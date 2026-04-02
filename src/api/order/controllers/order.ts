"use strict";

// @ts-ignore
const stripe = require("stripe")(process.env.STRIPE_KEY);
// @ts-ignore
const { MercadoPagoConfig, Preference } = require("mercadopago");

import { sendEmail } from "../helpers/send-email";
import {
  buildSalesEmailHtml,
  buildCustomerEmailHtml,
  type OrderEmailData,
} from "../helpers/email-templates";

import { factories } from "@strapi/strapi";

// Configurar Mercado Pago
const mpConfig = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

module.exports = factories.createCoreController(
  "api::order.order",
  ({ strapi }) => ({

    async create(ctx) {
      const { products } = ctx.request.body;

      if (!products || !Array.isArray(products) || products.length === 0) {
        ctx.response.status = 400;
        return { error: "Orden inválida: no hay productos" };
      }

      for (const product of products) {
        if (!product.id) {
          ctx.response.status = 400;
          return { error: "Producto inválido" };
        }
      }

      try {
        const lineItems = await Promise.all(
          products.map(async (product) => {
            const item = await strapi.entityService.findOne(
              "api::product.product",
              product.id,
              { fields: ["productName", "price"] },
            );

            return {
              price_data: {
                currency: "mxn",
                product_data: {
                  name: item.productName,
                },
                unit_amount: Math.round(item.price * 100),
              },
              quantity: 1,
            };
          }),
        );

        const session = await stripe.checkout.sessions.create({
          shipping_address_collection: { allowed_countries: ["MX"] },
          payment_method_types: ["card"],
          mode: "payment",
          success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`, // ✅ FIX
          cancel_url: `${process.env.CLIENT_URL}/carrito`,
          line_items: lineItems,
        });

        await strapi.service("api::order.order").create({
          data: { products, stripeId: session.id },
        });

        return { stripeSession: session };

      } catch (error) {
        console.error("🚨 Error en la orden:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },

    async confirmStripeSession(ctx) {
      try {
        const { session_id } = ctx.request.body;

        if (!session_id) {
          ctx.response.status = 400;
          return { error: "session_id es requerido" };
        }

        const fullSession = await stripe.checkout.sessions.retrieve(session_id);
        const lineItemsResponse =
          await stripe.checkout.sessions.listLineItems(session_id);

        if (fullSession.payment_status !== "paid") {
          return {
            success: false,
            message: "El pago aún no se ha completado",
          };
        }

        const customerEmail = fullSession.customer_details?.email;
        const customerName = fullSession.customer_details?.name || "Cliente";

        const shippingDetails =
          fullSession.shipping_details ||
          fullSession.shipping ||
          fullSession.collected_information?.shipping_details;

        const shippingAddress =
          shippingDetails?.address ||
          fullSession.customer_details?.address ||
          {};

        const parsedLineItems = (lineItemsResponse.data || []).map((item) => ({
          description: item.description || "Producto",
          quantity: item.quantity || 1,
          amount_total: item.amount_total || 0,
          currency: item.currency || "mxn",
        }));

        const emailData: OrderEmailData = {
          sessionId: fullSession.id,
          customerName,
          customerEmail: customerEmail || "",
          shippingName: shippingDetails?.name || customerName,
          shippingAddress: {
            line1: shippingAddress?.line1 || "",
            line2: shippingAddress?.line2 || "",
            city: shippingAddress?.city || "",
            state: shippingAddress?.state || "",
            postal_code: shippingAddress?.postal_code || "",
            country: shippingAddress?.country || "MX",
          },
          lineItems: parsedLineItems,
          totalAmount: fullSession.amount_total || 0,
          currency: fullSession.currency || "mxn",
        };

        console.log("📧 Iniciando envío de correos...");

        // 🔥 NO BLOQUEANTE
        console.log("➡️ Enviando email ventas...");
        sendEmail({
          to: "ventas@salmetexmed.com.mx",
          subject: `🛒 Nueva Venta - ${customerName} - ${new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
          }).format((fullSession.amount_total || 0) / 100)}`,
          html: buildSalesEmailHtml(emailData),
        })
          .then(() => console.log("✅ Email ventas enviado"))
          .catch((err) => console.error("❌ Error ventas:", err));

        // 🔥 NO BLOQUEANTE
        if (customerEmail) {
          console.log("➡️ Enviando email cliente...");
          sendEmail({
            to: customerEmail,
            subject: `✅ Confirmación de compra - SALMETEX MED`,
            html: buildCustomerEmailHtml(emailData),
          })
            .then(() => console.log("✅ Email cliente enviado"))
            .catch((err) => console.error("❌ Error cliente:", err));
        }

        // 👉 RESPUESTA INMEDIATA
        return {
          success: true,
          message: "Pago confirmado, procesando correos",
        };

      } catch (error) {
        console.error("🚨 Error confirmando sesión de Stripe:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },

    async createMercadoPagoPreference(ctx) {
      const { products, installments = 12 } = ctx.request.body;

      try {
        const items = await Promise.all(
          products.map(async (product) => {
            const item = await strapi.entityService.findOne(
              "api::product.product",
              product.id,
              { fields: ["productName", "price"] },
            );

            return {
              id: product.id,
              title: item.productName,
              quantity: 1,
              unit_price: item.price,
              currency_id: "MXN",
            };
          }),
        );

        const preference = new Preference(mpConfig);

        const response = await preference.create({
          body: {
            items,
            payer: {
              email: ctx.request.body.email || "test@test.com",
            },
            payment_methods: {
              default_installments: installments,
            },
            back_url: `${process.env.CLIENT_URL}/success`,
            notification_url: `${process.env.BACKEND_URL}/api/orders/notification`,
            external_reference: `order-${Date.now()}`,
          },
        });

        await strapi.service("api::order.order").create({
          data: {
            products,
            mercadoPagoId: response.id,
            installments,
          },
        });

        return {
          mercadoPagoPreference: {
            id: response.id,
            init_point: response.init_point,
          },
        };

      } catch (error) {
        console.error("🚨 Error Mercado Pago:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },

  }),
);

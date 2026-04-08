"use strict";

// @ts-ignore
const stripe = require("stripe")(process.env.STRIPE_KEY);
// @ts-ignore
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

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
      //@ts-ignore
      const { products } = ctx.request.body;

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
          success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_URL}/carrito`,
          line_items: lineItems,
        });

        await strapi
          .service("api::order.order")
          .create({ data: { products, stripeId: session.id } });

        return { stripeSession: session };
      } catch (error) {
        console.error("🚨 Error en la orden:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },

    async confirmStripeSession(ctx) {
      try {
        // @ts-ignore
        const { session_id } = ctx.request.body;

        if (!session_id) {
          ctx.response.status = 400;
          return { error: "session_id es requerido" };
        }

        const fullSession = await stripe.checkout.sessions.retrieve(session_id);
        const lineItemsResponse =
          await stripe.checkout.sessions.listLineItems(session_id);

        if (fullSession.payment_status !== "paid") {
          console.log("⚠️ Sesión no pagada:", fullSession.payment_status);
          return {
            success: false,
            message: "El pago aún no se ha completado",
            emailsSent: false,
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

        console.log("📧 Enviando correos Stripe...");
        console.log("   Cliente:", customerEmail);

        setImmediate(async () => {
          try {
            await strapi.service("plugin::email.email").send({
              to: "ventas@salmetexmed.com.mx",
              subject: `🛒 Nueva Venta - ${customerName} - ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format((fullSession.amount_total || 0) / 100)}`,
              html: buildSalesEmailHtml(emailData),
            });
            console.log("✅ Email de ventas Stripe enviado");
          } catch (e: any) {
            console.error("❌ Error email ventas Stripe:", e.message);
          }

          if (customerEmail) {
            try {
              await strapi.service("plugin::email.email").send({
                to: customerEmail,
                subject: `✅ Confirmación de compra - SALMETEX MED`,
                html: buildCustomerEmailHtml(emailData),
              });
              console.log("✅ Email cliente Stripe enviado:", customerEmail);
            } catch (e: any) {
              console.error("❌ Error email cliente Stripe:", e.message);
            }
          }
        });

        return {
          success: true,
          emailsQueued: true,
          customerName,
          customerEmail,
          shippingName: shippingDetails?.name || customerName,
          shippingAddress: shippingAddress || null,
          lineItems: parsedLineItems,
          totalAmount: fullSession.amount_total,
          currency: fullSession.currency,
        };
      } catch (error: any) {
        console.error("🚨 Error confirmando sesión de Stripe:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },

    async createMercadoPagoPreference(ctx) {
      // @ts-ignore
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
              id: String(product.id),
              title: item.productName,
              quantity: 1,
              unit_price: item.price,
              currency_id: "MXN",
            };
          }),
        );

        const preference = new Preference(mpConfig);

        const preferenceData = {
          items,
          payer: {
            email: ctx.request.body.email || "",
          },
          payment_methods: {
            default_installments: installments,
          },
          back_urls: {
            success: `${process.env.CLIENT_URL}/successMercado`,
            failure: `${process.env.CLIENT_URL}/carrito`,
            pending: `${process.env.CLIENT_URL}/success`,
          },
          auto_return: "approved",
          notification_url: `${process.env.BACKEND_URL}/api/orders/notification`,
          external_reference: `order-${Date.now()}`,
        };

        const response = await preference.create({ body: preferenceData });

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
        console.error("🚨 Error al crear preferencia de Mercado Pago:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },

    async confirmMercadoPago(ctx) {
      try {
        // @ts-ignore
        const { payment_id, status, lineItems, totalAmount } = ctx.request.body;

        if (!payment_id) {
          ctx.response.status = 400;
          return { error: "payment_id es requerido" };
        }

        if (status !== "approved") {
          return { success: false, message: "El pago no está aprobado" };
        }

        // Consultar pago real en MP (funciona en producción)
        const paymentClient = new Payment(mpConfig);
        let customerName = "Cliente";
        let customerEmail = "";
        let mpLineItems = lineItems || [];
        let mpTotalAmount = totalAmount || 0;

        try {
          const payment = await paymentClient.get({ id: payment_id });
          customerName = payment.payer?.first_name
            ? `${payment.payer.first_name} ${payment.payer.last_name || ""}`.trim()
            : "Cliente";
          customerEmail = payment.payer?.email || "";
          mpTotalAmount = Math.round((payment.transaction_amount || 0) * 100);

          if (payment.additional_info?.items?.length > 0) {
            mpLineItems = payment.additional_info.items.map((item: any) => ({
              description: item.title || "Producto",
              quantity: Number(item.quantity) || 1,
              amount_total: Math.round((item.unit_price || 0) * 100),
              currency: "mxn",
            }));
          }
        } catch (mpError: any) {
          // Si falla la consulta (sandbox), usar datos del frontend
          console.warn("⚠️ No se pudo consultar MP API, usando datos del frontend:", mpError.message);
        }

        const emailData: OrderEmailData = {
          sessionId: String(payment_id),
          customerName,
          customerEmail,
          shippingName: customerName,
          shippingAddress: {
            line1: "",
            line2: "",
            city: "",
            state: "",
            postal_code: "",
            country: "MX",
          },
          lineItems: mpLineItems,
          totalAmount: mpTotalAmount,
          currency: "mxn",
        };

        console.log("📧 Enviando correos MP...");
        console.log("   Cliente:", customerEmail);

        setImmediate(async () => {
          try {
            await strapi.service("plugin::email.email").send({
              to: "ventas@salmetexmed.com.mx",
              subject: `🛒 Nueva Venta MP - ${customerName} - ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(mpTotalAmount / 100)}`,
              html: buildSalesEmailHtml(emailData),
            });
            console.log("✅ Email de ventas MP enviado");
          } catch (e: any) {
            console.error("❌ Error email ventas MP:", e.message);
          }

          if (customerEmail) {
            try {
              await strapi.service("plugin::email.email").send({
                to: customerEmail,
                subject: `✅ Confirmación de compra - SALMETEX MED`,
                html: buildCustomerEmailHtml(emailData),
              });
              console.log("✅ Email cliente MP enviado:", customerEmail);
            } catch (e: any) {
              console.error("❌ Error email cliente MP:", e.message);
            }
          }
        });

        return {
          success: true,
          emailsQueued: true,
          customerName,
          customerEmail,
          lineItems: mpLineItems,
          totalAmount: mpTotalAmount,
          currency: "mxn",
        };
      } catch (error: any) {
        console.error("🚨 Error confirmando pago MP:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },
  }),
);

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

/**
 * order controller
 */

// export default factories.createCoreController('api::order.order');

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
            // console.log("Producto recibido:", product);
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
          success_url: `${process.env.CLIENT_URL}success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_URL}carrito`,
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

    /**
     * Confirmar sesión de Stripe y enviar correos
     * Se llama desde la página de éxito con el session_id
     */
    async confirmStripeSession(ctx) {
      try {
        // @ts-ignore
        const { session_id } = ctx.request.body;

        if (!session_id) {
          ctx.response.status = 400;
          return { error: "session_id es requerido" };
        }

        // console.log("📩 Confirmando sesión de Stripe:", session_id);

        // Recuperar la sesión completa
        const fullSession = await stripe.checkout.sessions.retrieve(session_id);

        // Recuperar line items por separado (más confiable)
        const lineItemsResponse =
          await stripe.checkout.sessions.listLineItems(session_id);

        // Verificar que el pago fue exitoso
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

        // Stripe puede guardar la dirección de envío en diferentes campos según la versión del API
        const shippingDetails =
          fullSession.shipping_details ||
          fullSession.shipping ||
          fullSession.collected_information?.shipping_details;

        const shippingAddress =
          shippingDetails?.address ||
          fullSession.customer_details?.address ||
          {};

        // Debug: ver qué datos devuelve Stripe
        // console.log("📋 Datos de sesión Stripe:");
        // console.log("   customer_details:", JSON.stringify(fullSession.customer_details, null, 2));
        // console.log("   shipping_details:", JSON.stringify(fullSession.shipping_details, null, 2));
        // console.log("   shipping:", JSON.stringify(fullSession.shipping, null, 2));
        // console.log("   collected_information:", JSON.stringify(fullSession.collected_information, null, 2));
        // console.log("   line_items:", JSON.stringify(lineItemsResponse.data, null, 2));

        const parsedLineItems = (lineItemsResponse.data || []).map((item) => ({
          description: item.description || "Producto",
          quantity: item.quantity || 1,
          amount_total: item.amount_total || 0,
          currency: item.currency || "mxn",
        }));

        // Construir datos del email
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

        const emailResults = {
          ventas: { sent: false, error: null as string | null },
          cliente: {
            sent: false,
            email: customerEmail || "",
            error: null as string | null,
          },
        };

        console.log("📧 Enviando correos de confirmación...");
        console.log("   Cliente:", customerEmail);
        console.log("   Ventas: ventas@salmetexmed.com.mx");

        // Enviar email al equipo de ventas
        try {
          await sendEmail({
            to: "ventas@salmetexmed.com.mx",
            subject: `🛒 Nueva Venta - ${customerName} - ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format((fullSession.amount_total || 0) / 100)}`,
            html: buildSalesEmailHtml(emailData),
          });
          emailResults.ventas.sent = true;
          console.log("✅ Email enviado a ventas@salmetexmed.com.mx");
        } catch (emailError: any) {
          emailResults.ventas.error = emailError.message;
          console.error("❌ Error enviando email a ventas:", emailError);
        }

        // Enviar email al cliente
        if (customerEmail) {
          try {
            await sendEmail({
              to: customerEmail,
              subject: `✅ Confirmación de compra - SALMETEX MED`,
              html: buildCustomerEmailHtml(emailData),
            });
            emailResults.cliente.sent = true;
            console.log(
              "✅ Email de confirmación enviado al cliente:",
              customerEmail,
            );
          } catch (emailError: any) {
            emailResults.cliente.error = emailError.message;
            console.error("❌ Error enviando email al cliente:", emailError);
          }
        }

        return {
          success: true,
          emailsSent: emailResults.ventas.sent || emailResults.cliente.sent,
          emailResults,
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
        // Obtener detalles de los productos
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

        // Calcular total
        const totalAmount = items.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        );

        // Crear preferencia de Mercado Pago
        const preference = new Preference(mpConfig);

        const preferenceData = {
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
        };

        const response = await preference.create({ body: preferenceData });

        // Guardar la orden con referencia a Mercado Pago
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
  }),
);

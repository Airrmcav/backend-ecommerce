/**
 * order controller
 */

import { factories } from "@strapi/strapi";
// @ts-ignore
import Stripe from "stripe";
// @ts-ignore
import { MercadoPagoConfig, Preference } from "mercadopago";
import {
  buildSalesEmailHtml,
  buildCustomerEmailHtml,
  type OrderEmailData,
} from "../helpers/email-templates";

// Configurar Stripe (sin apiVersion explícito para evitar conflictos)
const stripeClient = new Stripe.Stripe(process.env.STRIPE_KEY as string);

// Configurar Mercado Pago
const mpConfig = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN as string,
});

export default factories.createCoreController(
  "api::order.order",
  ({ strapi }) => ({
    /**
     * Crear sesión de Stripe Checkout
     */
    async create(ctx) {
      const { products } = ctx.request.body as { products: any[] };

      try {
        const lineItems = await Promise.all(
          products.map(async (product: any) => {
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

        const session = await stripeClient.checkout.sessions.create({
          shipping_address_collection: { allowed_countries: ["MX"] },
          payment_method_types: ["card"],
          mode: "payment",
          success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_URL}/carrito`,
          line_items: lineItems,
        });

        const totalAmount = lineItems.reduce(
          (sum: number, item: any) =>
            sum + (item.price_data.unit_amount * item.quantity) / 100,
          0,
        );

        await strapi.service("api::order.order").create({
          data: {
            products,
            stripeId: session.id,
            paymentMethod: "stripe",
            status: "pending",
            totalAmount,
            currency: "mxn",
          },
        } as any);

        return { stripeSession: session };
      } catch (error: any) {
        console.error("🚨 Error en la orden:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },

    /**
     * Confirmar sesión de Stripe y actualizar orden con datos del cliente
     */
    async confirmStripeSession(ctx) {
      try {
        const { session_id } = ctx.request.body as { session_id: string };

        if (!session_id) {
          ctx.response.status = 400;
          return { error: "session_id es requerido" };
        }

        const fullSession =
          await stripeClient.checkout.sessions.retrieve(session_id);
        const lineItemsResponse =
          await stripeClient.checkout.sessions.listLineItems(session_id);

        if (fullSession.payment_status !== "paid") {
          return {
            success: false,
            message: "El pago aún no se ha completado",
            emailsSent: false,
          };
        }

        const customerEmail = fullSession.customer_details?.email;
        const customerName = fullSession.customer_details?.name || "Cliente";

        const fullSessionAny = fullSession as any;
        const shippingDetails =
          fullSessionAny.shipping_details || fullSessionAny.shipping;
        const shippingAddressRaw =
          shippingDetails?.address ||
          fullSession.customer_details?.address ||
          {};

        const addressForDB = {
          line1: shippingAddressRaw.line1 || "",
          line2: shippingAddressRaw.line2 || "",
          city: shippingAddressRaw.city || "",
          state: shippingAddressRaw.state || "",
          postal_code: shippingAddressRaw.postal_code || "",
          country: shippingAddressRaw.country || "MX",
        };

        const parsedLineItems = (lineItemsResponse.data || []).map(
          (item: any) => ({
            description: item.description || "Producto",
            quantity: item.quantity || 1,
            amount_total: item.amount_total || 0,
            currency: item.currency || "mxn",
          }),
        );

        const existingOrder = await strapi.db
          .query("api::order.order")
          .findOne({
            where: { stripeId: session_id },
          });

        if (existingOrder) {
          await strapi.service("api::order.order").update(existingOrder.id, {
            data: {
              customerEmail: customerEmail || "",
              customerName,
              shippingAddress: addressForDB,
              status: "paid",
            },
          } as any);
        }

        const emailData: OrderEmailData = {
          sessionId: fullSession.id,
          customerName,
          customerEmail: customerEmail || "",
          shippingName: shippingDetails?.name || customerName,
          shippingAddress: addressForDB,
          lineItems: parsedLineItems,
          totalAmount: fullSession.amount_total || 0,
          currency: fullSession.currency || "mxn",
        };

        setImmediate(async () => {
          try {
            await strapi.service("plugin::email.email").send({
              to: "ventas@salmetexmed.com.mx",
              subject: `🛒 Nueva Venta - ${customerName} - ${new Intl.NumberFormat(
                "es-MX",
                {
                  style: "currency",
                  currency: "MXN",
                },
              ).format((fullSession.amount_total || 0) / 100)}`,
              html: buildSalesEmailHtml(emailData),
            });
            if (customerEmail) {
              await strapi.service("plugin::email.email").send({
                to: customerEmail,
                subject: `✅ Confirmación de compra - SALMETEX MED`,
                html: buildCustomerEmailHtml(emailData),
              });
            }
          } catch (e: any) {
            console.error("Error enviando correos:", e.message);
          }
        });

        return {
          success: true,
          emailsQueued: true,
          customerName,
          customerEmail,
          shippingName: shippingDetails?.name || customerName,
          shippingAddress: addressForDB,
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

    /**
     * Crear preferencia de Mercado Pago
     */
    async createMercadoPagoPreference(ctx) {
      const {
        products,
        installments = 12,
        shippingAddress,
        customerEmail,
        customerName,
      } = ctx.request.body as {
        products: any[];
        installments?: number;
        shippingAddress: any;
        customerEmail?: string;
        customerName?: string;
      };

      if (
        !shippingAddress ||
        !shippingAddress.line1 ||
        !shippingAddress.city ||
        !shippingAddress.postal_code
      ) {
        ctx.response.status = 400;
        return {
          error:
            "La dirección de envío es obligatoria (calle, ciudad y código postal).",
        };
      }

      try {
        const items = await Promise.all(
          products.map(async (product: any) => {
            const item = await strapi.entityService.findOne(
              "api::product.product",
              product.id,
              {
                fields: ["productName", "price"],
              },
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

        const totalAmount = items.reduce(
          (sum: number, item: any) => sum + item.unit_price * item.quantity,
          0,
        );

        const newOrder = await strapi.service("api::order.order").create({
          data: {
            products: items,
            installments,
            shippingAddress,
            customerEmail: customerEmail || null,
            customerName: customerName || "Cliente",
            status: "pending",
            paymentMethod: "mercadopago",
            totalAmount,
            currency: "MXN",
            mercadoPagoId: null,
          },
        } as any);

        const preference = new Preference(mpConfig);

        const isSandbox =
          process.env.MERCADO_PAGO_ACCESS_TOKEN?.startsWith("TEST-");

        const preferenceData = {
          items,
          auto_return: "approved",
          payer: {
            email: customerEmail || "test_user_123456@testuser.com",
            name: customerName || "Cliente",
            address: {
              zip_code: shippingAddress.postal_code,
              street_name: shippingAddress.line1,
              street_number: shippingAddress.line2 || "",
              city_name: shippingAddress.city,
              state_name: shippingAddress.state,
              country_name: shippingAddress.country || "MX",
            },
          },
          shipments: {
            receiver_address: {
              zip_code: shippingAddress.postal_code,
              street_name: shippingAddress.line1,
              street_number: shippingAddress.line2 || "",
              city_name: shippingAddress.city,
              state_name: shippingAddress.state,
              country_name: shippingAddress.country || "MX",
              apartment: shippingAddress.apartment || "",
            },
          },
          back_urls: {
            success: `${process.env.CLIENT_URL}/successMercado`,
            failure: `${process.env.CLIENT_URL}/carrito`,
            pending: `${process.env.CLIENT_URL}/success`,
          },
          external_reference: newOrder.id.toString(),
          notification_url: `${process.env.BACKEND_URL}/api/order/mercadopago-webhook`,
        };

        const response = await preference.create({ body: preferenceData });

        await strapi.service("api::order.order").update(newOrder.id, {
          data: { mercadoPagoId: response.id },
        } as any);

        // 👇 Esto es lo clave
        return {
          mercadoPagoPreference: {
            id: response.id,
            init_point: isSandbox
              ? response.sandbox_init_point
              : response.init_point,
          },
        };

        await strapi.service("api::order.order").update(newOrder.id, {
          data: { mercadoPagoId: response.id },
        } as any);

        return {
          mercadoPagoPreference: {
            id: response.id,
            init_point: response.init_point,
          },
        };
      } catch (error: any) {
        console.error("🚨 Error al crear preferencia de Mercado Pago:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },

    /**
     * Confirmar pago de Mercado Pago
     */
    async confirmMercadoPago(ctx) {
      
      try {
        const { payment_id, status, external_reference } = ctx.request.body as {
          payment_id: string;
          status: string;
          external_reference: string;
        };

        if (!payment_id) {
          ctx.response.status = 400;
          return { error: "payment_id es requerido" };
        }

        if (status !== "approved") {
          return { success: false, message: "El pago no está aprobado" };
        }

        const orderId = parseInt(external_reference, 10);

        if (!orderId || isNaN(orderId)) {
          ctx.response.status = 400;
          return { error: "external_reference inválido" };
        }

        const order = await strapi.entityService.findOne(
          "api::order.order",
          orderId,
          {
            fields: [
              "shippingAddress",
              "customerName",
              "customerEmail",
              "totalAmount",
              "products",
              "status", 
            ],
          },
        );

        if (!order) {
          return { success: false, message: "Orden no encontrada" };
        }

        /**
         * 🔥 IDPOTENCIA: si ya está pagada, NO volver a procesar
         */
        if (order.status === "paid") {
          return {
            success: true,
            message: "Orden ya procesada",
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            shippingAddress: order.shippingAddress,
            totalAmount: (order.totalAmount as number) * 100,
            currency: "mxn",
            lineItems: (order.products as any[]).map((p: any) => ({
              description: p.title || "Producto",
              quantity: p.quantity || 1,
              amount_total: (p.unit_price || 0) * 100,
              currency: "MXN",
            })),
          };
        }

        /**
         * ✅ Marcar como pagado
         */
        await strapi.service("api::order.order").update(orderId, {
          data: { status: "paid" },
        } as any);

        const shippingAddressForEmail = (order.shippingAddress as any) || {
          line1: "",
          line2: "",
          city: "",
          state: "",
          postal_code: "",
          country: "MX",
        };

        const emailData: OrderEmailData = {
          sessionId: String(payment_id),
          customerName: order.customerName || "Cliente",
          customerEmail: order.customerEmail || "",
          shippingName: order.customerName || "Cliente",
          shippingAddress: shippingAddressForEmail,
          lineItems: (order.products as any[]).map((p: any) => ({
            description: p.title || "Producto",
            quantity: p.quantity || 1,
            amount_total: (p.unit_price || 0) * 100,
            currency: "MXN",
          })),
          totalAmount: (order.totalAmount as number) * 100,
          currency: "mxn",
        };

        /**
         * 📧 Enviar correos SOLO UNA VEZ
         */
        setImmediate(async () => {
          try {
            await strapi.service("plugin::email.email").send({
              to: "ventas@salmetexmed.com.mx",
              subject: `🛒 Nueva Venta MP - ${order.customerName} - $${order.totalAmount} MXN`,
              html: buildSalesEmailHtml(emailData),
            });

            if (order.customerEmail) {
              await strapi.service("plugin::email.email").send({
                to: order.customerEmail,
                subject: `✅ Confirmación de compra - SALMETEXMED`,
                html: buildCustomerEmailHtml(emailData),
              });
            }
          } catch (e: any) {
            console.error("Error enviando correos MP:", e.message);
          }
        });

        return {
          success: true,
          emailsQueued: true,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          shippingAddress: order.shippingAddress,
          totalAmount: (order.totalAmount as number) * 100,
          currency: "mxn",
          lineItems: (order.products as any[]).map((p: any) => ({
            description: p.title || "Producto",
            quantity: p.quantity || 1,
            amount_total: (p.unit_price || 0) * 100,
            currency: "MXN",
          })),
        };
      } catch (error: any) {
        console.error("🚨 Error confirmando pago MP:", error);
        ctx.response.status = 500;
        return { error: error.message };
      }
    },
    
  }),
);

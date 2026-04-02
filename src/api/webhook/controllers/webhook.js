'use strict';

const stripe = require("stripe")(process.env.STRIPE_KEY);

// Importamos tus helpers de correo (Ajusta las rutas si es necesario)
// Nota: Strapi v4 usa rutas relativas desde el archivo del controlador
const { sendEmail } = require("../../order/helpers/send-email");
const {
  buildSalesEmailHtml,
  buildCustomerEmailHtml,
} = require("../../order/helpers/email-templates");

module.exports = {
  async stripeWebhook(ctx) {
    const sig = ctx.request.headers['stripe-signature'];
    const unparsedBody = ctx.request.body[Symbol.for('unparsedBody')];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        unparsedBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Error de firma en Webhook:", err.message);
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    // 🎯 Evento: El pago se completó con éxito
    if (event.type === 'checkout.session.completed') {
      const fullSession = event.data.object;
      const sessionId = fullSession.id;

      console.log("💰 Procesando pago exitoso vía Webhook:", sessionId);

      try {
        // 1. Recuperar line items (tal como lo hacías en order.ts)
        const lineItemsResponse = await stripe.checkout.sessions.listLineItems(sessionId);

        const customerEmail = fullSession.customer_details?.email;
        const customerName = fullSession.customer_details?.name || "Cliente";

        const shippingDetails = fullSession.shipping_details || fullSession.shipping || {};
        const shippingAddress = shippingDetails.address || {};

        const parsedLineItems = (lineItemsResponse.data || []).map((item) => ({
          description: item.description || "Producto",
          quantity: item.quantity || 1,
          amount_total: item.amount_total || 0,
          currency: item.currency || "mxn",
        }));

        // 2. Construir datos del email
        const emailData = {
          sessionId: sessionId,
          customerName,
          customerEmail: customerEmail || "",
          shippingName: shippingDetails.name || customerName,
          shippingAddress: {
            line1: shippingAddress.line1 || "",
            line2: shippingAddress.line2 || "",
            city: shippingAddress.city || "",
            state: shippingAddress.state || "",
            postal_code: shippingAddress.postal_code || "",
            country: shippingAddress.country || "MX",
          },
          lineItems: parsedLineItems,
          totalAmount: fullSession.amount_total || 0,
          currency: fullSession.currency || "mxn",
        };

        // 3. Enviar email al equipo de ventas
        await sendEmail({
          to: "ventas@salmetexmed.com.mx",
          subject: `🛒 Nueva Venta Webhook - ${customerName} - ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format((fullSession.amount_total || 0) / 100)}`,
          html: buildSalesEmailHtml(emailData),
        });
        console.log("✅ Email enviado a ventas@salmetexmed.com.mx");

        // 4. Enviar email al cliente
        if (customerEmail) {
          await sendEmail({
            to: customerEmail,
            subject: `✅ Confirmación de compra - SALMETEX MED`,
            html: buildCustomerEmailHtml(emailData),
          });
          console.log("✅ Email de confirmación enviado al cliente:", customerEmail);
        }

        // 5. (Opcional) Actualizar estado en tu base de datos si fuera necesario
        // await strapi.db.query('api::order.order').update({
        //   where: { stripeId: sessionId },
        //   data: { status: 'paid' },
        // });

      } catch (processError) {
        console.error("🚨 Error procesando lógica interna del webhook:", processError);
        // No devolvemos error a Stripe aquí para evitar que reintente infinitamente si es error de mail
      }
    }

    ctx.send({ received: true });
  },
};
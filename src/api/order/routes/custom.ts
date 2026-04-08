/**
 * order custom routes - Mercado Pago & Stripe Confirm
 */

export default [
  {
    method: "POST",
    path: "/mercado-pago/preference",
    handler: "api::order.order.createMercadoPagoPreference",
    config: { auth: false },
  },
  {
    method: "POST",
    path: "/stripe/confirm-session",
    handler: "api::order.order.confirmStripeSession",
    config: { auth: false },
  },
  {
  method: "POST",
  path: "/orders/confirm-mercadopago",
  handler: "api::order.order.confirmMercadoPago",
  config: { auth: false },
},
];

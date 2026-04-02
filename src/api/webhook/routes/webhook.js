module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/webhook/stripe', // Esta será tu URL: dominio.com/api/webhook/stripe
      handler: 'webhook.stripeWebhook',
      config: {
        auth: false, // Permitimos que Stripe acceda sin token de usuario
      },
    },
  ],
};
module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.titan.email'),
        port: env.int('SMTP_PORT', 587),
        auth: {
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        },
        secure: true, // Titan usa SSL en el puerto 465
      },
      settings: {
        defaultFrom: env('SMTP_FROM'),
        defaultReplyTo: env('SMTP_FROM'),
      },
    },
  },
});

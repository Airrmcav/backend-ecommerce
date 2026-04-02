export default ({ env }) => ({
  // --- Tu configuración de Cloudinary (Ya la tienes) ---
  upload: {
    config: {
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_NAME'),
        api_key: env('CLOUDINARY_KEY'),
        api_secret: env('CLOUDINARY_SECRET'),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },

  // --- NUEVA CONFIGURACIÓN DE EMAIL (Agrega esto) ---
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.titan.email'),
        port: env.int('SMTP_PORT', 465),
        auth: {
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        },
        secure: true, // Forzamos true porque Titan usa SSL en el 465
      },
      settings: {
        defaultFrom: env('SMTP_FROM'),
        defaultReplyTo: env('SMTP_FROM'),
      },
    },
  },
});

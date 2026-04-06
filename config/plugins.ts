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
  email: {
    config: {
      provider: '@strapi/provider-email-resend',
      providerOptions: {
        apiKey: env('RESEND_API_KEY'),
      },
      settings: {
        defaultFrom: env('RESEND_FROM_EMAIL', 'noreply@salmetexmed.com.mx'),
        defaultReplyTo: env('RESEND_REPLY_TO', 'noreply@salmetexmed.com.mx'),
      },
    },
  },
});
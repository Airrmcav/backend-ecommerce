module.exports = [
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      headers: '*',
      origin: ['*']
    }
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      includeUnparsed: true,
    },
  },
  // 👆 ---------------------------------------
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
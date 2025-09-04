'use strict';

module.exports = (plugin) => {
  // Asegurarse de que el proveedor de Cloudinary se use en producción
  const settings = {
    provider: 'cloudinary',
    providerOptions: {
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_KEY,
      api_secret: process.env.CLOUDINARY_SECRET,
    },
    actionOptions: {
      upload: {},
      uploadStream: {},
      delete: {},
    },
  };

  // Sobrescribir la configuración del proveedor
  plugin.services['upload'] = {
    ...plugin.services['upload'],
    getSettings() {
      return settings;
    },
  };

  // Asegurarse de que las imágenes se guarden permanentemente
  plugin.services['image-manipulation'] = {
    ...plugin.services['image-manipulation'],
    async optimize(buffer) {
      // Devolver el buffer original sin modificar para evitar pérdida de datos
      return buffer;
    },
  };

  return plugin;
};
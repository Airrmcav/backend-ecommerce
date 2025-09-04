'use strict';

module.exports = (plugin) => {
  // Modificar la configuración para permitir acceso en producción
  plugin.controllers.components.getComponents = async (ctx) => {
    // Permitir acceso sin restricciones
    const components = await strapi.components;
    ctx.body = { data: components };
  };

  plugin.controllers.contentTypes.getContentTypes = async (ctx) => {
    // Permitir acceso sin restricciones
    const contentTypes = await strapi.contentTypes;
    ctx.body = { data: contentTypes };
  };

  plugin.controllers.contentTypes.getContentType = async (ctx) => {
    // Permitir acceso sin restricciones
    const { uid } = ctx.params;
    const contentType = strapi.contentTypes[uid];
    
    if (!contentType) {
      return ctx.notFound('contentType.notFound');
    }

    ctx.body = {
      data: contentType,
    };
  };

  return plugin;
};
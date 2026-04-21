import type { Schema, Struct } from '@strapi/strapi';

export interface ProductProductVariant extends Struct.ComponentSchema {
  collectionName: 'components_product_product_variants';
  info: {
    displayName: 'product.variant';
  };
  attributes: {
    isDefault: Schema.Attribute.Boolean;
    name: Schema.Attribute.String;
    price: Schema.Attribute.Decimal;
    stock: Schema.Attribute.Integer;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'product.product-variant': ProductProductVariant;
    }
  }
}

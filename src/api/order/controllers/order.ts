'use strict';


// @ts-ignore
const stripe = require("stripe")(process.env.STRIPE_KEY);
/**
 * order controller
 */

// export default factories.createCoreController('api::order.order');

import { factories } from '@strapi/strapi'

module.exports = factories.createCoreController("api::order.order", ({ strapi }) => ({
    async create(ctx) {
        //@ts-ignore
        const { products } = ctx.request.body;

        try {
            const lineItems = await Promise.all(
                products.map(async (product) => {
                    // console.log("Producto recibido:", product);
                    const item = await strapi.entityService.findOne(
                        "api::product.product",
                        product.id,
                        { fields: ["productName", "price"] }
                    );
                    return {
                        price_data: {
                            currency: "mxn", 
                            product_data: {
                                name: item.productName,
                            },
                            unit_amount: Math.round(item.price * 100),
                        },
                        quantity: 1,
                    }
                })
            );

            const session = await stripe.checkout.sessions.create({
                shipping_address_collection: { allowed_countries: ["MX"] },
                payment_method_types: ["card"],
                mode: "payment",
                success_url: `${process.env.CLIENT_URL}/success`,
                cancel_url: `${process.env.CLIENT_URL}/error`,
                line_items: lineItems, 
            });

            await strapi.service("api::order.order")
            .create({ data: { products, stripeId: session.id },
            });

            return { stripeSession: session };
        } catch (error) {
            console.error("🚨 Error en la orden:", error);
            ctx.response.status = 500;
            return { error: error.message };
        }
    },
}));

import Stripe from 'stripe';
import type { Context } from '../context.js';

export interface StripeConfig {
  apiKey: string;
  webhookSecret?: string;
  currency?: string;
}

export function stripePlugin(config: StripeConfig) {
  const stripe = new Stripe(config.apiKey, {
    apiVersion: '2025-10-29.clover',
  });

  return async (ctx: Context, next: () => Promise<any>) => {
    ctx.stripe = {
      createPaymentIntent: async (amount: number, currency?: string) => {
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: currency || config.currency || 'usd',
            automatic_payment_methods: {
              enabled: true,
            },
          });
          return { success: true, clientSecret: paymentIntent.client_secret, id: paymentIntent.id };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },

      confirmPaymentIntent: async (id: string, paymentMethod: string) => {
        try {
          const paymentIntent = await stripe.paymentIntents.confirm(id, {
            payment_method: paymentMethod,
          });
          return { success: true, status: paymentIntent.status, id: paymentIntent.id };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },

      createCustomer: async (email: string, name?: string) => {
        try {
          const customer = await stripe.customers.create({
            email,
            name,
          });
          return { success: true, customer };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },
    };
    await next();
  };
}
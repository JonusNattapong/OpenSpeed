import twilio from 'twilio';
import type { Context } from '../context.js';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export function twilioPlugin(config: TwilioConfig) {
  const client = twilio(config.accountSid, config.authToken);

  return async (ctx: Context, next: () => Promise<any>) => {
    ctx.twilio = {
      sendSMS: async (to: string, message: string) => {
        try {
          const result = await client.messages.create({
            body: message,
            from: config.phoneNumber,
            to,
          });
          return { success: true, sid: result.sid };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },

      makeCall: async (to: string, twimlUrl: string) => {
        try {
          const call = await client.calls.create({
            url: twimlUrl,
            to,
            from: config.phoneNumber,
          });
          return { success: true, sid: call.sid };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },

      sendWhatsApp: async (to: string, message: string) => {
        try {
          const result = await client.messages.create({
            body: message,
            from: `whatsapp:${config.phoneNumber}`,
            to: `whatsapp:${to}`,
          });
          return { success: true, sid: result.sid };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },
    };
    await next();
  };
}
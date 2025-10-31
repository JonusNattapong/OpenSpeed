import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import type { Context } from '../context.js';

export interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'smtp';
  apiKey?: string; // For SendGrid
  domain?: string; // For Mailgun
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
}

export function emailPlugin(config: EmailConfig) {
  let transporter: any;

  if (config.provider === 'sendgrid' && config.apiKey) {
    sgMail.setApiKey(config.apiKey);
  } else if (config.provider === 'smtp' && config.smtp) {
    transporter = nodemailer.createTransport(config.smtp);
  }

  return async (ctx: Context, next: () => Promise<any>) => {
    // This is a middleware that adds email methods to context
    ctx.email = {
      send: async (options: { to: string; subject: string; text?: string; html?: string }) => {
        if (config.provider === 'sendgrid') {
          const msg: any = {
            to: options.to,
            from: config.from,
            subject: options.subject,
            text: options.text,
            html: options.html,
          };
          return await sgMail.send(msg);
        } else if (config.provider === 'smtp') {
          const mailOptions = {
            from: config.from,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
          };
          return await transporter.sendMail(mailOptions);
        }
      }
    };
    await next();
  };
}
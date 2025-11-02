/**
 * Minimal ambient type declarations to reduce diagnostics errors
 * - Place this file at OpenSpeed/types/custom.d.ts
 *
 * These declarations intentionally keep types broad (any) to avoid
 * blocking builds while still providing basic typings for commonly
 * used modules that may lack @types in this workspace.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'jsonwebtoken' {
  export function sign(
    payload: any,
    secretOrPrivateKey: string,
    options?: any
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string,
    options?: any
  ): any;

  export function decode(token: string, options?: any): any;

  export const JsonWebTokenError: any;
  export const NotBeforeError: any;
  export const TokenExpiredError: any;
}

declare module 'bcryptjs' {
  export function hash(s: string, salt: number | string): Promise<string> | string;
  export function compare(s: string, hash: string): Promise<boolean> | boolean;
  export function genSaltSync(rounds?: number): string;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(s: string, salt: number | string): string;
  export function compareSync(s: string, hash: string): boolean;
  export default {
    hash: typeof hash,
    compare: typeof compare,
    genSalt: typeof genSalt,
    genSaltSync: typeof genSaltSync,
    hashSync: typeof hashSync,
    compareSync: typeof compareSync,
  };
}

declare module 'ioredis' {
  // Provide a minimal Redis class API used in the project
  class Redis {
    constructor(uri?: string, opts?: any);
    on(event: string, listener: (...args: any[]) => void): this;
    connect(): Promise<void>;
    quit(): Promise<void>;
    // Hash helpers
    hgetall(key: string): Promise<Record<string, string | undefined>>;
    hmset(key: string, data: Record<string, string>): Promise<'OK' | void>;
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string): Promise<number>;
    // Key helpers
    expire(key: string, seconds: number): Promise<number>;
    del(key: string): Promise<number>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null>;
    // Generic send command
    send_command(command: string, args?: any[]): Promise<any>;
  }

  export = Redis;
}

declare module 'nodemailer' {
  export interface SendMailOptions {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    [key: string]: any;
  }

  export interface SentMessageInfo {
    messageId?: string;
    envelope?: any;
    accepted?: string[];
    rejected?: string[];
    pending?: string[];
    response?: string;
    [key: string]: any;
  }

  export interface Transporter {
    sendMail(mail: SendMailOptions): Promise<SentMessageInfo>;
    verify?(cb?: (err: Error | null, success: boolean) => void): Promise<boolean> | void;
    close?(): void;
  }

  export function createTransport(options?: any): Transporter;
  const nodemailer: {
    createTransport(options?: any): Transporter;
  };
  export default nodemailer;
}

/**
 * Provide a small fallback for modules that sometimes lack types in the environment
 * - Prevents TS from complaining across the repo for quick iteration.
 */

/* Global additions used by the codebase */
declare global {
  // Security event counter used in several modules (in-memory fallback)
  var securityEventCounts: Map<string, number> | undefined;

  interface Global {}
}

// Ensure this file is treated as a module.
export {};

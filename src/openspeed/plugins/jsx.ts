/**
 * JSX/HTML Rendering Plugin for OpenSpeed
 * Provides JSX and HTML templating support similar to Hono
 */

import type { Context } from '../context.js';

// JSX Runtime Configuration
export interface JSXOptions {
  pretty?: boolean;
  doctype?: boolean;
  fragmentTag?: string;
}

// JSX Element Types
export type JSXChild = string | number | boolean | null | undefined | JSXElement | JSXChild[];

export interface JSXElement {
  type: string | Function;
  props: Record<string, any>;
  children: JSXChild[];
}

// JSX Factory Functions
export namespace JSX {
  export interface Element extends JSXElement {}
  export interface IntrinsicElements {
    [elemName: string]: any;
  }
}

/**
 * JSX Factory - creates JSX elements
 */
export function jsx(
  type: string | Function,
  props: Record<string, any> | null,
  ...children: JSXChild[]
): JSXElement {
  const { children: propsChildren, ...restProps } = props || {};
  const allChildren = propsChildren ? [propsChildren, ...children] : children;

  return {
    type,
    props: restProps || {},
    children: allChildren.flat(),
  };
}

/**
 * Fragment component for grouping elements
 */
export function Fragment({ children }: { children: JSXChild[] }): JSXElement {
  return {
    type: 'fragment',
    props: {},
    children: Array.isArray(children) ? children : [children],
  };
}

/**
 * Render JSX to HTML string
 */
export function renderToString(element: JSXChild, options: JSXOptions = {}): string {
  const { pretty = false, doctype = false } = options;

  let html = doctype ? '<!DOCTYPE html>\n' : '';
  html += renderElement(element, 0, pretty);

  return html;
}

/**
 * Render individual element
 */
function renderElement(element: JSXChild, depth: number, pretty: boolean): string {
  // Handle null, undefined, boolean
  if (element == null || typeof element === 'boolean') {
    return '';
  }

  // Handle primitives (string, number)
  if (typeof element === 'string' || typeof element === 'number') {
    return escapeHtml(String(element));
  }

  // Handle arrays
  if (Array.isArray(element)) {
    return element.map(child => renderElement(child, depth, pretty)).join('');
  }

  // Handle JSX elements
  const jsxElement = element as JSXElement;

  // SECURITY: Handle raw HTML (bypasses escaping - XSS risk!)
  if (jsxElement.type === 'raw' && jsxElement.props.__html) {
    console.warn('[SECURITY WARNING] Using raw HTML - ensure content is trusted and sanitized!');
    return jsxElement.props.__html;
  }

  // Handle fragments
  if (jsxElement.type === 'fragment' || jsxElement.type === Fragment) {
    return jsxElement.children
      .map(child => renderElement(child, depth, pretty))
      .join('');
  }

  // Handle function components
  if (typeof jsxElement.type === 'function') {
    const Component = jsxElement.type;
    const result = Component({ ...jsxElement.props, children: jsxElement.children });
    return renderElement(result, depth, pretty);
  }

  // Handle HTML elements
  const tag = jsxElement.type as string;
  const props = jsxElement.props;
  const children = jsxElement.children;

  // Self-closing tags
  const selfClosing = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

  const indent = pretty ? '  '.repeat(depth) : '';
  const newline = pretty ? '\n' : '';

  // Build opening tag
  let html = `${indent}<${tag}`;

  // Add attributes
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;

    if (value === true) {
      html += ` ${formatAttribute(key)}`;
    } else {
      html += ` ${formatAttribute(key)}="${escapeHtml(String(value))}"`;
    }
  }

  // Self-closing or with children
  if (selfClosing.includes(tag)) {
    html += ` />${newline}`;
  } else {
    html += '>';

    if (children.length > 0) {
      const hasComplexChildren = children.some(child =>
        typeof child === 'object' && child != null && !Array.isArray(child)
      );

      if (hasComplexChildren && pretty) {
        html += newline;
        html += children.map(child => renderElement(child, depth + 1, pretty)).join('');
        html += indent;
      } else {
        html += children.map(child => renderElement(child, depth + 1, false)).join('');
      }
    }

    html += `</${tag}>${newline}`;
  }

  return html;
}

/**
 * Format attribute names (handle special cases)
 */
function formatAttribute(key: string): string {
  // Handle className -> class
  if (key === 'className') return 'class';
  if (key === 'htmlFor') return 'for';

  // Handle data-* and aria-*
  if (key.startsWith('data') || key.startsWith('aria')) {
    return key.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  return key.toLowerCase();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
}

/**
 * Raw HTML (dangerous - use with caution)
 * 
 * ⚠️ SECURITY WARNING: This function bypasses HTML escaping and can introduce XSS vulnerabilities!
 * 
 * Only use this with:
 * - Content from trusted sources
 * - Content that has been properly sanitized
 * - HTML you have full control over
 * 
 * DO NOT use with:
 * - User-generated content
 * - Data from external APIs
 * - Any untrusted input
 * 
 * Example safe usage:
 * ```tsx
 * const trustedHtml = raw('<div>Static trusted content</div>');
 * ```
 * 
 * Example UNSAFE usage (DO NOT DO THIS):
 * ```tsx
 * const userInput = getUserInput(); // ❌ DANGEROUS!
 * const unsafe = raw(userInput);
 * ```
 * 
 * Consider using a sanitization library like DOMPurify before using raw().
 */
export function raw(html: string): JSXElement {
  return {
    type: 'raw',
    props: { __html: html },
    children: [],
  };
}

/**
 * HTML template literal tag
 */
export function html(strings: TemplateStringsArray, ...values: any[]): string {
  let result = '';

  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      const value = values[i];
      if (typeof value === 'string') {
        result += escapeHtml(value);
      } else {
        result += String(value);
      }
    }
  }

  return result;
}

/**
 * JSX Plugin for OpenSpeed
 */
export interface JSXPluginOptions extends JSXOptions {
  globalComponents?: Record<string, Function>;
}

export function jsxPlugin(options: JSXPluginOptions = {}) {
  return async (ctx: Context, next: () => Promise<any>) => {
    // Extend context with JSX helpers
    (ctx as any).jsx = (element: JSXChild) => {
      const htmlString = renderToString(element, options);
      return ctx.html(htmlString);
    };

    (ctx as any).renderJSX = (element: JSXChild, renderOptions?: JSXOptions) => {
      return renderToString(element, { ...options, ...renderOptions });
    };

    await next();
  };
}

// Export for convenience
export { jsx as h, jsx as createElement };

/**
 * Common HTML Components
 */
export const Html = ({ children, lang = 'en', ...props }: any) => jsx('html', { lang, ...props }, children);
export const Head = ({ children, ...props }: any) => jsx('head', props, children);
export const Body = ({ children, ...props }: any) => jsx('body', props, children);
export const Title = ({ children, ...props }: any) => jsx('title', props, children);
export const Meta = (props: any) => jsx('meta', props);
export const Link = (props: any) => jsx('link', props);
export const Script = ({ children, ...props }: any) => jsx('script', props, children);
export const Style = ({ children, ...props }: any) => jsx('style', props, children);

export const Div = ({ children, ...props }: any) => jsx('div', props, children);
export const Span = ({ children, ...props }: any) => jsx('span', props, children);
export const P = ({ children, ...props }: any) => jsx('p', props, children);
export const A = ({ children, ...props }: any) => jsx('a', props, children);
export const Img = (props: any) => jsx('img', props);
export const Button = ({ children, ...props }: any) => jsx('button', props, children);
export const Input = (props: any) => jsx('input', props);
export const Form = ({ children, ...props }: any) => jsx('form', props, children);
export const Label = ({ children, ...props }: any) => jsx('label', props, children);
export const H1 = ({ children, ...props }: any) => jsx('h1', props, children);
export const H2 = ({ children, ...props }: any) => jsx('h2', props, children);
export const H3 = ({ children, ...props }: any) => jsx('h3', props, children);
export const Ul = ({ children, ...props }: any) => jsx('ul', props, children);
export const Li = ({ children, ...props }: any) => jsx('li', props, children);

/**
 * Layout component helper
 */
export function Layout({ children, title = 'OpenSpeed App' }: { children: JSXChild; title?: string }) {
  return jsx(Html, {},
    jsx(Head, {},
      jsx(Title, {}, title),
      jsx(Meta, { charset: 'UTF-8' }),
      jsx(Meta, { name: 'viewport', content: 'width=device-width, initial-scale=1.0' })
    ),
    jsx(Body, {}, children)
  );
}

/**
 * Example usage:
 *
 * import { jsx, jsxPlugin, Layout, H1, P } from 'openspeed/plugins/jsx';
 *
 * app.use(jsxPlugin());
 *
 * app.get('/', (ctx) => {
 *   return ctx.jsx(
 *     <Layout title="Home">
 *       <H1>Welcome to OpenSpeed</H1>
 *       <P>Fast and ergonomic web framework</P>
 *     </Layout>
 *   );
 * });
 */

---
layout: default
title: Cookie
parent: Plugins
nav_order: 3
---

# Cookie Plugin

The cookie plugin provides comprehensive cookie management with a CookieJar implementation for session handling and state management.

## Installation

```typescript
import { cookie } from 'openspeed-framework/plugins/cookie';

const app = createApp();
app.use(cookie());
```

## Basic Usage

### Setting Cookies

```typescript
app.get('/set-cookie', (ctx) => {
  ctx.setCookie('session', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 86400 // 1 day
  });

  return ctx.json({ message: 'Cookie set successfully' });
});
```

### Getting Cookies

```typescript
app.get('/profile', (ctx) => {
  const sessionId = ctx.getCookie('session');

  if (!sessionId) {
    return ctx.json({ error: 'Not authenticated' }, 401);
  }

  return ctx.json({ sessionId, user: getUser(sessionId) });
});
```

### Deleting Cookies

```typescript
app.get('/logout', (ctx) => {
  // Clear the session cookie
  ctx.setCookie('session', '', { maxAge: 0 });

  return ctx.json({ message: 'Logged out successfully' });
});
```

## Cookie Options

```typescript
interface CookieOptions {
  maxAge?: number;        // Max age in seconds
  expires?: Date;         // Expiration date
  path?: string;          // Cookie path (default: '/')
  domain?: string;        // Cookie domain
  secure?: boolean;       // HTTPS only (default: false)
  httpOnly?: boolean;     // Prevent client-side access (default: false)
  sameSite?: 'strict' | 'lax' | 'none';  // CSRF protection
  priority?: 'low' | 'medium' | 'high';  // Cookie priority
}
```

## Common Patterns

### Session Management

```typescript
app.post('/login', (ctx) => {
  const { username, password } = ctx.getBody();

  const user = authenticateUser(username, password);
  if (!user) {
    return ctx.json({ error: 'Invalid credentials' }, 401);
  }

  // Set session cookie
  ctx.setCookie('session', user.id, {
    httpOnly: true,
    secure: true,
    maxAge: 7 * 24 * 60 * 60, // 7 days
    sameSite: 'strict'
  });

  return ctx.json({ message: 'Logged in successfully', user });
});
```

### CSRF Protection

```typescript
app.get('/csrf-token', (ctx) => {
  const token = generateCSRFToken();

  ctx.setCookie('csrf-token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  });

  return ctx.json({ csrfToken: token });
});

app.post('/api/action', (ctx) => {
  const cookieToken = ctx.getCookie('csrf-token');
  const bodyToken = ctx.getBody().csrfToken;

  if (!cookieToken || cookieToken !== bodyToken) {
    return ctx.json({ error: 'CSRF token mismatch' }, 403);
  }

  // Process the action
  return ctx.json({ success: true });
});
```

### Theme Preferences

```typescript
app.get('/set-theme', (ctx) => {
  const theme = ctx.getQuery('theme') || 'light';

  ctx.setCookie('theme', theme, {
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: '/',
    sameSite: 'lax'
  });

  return ctx.json({ theme });
});

app.get('/get-theme', (ctx) => {
  const theme = ctx.getCookie('theme') || 'light';
  return ctx.json({ theme });
});
```

### Language Preferences

```typescript
app.get('/set-language', (ctx) => {
  const lang = ctx.getQuery('lang') || 'en';

  ctx.setCookie('lang', lang, {
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax'
  });

  return ctx.json({ language: lang });
});
```

## CookieJar API

### Direct CookieJar Access

```typescript
app.get('/cookies', (ctx) => {
  if (!ctx.cookies) {
    return ctx.json({ cookies: {} });
  }

  // Get all cookies as an object
  const allCookies = {};
  for (const [name] of ctx.cookies.entries()) {
    allCookies[name] = ctx.cookies.get(name);
  }

  return ctx.json({ cookies: allCookies });
});
```

### Clearing All Cookies

```typescript
app.get('/clear-all', (ctx) => {
  if (ctx.cookies) {
    ctx.cookies.clear();
  }

  return ctx.json({ message: 'All cookies cleared' });
});
```

## Security Best Practices

### Secure Cookies

```typescript
// Always use secure options for sensitive cookies
ctx.setCookie('session', sessionId, {
  httpOnly: true,    // Prevent XSS attacks
  secure: true,      // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 3600       // Reasonable expiration
});
```

### Cookie Prefixes

```typescript
// Use prefixes to avoid conflicts
ctx.setCookie('__Host-session', sessionId, {
  secure: true,
  path: '/',
  httpOnly: true
});

ctx.setCookie('__Secure-theme', 'dark', {
  secure: true,
  path: '/',
  sameSite: 'lax'
});
```

### Domain Restrictions

```typescript
// Restrict cookies to specific subdomains
ctx.setCookie('session', sessionId, {
  domain: '.example.com',  // Valid for all subdomains
  path: '/',
  secure: true,
  httpOnly: true
});
```

## Cookie Parsing

The plugin automatically parses cookies from the request headers:

```typescript
// Cookies are automatically available
app.get('/debug', (ctx) => {
  const allCookies = {};

  // Parse all incoming cookies
  if (ctx.cookies) {
    for (const [name] of ctx.cookies.entries()) {
      allCookies[name] = ctx.cookies.get(name);
    }
  }

  return ctx.json({
    cookies: allCookies,
    headers: ctx.req.headers
  });
});
```

## Integration with Authentication

```typescript
// Middleware to check authentication
const requireAuth = (ctx, next) => {
  const sessionId = ctx.getCookie('session');

  if (!sessionId) {
    return ctx.json({ error: 'Authentication required' }, 401);
  }

  const user = validateSession(sessionId);
  if (!user) {
    ctx.setCookie('session', '', { maxAge: 0 }); // Clear invalid session
    return ctx.json({ error: 'Invalid session' }, 401);
  }

  ctx.req.user = user;
  return next();
};

app.get('/protected', requireAuth, (ctx) => {
  return ctx.json({
    message: 'Welcome!',
    user: ctx.req.user
  });
});
```

## Cookie Size Limits

Be aware of browser cookie limits:
- Maximum 4KB per cookie
- Maximum 20 cookies per domain
- Maximum 50 cookies total

```typescript
app.post('/preferences', (ctx) => {
  const prefs = ctx.getBody();

  // Validate size
  const cookieValue = JSON.stringify(prefs);
  if (cookieValue.length > 4000) { // 4KB limit
    return ctx.json({ error: 'Preferences too large' }, 400);
  }

  ctx.setCookie('prefs', cookieValue, {
    maxAge: 365 * 24 * 60 * 60,
    httpOnly: false // Allow client-side access
  });

  return ctx.json({ success: true });
});
```

## Testing Cookies

```typescript
// In your tests
describe('Cookie Management', () => {
  it('should set and get cookies', () => {
    const app = createApp();
    app.use(cookie());

    app.get('/test', (ctx) => {
      ctx.setCookie('test', 'value');
      return ctx.text('ok');
    });

    // Test the endpoint
    const response = await request(app).get('/test');
    expect(response.headers['set-cookie']).toContain('test=value');
  });
});
```

## Examples

See the complete authentication example for a full implementation of session management with cookies.
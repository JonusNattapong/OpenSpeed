import { describe, it, expect } from 'vitest';
import Router from '../../src/openspeed/router.js';

describe('Router', () => {
  it('handles static routes', () => {
    const router = new Router();
    const handler = () => 'ok';
    router.add('GET', '/users', handler);

    const match = router.find('GET', '/users');
    expect(match).not.toBeNull();
    expect(match?.handler).toBe(handler);
    expect(match?.params).toEqual({});
  });

  it('handles param routes and decodes values', () => {
    const router = new Router();
    const handler = () => 'ok';
    router.add('GET', '/users/:id', handler);

    const match = router.find('GET', '/users/123%2045');
    expect(match).not.toBeNull();
    expect(match?.handler).toBe(handler);
    expect(match?.params).toEqual({ id: '123 45' });
  });

  it('returns null for missing routes or methods', () => {
    const router = new Router();
    router.add('GET', '/users', () => 'ok');

    expect(router.find('GET', '/missing')).toBeNull();
    expect(router.find('POST', '/users')).toBeNull();
  });
});


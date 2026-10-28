import { describe, expect, it } from 'vitest';

import { safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it('allows the account-gated commerce return path', () => {
    expect(safeReturnTo('/commerce/cart')).toBe('/commerce/cart');
    expect(safeReturnTo(['/commerce/cart'])).toBe('/commerce/cart');
  });

  it('rejects arbitrary internal and external redirects', () => {
    expect(safeReturnTo('/profile')).toBeUndefined();
    expect(safeReturnTo('https://example.com')).toBeUndefined();
    expect(safeReturnTo('//example.com')).toBeUndefined();
    expect(safeReturnTo(undefined)).toBeUndefined();
  });
});

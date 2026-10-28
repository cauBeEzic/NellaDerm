import { describe, expect, it } from 'vitest';

import { demoProduct, localDayKey, nextProduct, toggleProductStatus } from './today';

describe('today routine state', () => {
  it('adds the next missing demo product', () => {
    const first = demoProduct(0);
    expect(nextProduct([first]).name).toBe('NellaCalm');
  });

  it('uses a stable local date key for daily records', () => {
    expect(localDayKey(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07');
  });

  it('marks a product used and supports undo', () => {
    const first = demoProduct(0);
    const used = toggleProductStatus([first], first.id, 'used', '8:42 PM');
    expect(used[0]).toMatchObject({ status: 'used', usedAt: '8:42 PM' });

    const undone = toggleProductStatus(used, first.id, 'used');
    expect(undone[0]).toMatchObject({ status: 'due' });
    expect(undone[0].usedAt).toBeUndefined();
  });

  it('marks a product skipped and supports undo', () => {
    const product = demoProduct(1);
    const skipped = toggleProductStatus([product], product.id, 'skipped');
    expect(skipped[0].status).toBe('skipped');
    expect(toggleProductStatus(skipped, product.id, 'skipped')[0].status).toBe('due');
  });
});

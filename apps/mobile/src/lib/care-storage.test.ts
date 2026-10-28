import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyCareState, findCareProductByBarcode, insertCareProduct, SAMPLE_CARE_BARCODE, setCareRoutineSchedules } from './care';
import { loadCareState, saveCareState } from './care-storage';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

describe('Care storage ownership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves rescanned fields after reload without changing another profile or account', async () => {
    const records = new Map<string, string>();
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => records.get(key) ?? null);
    vi.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { records.set(key, value); });
    const sample = findCareProductByBarcode(SAMPLE_CARE_BARCODE)!;
    const saved = { ...sample, schedule: ['evening' as const], supply: 'low' as const, startedOn: '2026-01-12', personalInstructions: 'Synthetic instructions' };
    const ownerState = { ...emptyCareState, products: [saved] };
    const dependentState = { ...emptyCareState, products: [{ ...sample, startedOn: '2026-02-01' }] };
    const otherAccountState = { ...emptyCareState, products: [{ ...sample, personalInstructions: 'Other synthetic owner' }] };
    await saveCareState('synthetic-a', 'self', ownerState);
    await saveCareState('synthetic-a', 'dependent', dependentState);
    await saveCareState('synthetic-b', 'self', otherAccountState);
    const originalBytes = new Map(records);

    const loaded = await loadCareState('synthetic-a', 'self');
    await saveCareState('synthetic-a', 'self', { ...loaded, products: insertCareProduct(loaded.products, { ...sample, startedOn: '2026-10-16' }) });
    expect(await loadCareState('synthetic-a', 'self')).toEqual(ownerState);
    expect(await loadCareState('synthetic-a', 'dependent')).toEqual(dependentState);
    expect(await loadCareState('synthetic-b', 'self')).toEqual(otherAccountState);
    expect(records).toEqual(originalBytes);

    const emptyProfile = await loadCareState('synthetic-a', 'new-dependent');
    expect(insertCareProduct(emptyProfile.products, sample)).toEqual([sample]);
  });

  it('round-trips schedule history in only the selected owner and preserves the original on failed persistence', async () => {
    const records = new Map<string, string>();
    let fail = false;
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => records.get(key) ?? null);
    vi.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
      if (fail) throw new Error('Synthetic unavailable storage');
      records.set(key, value);
    });
    const product = { ...findCareProductByBarcode(SAMPLE_CARE_BARCODE)!, personalInstructions: 'Synthetic original note' };
    const original = { ...emptyCareState, products: [product] };
    for (const [account, profile] of [['synthetic-a', 'self'], ['synthetic-a', 'dependent'], ['synthetic-b', 'self']]) {
      await saveCareState(account, profile, original);
    }
    const before = new Map(records);
    const loaded = await loadCareState('synthetic-a', 'self');
    const changed = setCareRoutineSchedules(loaded, [{ productId: product.id, schedule: ['evening'], weekdays: ['mon', 'fri'] }], '2026-10-16');
    fail = true;
    await expect(saveCareState('synthetic-a', 'self', changed)).rejects.toThrow('Synthetic');
    expect(records).toEqual(before);
    expect(await loadCareState('synthetic-a', 'self')).toEqual(original);
    fail = false;
    await saveCareState('synthetic-a', 'self', changed);
    expect(await loadCareState('synthetic-a', 'self')).toEqual(changed);
    expect(await loadCareState('synthetic-a', 'dependent')).toEqual(original);
    expect(await loadCareState('synthetic-b', 'self')).toEqual(original);
    expect(records.get('myeczema.care.synthetic-a.dependent')).toBe(before.get('myeczema.care.synthetic-a.dependent'));
    expect(records.get('myeczema.care.synthetic-b.self')).toBe(before.get('myeczema.care.synthetic-b.self'));
  });

  it('fails closed on malformed weekday/history fields rather than silently converting them to daily schedules', async () => {
    const product = findCareProductByBarcode(SAMPLE_CARE_BARCODE)!;
    for (const fields of [
      { weekdays: [] },
      { weekdays: ['holiday'] },
      { scheduleHistory: [{ beforeDay: '2026-02-30', schedule: ['morning'], weekdays: ['mon'] }] },
      { scheduleHistory: [
        { beforeDay: '2026-10-16', schedule: ['morning'], weekdays: ['mon'] },
        { beforeDay: '2026-10-15', schedule: ['evening'], weekdays: ['fri'] },
      ] },
    ]) {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ ...emptyCareState, products: [{ ...product, ...fields }] }));
      await expect(loadCareState('synthetic-a', 'self')).rejects.toThrow();
    }
  });

  it('fails closed instead of replacing unreadable profile data', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{not-json');
    await expect(loadCareState('account-a', 'profile-b')).rejects.toThrow();
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ products: 'not-an-array' }));
    await expect(loadCareState('account-a', 'profile-b')).rejects.toThrow('products');
  });

  it('fills newly introduced reminder preferences when loading older records', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify({
      products: [],
      events: [],
      reminders: { morning: false, evening: true, weeklyReview: false, productSupply: true, quietHours: true, quietHoursLabel: '10:00 PM–7:00 AM' },
    }));
    const state = await loadCareState('account-a', 'profile-b');
    expect(state.reminders).toMatchObject({ checkIn: true, morning: false, prescription: true, weeklyReview: false });
  });
});

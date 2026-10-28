export type SkinCheckIn = 'better' | 'same' | 'worse';
export type RoutineProductStatus = 'due' | 'used' | 'skipped';
export type RoutineProductKind = 'skincare' | 'prescription';

export type RoutineProduct = {
  id: string;
  name: string;
  area: string;
  kind: RoutineProductKind;
  status: RoutineProductStatus;
  usedAt?: string;
};

export type TodayState = {
  checkIn?: SkinCheckIn;
  products: RoutineProduct[];
};

export const emptyTodayState: TodayState = { products: [] };

export function initialProduct(name: string): RoutineProduct {
  return {
    id: 'first-product',
    name,
    area: 'Hands, inner elbows',
    kind: 'skincare',
    status: 'due',
  };
}

export function demoProduct(position: number): RoutineProduct {
  if (position === 0) {
    return {
      id: 'cerave-moisturizing-cream',
      name: 'CeraVe Moisturizing Cream',
      area: 'Hands, inner elbows',
      kind: 'skincare',
      status: 'due',
    };
  }
  if (position === 1) {
    return {
      id: 'nella-calm',
      name: 'NellaCalm',
      area: 'Face and neck',
      kind: 'skincare',
      status: 'due',
    };
  }
  return {
    id: 'tacrolimus',
    name: 'Tacrolimus 0.1% ointment',
    area: 'Knuckles · follow your pharmacy label',
    kind: 'prescription',
    status: 'due',
  };
}

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nextProduct(products: RoutineProduct[]) {
  const knownProducts = ['CeraVe Moisturizing Cream', 'NellaCalm', 'Tacrolimus 0.1% ointment'];
  const nextIndex = knownProducts.findIndex((name) => !products.some((product) => product.name === name));
  return demoProduct(nextIndex === -1 ? products.length : nextIndex);
}

export function toggleProductStatus(
  products: RoutineProduct[],
  productId: string,
  nextStatus: Extract<RoutineProductStatus, 'used' | 'skipped'>,
  usedAt = 'Just now',
) {
  return products.map((product) => {
    if (product.id !== productId) return product;
    if (product.status === nextStatus) {
      const { usedAt: _usedAt, ...rest } = product;
      return { ...rest, status: 'due' as const };
    }
    return {
      ...product,
      status: nextStatus,
      usedAt: nextStatus === 'used' ? usedAt : undefined,
    };
  });
}

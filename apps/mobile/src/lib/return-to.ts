export type AllowedReturnTo = '/commerce/cart';

const allowedReturnPaths = new Set<string>(['/commerce/cart']);

export function safeReturnTo(value: string | string[] | undefined): AllowedReturnTo | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && allowedReturnPaths.has(candidate) ? candidate as AllowedReturnTo : undefined;
}

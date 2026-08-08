/** Slugifies a route name into a unique route code (max 50 chars). */
export function generateRouteCode(
  name: string,
  usedCodes: Set<string>,
): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
      .slice(0, 50) || 'ROUTE';
  let code = base;
  let n = 2;
  while (usedCodes.has(code)) {
    const suffix = `-${n}`;
    code = `${base.slice(0, 50 - suffix.length)}${suffix}`;
    n += 1;
  }
  return code;
}

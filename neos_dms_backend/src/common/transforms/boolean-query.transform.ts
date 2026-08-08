import { Transform, Type } from 'class-transformer';

/**
 * Parses a boolean that arrives as a query string (e.g. `?dryRun=false`).
 *
 * The global `enableImplicitConversion` converts `Boolean` query params with
 * `Boolean(value)` — and `Boolean('false') === true` — corrupting "false"
 * before any transform runs. Forcing the field type to `String` keeps the
 * raw value intact so the explicit transform below can honour `'false'`/`'0'`.
 */
export function ParseBooleanQuery() {
  return (target: object, propertyKey: string) => {
    Type(() => String)(target, propertyKey);
    Transform(({ value }) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }
      if (typeof value === 'boolean') {
        return value;
      }
      return value === 'true' || value === '1';
    })(target, propertyKey);
  };
}

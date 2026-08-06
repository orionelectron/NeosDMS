import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../auth.constants';

/**
 * Requires ALL listed permission codes on the handler. Any single code
 * grants access; the `admin` role (superuser) bypasses all checks.
 */
export const RequirePermission = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);

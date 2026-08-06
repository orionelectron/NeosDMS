export const PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'requiredPermissions';

export const ACCESS_TOKEN_TYPE = 'access';

export const SUPERUSER_ROLE_CODE = 'admin';

/** Hard bound so the hash is always SHA-256 of the raw token. */
export const REFRESH_TOKEN_BYTES = 48;

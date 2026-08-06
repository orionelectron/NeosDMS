import { SetMetadata } from '@nestjs/common';
import { PUBLIC_KEY } from '../auth.constants';

/** Marks an endpoint as reachable without a bearer token. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

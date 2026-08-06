import { Seed } from './seed.interface';

/**
 * Seed registry — ordered by ascending `version`; each runs exactly once.
 * Phase 0 only ships the mechanism + permission-code catalog.
 * Base-role/permission seeding is added here in Phase 2 when the IAM
 * tables (`roles`, `permissions`, `role_permission_mappings`) exist.
 */
export const SEEDS: readonly Seed[] = [];

import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { UserEntity } from './user.entity';

/**
 * DB-backed refresh session (per Decision: rotation + revocation). The raw
 * refresh token is never stored — only its SHA-256 hash. On refresh the old
 * session is revoked and a new one issued.
 */
@Entity('refresh_sessions')
@Index('uq_refresh_sessions_token_hash', ['tokenHash'], { unique: true })
@Index('idx_refresh_sessions_user', ['userId'])
export class RefreshSessionEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'token_hash', type: 'varchar' })
  tokenHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', name: 'user_agent', nullable: true })
  userAgent: string | null;
}

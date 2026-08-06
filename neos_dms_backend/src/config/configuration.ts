import { NodeEnv, validateEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  jwt: {
    secret: string;
    accessTtl: string;
    refreshTtlDays: number;
  };
}

export function configuration(): AppConfig {
  const env = validateEnv(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    database: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    },
    jwt: {
      secret: env.JWT_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtlDays: env.JWT_REFRESH_TTL_DAYS,
    },
  };
}

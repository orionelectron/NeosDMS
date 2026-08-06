import { EnvironmentVariables, validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validEnv: Record<string, string> = {
    NODE_ENV: 'development',
    PORT: '3000',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'neos',
    DB_PASSWORD: 'secret',
    DB_NAME: 'neos_dms',
  };

  it('returns a typed instance for a valid environment', () => {
    const env = validateEnv(validEnv);

    expect(env).toBeInstanceOf(EnvironmentVariables);
    expect(env.PORT).toBe(3000);
    expect(env.DB_PORT).toBe(5432);
    expect(env.NODE_ENV).toBe('development');
  });

  it('fails fast when a required variable is missing', () => {
    const incomplete = { ...validEnv };
    delete incomplete.DB_HOST;

    expect(() => validateEnv(incomplete)).toThrow(
      /Environment validation failed/,
    );
  });

  it('fails fast on invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      /Environment validation failed/,
    );
  });
});

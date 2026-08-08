import 'reflect-metadata';
import { IsBoolean, IsOptional } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ParseBooleanQuery } from './boolean-query.transform';

class TestQueryDto {
  @IsOptional()
  @IsBoolean()
  @ParseBooleanQuery()
  dryRun?: boolean;
}

describe('ParseBooleanQuery via ValidationPipe path', () => {
  it.each([
    ['false', false],
    ['true', true],
    ['0', false],
    ['1', true],
    ['', undefined],
    [undefined, undefined],
  ])('parses %p as %p', async (raw, expected) => {
    const instance = plainToInstance(
      TestQueryDto,
      raw === undefined ? {} : { dryRun: raw },
      { enableImplicitConversion: true },
    );
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
    expect(instance.dryRun).toBe(expected);
  });

  it('keeps real boolean false', async () => {
    const instance = plainToInstance(
      TestQueryDto,
      { dryRun: false },
      { enableImplicitConversion: true },
    );
    expect(await validate(instance)).toHaveLength(0);
    expect(instance.dryRun).toBe(false);
  });
});

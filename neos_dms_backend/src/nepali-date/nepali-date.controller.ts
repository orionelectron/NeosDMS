import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { NepaliDateConverter } from './nepali-date-converter';
import type { AdDate, BsDate } from './nepali-date-converter';

interface BsMonthInfo {
  bsYear: number;
  bsMonth: number;
  days: number;
  nameEn: string;
  nameNe: string;
}

@Controller('nepali-date')
export class NepaliDateController {
  constructor(private readonly nepaliDateConverter: NepaliDateConverter) {}

  @Get('ad-to-bs')
  adToBs(
    @Query('adYear') adYear: string,
    @Query('adMonth') adMonth: string,
    @Query('adDay') adDay: string,
  ): BsDate {
    return this.run(() =>
      this.nepaliDateConverter.adToBs(
        this.parsePositiveInt(adYear, 'adYear'),
        this.parsePositiveInt(adMonth, 'adMonth'),
        this.parsePositiveInt(adDay, 'adDay'),
      ),
    );
  }

  @Get('bs-to-ad')
  bsToAd(
    @Query('bsYear') bsYear: string,
    @Query('bsMonth') bsMonth: string,
    @Query('bsDay') bsDay: string,
  ): AdDate {
    return this.run(() =>
      this.nepaliDateConverter.bsToAd(
        this.parsePositiveInt(bsYear, 'bsYear'),
        this.parsePositiveInt(bsMonth, 'bsMonth'),
        this.parsePositiveInt(bsDay, 'bsDay'),
      ),
    );
  }

  @Get('bs-month')
  getBsMonth(
    @Query('bsYear') bsYear: string,
    @Query('bsMonth') bsMonth: string,
  ): BsMonthInfo {
    return this.run(() => {
      const year = this.parsePositiveInt(bsYear, 'bsYear');
      const month = this.parsePositiveInt(bsMonth, 'bsMonth');
      return {
        bsYear: year,
        bsMonth: month,
        days: this.nepaliDateConverter.getDaysInBsMonth(year, month),
        nameEn: this.nepaliDateConverter.getBsMonthName(month, 'en'),
        nameNe: this.nepaliDateConverter.getBsMonthName(month, 'ne'),
      };
    });
  }

  private parsePositiveInt(value: string | undefined, name: string): number {
    if (value === undefined || value === '') {
      throw new BadRequestException(`Query parameter '${name}' is required.`);
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `Query parameter '${name}' must be a positive integer.`,
      );
    }
    return parsed;
  }

  private run<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

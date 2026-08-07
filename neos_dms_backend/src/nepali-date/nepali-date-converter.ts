import { Injectable } from '@nestjs/common';

export interface BsDate {
  bsYear: number;
  bsMonth: number;
  bsDay: number;
}

export interface AdDate {
  adYear: number;
  adMonth: number;
  adDay: number;
}

export type BsMonthLanguage = 'en' | 'ne';

interface BsMonthNames {
  en: Record<number, string>;
  ne: Record<number, string>;
}

@Injectable()
export class NepaliDateConverter {
  /** First Bikram Sambat year covered by the calendar dataset. */
  private static readonly BS_EPOCH_YEAR = 2000;
  /** AD date corresponding to BS 2000-01-01 (Baisakh 1). */
  private static readonly AD_EPOCH: AdDate = {
    adYear: 1943,
    adMonth: 4,
    adDay: 14,
  };
  /** Zero-based day-of-year of 14 April in a common (non-leap) AD year. */
  private static readonly AD_EPOCH_DAY_OF_YEAR = 103;
  private static readonly AD_MONTH_LENGTHS: ReadonlyArray<number> = [
    31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];

  private readonly bsCalendar: ReadonlyArray<ReadonlyArray<number>> = [
    [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  ];

  private readonly bsMonthNames: BsMonthNames = {
    en: {
      1: 'Baishakh',
      2: 'Jestha',
      3: 'Ashadh',
      4: 'Shrawan',
      5: 'Bhadra',
      6: 'Ashwin',
      7: 'Kartik',
      8: 'Mangsir',
      9: 'Poush',
      10: 'Magh',
      11: 'Falgun',
      12: 'Chaitra',
    },
    ne: {
      1: 'बैशाख',
      2: 'जेठ',
      3: 'असार',
      4: 'श्रावण',
      5: 'भदौ',
      6: 'असोज',
      7: 'कार्तिक',
      8: 'मंसिर',
      9: 'पुष',
      10: 'माघ',
      11: 'फाल्गुन',
      12: 'चैत',
    },
  };

  /** Total number of days in the whole BS calendar dataset (one 141-year cycle). */
  private readonly bsTotalDays: number = this.bsCalendar.reduce(
    (total, monthLengths) =>
      total + monthLengths.reduce((sum, days) => sum + days, 0),
    0,
  );

  private get minAdYear(): number {
    return NepaliDateConverter.AD_EPOCH.adYear;
  }

  private get maxAdYear(): number {
    return NepaliDateConverter.AD_EPOCH.adYear + this.bsCalendar.length;
  }

  /**
   * Converts an AD (Gregorian) date to a BS (Bikram Sambat) date.
   */
  adToBs(adYear: number, adMonth: number, adDay: number): BsDate {
    this.assertValidAdDate(adYear, adMonth, adDay);
    const dayNumber = this.adToDayNumber(adYear, adMonth, adDay);
    if (dayNumber < 0 || dayNumber >= this.bsTotalDays) {
      throw new RangeError(
        `AD date ${adYear}-${adMonth}-${adDay} is outside the supported range.`,
      );
    }
    return this.dayNumberToBs(dayNumber);
  }

  /**
   * Converts a BS (Bikram Sambat) date to an AD (Gregorian) date.
   */
  bsToAd(bsYear: number, bsMonth: number, bsDay: number): AdDate {
    this.assertValidBsDate(bsYear, bsMonth, bsDay);
    return this.dayNumberToAd(this.bsToDayNumber(bsYear, bsMonth, bsDay));
  }

  isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  /**
   * Returns the number of days in the given BS month and year.
   */
  getDaysInBsMonth(bsYear: number, bsMonth: number): number {
    if (!Number.isInteger(bsMonth) || bsMonth < 1 || bsMonth > 12) {
      throw new RangeError('BS month must be an integer between 1 and 12.');
    }
    return this.getBsYearData(bsYear)[bsMonth - 1];
  }

  /**
   * Returns the BS month name, either in English or in Nepali.
   */
  getBsMonthName(
    monthNumber: number,
    language: BsMonthLanguage = 'en',
  ): string {
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      throw new RangeError('Month number must be between 1 and 12.');
    }
    return (
      this.bsMonthNames[language][monthNumber] ??
      this.bsMonthNames.en[monthNumber]
    );
  }

  /**
   * Returns the inclusive number of days between two BS dates (both endpoints
   * counted, so 2082-01-01 to 2082-01-01 is 1). Throws if `to` precedes `from`.
   */
  daysBetweenBs(from: BsDate, to: BsDate): number {
    this.assertValidBsDate(from.bsYear, from.bsMonth, from.bsDay);
    this.assertValidBsDate(to.bsYear, to.bsMonth, to.bsDay);
    const fromDay = this.bsToDayNumber(from.bsYear, from.bsMonth, from.bsDay);
    const toDay = this.bsToDayNumber(to.bsYear, to.bsMonth, to.bsDay);
    if (toDay < fromDay) {
      throw new RangeError('The end date must not precede the start date.');
    }
    return toDay - fromDay + 1;
  }

  /** Converts the current (local) date to its BS equivalent. */
  getTodayBsDate(): BsDate {
    const now = new Date();
    return this.adToBs(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  private getBsYearData(bsYear: number): ReadonlyArray<number> {
    const index = bsYear - NepaliDateConverter.BS_EPOCH_YEAR;
    if (index < 0 || index >= this.bsCalendar.length) {
      throw new RangeError(
        `BS year ${bsYear} is outside the supported range (${NepaliDateConverter.BS_EPOCH_YEAR}-${NepaliDateConverter.BS_EPOCH_YEAR + this.bsCalendar.length - 1}).`,
      );
    }
    return this.bsCalendar[index];
  }

  private getDaysInBsYear(bsYear: number): number {
    return this.getBsYearData(bsYear).reduce((sum, days) => sum + days, 0);
  }

  private getDaysInAdMonth(adYear: number, adMonth: number): number {
    return (
      NepaliDateConverter.AD_MONTH_LENGTHS[adMonth - 1] +
      (adMonth === 2 && this.isLeapYear(adYear) ? 1 : 0)
    );
  }

  private adToDayNumber(
    adYear: number,
    adMonth: number,
    adDay: number,
  ): number {
    let dayNumber = 0;
    for (
      let year = NepaliDateConverter.AD_EPOCH.adYear;
      year < adYear;
      year++
    ) {
      dayNumber += this.isLeapYear(year) ? 366 : 365;
    }
    for (let month = 1; month < adMonth; month++) {
      dayNumber += this.getDaysInAdMonth(adYear, month);
    }
    dayNumber += adDay - 1;
    return dayNumber - NepaliDateConverter.AD_EPOCH_DAY_OF_YEAR;
  }

  private dayNumberToAd(dayNumber: number): AdDate {
    let adYear = NepaliDateConverter.AD_EPOCH.adYear;
    let remaining = dayNumber + NepaliDateConverter.AD_EPOCH_DAY_OF_YEAR;
    while (remaining < 0) {
      adYear -= 1;
      remaining += this.isLeapYear(adYear) ? 366 : 365;
    }
    let adMonth = 1;
    for (;;) {
      const daysInMonth = this.getDaysInAdMonth(adYear, adMonth);
      if (remaining < daysInMonth) {
        return { adYear, adMonth, adDay: remaining + 1 };
      }
      remaining -= daysInMonth;
      adMonth += 1;
      if (adMonth > 12) {
        adMonth = 1;
        adYear += 1;
      }
    }
  }

  private bsToDayNumber(
    bsYear: number,
    bsMonth: number,
    bsDay: number,
  ): number {
    let dayNumber = 0;
    for (let year = NepaliDateConverter.BS_EPOCH_YEAR; year < bsYear; year++) {
      dayNumber += this.getDaysInBsYear(year);
    }
    const yearData = this.getBsYearData(bsYear);
    for (let month = 1; month < bsMonth; month++) {
      dayNumber += yearData[month - 1];
    }
    return dayNumber + bsDay - 1;
  }

  private dayNumberToBs(dayNumber: number): BsDate {
    let bsYear = NepaliDateConverter.BS_EPOCH_YEAR;
    for (;;) {
      const yearData = this.getBsYearData(bsYear);
      const yearDays = yearData.reduce((sum, days) => sum + days, 0);
      if (dayNumber < yearDays) {
        let bsMonth = 1;
        while (dayNumber >= yearData[bsMonth - 1]) {
          dayNumber -= yearData[bsMonth - 1];
          bsMonth += 1;
        }
        return { bsYear, bsMonth, bsDay: dayNumber + 1 };
      }
      dayNumber -= yearDays;
      bsYear += 1;
    }
  }

  private assertValidAdDate(
    adYear: number,
    adMonth: number,
    adDay: number,
  ): void {
    if (
      !Number.isInteger(adYear) ||
      !Number.isInteger(adMonth) ||
      !Number.isInteger(adDay)
    ) {
      throw new RangeError('AD date components must be integers.');
    }
    if (adYear < this.minAdYear || adYear > this.maxAdYear) {
      throw new RangeError(
        `AD year must be between ${this.minAdYear} and ${this.maxAdYear}.`,
      );
    }
    if (adMonth < 1 || adMonth > 12) {
      throw new RangeError('AD month must be between 1 and 12.');
    }
    if (adDay < 1 || adDay > this.getDaysInAdMonth(adYear, adMonth)) {
      throw new RangeError('AD day is invalid for the given month.');
    }
  }

  private assertValidBsDate(
    bsYear: number,
    bsMonth: number,
    bsDay: number,
  ): void {
    if (
      !Number.isInteger(bsYear) ||
      !Number.isInteger(bsMonth) ||
      !Number.isInteger(bsDay)
    ) {
      throw new RangeError('BS date components must be integers.');
    }
    if (bsMonth < 1 || bsMonth > 12) {
      throw new RangeError('BS month must be between 1 and 12.');
    }
    if (bsDay < 1 || bsDay > this.getDaysInBsMonth(bsYear, bsMonth)) {
      throw new RangeError('BS day is invalid for the given month.');
    }
  }
}

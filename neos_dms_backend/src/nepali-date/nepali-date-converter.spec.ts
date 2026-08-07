import { NepaliDateConverter } from './nepali-date-converter';

describe('NepaliDateConverter', () => {
  let converter: NepaliDateConverter;

  beforeEach(() => {
    converter = new NepaliDateConverter();
  });

  describe('adToBs', () => {
    it.each([
      [2023, 4, 14, 2080, 1, 1],
      [2023, 5, 1, 2080, 1, 18],
      [2023, 1, 1, 2079, 9, 17],
      [2022, 4, 14, 2079, 1, 1],
      [2021, 4, 14, 2078, 1, 1],
      [2020, 1, 1, 2076, 9, 17],
      [2000, 1, 1, 2056, 9, 17],
      [2000, 4, 13, 2057, 1, 1],
    ])(
      'converts AD %i-%i-%i to BS %i-%i-%i',
      (adYear, adMonth, adDay, bsYear, bsMonth, bsDay) => {
        expect(converter.adToBs(adYear, adMonth, adDay)).toEqual({
          bsYear,
          bsMonth,
          bsDay,
        });
      },
    );

    it('rejects dates outside the supported range', () => {
      expect(() => converter.adToBs(1942, 12, 31)).toThrow(RangeError);
      expect(() => converter.adToBs(2085, 1, 1)).toThrow(RangeError);
    });

    it('rejects invalid dates', () => {
      expect(() => converter.adToBs(2023, 2, 30)).toThrow(RangeError);
      expect(() => converter.adToBs(2023, 13, 1)).toThrow(RangeError);
      expect(() => converter.adToBs(2023, 1, 0)).toThrow(RangeError);
    });
  });

  describe('bsToAd', () => {
    it.each([
      [2080, 1, 1, 2023, 4, 14],
      [2079, 1, 1, 2022, 4, 14],
      [2078, 1, 1, 2021, 4, 14],
      [2076, 9, 17, 2020, 1, 1],
      [2070, 1, 1, 2013, 4, 14],
      [2068, 1, 1, 2011, 4, 14],
      [2057, 1, 1, 2000, 4, 13],
      [2000, 1, 1, 1943, 4, 14],
      [2080, 4, 1, 2023, 7, 17],
      [2080, 11, 1, 2024, 2, 13],
      [2080, 1, 18, 2023, 5, 1],
    ])(
      'converts BS %i-%i-%i to AD %i-%i-%i',
      (bsYear, bsMonth, bsDay, adYear, adMonth, adDay) => {
        expect(converter.bsToAd(bsYear, bsMonth, bsDay)).toEqual({
          adYear,
          adMonth,
          adDay,
        });
      },
    );

    it('rejects years outside the dataset', () => {
      expect(() => converter.bsToAd(1999, 1, 1)).toThrow(RangeError);
      expect(() => converter.bsToAd(2141, 1, 1)).toThrow(RangeError);
    });

    it('rejects invalid dates', () => {
      expect(() => converter.bsToAd(2080, 1, 32)).toThrow(RangeError);
      expect(() => converter.bsToAd(2080, 0, 1)).toThrow(RangeError);
    });
  });

  describe('round trips', () => {
    it('adToBs followed by bsToAd returns the original date', () => {
      for (let adYear = 1943; adYear <= 2083; adYear++) {
        for (let adMonth = 1; adMonth <= 12; adMonth++) {
          for (let adDay = 1; adDay <= 28; adDay++) {
            if (adYear === 1943 && (adMonth < 4 || adDay < 14)) {
              continue;
            }
            const bs = converter.adToBs(adYear, adMonth, adDay);
            expect(converter.bsToAd(bs.bsYear, bs.bsMonth, bs.bsDay)).toEqual({
              adYear,
              adMonth,
              adDay,
            });
          }
        }
      }
    });

    it('bsToAd followed by adToBs returns the original date', () => {
      for (let bsYear = 2000; bsYear <= 2140; bsYear++) {
        for (let bsMonth = 1; bsMonth <= 12; bsMonth++) {
          for (let bsDay = 1; bsDay <= 28; bsDay++) {
            const ad = converter.bsToAd(bsYear, bsMonth, bsDay);
            expect(converter.adToBs(ad.adYear, ad.adMonth, ad.adDay)).toEqual({
              bsYear,
              bsMonth,
              bsDay,
            });
          }
        }
      }
    });
  });

  describe('isLeapYear', () => {
    it.each([
      [2024, true],
      [2000, true],
      [2023, false],
      [1900, false],
      [2026, false],
    ])('year %i -> %s', (year, expected) => {
      expect(converter.isLeapYear(year)).toBe(expected);
    });
  });

  describe('getDaysInBsMonth', () => {
    it.each([
      [2080, 1, 31],
      [2080, 12, 30],
      [2070, 12, 30],
      [2000, 1, 31],
    ])('BS %i-%i has %i days', (bsYear, bsMonth, expected) => {
      expect(converter.getDaysInBsMonth(bsYear, bsMonth)).toBe(expected);
    });

    it('rejects an invalid month', () => {
      expect(() => converter.getDaysInBsMonth(2080, 13)).toThrow(RangeError);
      expect(() => converter.getDaysInBsMonth(2080, 0)).toThrow(RangeError);
    });
  });

  describe('getBsMonthName', () => {
    it('returns English names by default', () => {
      expect(converter.getBsMonthName(1)).toBe('Baishakh');
      expect(converter.getBsMonthName(12)).toBe('Chaitra');
    });

    it('returns Nepali names when requested', () => {
      expect(converter.getBsMonthName(1, 'ne')).toBe('बैशाख');
      expect(converter.getBsMonthName(4, 'ne')).toBe('श्रावण');
    });

    it('rejects an invalid month', () => {
      expect(() => converter.getBsMonthName(0)).toThrow(RangeError);
      expect(() => converter.getBsMonthName(13)).toThrow(RangeError);
    });
  });

  describe('daysBetweenBs', () => {
    it('counts a single day as 1', () => {
      expect(
        converter.daysBetweenBs(
          { bsYear: 2082, bsMonth: 1, bsDay: 5 },
          { bsYear: 2082, bsMonth: 1, bsDay: 5 },
        ),
      ).toBe(1);
    });

    it('counts inclusive range within a month', () => {
      expect(
        converter.daysBetweenBs(
          { bsYear: 2082, bsMonth: 3, bsDay: 10 },
          { bsYear: 2082, bsMonth: 3, bsDay: 12 },
        ),
      ).toBe(3);
    });

    it('counts across month boundaries using the BS calendar', () => {
      // 2082-01-30 .. 2082-02-02 spans Baishakh→Jestha
      const days = converter.daysBetweenBs(
        { bsYear: 2082, bsMonth: 1, bsDay: 30 },
        { bsYear: 2082, bsMonth: 2, bsDay: 2 },
      );
      const monthDays = converter.getDaysInBsMonth(2082, 1);
      expect(days).toBe(monthDays - 30 + 1 + 2);
    });

    it('counts across year boundaries', () => {
      // 2081-12-30 .. 2082-01-02 spans Chaitra→Baishakh
      const days = converter.daysBetweenBs(
        { bsYear: 2081, bsMonth: 12, bsDay: 30 },
        { bsYear: 2082, bsMonth: 1, bsDay: 2 },
      );
      const chaitraDays = converter.getDaysInBsMonth(2081, 12);
      expect(days).toBe(chaitraDays - 30 + 1 + 2);
    });

    it('throws when the end precedes the start', () => {
      expect(() =>
        converter.daysBetweenBs(
          { bsYear: 2082, bsMonth: 3, bsDay: 12 },
          { bsYear: 2082, bsMonth: 3, bsDay: 10 },
        ),
      ).toThrow(RangeError);
    });

    it('throws on an invalid BS day', () => {
      expect(() =>
        converter.daysBetweenBs(
          { bsYear: 2082, bsMonth: 2, bsDay: 33 },
          { bsYear: 2082, bsMonth: 2, bsDay: 34 },
        ),
      ).toThrow(RangeError);
    });
  });

  describe('getTodayBsDate', () => {
    it("round-trips back to today's AD date", () => {
      const today = new Date();
      const bs = converter.getTodayBsDate();
      const ad = converter.bsToAd(bs.bsYear, bs.bsMonth, bs.bsDay);
      expect(ad).toEqual({
        adYear: today.getFullYear(),
        adMonth: today.getMonth() + 1,
        adDay: today.getDate(),
      });
    });
  });
});

import { add, sub } from 'date-fns';
import { Fn } from '@dortdb/core';

/** Returns the current timestamp as a `Date`. */
export const now: Fn = {
  name: 'now',
  impl: () => new Date(),
};

/**
 * Parses an interval string into an {@link Interval}, accepting both SQL-standard
 * (`'1-2 3 4:5:6'`) and PostgreSQL (`'1 year 2 months ago'`) syntax.
 */
export const interval: Fn = {
  name: 'interval',
  impl: (repr: string) => {
    repr = repr.trim().toLowerCase();
    const standard = sqlStandardInterval(repr);
    if (standard) return standard;

    return postgresInterval(repr);
  },
  pure: true,
};

const dayMs = 24 * 60 * 60 * 1000;

/**
 * Sometimes adding days can result in "extra hours" due to daylight saving time changes.
 * This function trims those extra hours differences when the original date is at midnight
 * and the interval being added is a whole number of days
 */
export function trimExtraHours(
  origDate: Date,
  newDate: Date,
  interval: Interval,
): Date {
  if (
    +origDate % dayMs === 0 &&
    +newDate % dayMs !== 0 &&
    !interval.hours &&
    !interval.minutes &&
    !interval.seconds
  ) {
    newDate = new Date(
      +newDate -
        (newDate.getTimezoneOffset() - origDate.getTimezoneOffset()) * 60_000,
    );
  }
  return newDate;
}

/**
 * `date.add`: adds its two operands. Two {@link Interval}s sum component-wise;
 * a `Date` and an `Interval` produce a `Date` (with daylight-saving correction
 * for whole-day intervals via {@link trimExtraHours}).
 */
export const dateAdd: Fn = {
  name: 'add',
  schema: 'date',
  impl: (a: Date | Interval, b: Date | Interval) => {
    if (a instanceof Interval) {
      if (b instanceof Interval) {
        const res = new Interval();
        res.years = a.years + b.years;
        res.months = a.months + b.months;
        res.days = a.days + b.days;
        res.hours = a.hours + b.hours;
        res.minutes = a.minutes + b.minutes;
        res.seconds = a.seconds + b.seconds;
        return res;
      }

      return add(b, a);
    }
    return trimExtraHours(a, add(a, b as Interval), b as Interval);
  },
};

/**
 * `date.sub`: subtracts `b` from `a`. Two {@link Interval}s subtract component-wise;
 * a `Date` minus an `Interval` produces a `Date` (with daylight-saving correction
 * for whole-day intervals via {@link trimExtraHours}).
 */
export const dateSub: Fn = {
  name: 'sub',
  schema: 'date',
  impl: (a: Date | Interval, b: Interval) => {
    if (a instanceof Interval) {
      const res = new Interval();
      res.years = a.years - b.years;
      res.months = a.months - b.months;
      res.days = a.days - b.days;
      res.hours = a.hours - b.hours;
      res.minutes = a.minutes - b.minutes;
      res.seconds = a.seconds - b.seconds;
      return res;
    }
    return trimExtraHours(a, sub(a, b), b);
  },
};

function sqlStandardInterval(repr: string): Interval | null {
  const match = repr.match(
    /^(((?<y>[+-]?\d+)-(?<mo>\d+)\s*)?(?<d>[+-]?\d+)\s*)?(?<h>[+-]?\d+):(?<mi>\d+):(?<s>\d+(\.\d+)?)$/,
  );
  if (!match) return null;
  const res = new Interval();
  res.years = +(match.groups['y'] ?? 0);
  res.months = +(match.groups['mo'] ?? 0) * Math.sign(res.years);
  res.days = +(match.groups['d'] ?? 0);
  res.hours = +(match.groups['h'] ?? 0);
  res.minutes = +(match.groups['mi'] ?? 0) * Math.sign(res.hours);
  res.seconds = +(match.groups['s'] ?? 0) * Math.sign(res.hours);
  return res;
}

function postgresInterval(repr: string): Interval | null {
  const res = new Interval();
  for (const [key, regexp] of Object.entries({
    years: /(?<val>[+-]?\s*\b\d+)\s*y((ea)?r)?s?\b/,
    months: /(?<val>[+-]?\s*\b\d+)\s*mo(n(th)?)?s?\b/,
    days: /(?<val>[+-]?\s*\b\d+)\s*d(ay)?s?\b/,
    hours: /(?<val>[+-]?\s*\b\d+)\s*h((ou)?r)?s?\b/,
    minutes: /(?<val>[+-]?\s*\b\d+)\s*((min(ute)?s?)|m)\b/,
    seconds: /(?<val>[+-]?\s*\b\d+(\.\d+)?)\s*((sec(ond)?)s?|s)\b/,
  })) {
    const match = repr.match(regexp);
    if (match) {
      (res as any)[key] = +match.groups['val'].replace(/\s/g, '');
    }
  }
  const compactMatch = repr.match(/(?<h>[+-]?\d+):(?<m>\d+):(?<s>\d+(\.\d+)?)/);
  if (compactMatch) {
    res.hours = +compactMatch.groups['h'];
    res.minutes = +compactMatch.groups['m'] * Math.sign(res.hours);
    res.seconds = +compactMatch.groups['s'] * Math.sign(res.hours);
  }
  if (repr.match(/\bago$/)) {
    res.years = -res.years;
    res.months = -res.months;
    res.days = -res.days;
    res.hours = -res.hours;
    res.minutes = -res.minutes;
    res.seconds = -res.seconds;
  }
  return res;
}

/** A calendar/clock interval, stored as independent unit components. */
export class Interval {
  /** Seconds component. */
  seconds = 0;
  /** Minutes component. */
  minutes = 0;
  /** Hours component. */
  hours = 0;
  /** Days component. */
  days = 0;
  /** Months component. */
  months = 0;
  /** Years component. */
  years = 0;

  /**
   * Approximate total duration in milliseconds, treating a month as 30 days and a
   * year as 365 days. Useful for ordering/comparison, not for exact arithmetic.
   */
  valueOf() {
    return (
      ((((this.years * 365 + this.months * 30 + this.days) * 24 + this.hours) *
        60 +
        this.minutes) *
        60 +
        this.seconds) *
      1000
    );
  }
}

/**
 * `date.extract`: returns a single field of a date - one of `year`, `month` (1-based),
 * `day`, `hour`, `minute`, or `second`.
 *
 * @throws if the requested field name is not recognized.
 */
export const extract: Fn = {
  name: 'extract',
  schema: 'date',
  impl: (date: Date, field: string) => {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    switch (field.toLowerCase()) {
      case 'year':
        return date.getFullYear();
      case 'month':
        return date.getMonth() + 1; // getMonth() is zero-based
      case 'day':
        return date.getDate();
      case 'hour':
        return date.getHours();
      case 'minute':
        return date.getMinutes();
      case 'second':
        return date.getSeconds();
      default:
        throw new Error(`Unknown field: ${field}`);
    }
  },
  pure: true,
};

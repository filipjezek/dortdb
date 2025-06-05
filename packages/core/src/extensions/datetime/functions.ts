import { add, sub } from 'date-fns';
import { Fn } from '../../extension.js';

export const now: Fn = {
  name: 'now',
  impl: () => new Date(),
};

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
    return add(a, b as Interval);
  },
};

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
    return sub(a, b);
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
    seconds: /(?<val>[+-]?\s*\b\d+(\.\d+)?)\s*((sec(ond)?)?s?|s)\b/,
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

export class Interval {
  seconds = 0;
  minutes = 0;
  hours = 0;
  days = 0;
  months = 0;
  years = 0;

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

import { describe, it, expect } from 'vitest';
import {
  interval,
  Interval,
  dateAdd,
  dateSub,
  extract,
  now,
} from './functions.js';

describe('datetime functions', () => {
  it('now returns a Date close to current time', () => {
    const d = now.impl();
    expect(d).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - +d)).toBeLessThan(2000);
  });

  it('parses postgres-style interval units', () => {
    const res = interval.impl(
      '1 year 2 months 3 days 4 hours 5 minutes 6 seconds',
    ) as Interval;
    expect(res).toBeInstanceOf(Interval);
    expect(res.years).toBe(1);
    expect(res.months).toBe(2);
    expect(res.days).toBe(3);
    expect(res.hours).toBe(4);
    expect(res.minutes).toBe(5);
    expect(res.seconds).toBe(6);
  });

  it('parses compact H:MM:SS format', () => {
    const res = interval.impl('4:05:06') as Interval;
    expect(res.hours).toBe(4);
    expect(res.minutes).toBe(5);
    expect(res.seconds).toBe(6);
  });

  it('interprets "ago" as negative values', () => {
    const res = interval.impl('1 year ago') as Interval;
    expect(res.years).toBe(-1);
  });

  it('parses SQL-standard combined format (years-months, days, H:MM:SS)', () => {
    const res = interval.impl('1-02 3 04:05:06') as Interval;
    expect(res.years).toBe(1);
    expect(res.months).toBe(2);
    expect(res.days).toBe(3);
    expect(res.hours).toBe(4);
    expect(res.minutes).toBe(5);
    expect(res.seconds).toBe(6);
  });

  it('applies sign to months based on years sign (SQL standard)', () => {
    const res = interval.impl('-1-02 03:04:05') as Interval;
    expect(res.years).toBe(-1);
    expect(res.months).toBe(-2);
  });

  it('parses mixed unit abbreviations and fractional seconds (Postgres style)', () => {
    const res = interval.impl(
      '+2 years -3 mo 4 days +5 hours 6 min 7.5 sec',
    ) as Interval;
    expect(res.years).toBe(2);
    expect(res.months).toBe(-3);
    expect(res.days).toBe(4);
    expect(res.hours).toBe(5);
    expect(res.minutes).toBe(6);
    expect(res.seconds).toBe(7.5);
  });

  it('handles compact negative hours making minutes/seconds negative (Postgres compact)', () => {
    const res = interval.impl('-4:05:06') as Interval;
    expect(res.hours).toBe(-4);
    expect(res.minutes).toBe(-5);
    expect(res.seconds).toBe(-6);
  });

  it('accepts spaced sign before number in units (Postgres)', () => {
    const res = interval.impl('+ 5 years') as Interval;
    expect(res.years).toBe(5);
  });

  it('adds two Interval instances', () => {
    const a = new Interval();
    a.years = 1;
    a.months = 2;
    const b = new Interval();
    b.years = 3;
    b.months = 4;
    const res = dateAdd.impl(a, b) as Interval;
    expect(res.years).toBe(4);
    expect(res.months).toBe(6);
  });

  it('subtracts two Interval instances', () => {
    const a = new Interval();
    a.days = 10;
    const b = new Interval();
    b.days = 3;
    const res = dateSub.impl(a, b) as Interval;
    expect(res.days).toBe(7);
  });

  it('adds an Interval to a Date', () => {
    const d = new Date(2020, 0, 1, 10, 0, 0); // local time
    const iv = new Interval();
    iv.days = 1;
    iv.hours = 2;
    const res = dateAdd.impl(d, iv) as Date;
    expect(res.getFullYear()).toBe(2020);
    expect(res.getDate()).toBe(2);
    expect(res.getHours()).toBe(12);
  });

  it('extracts date fields', () => {
    const d = new Date(2001, 1, 3, 4, 5, 6); // local time
    expect(extract.impl(d, 'year')).toBe(2001);
    expect(extract.impl(d, 'month')).toBe(2);
    expect(extract.impl(d, 'day')).toBe(3);
    expect(extract.impl(d, 'hour')).toBe(4);
    expect(extract.impl(d, 'minute')).toBe(5);
    expect(extract.impl(d, 'second')).toBe(6);
  });
});

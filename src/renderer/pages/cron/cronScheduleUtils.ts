/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICronSchedule } from '@/common/adapter/ipcBridge';

export type CronIntervalUnit = 'minute' | 'hour' | 'day' | 'month' | 'year';

export type CronScheduleDraft = {
  firstRunAtMs: number;
  intervalValue: number;
  intervalUnit: CronIntervalUnit;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const YEAR_MS = 365 * DAY_MS;

const DEFAULT_INTERVAL_DRAFT: Pick<CronScheduleDraft, 'intervalValue' | 'intervalUnit'> = {
  intervalValue: 1,
  intervalUnit: 'hour',
};

export function buildCronSchedule(
  draft: CronScheduleDraft,
  description: string
): Extract<ICronSchedule, { kind: 'every' | 'cron' }> {
  const normalizedValue = Math.max(1, Math.trunc(draft.intervalValue));

  if (draft.intervalUnit === 'month') {
    return {
      kind: 'cron',
      expr: buildMonthlyCronExpr(draft.firstRunAtMs, normalizedValue),
      startAtMs: draft.firstRunAtMs,
      description,
    };
  }

  return {
    kind: 'every',
    everyMs: getUnitDurationMs(draft.intervalUnit) * normalizedValue,
    startAtMs: draft.firstRunAtMs,
    description,
  };
}

export function scheduleToDraft(schedule: ICronSchedule): CronScheduleDraft {
  if (schedule.kind === 'at') {
    return {
      firstRunAtMs: schedule.atMs,
      intervalValue: 1,
      intervalUnit: 'day',
    };
  }

  if (schedule.kind === 'every') {
    return {
      firstRunAtMs: schedule.startAtMs ?? Date.now() + schedule.everyMs,
      ...getEveryScheduleUnit(schedule.everyMs),
    };
  }

  return {
    firstRunAtMs: schedule.startAtMs ?? Date.now() + HOUR_MS,
    ...getCronScheduleUnit(schedule.expr),
  };
}

function getUnitDurationMs(unit: Exclude<CronIntervalUnit, 'month'>): number {
  switch (unit) {
    case 'minute':
      return MINUTE_MS;
    case 'hour':
      return HOUR_MS;
    case 'day':
      return DAY_MS;
    case 'year':
      return YEAR_MS;
  }
}

function getEveryScheduleUnit(everyMs: number): Pick<CronScheduleDraft, 'intervalValue' | 'intervalUnit'> {
  if (everyMs % YEAR_MS === 0 && everyMs >= YEAR_MS) {
    return { intervalValue: everyMs / YEAR_MS, intervalUnit: 'year' };
  }

  if (everyMs % DAY_MS === 0 && everyMs >= DAY_MS) {
    return { intervalValue: everyMs / DAY_MS, intervalUnit: 'day' };
  }

  if (everyMs % HOUR_MS === 0 && everyMs >= HOUR_MS) {
    return { intervalValue: everyMs / HOUR_MS, intervalUnit: 'hour' };
  }

  return { intervalValue: Math.max(1, Math.round(everyMs / MINUTE_MS)), intervalUnit: 'minute' };
}

function getCronScheduleUnit(expr: string): Pick<CronScheduleDraft, 'intervalValue' | 'intervalUnit'> {
  const parts = expr.trim().split(/\s+/);
  const normalizedParts = parts.length >= 5 ? parts.slice(-5) : [];

  if (normalizedParts.length !== 5) {
    return DEFAULT_INTERVAL_DRAFT;
  }

  const [_minute, _hour, dayOfMonth, month, dayOfWeek] = normalizedParts;
  if (dayOfWeek !== '*' || dayOfMonth === '*') {
    return DEFAULT_INTERVAL_DRAFT;
  }

  if (month === '*') {
    return { intervalValue: 1, intervalUnit: 'month' };
  }

  const monthValues = parseMonthValues(month);
  if (monthValues.length === 0) {
    return DEFAULT_INTERVAL_DRAFT;
  }
  if (monthValues.length === 1) {
    return { intervalValue: 1, intervalUnit: 'year' };
  }

  const firstGap = ((monthValues[1] ?? monthValues[0]) - monthValues[0] + 12) % 12 || 12;
  const isConsistent = monthValues.every((value, index) => {
    const next = monthValues[(index + 1) % monthValues.length]!;
    const gap = (next - value + 12) % 12 || 12;
    return gap === firstGap;
  });

  if (isConsistent) {
    return { intervalValue: firstGap, intervalUnit: 'month' };
  }

  return DEFAULT_INTERVAL_DRAFT;
}

function buildMonthlyCronExpr(firstRunAtMs: number, intervalValue: number): string {
  const date = new Date(firstRunAtMs);
  const monthField = buildMonthField(date.getMonth() + 1, intervalValue);

  return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${monthField} *`;
}

function buildMonthField(startMonth: number, intervalValue: number): string {
  if (intervalValue <= 1) {
    return '*';
  }

  const months = Array.from({ length: 12 }, (_value, index) => index + 1).filter(
    (month) => (month - startMonth + 12) % intervalValue === 0
  );

  return months.join(',');
}

function parseMonthValues(monthField: string): number[] {
  return monthField
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12)
    .toSorted((a, b) => a - b);
}

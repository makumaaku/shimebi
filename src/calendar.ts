import { addDays, dayOfWeek, format, type DateInput, type PlainDate, toPlain } from "./date.js";
import { isNationalHoliday } from "./holidays.js";

/**
 * 営業日カレンダーの種類
 * - "bank": 銀行休業日（土日・祝日・12/31・1/2・1/3）を休みとする。振込の支払期日向け（デフォルト）
 * - "national": 土日・祝日を休みとする
 * - "weekdays": 土日のみ休み
 */
export type CalendarType = "bank" | "national" | "weekdays";

export interface CalendarOptions {
  calendar?: CalendarType;
  /** 追加の休業日（会社の夏季休業など） */
  extraHolidays?: DateInput[];
  /** 休業日から除外する日（臨時営業日など） */
  excludeHolidays?: DateInput[];
  /** 独自判定。true を返すと休業日扱い（他の判定より優先） */
  isHoliday?: (date: string) => boolean;
}

function toSet(list: DateInput[] | undefined): Set<string> {
  return new Set((list ?? []).map((d) => format(toPlain(d))));
}

/** 内部用: オプションから休業日判定関数を作る */
export function makeHolidayChecker(opts: CalendarOptions = {}): (p: PlainDate) => boolean {
  const calendar = opts.calendar ?? "bank";
  const extra = toSet(opts.extraHolidays);
  const exclude = toSet(opts.excludeHolidays);
  return (p) => {
    const key = format(p);
    if (opts.isHoliday?.(key)) return true;
    if (exclude.has(key)) return false;
    if (extra.has(key)) return true;
    const dow = dayOfWeek(p);
    if (dow === 0 || dow === 6) return true;
    if (calendar === "weekdays") return false;
    if (isNationalHoliday(key)) return true;
    if (calendar === "bank") {
      if ((p.m === 12 && p.d === 31) || (p.m === 1 && (p.d === 2 || p.d === 3))) return true;
    }
    return false;
  };
}

/** 営業日なら true */
export function isBusinessDay(date: DateInput, opts?: CalendarOptions): boolean {
  return !makeHolidayChecker(opts)(toPlain(date));
}

/** n 営業日後（負数なら前）の日付。n=0 の場合、休業日なら翌営業日 */
export function addBusinessDays(date: DateInput, n: number, opts?: CalendarOptions): string {
  const isOff = makeHolidayChecker(opts);
  let p = toPlain(date);
  if (n === 0) {
    while (isOff(p)) p = addDays(p, 1);
    return format(p);
  }
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    p = addDays(p, step);
    if (!isOff(p)) remaining--;
  }
  return format(p);
}

/** 次の営業日（当日が営業日なら当日） */
export function nextBusinessDay(date: DateInput, opts?: CalendarOptions): string {
  const isOff = makeHolidayChecker(opts);
  let p = toPlain(date);
  while (isOff(p)) p = addDays(p, 1);
  return format(p);
}

/** 前の営業日（当日が営業日なら当日） */
export function previousBusinessDay(date: DateInput, opts?: CalendarOptions): string {
  const isOff = makeHolidayChecker(opts);
  let p = toPlain(date);
  while (isOff(p)) p = addDays(p, -1);
  return format(p);
}

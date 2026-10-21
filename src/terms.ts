import { addDays, compare, format, monthWithDay, type DateInput, type PlainDate, toPlain } from "./date.js";
import { type CalendarOptions, makeHolidayChecker } from "./calendar.js";
import { parsePaymentTerms } from "./parse.js";

/** 締め日・支払日の「日」。数値(1-31) または "end"(末日) */
export type DayOfMonth = number | "end";

/**
 * 支払期日が休業日に当たった場合の扱い
 * - "previous": 前営業日（デフォルト）
 * - "next": 翌営業日
 * - "modifiedNext": 翌営業日。ただし月をまたぐ場合は前営業日
 * - "none": 調整しない
 */
export type HolidayAdjustment = "previous" | "next" | "modifiedNext" | "none";

export interface PaymentTerms extends CalendarOptions {
  /** 締め日。"end" または 31 で月末締め */
  closingDay: DayOfMonth;
  /** 締め月から何か月後に支払うか（0=当月, 1=翌月, 2=翌々月 ...） */
  monthOffset: number;
  /** 支払日。"end" で末日払い */
  paymentDay: DayOfMonth;
  /** 休業日の調整。デフォルト "previous" */
  adjustment?: HolidayAdjustment;
}

/** 文字列（例: "月末締め翌月末払い"）またはオブジェクトで指定できる */
export type TermsInput = PaymentTerms | string;

export interface PaymentSchedule {
  /** 対象期間の開始日（前回締め日の翌日） */
  periodStart: string;
  /** 締め日 */
  closingDate: string;
  /** 休日調整前の支払日 */
  scheduledPaymentDate: string;
  /** 休日調整後の支払期日 */
  paymentDate: string;
  /** 休日調整が行われたか */
  adjusted: boolean;
}

function resolve(terms: TermsInput, override?: CalendarOptions & { adjustment?: HolidayAdjustment }): PaymentTerms {
  const t = typeof terms === "string" ? parsePaymentTerms(terms) : terms;
  validate(t);
  return { ...t, ...stripUndefined(override ?? {}) };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function validate(t: PaymentTerms): void {
  const okDay = (d: DayOfMonth) => d === "end" || (Number.isInteger(d) && d >= 1 && d <= 31);
  if (!okDay(t.closingDay)) throw new RangeError(`closingDay must be 1-31 or "end": ${t.closingDay}`);
  if (!okDay(t.paymentDay)) throw new RangeError(`paymentDay must be 1-31 or "end": ${t.paymentDay}`);
  if (!Number.isInteger(t.monthOffset) || t.monthOffset < 0) {
    throw new RangeError(`monthOffset must be a non-negative integer: ${t.monthOffset}`);
  }
}

/** 締め日（"end" or 31 以上は月末扱い。その月に存在しない日は月末に丸める） */
function closingOf(y: number, m: number, closingDay: DayOfMonth): PlainDate {
  return monthWithDay(y, m, 0, closingDay === "end" || closingDay >= 31 ? "end" : closingDay);
}

/** 取引日（納品日・検収日など）を含む期間の締め日 */
function closingFor(p: PlainDate, closingDay: DayOfMonth): PlainDate {
  const thisMonth = closingOf(p.y, p.m, closingDay);
  if (compare(p, thisMonth) <= 0) return thisMonth;
  const next = monthWithDay(p.y, p.m, 1, 1);
  return closingOf(next.y, next.m, closingDay);
}

function adjust(p: PlainDate, mode: HolidayAdjustment, isOff: (p: PlainDate) => boolean): PlainDate {
  if (mode === "none" || !isOff(p)) return p;
  const walk = (start: PlainDate, step: number) => {
    let q = start;
    while (isOff(q)) q = addDays(q, step);
    return q;
  };
  if (mode === "previous") return walk(p, -1);
  const next = walk(p, 1);
  if (mode === "modifiedNext" && next.m !== p.m) return walk(p, -1);
  return next;
}

/**
 * 取引日から締め日・支払期日を計算する
 *
 * @example
 * getPaymentSchedule("2026-10-21", "月末締め翌月末払い")
 * // { periodStart: "2026-10-01", closingDate: "2026-10-31", paymentDate: "2026-11-30", ... }
 */
export function getPaymentSchedule(
  transactionDate: DateInput,
  terms: TermsInput,
  options?: CalendarOptions & { adjustment?: HolidayAdjustment },
): PaymentSchedule {
  const t = resolve(terms, options);
  const closing = closingFor(toPlain(transactionDate), t.closingDay);
  const prevMonth = monthWithDay(closing.y, closing.m, -1, 1);
  const periodStart = addDays(closingOf(prevMonth.y, prevMonth.m, t.closingDay), 1);
  const scheduled = monthWithDay(closing.y, closing.m, t.monthOffset, t.paymentDay);
  if (compare(scheduled, closing) < 0) {
    throw new RangeError(
      `Payment date (${format(scheduled)}) is before closing date (${format(closing)}). Check monthOffset / paymentDay.`,
    );
  }
  const paid = adjust(scheduled, t.adjustment ?? "previous", makeHolidayChecker(t));
  return {
    periodStart: format(periodStart),
    closingDate: format(closing),
    scheduledPaymentDate: format(scheduled),
    paymentDate: format(paid),
    adjusted: compare(paid, scheduled) !== 0,
  };
}

/** 取引日から支払期日（休日調整後）を返す */
export function getPaymentDate(
  transactionDate: DateInput,
  terms: TermsInput,
  options?: CalendarOptions & { adjustment?: HolidayAdjustment },
): string {
  return getPaymentSchedule(transactionDate, terms, options).paymentDate;
}

/** 取引日を含む期間の締め日を返す */
export function getClosingDate(transactionDate: DateInput, terms: TermsInput | DayOfMonth): string {
  const closingDay = typeof terms === "number" || terms === "end" ? terms : resolve(terms).closingDay;
  return format(closingFor(toPlain(transactionDate), closingDay));
}

/**
 * 指定日から n 期間分の締め日・支払期日の一覧（資金繰り表・カレンダー登録向け）
 */
export function listPaymentSchedules(
  from: DateInput,
  count: number,
  terms: TermsInput,
  options?: CalendarOptions & { adjustment?: HolidayAdjustment },
): PaymentSchedule[] {
  const t = resolve(terms, options);
  const out: PaymentSchedule[] = [];
  let cursor = toPlain(from);
  for (let i = 0; i < count; i++) {
    const s = getPaymentSchedule(format(cursor), t);
    out.push(s);
    cursor = addDays(toPlain(s.closingDate), 1);
  }
  return out;
}

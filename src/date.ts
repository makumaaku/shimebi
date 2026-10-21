/** 日付のみを扱う内部表現（タイムゾーンの影響を受けない） */
export interface PlainDate {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

/** 受け付ける日付入力: Date（ローカル日付として解釈）または "YYYY-MM-DD" / "YYYY/MM/DD" */
export type DateInput = Date | string;

const DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

export function toPlain(input: DateInput): PlainDate {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new RangeError("Invalid Date");
    return { y: input.getFullYear(), m: input.getMonth() + 1, d: input.getDate() };
  }
  const m = DATE_RE.exec(input.trim());
  if (!m) throw new RangeError(`Invalid date string: "${input}" (expected YYYY-MM-DD)`);
  const p = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  if (p.m < 1 || p.m > 12 || p.d < 1 || p.d > daysInMonth(p.y, p.m)) {
    throw new RangeError(`Invalid date: "${input}"`);
  }
  return p;
}

export function format(p: PlainDate): string {
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0=日曜 ... 6=土曜 */
export function dayOfWeek(p: PlainDate): number {
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export function addDays(p: PlainDate, n: number): PlainDate {
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** 月を加算し、日は指定値（月末を超える場合は月末に丸める） */
export function monthWithDay(y: number, m: number, addMonths: number, day: number | "end"): PlainDate {
  const idx = y * 12 + (m - 1) + addMonths;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const last = daysInMonth(ny, nm);
  return { y: ny, m: nm, d: day === "end" ? last : Math.min(day, last) };
}

export function compare(a: PlainDate, b: PlainDate): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

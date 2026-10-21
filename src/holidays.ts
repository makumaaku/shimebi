import { addDays, dayOfWeek, format, type DateInput, type PlainDate, toPlain } from "./date.js";

/**
 * 日本の国民の祝日（「国民の祝日に関する法律」ベース）を外部データなしで計算する。
 * 対象: 2000〜2099年。春分・秋分は近似式で算出するため、
 * 官報で公表される日付と異なる場合は `extraHolidays` / `excludeHolidays` で補正できる。
 */

function nthMonday(y: number, m: number, n: number): number {
  const first = dayOfWeek({ y, m, d: 1 });
  const offset = (8 - first) % 7; // 最初の月曜までの日数
  return 1 + offset + (n - 1) * 7;
}

function vernalEquinox(y: number): number {
  return Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}

function autumnalEquinox(y: number): number {
  return Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}

const cache = new Map<number, Map<string, string>>();

/** 指定年の祝日一覧（"YYYY-MM-DD" → 祝日名）。振替休日・国民の休日を含む */
export function holidaysOf(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;

  const base = new Map<string, string>();
  const add = (m: number, d: number, name: string) => base.set(format({ y: year, m, d }), name);

  add(1, 1, "元日");
  add(1, nthMonday(year, 1, 2), "成人の日");
  add(2, 11, "建国記念の日");
  if (year >= 2020) add(2, 23, "天皇誕生日");
  add(3, vernalEquinox(year), "春分の日");
  add(4, 29, year >= 2007 ? "昭和の日" : "みどりの日");
  add(5, 3, "憲法記念日");
  if (year >= 2007) add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");

  // 海の日
  if (year === 2020) add(7, 23, "海の日");
  else if (year === 2021) add(7, 22, "海の日");
  else if (year >= 2003) add(7, nthMonday(year, 7, 3), "海の日");
  else add(7, 20, "海の日");

  // 山の日
  if (year === 2020) add(8, 10, "山の日");
  else if (year === 2021) add(8, 8, "山の日");
  else if (year >= 2016) add(8, 11, "山の日");

  // 敬老の日
  if (year >= 2003) add(9, nthMonday(year, 9, 3), "敬老の日");
  else add(9, 15, "敬老の日");
  add(9, autumnalEquinox(year), "秋分の日");

  // スポーツの日（2019年までは体育の日）
  if (year === 2020) add(7, 24, "スポーツの日");
  else if (year === 2021) add(7, 23, "スポーツの日");
  else if (year >= 2022) add(10, nthMonday(year, 10, 2), "スポーツの日");
  else add(10, nthMonday(year, 10, 2), "体育の日");

  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");
  if (year <= 2018) add(12, 23, "天皇誕生日");

  // 特例（皇室関連）
  if (year === 2019) {
    add(5, 1, "休日（祝日扱い）"); // 天皇の即位の日
    add(10, 22, "休日（祝日扱い）"); // 即位礼正殿の儀の行われる日
  }

  const result = new Map(base);
  const keys = [...base.keys()].sort();

  // 振替休日: 祝日が日曜の場合、その後の最も近い「祝日でない日」（2007年以降）。2006年以前は翌月曜のみ
  for (const key of keys) {
    const p = toPlain(key);
    if (dayOfWeek(p) !== 0) continue;
    let next = addDays(p, 1);
    if (year >= 2007) {
      while (result.has(format(next))) next = addDays(next, 1);
      result.set(format(next), "振替休日");
    } else if (!result.has(format(next))) {
      result.set(format(next), "振替休日");
    }
  }

  // 国民の休日: 前日と翌日が祝日に挟まれた平日
  for (let d: PlainDate = { y: year, m: 1, d: 2 }; d.y === year && !(d.m === 12 && d.d === 31); d = addDays(d, 1)) {
    const k = format(d);
    if (result.has(k) || dayOfWeek(d) === 0) continue;
    if (base.has(format(addDays(d, -1))) && base.has(format(addDays(d, 1)))) {
      result.set(k, "休日");
    }
  }

  const sorted = new Map([...result.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
  cache.set(year, sorted);
  return sorted;
}

/** 祝日名を返す（祝日でなければ undefined） */
export function getHolidayName(date: DateInput): string | undefined {
  const p = toPlain(date);
  return holidaysOf(p.y).get(format(p));
}

/** 国民の祝日・振替休日・国民の休日なら true */
export function isNationalHoliday(date: DateInput): boolean {
  return getHolidayName(date) !== undefined;
}

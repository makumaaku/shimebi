import { addDays, toPlain } from "./date.js";
import type { PaymentSchedule } from "./terms.js";

export interface CsvOptions {
  /** 見出し行の言語。"en" はプロパティ名そのまま（デフォルト）、"ja" は日本語、false で見出しなし */
  header?: "en" | "ja" | false;
  /** 先頭に UTF-8 BOM を付ける（Excel で文字化けさせないため）。デフォルト false */
  bom?: boolean;
  /** 改行コード。デフォルト "\n" */
  eol?: "\n" | "\r\n";
}

const KEYS = ["periodStart", "closingDate", "scheduledPaymentDate", "paymentDate", "adjusted"] as const;
const JA: Record<(typeof KEYS)[number], string> = {
  periodStart: "対象期間開始",
  closingDate: "締め日",
  scheduledPaymentDate: "支払予定日",
  paymentDate: "支払期日",
  adjusted: "休業日調整",
};

/**
 * 支払スケジュールを CSV 文字列にする（資金繰り表・スプレッドシート向け）
 *
 * @example
 * toCSV(listPaymentSchedules("2026-10-01", 3, "月末締め翌月末払い"), { header: "ja", bom: true })
 */
export function toCSV(schedules: readonly PaymentSchedule[], options: CsvOptions = {}): string {
  const { header = "en", bom = false, eol = "\n" } = options;
  const lines: string[] = [];
  if (header === "en") lines.push(KEYS.join(","));
  else if (header === "ja") lines.push(KEYS.map((k) => JA[k]).join(","));
  for (const s of schedules) lines.push(KEYS.map((k) => String(s[k])).join(","));
  return (bom ? "\uFEFF" : "") + lines.join(eol) + eol;
}

export interface ICalendarOptions {
  /** 予定のタイトル。デフォルト "支払期日" */
  summary?: string;
  /** 支払条件のラベル（例: "月末締め翌月末払い"）。説明欄に入る */
  label?: string;
  /** カレンダー名（X-WR-CALNAME） */
  calendarName?: string;
  /** DTSTAMP に使う日時。デフォルトは現在時刻 */
  now?: Date;
}

const ymd = (s: string) => s.replace(/-/g, "");

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** RFC 5545 の行折り返し（1行75オクテット以内。マルチバイト文字の途中では切らない） */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // 継続行は先頭の空白1オクテット分を引く
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * 支払スケジュールを iCalendar（.ics）形式にする。支払期日を終日予定として登録できる
 *
 * @example
 * toICalendar(listPaymentSchedules("2026-10-01", 12, "月末締め翌月末払い"), { label: "月末締め翌月末払い" })
 */
export function toICalendar(schedules: readonly PaymentSchedule[], options: ICalendarOptions = {}): string {
  const { summary = "支払期日", label, calendarName, now = new Date() } = options;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//shimebi//shimebi//JA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (calendarName) lines.push(`X-WR-CALNAME:${escapeText(calendarName)}`);
  for (const s of schedules) {
    const end = addDays(toPlain(s.paymentDate), 1);
    const endStr = `${end.y}${String(end.m).padStart(2, "0")}${String(end.d).padStart(2, "0")}`;
    const desc = [
      label ? `支払条件: ${label}` : undefined,
      `対象期間: ${s.periodStart} 〜 ${s.closingDate}`,
      s.adjusted ? `本来の支払日 ${s.scheduledPaymentDate} が休業日のため調整` : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ymd(s.closingDate)}-${ymd(s.paymentDate)}@shimebi`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(s.paymentDate)}`,
      `DTEND;VALUE=DATE:${endStr}`,
      `SUMMARY:${escapeText(`${summary}（${s.closingDate} 締め分）`)}`,
      `DESCRIPTION:${escapeText(desc)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

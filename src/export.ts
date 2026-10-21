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

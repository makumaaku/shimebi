#!/usr/bin/env node
import { formatPaymentTerms, listPaymentSchedules, parsePaymentTerms, type HolidayAdjustment, type CalendarType } from "./index.js";

const HELP = `shimebi — 締め日・支払期日を計算する

使い方:
  shimebi <支払条件> [取引日] [オプション]

例:
  shimebi 月末締め翌月末払い
  shimebi 20日締め翌月10日払い 2026-12-25
  shimebi 月末締め翌月末払い 2026-10-01 --count 6
  shimebi 15日締め翌月15日払い --adjust next --calendar national --json

オプション:
  -n, --count <n>       何期間分を表示するか (デフォルト: 1)
  -a, --adjust <mode>   休業日の調整: previous | next | modifiedNext | none (デフォルト: previous)
  -c, --calendar <type> 休業日カレンダー: bank | national | weekdays (デフォルト: bank)
      --json            JSONで出力
  -h, --help            ヘルプ
`;

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const dow = (s: string) => WEEK[new Date(`${s}T00:00:00Z`).getUTCDay()];

function main(argv: string[]): number {
  const positional: string[] = [];
  let count = 1;
  let adjustment: HolidayAdjustment | undefined;
  let calendar: CalendarType | undefined;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") {
      process.stdout.write(HELP);
      return 0;
    } else if (a === "-n" || a === "--count") count = Number(argv[++i]);
    else if (a === "-a" || a === "--adjust") adjustment = argv[++i] as HolidayAdjustment;
    else if (a === "-c" || a === "--calendar") calendar = argv[++i] as CalendarType;
    else if (a === "--json") json = true;
    else positional.push(a);
  }
  if (positional.length === 0) {
    process.stderr.write(HELP);
    return 1;
  }
  const [termsText, dateText] = positional as [string, string | undefined];
  const terms = parsePaymentTerms(termsText);
  const from = dateText ?? new Date();
  const rows = listPaymentSchedules(from, Number.isFinite(count) && count > 0 ? count : 1, terms, { adjustment, calendar });

  if (json) {
    process.stdout.write(`${JSON.stringify({ terms, label: formatPaymentTerms(terms), schedules: rows }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`支払条件: ${formatPaymentTerms(terms)}\n\n`);
  for (const r of rows) {
    const note = r.adjusted ? `  (本来 ${r.scheduledPaymentDate}(${dow(r.scheduledPaymentDate)}) が休業日のため調整)` : "";
    process.stdout.write(
      `対象期間 ${r.periodStart} 〜 ${r.closingDate}(${dow(r.closingDate)})  →  支払期日 ${r.paymentDate}(${dow(r.paymentDate)})${note}\n`,
    );
  }
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exitCode = 1;
}

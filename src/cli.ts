#!/usr/bin/env node
import { createRequire } from "node:module";
import { formatPaymentTerms, listPaymentSchedules, parsePaymentTerms, toCSV, toICalendar, type HolidayAdjustment, type CalendarType } from "./index.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const HELP = `shimebi — 締め日・支払期日を計算する

使い方:
  shimebi <支払条件> [取引日] [オプション]

例:
  shimebi 月末締め翌月末払い
  shimebi 20日締め翌月10日払い 2026-12-25
  shimebi 月末締め翌月末払い 2026-10-01 --count 6
  shimebi 15日締め翌月15日払い --adjust next --calendar national --json
  shimebi 月末締め翌月末払い 2026-04-01 -n 12 --csv > 支払予定.csv
  shimebi 20日締め翌月10日払い -n 12 --ics > 支払期日.ics

オプション:
  -n, --count <n>       何期間分を表示するか (デフォルト: 1)
  -a, --adjust <mode>   休業日の調整: previous | next | modifiedNext | none (デフォルト: previous)
  -c, --calendar <type> 休業日カレンダー: bank | national | weekdays (デフォルト: bank)
      --json            JSONで出力
      --csv             CSVで出力（日本語見出し）
      --ics             iCalendar(.ics)で出力。支払期日をカレンダーに取り込める
  -v, --version         バージョンを表示
  -h, --help            ヘルプ
`;

const ADJUSTMENTS: readonly HolidayAdjustment[] = ["previous", "next", "modifiedNext", "none"];
const CALENDARS: readonly CalendarType[] = ["bank", "national", "weekdays"];

class UsageError extends Error {}

function oneOf<T extends string>(option: string, value: string | undefined, allowed: readonly T[]): T {
  if (value === undefined || !(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`${option} には ${allowed.join(" | ")} のいずれかを指定してください (指定値: ${value ?? "なし"})`);
  }
  return value as T;
}

function positiveInt(option: string, value: string | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`${option} には1以上の整数を指定してください (指定値: ${value ?? "なし"})`);
  return n;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const dow = (s: string) => WEEK[new Date(`${s}T00:00:00Z`).getUTCDay()];

function main(argv: string[]): number {
  const positional: string[] = [];
  let count = 1;
  let adjustment: HolidayAdjustment | undefined;
  let calendar: CalendarType | undefined;
  type Output = "text" | "json" | "csv" | "ics";
  let output = "text" as Output;
  const setOutput = (o: Output) => {
    if (output !== "text" && output !== o) throw new UsageError("--json / --csv / --ics はどれか1つだけ指定できます");
    output = o;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") {
      process.stdout.write(HELP);
      return 0;
    } else if (a === "-v" || a === "--version") {
      process.stdout.write(`${version}\n`);
      return 0;
    } else if (a === "-n" || a === "--count") count = positiveInt(a, argv[++i]);
    else if (a === "-a" || a === "--adjust") adjustment = oneOf(a, argv[++i], ADJUSTMENTS);
    else if (a === "-c" || a === "--calendar") calendar = oneOf(a, argv[++i], CALENDARS);
    else if (a === "--json") setOutput("json");
    else if (a === "--csv") setOutput("csv");
    else if (a === "--ics") setOutput("ics");
    else if (a.startsWith("-") && a.length > 1 && !/^-\d/.test(a)) throw new UsageError(`不明なオプション: ${a}`);
    else positional.push(a);
  }
  if (positional.length === 0) {
    process.stderr.write(HELP);
    return 1;
  }
  const [termsText, dateText] = positional as [string, string | undefined];
  const terms = parsePaymentTerms(termsText);
  const from = dateText ?? new Date();
  const rows = listPaymentSchedules(from, count, terms, { adjustment, calendar });

  const label = formatPaymentTerms(terms);
  if (output === "json") {
    process.stdout.write(`${JSON.stringify({ terms, label, schedules: rows }, null, 2)}\n`);
    return 0;
  }
  if (output === "csv") {
    process.stdout.write(toCSV(rows, { header: "ja" }));
    return 0;
  }
  if (output === "ics") {
    process.stdout.write(toICalendar(rows, { label, calendarName: `支払期日（${label}）` }));
    return 0;
  }
  process.stdout.write(`支払条件: ${label}\n\n`);
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
  if (e instanceof UsageError) process.stderr.write("使い方は shimebi --help を参照してください\n");
  process.exitCode = 1;
}

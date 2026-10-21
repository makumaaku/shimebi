# shimebi（締め日）

[![CI](https://github.com/makumaaku/shimebi/actions/workflows/ci.yml/badge.svg)](https://github.com/makumaaku/shimebi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

「**月末締め翌月末払い**」「**20日締め翌月10日払い**」といった日本の支払条件から、**締め日**と**支払期日**を計算する TypeScript ライブラリ & CLI です。支払日が土日祝や銀行休業日（12/31〜1/3）に当たる場合の前営業日・翌営業日への調整もできます。

- 依存パッケージなし。祝日（振替休日・国民の休日を含む）もライブラリ内で計算します
- 支払条件を日本語の文字列のまま渡せます（全角数字・「〆」「、」などの表記ゆれにも対応）
- ESM / CommonJS / 型定義つき。Node.js・ブラウザ・Deno・Bun・n8n の Code ノードで使えます

> 請求書の支払期日を出す、資金繰り表に入金予定日を並べる、カレンダーに支払日を登録する、といった処理はアプリごとに毎回書かれがちです。ここで一度ちゃんと実装しておくためのライブラリです。

## インストール

```bash
npm install shimebi
```

## 使い方

```ts
import { getPaymentSchedule, getPaymentDate } from "shimebi";

getPaymentDate("2026-10-21", "月末締め翌月末払い");
// => "2026-11-30"

getPaymentSchedule("2026-11-15", "月末締め翌月末払い");
// => {
//   periodStart: "2026-11-01",
//   closingDate: "2026-11-30",
//   scheduledPaymentDate: "2026-12-31",
//   paymentDate: "2026-12-30",   // 12/31 は銀行休業日なので前営業日に調整
//   adjusted: true
// }

// 締め日を過ぎた取引は次の期間に入る
getPaymentSchedule("2026-12-25", "20日締め翌月10日払い");
// => { periodStart: "2026-12-21", closingDate: "2027-01-20", paymentDate: "2027-02-10", ... }
```

### 休業日の調整

```ts
// 2027-01-31 は日曜日
getPaymentDate("2026-12-10", "月末締め翌月末払い");                                // "2027-01-29"（前営業日、デフォルト）
getPaymentDate("2026-12-10", "月末締め翌月末払い", { adjustment: "next" });         // "2027-02-01"（翌営業日）
getPaymentDate("2026-12-10", "月末締め翌月末払い", { adjustment: "modifiedNext" }); // "2027-01-29"（翌営業日。月をまたぐときは前営業日）
getPaymentDate("2026-12-10", "月末締め翌月末払い", { adjustment: "none" });         // "2027-01-31"（調整しない）
```

| `calendar` | 休業日 |
| --- | --- |
| `"bank"`（デフォルト） | 土日・祝日・12/31・1/2・1/3（銀行休業日） |
| `"national"` | 土日・祝日 |
| `"weekdays"` | 土日のみ |

自社の休業日は `extraHolidays`、臨時の営業日は `excludeHolidays`、それ以外の独自ルールは `isHoliday` で指定します。

```ts
getPaymentDate("2026-07-10", "月末締め翌月15日払い", {
  extraHolidays: ["2026-08-13", "2026-08-14"], // 夏季休業
});
```

### 支払条件をオブジェクトで指定する

```ts
getPaymentDate("2026-10-21", {
  closingDay: 20,       // 締め日（"end" で月末）
  monthOffset: 1,       // 0=当月, 1=翌月, 2=翌々月 ...
  paymentDay: 10,       // 支払日（"end" で末日）
  adjustment: "previous",
  calendar: "bank",
});
```

### 文字列のパースと整形

```ts
import { parsePaymentTerms, formatPaymentTerms } from "shimebi";

parsePaymentTerms("１５日〆、翌々月５日支払");
// => { closingDay: 15, monthOffset: 2, paymentDay: 5 }

formatPaymentTerms({ closingDay: "end", monthOffset: 1, paymentDay: "end" });
// => "月末締め翌月末払い"
```

パースできる表記の例:

- `月末締め翌月末払い` / `末締め翌月末日払い` / `毎月末日締め 翌々月末 支払い`
- `20日締め翌月10日払い` / `25日締め、翌月25日払い` / `１５日〆翌々月５日支払`
- `15日締め当月末払い` / `月末締め3ヶ月後10日払い` / `月末締切翌月20日振込`

### 期間ごとの一覧（資金繰り表・カレンダー向け）

```ts
import { listPaymentSchedules } from "shimebi";

listPaymentSchedules("2026-10-01", 3, "月末締め翌月末払い");
// => [
//   { closingDate: "2026-10-31", paymentDate: "2026-11-30", ... },
//   { closingDate: "2026-11-30", paymentDate: "2026-12-30", ... },
//   { closingDate: "2026-12-31", paymentDate: "2027-01-29", ... },
// ]
```

### CSV に書き出す

```ts
import { listPaymentSchedules, toCSV } from "shimebi";

toCSV(listPaymentSchedules("2026-10-01", 3, "月末締め翌月末払い"), { header: "ja", bom: true });
// 対象期間開始,締め日,支払予定日,支払期日,休業日調整
// 2026-10-01,2026-10-31,2026-11-30,2026-11-30,false
// ...
```

`header` は `"en"`（デフォルト）/ `"ja"` / `false`、`bom: true` で Excel でも文字化けしない UTF-8 BOM を付けます。

### カレンダーに登録する（iCalendar）

```ts
import { listPaymentSchedules, toICalendar } from "shimebi";

const ics = toICalendar(listPaymentSchedules("2026-10-01", 12, "月末締め翌月末払い"), {
  label: "月末締め翌月末払い",
  calendarName: "取引先A 支払期日",
});
// 支払期日ごとの終日予定。.ics として保存して Google カレンダーや Outlook にインポートできます
```

CLI なら `npx shimebi 月末締め翌月末払い -n 12 --ics > 支払期日.ics` で同じファイルが作れます。

### 営業日・祝日のユーティリティ

```ts
import { isBusinessDay, addBusinessDays, getHolidayName, holidaysOf } from "shimebi";

addBusinessDays("2026-12-30", 1);            // "2027-01-04"（年末年始の銀行休業日を飛ばす）
isBusinessDay("2026-09-22");                 // false（国民の休日）
getHolidayName("2026-05-06");                // "振替休日"
holidaysOf(2027);                            // Map { "2027-01-01" => "元日", ... }
```

## CLI

```bash
npx shimebi 月末締め翌月末払い 2026-10-01 -n 4
```

```
支払条件: 月末締め翌月末払い

対象期間 2026-10-01 〜 2026-10-31(土)  →  支払期日 2026-11-30(月)
対象期間 2026-11-01 〜 2026-11-30(月)  →  支払期日 2026-12-30(水)  (本来 2026-12-31(木) が休業日のため調整)
対象期間 2026-12-01 〜 2026-12-31(木)  →  支払期日 2027-01-29(金)  (本来 2027-01-31(日) が休業日のため調整)
対象期間 2027-01-01 〜 2027-01-31(日)  →  支払期日 2027-02-26(金)  (本来 2027-02-28(日) が休業日のため調整)
```

オプション: `-n/--count`、`-a/--adjust previous|next|modifiedNext|none`、`-c/--calendar bank|national|weekdays`、`--json`、`--csv`、`--ics`、`-v/--version`

## 仕様

- **締め日**: 取引日（納品日・検収日など）がその月の締め日以前ならその月の締め日、過ぎていれば翌月の締め日。締め日はその日を含みます。
- **月末の丸め**: `30日締め` の場合、2月は月末（28日 / 29日）に丸めます。`31日` は月末と同じ扱いです。
- **支払日**: 締め日の月から `monthOffset` か月後の `paymentDay`。支払日が締め日より前になる条件（例: `25日締め当月10日払い`）はエラーになります。
- **日付の入出力**: 入力は `"YYYY-MM-DD"` 文字列または `Date`（ローカル日付として解釈）。出力は常に `"YYYY-MM-DD"` 文字列なので、タイムゾーンのずれは起きません。
- **祝日**: 2000〜2099年に対応。2000〜2050年は [holiday_jp](https://github.com/holiday-jp/holiday_jp) のデータと一致することをテストで確認しています。春分・秋分の日は計算式で出しているため、将来の官報公示と違う年があれば `extraHolidays` / `excludeHolidays` で補正してください。祝日法が改正された場合はライブラリの更新で対応します。

## English

**shimebi** calculates closing dates and payment due dates from Japanese payment terms such as `月末締め翌月末払い` ("close at month-end, pay at the end of the following month"). If the due date falls on a weekend, a Japanese national holiday, or a bank holiday (Dec 31 – Jan 3), it can shift the date to the previous or next business day. It has no dependencies, includes its own Japanese holiday calculation, and ships ESM, CJS, type definitions and a CLI.

```ts
import { getPaymentDate } from "shimebi";
getPaymentDate("2026-11-15", "月末締め翌月末払い"); // "2026-12-30" (Dec 31 is a bank holiday)
```

## License

MIT © Maaku Saito ([Boring LLC](https://boring-tool.com))

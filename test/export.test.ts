import { describe, expect, it } from "vitest";
import { listPaymentSchedules, toCSV } from "../src/index.js";

const rows = listPaymentSchedules("2026-10-01", 2, "月末締め翌月末払い");

describe("toCSV", () => {
  it("デフォルトは英語見出し・LF", () => {
    expect(toCSV(rows)).toBe(
      [
        "periodStart,closingDate,scheduledPaymentDate,paymentDate,adjusted",
        "2026-10-01,2026-10-31,2026-11-30,2026-11-30,false",
        "2026-11-01,2026-11-30,2026-12-31,2026-12-30,true",
        "",
      ].join("\n"),
    );
  });

  it("日本語見出し・BOM・CRLF", () => {
    const out = toCSV(rows, { header: "ja", bom: true, eol: "\r\n" });
    expect(out.startsWith("\uFEFF対象期間開始,締め日,支払予定日,支払期日,休業日調整\r\n")).toBe(true);
    expect(out.endsWith("true\r\n")).toBe(true);
  });

  it("見出しなし・空配列", () => {
    expect(toCSV(rows, { header: false }).split("\n")[0]).toBe("2026-10-01,2026-10-31,2026-11-30,2026-11-30,false");
    expect(toCSV([], { header: false })).toBe("\n");
  });
});

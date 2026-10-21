import { describe, expect, it } from "vitest";
import { listPaymentSchedules, toCSV, toICalendar } from "../src/index.js";

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

describe("toICalendar", () => {
  const now = new Date("2026-10-21T00:00:00Z");
  const ics = toICalendar(rows, { label: "月末締め翌月末払い", calendarName: "支払期日", now });
  const lines = ics.split("\r\n");

  it("VCALENDAR と終日の VEVENT を出力する", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines).toContain("DTSTART;VALUE=DATE:20261230");
    expect(lines).toContain("DTEND;VALUE=DATE:20261231");
    expect(lines).toContain("UID:20261130-20261230@shimebi");
    expect(lines).toContain("DTSTAMP:20261021T000000Z");
  });

  it("説明欄に支払条件と休業日調整を入れる", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:支払条件: 月末締め翌月末払い\\n対象期間: 2026-11-01 〜 2026-11-30\\n本来の支払日 2026-12-31 が休業日のため調整");
  });

  it("各行は75オクテット以内に折り返す", () => {
    const enc = new TextEncoder();
    for (const l of lines) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
  });

  it("テキストのエスケープ", () => {
    const out = toICalendar(rows.slice(0, 1), { summary: "A社, B社; 支払", now });
    expect(out).toContain("SUMMARY:A社\\, B社\\; 支払（2026-10-31 締め分）");
  });
});

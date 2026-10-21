import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  formatPaymentTerms,
  getClosingDate,
  getPaymentDate,
  getPaymentSchedule,
  isBusinessDay,
  listPaymentSchedules,
  parsePaymentTerms,
} from "../src/index.js";

describe("parsePaymentTerms", () => {
  const cases: [string, object][] = [
    ["月末締め翌月末払い", { closingDay: "end", monthOffset: 1, paymentDay: "end" }],
    ["末締め翌月末日払い", { closingDay: "end", monthOffset: 1, paymentDay: "end" }],
    ["20日締め翌月10日払い", { closingDay: 20, monthOffset: 1, paymentDay: 10 }],
    ["１５日〆翌々月５日支払", { closingDay: 15, monthOffset: 2, paymentDay: 5 }],
    ["25日締め、翌月25日払い", { closingDay: 25, monthOffset: 1, paymentDay: 25 }],
    ["毎月末日締め 翌々月末 支払い", { closingDay: "end", monthOffset: 2, paymentDay: "end" }],
    ["15日締め当月末払い", { closingDay: 15, monthOffset: 0, paymentDay: "end" }],
    ["月末締め3ヶ月後10日払い", { closingDay: "end", monthOffset: 3, paymentDay: 10 }],
    ["31日締め翌月31日払い", { closingDay: "end", monthOffset: 1, paymentDay: "end" }],
    ["月末締切翌月20日振込", { closingDay: "end", monthOffset: 1, paymentDay: 20 }],
  ];
  for (const [text, expected] of cases) {
    it(text, () => expect(parsePaymentTerms(text)).toEqual(expected));
  }

  it("throws on unknown text", () => {
    expect(() => parsePaymentTerms("なるはやで払う")).toThrow(SyntaxError);
    expect(() => parsePaymentTerms("0日締め翌月末払い")).toThrow(SyntaxError);
  });

  it("formats back to text", () => {
    expect(formatPaymentTerms({ closingDay: "end", monthOffset: 1, paymentDay: "end" })).toBe("月末締め翌月末払い");
    expect(formatPaymentTerms({ closingDay: 20, monthOffset: 2, paymentDay: 10 })).toBe("20日締め翌々月10日払い");
    expect(formatPaymentTerms({ closingDay: 15, monthOffset: 0, paymentDay: "end" })).toBe("15日締め当月末払い");
  });
});

describe("getPaymentSchedule", () => {
  it("月末締め翌月末払い（調整なし）", () => {
    expect(getPaymentSchedule("2026-10-21", "月末締め翌月末払い")).toEqual({
      periodStart: "2026-10-01",
      closingDate: "2026-10-31",
      scheduledPaymentDate: "2026-11-30",
      paymentDate: "2026-11-30",
      adjusted: false,
    });
  });

  it("12/31 は銀行休業日なので前営業日に調整", () => {
    const s = getPaymentSchedule("2026-11-15", "月末締め翌月末払い");
    expect(s.scheduledPaymentDate).toBe("2026-12-31");
    expect(s.paymentDate).toBe("2026-12-30");
    expect(s.adjusted).toBe(true);
    // national カレンダーでは 12/31 は営業日
    expect(getPaymentDate("2026-11-15", "月末締め翌月末払い", { calendar: "national" })).toBe("2026-12-31");
  });

  it("日曜の支払日: previous / next / modifiedNext", () => {
    // 2027-01-31 は日曜
    expect(getPaymentDate("2026-12-10", "月末締め翌月末払い")).toBe("2027-01-29");
    expect(getPaymentDate("2026-12-10", "月末締め翌月末払い", { adjustment: "next" })).toBe("2027-02-01");
    expect(getPaymentDate("2026-12-10", "月末締め翌月末払い", { adjustment: "modifiedNext" })).toBe("2027-01-29");
    expect(getPaymentDate("2026-12-10", "月末締め翌月末払い", { adjustment: "none" })).toBe("2027-01-31");
  });

  it("20日締め翌月10日払い: 締め日を過ぎた取引は翌期間", () => {
    expect(getPaymentSchedule("2026-12-20", "20日締め翌月10日払い").closingDate).toBe("2026-12-20");
    const s = getPaymentSchedule("2026-12-25", "20日締め翌月10日払い");
    expect(s.periodStart).toBe("2026-12-21");
    expect(s.closingDate).toBe("2027-01-20");
    expect(s.paymentDate).toBe("2027-02-10");
  });

  it("30日締めは2月なら月末に丸める", () => {
    const s = getPaymentSchedule("2027-02-15", "30日締め翌月30日払い");
    expect(s.closingDate).toBe("2027-02-28");
    expect(s.scheduledPaymentDate).toBe("2027-03-30");
    expect(getPaymentSchedule("2027-03-01", "30日締め翌月30日払い").periodStart).toBe("2027-03-01");
  });

  it("オブジェクト指定・extraHolidays", () => {
    const terms = { closingDay: 15, monthOffset: 1, paymentDay: 15, extraHolidays: ["2026-11-16"] };
    // 2026-11-15 は日曜 → 前営業日 11/13(金)
    expect(getPaymentDate("2026-10-01", terms)).toBe("2026-11-13");
    expect(getPaymentDate("2026-10-01", terms, { adjustment: "next" })).toBe("2026-11-17");
  });

  it("Date オブジェクトも受け付ける", () => {
    expect(getPaymentDate(new Date(2026, 9, 21), "月末締め翌月末払い")).toBe("2026-11-30");
  });

  it("支払日が締め日より前ならエラー", () => {
    expect(() => getPaymentDate("2026-10-01", "25日締め当月10日払い")).toThrow(RangeError);
  });

  it("不正な日付はエラー", () => {
    expect(() => getPaymentDate("2026-02-30", "月末締め翌月末払い")).toThrow(RangeError);
  });
});

describe("getClosingDate / listPaymentSchedules", () => {
  it("getClosingDate", () => {
    expect(getClosingDate("2026-10-21", 20)).toBe("2026-11-20");
    expect(getClosingDate("2026-10-21", "end")).toBe("2026-10-31");
    expect(getClosingDate("2026-10-21", "15日締め翌月15日払い")).toBe("2026-11-15");
  });

  it("listPaymentSchedules", () => {
    const rows = listPaymentSchedules("2026-10-01", 3, "月末締め翌月末払い");
    expect(rows.map((r) => [r.closingDate, r.paymentDate])).toEqual([
      ["2026-10-31", "2026-11-30"],
      ["2026-11-30", "2026-12-30"],
      ["2026-12-31", "2027-01-29"],
    ]);
  });
});

describe("business days", () => {
  it("銀行休業日（年末年始）を飛ばす", () => {
    expect(addBusinessDays("2026-12-30", 1)).toBe("2027-01-04");
    expect(addBusinessDays("2026-12-30", 1, { calendar: "national" })).toBe("2026-12-31");
    expect(addBusinessDays("2027-01-04", -1)).toBe("2026-12-30");
    expect(isBusinessDay("2027-01-02", { calendar: "weekdays" })).toBe(false); // 土曜
    expect(isBusinessDay("2026-09-22")).toBe(false); // 国民の休日
    expect(isBusinessDay("2026-10-21")).toBe(true);
  });

  it("excludeHolidays / isHoliday", () => {
    expect(isBusinessDay("2026-12-31", { excludeHolidays: ["2026-12-31"] })).toBe(true);
    expect(isBusinessDay("2026-10-21", { isHoliday: (d) => d.endsWith("-21") })).toBe(false);
  });
});

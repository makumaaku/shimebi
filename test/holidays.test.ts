import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { getHolidayName, holidaysOf } from "../src/index.js";

const require = createRequire(import.meta.url);
const ref = require("@holiday-jp/holiday_jp") as { holidays: Record<string, { name: string }> };

describe("holidays", () => {
  // 外部データ (holiday_jp) と 2000〜2050 年の祝日日付が完全一致することを確認
  for (let y = 2000; y <= 2050; y++) {
    it(`matches holiday_jp for ${y}`, () => {
      const expected = Object.keys(ref.holidays).filter((d) => d.startsWith(`${y}-`)).sort();
      const actual = [...holidaysOf(y).keys()];
      expect(actual).toEqual(expected);
    });
  }

  it("returns holiday names", () => {
    expect(getHolidayName("2026-01-01")).toBe("元日");
    expect(getHolidayName("2026-09-22")).toBe("休日"); // シルバーウィークの国民の休日
    expect(getHolidayName("2026-05-06")).toBe("振替休日");
    expect(getHolidayName("2026-10-21")).toBeUndefined();
  });
});

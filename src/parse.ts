import type { DayOfMonth, PaymentTerms } from "./terms.js";

/** 全角英数→半角、空白除去、表記ゆれの正規化 */
function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]/g, "")
    .replace(/[〆メ]/g, "締め")
    .replace(/締め?切り?/g, "締め")
    .replace(/翌翌月|翌々月/g, "翌々月")
    .replace(/[、,，・\/／]/g, "")
    .replace(/^毎月/, "");
}

const OFFSET: Record<string, number> = { 当月: 0, 同月: 0, 翌月: 1, 来月: 1, 翌々月: 2, 再来月: 2 };

const RE =
  /^(?:(月末|末日|末|\d{1,2}日)締め?(?:日)?(?:で|の)?)(当月|同月|翌月|来月|翌々月|再来月|\d+[ヶケかカヵ]?月後)の?(末日?|\d{1,2}日)(?:払い?|支払い?|支払|入金|振込|振り込み|決済)?$/;

function day(token: string): DayOfMonth {
  if (token.startsWith("末") || token === "月末") return "end";
  const n = Number(token.replace("日", ""));
  return n >= 31 ? "end" : n;
}

/**
 * 「月末締め翌月末払い」のような支払条件の文字列をパースする
 *
 * 対応例: 月末締め翌月末払い / 20日締め翌月10日払い / 15日〆翌々月5日支払 / 末締め当月末払い /
 *         ２５日締め、翌月２５日払い / 月末締め2ヶ月後10日払い
 */
export function parsePaymentTerms(text: string): PaymentTerms {
  const s = normalize(text);
  const m = RE.exec(s);
  if (!m) throw new SyntaxError(`Unrecognized payment terms: "${text}"`);
  const [, closing, offset, pay] = m as unknown as [string, string, string, string];
  const monthOffset = offset in OFFSET ? OFFSET[offset]! : Number(offset.match(/\d+/)![0]);
  const terms: PaymentTerms = { closingDay: day(closing), monthOffset, paymentDay: day(pay) };
  for (const d of [terms.closingDay, terms.paymentDay]) {
    if (d !== "end" && d < 1) throw new SyntaxError(`Invalid day in payment terms: "${text}"`);
  }
  return terms;
}

/** PaymentTerms を「20日締め翌月10日払い」形式の文字列にする */
export function formatPaymentTerms(terms: Pick<PaymentTerms, "closingDay" | "monthOffset" | "paymentDay">): string {
  const closing = terms.closingDay === "end" || terms.closingDay >= 31 ? "月末" : `${terms.closingDay}日`;
  const offset =
    terms.monthOffset === 0 ? "当月" : terms.monthOffset === 1 ? "翌月" : terms.monthOffset === 2 ? "翌々月" : `${terms.monthOffset}ヶ月後`;
  const pay = terms.paymentDay === "end" || terms.paymentDay >= 31 ? "末" : `${terms.paymentDay}日`;
  return `${closing}締め${offset}${pay}払い`;
}

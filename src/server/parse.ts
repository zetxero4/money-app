// แยกข้อความที่พิมพ์ในช่องเดียว เช่น "ข้าวมันไก่ 60 กาแฟ 55" หรือ "เมื่อวานค่าแท็กซี่ 120" เป็นรายการ

import { bahtToSatang } from "./money";
import { addDays, todayInBangkok } from "./thai-date";
import { guessKind, type Kind } from "./categories";

export interface ParsedItem {
  note: string;
  amountSatang: number;
  kind: Kind;
  occurredOn: string;
}

// เรียงคำยาวก่อน เพื่อไม่ให้ "เมื่อวาน" กิน "เมื่อวานซืน"
const DATE_WORDS: Array<[string, number]> = [
  ["เมื่อวานซืน", -2],
  ["เมื่อวาน", -1],
  ["วันนี้", 0],
];

const ITEM_RE = /([^\d]*?)\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:บาท|฿)?/g;

export function parseEntry(input: string, today: string = todayInBangkok()): ParsedItem[] {
  let text = input.trim();
  let offset = 0;
  for (const [word, days] of DATE_WORDS) {
    if (text.includes(word)) {
      offset = days;
      text = text.split(word).join(" ");
      break;
    }
  }
  const occurredOn = addDays(today, offset);

  const items: ParsedItem[] = [];
  for (const match of text.matchAll(ITEM_RE)) {
    const note = match[1].replace(/^[\s,;:+\-–]+|[\s,;:+\-–]+$/g, "").trim();
    const amountSatang = bahtToSatang(match[2]);
    if (amountSatang === null) continue;
    items.push({ note, amountSatang, kind: guessKind(note), occurredOn });
  }
  return items;
}

// หมวดเริ่มต้น (สร้างให้ตอนสมัครบัญชีเจ้าของ) และตัวเดาหมวดจากคำในโน้ต

export type Kind = "income" | "expense";

export interface CategorySeed {
  name: string;
  kind: Kind;
  icon: string; // ชื่อไอคอน lucide
  keywords: string[];
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: "อาหาร",
    kind: "expense",
    icon: "utensils",
    keywords: ["ข้าว", "กะเพรา", "ก๋วยเตี๋ยว", "ส้มตำ", "หมู", "ไก่", "ไข่", "ผัด", "ต้ม", "แกง", "ราดหน้า", "บะหมี่", "ขนม", "อาหาร", "มื้อ", "pizza", "kfc", "mk", "ชาบู", "หมูกระทะ", "ซูชิ"],
  },
  {
    name: "เครื่องดื่ม/กาแฟ",
    kind: "expense",
    icon: "coffee",
    keywords: ["กาแฟ", "ชา", "ชานม", "น้ำ", "โกโก้", "ลาเต้", "อเมริกาโน่", "starbucks", "amazon", "นม"],
  },
  {
    name: "เดินทาง",
    kind: "expense",
    icon: "car",
    keywords: ["แท็กซี่", "taxi", "grab", "bolt", "รถ", "bts", "mrt", "น้ำมัน", "ทางด่วน", "วิน", "มอไซค์", "รถเมล์", "ค่าจอด", "เรือ"],
  },
  {
    name: "ช้อปปิ้ง",
    kind: "expense",
    icon: "shopping-bag",
    keywords: ["เสื้อ", "รองเท้า", "กางเกง", "shopee", "lazada", "ช้อป", "ของใช้", "7-11", "เซเว่น", "lotus", "big c", "ซุปเปอร์"],
  },
  {
    name: "บิล/ค่าน้ำไฟ",
    kind: "expense",
    icon: "receipt",
    keywords: ["ค่าไฟ", "ค่าน้ำ", "ค่าเน็ต", "อินเทอร์เน็ต", "ค่าโทรศัพท์", "ค่าเช่า", "ค่าห้อง", "บิล", "ประกัน", "ผ่อน"],
  },
  {
    name: "บันเทิง",
    kind: "expense",
    icon: "clapperboard",
    keywords: ["หนัง", "netflix", "youtube", "spotify", "เกม", "คอนเสิร์ต", "เที่ยว", "ดูหนัง"],
  },
  {
    name: "สุขภาพ",
    kind: "expense",
    icon: "heart-pulse",
    keywords: ["ยา", "หมอ", "คลินิก", "โรงพยาบาล", "ฟิตเนส", "ยิม", "หาหมอ", "ทำฟัน"],
  },
  { name: "อื่นๆ", kind: "expense", icon: "circle-ellipsis", keywords: [] },
  {
    name: "เงินเดือน",
    kind: "income",
    icon: "wallet",
    keywords: ["เงินเดือน", "salary"],
  },
  {
    name: "รายได้เสริม",
    kind: "income",
    icon: "trending-up",
    keywords: ["รายได้เสริม", "ฟรีแลนซ์", "freelance", "ขายของ", "ค่าจ้าง", "โบนัส", "ปันผล", "ดอกเบี้ย", "ค่าคอม"],
  },
  { name: "รายรับอื่นๆ", kind: "income", icon: "piggy-bank", keywords: ["ได้เงิน", "รับเงิน", "โอนเข้า", "คืนเงิน"] },
];

/** คำที่บอกว่าเป็นรายรับ ถ้าไม่เจอถือเป็นรายจ่าย */
const INCOME_HINTS = ["เงินเดือน", "เงินเข้า", "รายได้", "ได้เงิน", "รับเงิน", "โอนเข้า", "โบนัส", "ปันผล", "ดอกเบี้ย", "ค่าคอม", "ขายของได้", "salary"];

export function guessKind(note: string): Kind {
  const text = note.toLowerCase();
  return INCOME_HINTS.some((h) => text.includes(h)) ? "income" : "expense";
}

export interface CategoryLike {
  id: string;
  name: string;
  kind: Kind;
  keywords: string;
}

/** เลือกหมวดที่ keyword ยาวที่สุดตรงกับโน้ต ถ้าไม่เจอใช้หมวด "อื่นๆ" ของประเภทนั้น */
export function guessCategory<T extends CategoryLike>(note: string, kind: Kind, categories: T[]): T | undefined {
  const text = note.toLowerCase();
  let best: { cat: T; len: number } | undefined;
  for (const cat of categories) {
    if (cat.kind !== kind) continue;
    for (const kw of cat.keywords.split(",")) {
      const k = kw.trim().toLowerCase();
      if (k && text.includes(k) && (!best || k.length > best.len)) best = { cat, len: k.length };
    }
  }
  if (best) return best.cat;
  const fallbackName = kind === "income" ? "รายรับอื่นๆ" : "อื่นๆ";
  return categories.find((c) => c.kind === kind && c.name === fallbackName) ?? categories.find((c) => c.kind === kind);
}

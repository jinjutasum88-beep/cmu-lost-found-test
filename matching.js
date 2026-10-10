/* ===================================================================
   matching.js — เครื่องมือจับคู่ประกาศของหาย/ของพบ ด้วยเทคนิค NLP
   -------------------------------------------------------------------
   ทำไมต้องเขียนเอง: ภาษาไทยเขียนติดกันไม่มีเว้นวรรคระหว่างคำ
   วิธีนับคำแบบภาษาอังกฤษ (split ด้วยช่องว่าง) จึงใช้ไม่ได้
   ไฟล์นี้จึงผสมสามเทคนิคเข้าด้วยกัน:

   1) Text normalization + synonym mapping
      ยุบคำที่สะกดต่างกันแต่หมายถึงของเดียวกันให้เป็นคำเดียว
      เช่น "ไอโฟน" / "iPhone" / "ไอโฟน" → "iphone"

   2) Character n-gram Dice coefficient  (n = 3)
      ตัดข้อความเป็นชิ้นละ 3 ตัวอักษร แล้ววัดว่าซ้อนทับกันกี่ %
      ข้อดี: ใช้กับภาษาไทยได้โดยไม่ต้องมีตัวตัดคำ และทนคำสะกดผิด

   3) TF-IDF weighted token overlap
      ให้น้ำหนักคำที่ "หายาก" มากกว่าคำที่พบทั่วไป
      เช่น "สติกเกอร์ลายแมว" สำคัญกว่า "สีดำ" ที่ใครก็เขียน

   คะแนนรวม = ฐานจากหมวดหมู่+สี + ความคล้ายคำอธิบาย + สถานที่ + เวลา
   =================================================================== */

/* ---------- 1. คำพ้อง / การสะกดที่ต่างกัน ---------- */
const SYNONYMS = [
  [["ไอโฟน","iphone","ไอ โฟน","ไอ-โฟน"], "iphone"],
  [["ซัมซุง","samsung","ซำซุง"], "samsung"],
  [["โน้ตบุ๊ค","โน๊ตบุ๊ค","โน้ตบุ้ค","notebook","แลปท็อป","แล็ปท็อป","laptop"], "notebook"],
  [["กระเป๋าตังค์","กระเป๋าตัง","กระเป๋าสตางค์","wallet"], "กระเป๋าสตางค์"],
  [["หูฟัง","earphone","earbuds","airpods","แอร์พอด","แอร์พอดส์"], "หูฟัง"],
  [["บัตรนักศึกษา","บัตร นศ","บัตรนศ","student card","บัตรนักเรียน"], "บัตรนักศึกษา"],
  [["กุญแจ","ลูกกุญแจ","พวงกุญแจ","key","keychain"], "กุญแจ"],
  [["แว่น","แว่นตา","glasses"], "แว่นตา"],
  [["ร่ม","umbrella"], "ร่ม"],
  [["ขวดน้ำ","กระบอกน้ำ","แก้วน้ำ","bottle"], "ขวดน้ำ"],
  [["สายชาร์จ","สายชาร์ท","charger","ที่ชาร์จ"], "สายชาร์จ"],
  [["สีดำ","ดำ","black"], "ดำ"],
  [["สีขาว","ขาว","white"], "ขาว"],
  [["สีแดง","แดง","red"], "แดง"],
  [["สีน้ำเงิน","น้ำเงิน","สีฟ้า","ฟ้า","blue"], "น้ำเงิน"],
  [["สีเขียว","เขียว","green"], "เขียว"],
  [["สีเหลือง","เหลือง","yellow"], "เหลือง"],
  [["สีชมพู","ชมพู","pink"], "ชมพู"],
  [["สีเทา","เทา","gray","grey"], "เทา"],
  [["สีน้ำตาล","น้ำตาล","brown"], "น้ำตาล"],
  [["สติกเกอร์","สติ๊กเกอร์","sticker"], "สติกเกอร์"],
  [["รอยขีดข่วน","รอยขีด","ขีดข่วน","รอยถลอก","ตำหนิ"], "รอยขีดข่วน"],
  [["เคส","case","ปลอก"], "เคส"],
  [["อนิลโล่","อะเนลโล่","อนิเอลโล่","anello"], "anello"],
  [["ตุ๊กตา","พวงกุญแจตุ๊กตา","doll"], "ตุ๊กตา"],
  [["รูป","ลาย","ภาพ"], "ลาย"],
  [["แมว","cat","เหมียว"], "แมว"],
  [["หมา","สุนัข","dog"], "หมา"],
  [["คิตตี้","kitty","hello kitty","เฮลโลคิตตี้","เฮลโล คิตตี้"], "kitty"],

  /* ---- คำอังกฤษ ↔ ไทย ----
     จำเป็นเพราะเว็บรองรับสองภาษา นักศึกษาต่างชาติจะเขียนคำอธิบายเป็นอังกฤษ
     ถ้าไม่ยุบให้เป็นคำเดียวกัน ชั้นเทียบตัวอักษรจะได้ 0 สนิทเมื่อจับคู่ข้ามภาษา */
  [["bag","backpack","handbag","satchel","เป้","กระเป๋าเป้","กระเป๋าสะพาย"], "กระเป๋า"],
  [["key","keys","keychain","ลูกกุญแจ","พวงกุญแจ"], "กุญแจ"],
  // ระวัง: ห้ามใส่คำว่า "phone" เดี่ยวๆ เพราะจะไปกินคำว่า "iphone" กลายเป็น "iโทรศัพท์"
  [["mobile phone","cell phone","smartphone","mobile","มือถือ","โทรศัพท์มือถือ"], "โทรศัพท์"],
  [["student id","student card","id card","บัตร นศ","บัตรนศ"], "บัตรนักศึกษา"],
  [["wallet","purse"], "กระเป๋าสตางค์"],
  [["earphone","earphones","headphone","headphones","earbuds"], "หูฟัง"],
  [["glasses","eyeglasses","spectacles","แว่น"], "แว่นตา"],
  [["umbrella"], "ร่ม"],
  [["bottle","water bottle","tumbler","กระบอกน้ำ","แก้วน้ำ"], "ขวดน้ำ"],
  [["charger","cable","charging cable","ที่ชาร์จ","สายชาร์ท"], "สายชาร์จ"],
  [["notebook","note book","documents","document","สมุด","เอกสาร"], "สมุด"],
  [["clothes","clothing","shirt","jacket","hoodie","เสื้อ"], "เสื้อผ้า"],
  [["sticker","stickers"], "สติกเกอร์"],
  [["scratch","scratches","scratched","dent","รอยบุบ"], "รอยขีดข่วน"],
  [["black"], "ดำ"], [["white"], "ขาว"], [["red"], "แดง"],
  [["blue","navy"], "น้ำเงิน"], [["green"], "เขียว"], [["yellow"], "เหลือง"],
  [["pink"], "ชมพู"], [["grey","gray"], "เทา"], [["brown"], "น้ำตาล"],
  [["library","central library"], "หอสมุด"],
  [["engineering","faculty of engineering"], "วิศวกรรมศาสตร์"],
  [["canteen","cafeteria","food court"], "โรงอาหาร"],
  [["dormitory","dorm","dormitories"], "หอพัก"],
  [["stadium","sports field"], "สนามกีฬา"],
  [["found","i found","picked up"], "พบ"],
  [["lost","i lost","missing"], "หาย"]
];

/* ---------- 2. คำที่ไม่มีความหมายในการจับคู่ ---------- */
const STOPWORDS = new Set([
  "ที่","ของ","และ","หรือ","แต่","ก็","กับ","ให้","ได้","ไป","มา","มี","เป็น","อยู่",
  "ครับ","ค่ะ","คะ","นะ","จ้า","อะ","น่ะ","เลย","มาก","หน่อย","ด้วย","แล้ว","ยัง",
  "ผม","ฉัน","เรา","คุณ","ทำ","ใช้","ตัว","อัน","ชิ้น","ใบ","อัพ","the","a","an","is",
  "my","i","it","this","that","of","and","or","in","on","at","หาย","เจอ","พบ","ทำหาย"
]);

/* ---------- 3. ทำความสะอาดข้อความ ---------- */

/**
 * ข้อความมี "คำ" ให้วิเคราะห์จริงหรือไม่
 * ถ้าผู้ใช้พิมพ์แต่อีโมจิหรือสัญลักษณ์ จะไม่มีตัวอักษรไทย/อังกฤษเลย
 * กรณีนั้นจับคู่ด้วย NLP ไม่ได้ ต้องจัดเข้าหมวด "อื่นๆ" และข้ามการจับคู่
 */
export function hasReadableText(text){
  return /[\u0E00-\u0E7Fa-zA-Z]/.test(String(text || ""));
}

export function normalize(text){
  let s = String(text || "").toLowerCase().normalize("NFC");
  // ตัดอักขระพิเศษ เก็บไว้เฉพาะ ไทย อังกฤษ ตัวเลข ช่องว่าง
  s = s.replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // ยุบคำพ้องให้เหลือรูปเดียว
  // เรียงจากวลียาวไปสั้น เพื่อให้ "student card" ถูกแทนก่อน "card"
  const pairs = [];
  for (const [variants, canonical] of SYNONYMS)
    for (const v of variants) if (v !== canonical) pairs.push([v, canonical]);
  pairs.sort((a, b) => b[0].length - a[0].length);
  for (const [v, canonical] of pairs) s = s.split(v).join(canonical);
  return s.replace(/\s+/g, " ").trim();
}

/* ---------- 4. ตัดเป็น token แบบหยาบ ----------
   ภาษาไทยตัดคำยาก จึงใช้วิธีผสม:
   - คำอังกฤษ/ตัวเลข → ตัดตามช่องว่าง (แม่นอยู่แล้ว)
   - ภาษาไทย → ตัดเป็นชิ้นละ 2 ตัวอักษรแบบเลื่อน (bigram)
     ซึ่งพิสูจน์แล้วว่าใช้แทนการตัดคำได้ดีในงานวัดความคล้าย  */
export function tokenize(text){
  const s = normalize(text);
  const tokens = [];
  for (const chunk of s.split(" ")){
    if (!chunk) continue;
    if (STOPWORDS.has(chunk)) continue;
    if (/^[a-z0-9]+$/.test(chunk)){
      tokens.push(chunk);                       // คำอังกฤษ/ตัวเลข เก็บทั้งคำ
    } else {
      if (chunk.length <= 2){ tokens.push(chunk); continue; }
      for (let i = 0; i < chunk.length - 1; i++) tokens.push(chunk.slice(i, i + 2));
    }
  }
  return tokens;
}

/* ---------- 5. character n-gram ---------- */
function ngrams(text, n = 3){
  const s = normalize(text).replace(/ /g, "");
  const out = new Set();
  if (s.length < n) { if (s) out.add(s); return out; }
  for (let i = 0; i <= s.length - n; i++) out.add(s.slice(i, i + n));
  return out;
}

/* Dice coefficient: 2|A∩B| / (|A|+|B|) — 0 ถึง 1 */
function dice(setA, setB){
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const g of setA) if (setB.has(g)) inter++;
  return (2 * inter) / (setA.size + setB.size);
}

/* วัดว่าข้อความที่สั้นกว่าถูกครอบคลุมอยู่ในข้อความที่ยาวกว่ามากแค่ไหน
   เหมาะกับงานของหายที่ผู้เก็บได้มักพิมพ์สั้นกว่าคนทำหายมาก */
export function shortTextCoverage(a, b){
  const setA = ngrams(a, 3), setB = ngrams(b, 3);
  const smaller = setA.size <= setB.size ? setA : setB;
  const larger  = setA.size <= setB.size ? setB : setA;
  // ข้อความสั้นมากเกินไป เช่น "ดำ" หรือ "มี" ไม่ควรใช้เป็นหลักฐานเพิ่มคะแนน
  if (smaller.size < 3) return 0;
  let inter = 0;
  for (const g of smaller) if (larger.has(g)) inter++;
  return inter / smaller.size;
}

/* ---------- 6. TF-IDF ---------- */
/* สร้างตาราง IDF จากคลังประกาศทั้งหมด — คำที่โผล่ในหลายประกาศจะได้น้ำหนักน้อย */
export function buildIdf(documents){
  const df = new Map();
  const N = documents.length || 1;
  for (const doc of documents){
    for (const t of new Set(tokenize(doc))) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map();
  for (const [t, count] of df) idf.set(t, Math.log((N + 1) / (count + 1)) + 1);
  return idf;
}

/* cosine similarity ของเวกเตอร์ TF-IDF สองตัว */
function tfidfCosine(textA, textB, idf){
  const vec = text => {
    const tf = new Map();
    const tokens = tokenize(text);
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    const v = new Map();
    for (const [t, f] of tf){
      const w = (1 + Math.log(f)) * (idf?.get(t) ?? 1);
      v.set(t, w);
    }
    return v;
  };
  const va = vec(textA), vb = vec(textB);
  if (!va.size || !vb.size) return 0;
  let dot = 0, na = 0, nb = 0;
  for (const [t, w] of va){ na += w * w; if (vb.has(t)) dot += w * vb.get(t); }
  for (const [, w] of vb) nb += w * w;
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/* ---------- 7. ความคล้ายของคำอธิบาย ---------- */
export function textSimilarity(a, b, idf){
  const d = dice(ngrams(a, 3), ngrams(b, 3));   // ทนคำสะกดผิด
  const c = tfidfCosine(a, b, idf);             // เน้นคำที่มีนัยสำคัญ
  const base = 0.55 * d + 0.45 * c;
  const coverage = shortTextCoverage(a, b);
  // รายละเอียดที่มีเฉพาะฝั่งข้อความยาว (เช่น ชื่อดารา/รุ่น) ไม่ควรหักคะแนน
  // หากใจความส่วนใหญ่ของข้อความสั้นปรากฏอยู่ในข้อความยาว
  const lengthAware = 0.75 * coverage + 0.25 * c;
  return Math.max(base, lengthAware);
}


/* ---------- เทียบหมวดหมู่/สี ที่ผู้ใช้พิมพ์เองได้ ----------
   ผู้ใช้เลือก "อื่นๆ" แล้วพิมพ์เอง เช่น "นาฬิกา" กับ "นาฬิกาข้อมือ" จึงเทียบด้วย === ไม่ได้
   กติกา: ค่าจากรายการสำเร็จรูปเทียบตรงตัวเหมือนเดิม (กัน "กระเป๋า" ไปชน "กระเป๋าสตางค์")
   แต่ถ้ามีฝั่งใดฝั่งหนึ่งพิมพ์เอง ให้ถือว่าตรงกันเมื่อคำหนึ่งอยู่ในอีกคำ */
export const PRESET_CATEGORIES = ["กระเป๋า","กุญแจ","โทรศัพท์","บัตรนักศึกษา","กระเป๋าสตางค์","หูฟัง","เอกสาร","เสื้อผ้า","อื่นๆ"];
export const PRESET_COLORS = ["ดำ","ขาว","แดง","น้ำเงิน","เขียว","เหลือง","ชมพู","เทา","น้ำตาล","อื่นๆ"];

export function sameLabel(a, b, presets = []){
  if (a === b) return true;
  if (presets.includes(a) && presets.includes(b)) return false;
  const x = normalize(a).replace(/ /g, ""), y = normalize(b).replace(/ /g, "");
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.length >= 3 && l.includes(s);
}

/* ---------- ด่านหมวดหมู่: ไม่เข้มจนพลาดของที่ผู้ใช้เลือกหมวดคลาดเคลื่อน ----------
   ตัดทิ้งเฉพาะกรณีที่ "ทั้งสองฝั่งเลือกจากรายการสำเร็จรูปและเป็นคนละหมวดที่ไม่เกี่ยวกัน"
   (เช่น โทรศัพท์ กับ กุญแจ) นอกนั้นปล่อยผ่านให้คะแนนคำอธิบาย/สี/สถานที่/เวลาตัดสิน
     - หมวดที่ผู้ใช้พิมพ์เอง หรือเลือก "อื่นๆ" = ไม่เข้ากับรายการสำเร็จรูป → ไม่ตัดทิ้ง
     - หมวดที่คนมักเลือกสลับกัน (RELATED_CATEGORY_GROUPS) ถือว่าเข้ากันได้ */
export const RELATED_CATEGORY_GROUPS = [
  ["กระเป๋า", "กระเป๋าสตางค์"],
];

export function categoriesCompatible(a, b){
  if (sameLabel(a, b, PRESET_CATEGORIES)) return true;
  const preset = (c) => PRESET_CATEGORIES.includes(c);
  if (!preset(a) || !preset(b) || a === "อื่นๆ" || b === "อื่นๆ") return true;
  return RELATED_CATEGORY_GROUPS.some(g => g.includes(a) && g.includes(b));
}

/* ---------- 8. คะแนนรวมของคู่ประกาศ ---------- */
export const MATCH_THRESHOLD = 0.70;   // แจ้งเตือนเมื่อ ≥ 70%
export const MAX_MATCHES = 3;          // เอาสูงสุด 3 อันดับ

function daysBetween(a, b){
  if (!a || !b) return null;
  return Math.abs(new Date(a) - new Date(b)) / 86400000;
}

/* รองรับทั้ง place/location และ eventDate/createdAt */
const placeOf = p => p.place || p.location || "";
const dateOf  = p => p.eventDate
  || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);

/* น้ำหนักของแต่ละองค์ประกอบในคะแนนรวม (รวมกันได้ 1.00) */
export const WEIGHTS = { color: 0.20, desc: 0.55, place: 0.15, time: 0.10 };

/* ---------- กันคะแนนสูงเกินจริงของคู่ที่ "ไม่เกี่ยวกัน" ----------
   ปัญหาที่พบ: ปากกา iPad vs AirPods, คีย์การ์ด vs ขวดน้ำ ได้ 65–70%
   สาเหตุ 2 ข้อ
   (1) cosine ของ embedding ไม่เคยเป็น 0 แม้ข้อความไม่เกี่ยวกัน (มักอยู่ราว 0.6–0.9)
       แต่เดิมเอาค่าดิบมาใช้เป็น "ความคล้าย 0–1" ตรง ๆ จึงได้ความหมายเกือบครึ่ง
       ทั้งที่ไม่เกี่ยวกันเลย → ต้อง "หักค่าฐาน" ออกก่อน (SEMANTIC_FLOOR..CEIL → 0..1)
   (2) สี+สถานที่+เวลา รวมกันได้ถึง 45 คะแนน และของสองชิ้นมักบังเอิญตรงกันเอง
       (ที่เดียวกัน วันเดียวกัน) → ต้องมีหลักฐานจากคำอธิบายก่อน
       ถ้าคำอธิบายคล้ายกันน้อยกว่า DESC_FULL คะแนนของ 3 ส่วนนี้จะถูกหักตามสัดส่วน
   ปรับค่าได้ที่นี่ที่เดียว ถ้าหน้าแอดมินแสดงว่าคู่จริงได้ความหมายต่ำเกินไป/คู่มั่วยังสูงอยู่ */
export const SEMANTIC_FLOOR = 0.70;   // cosine ที่ถือว่า "ไม่เกี่ยวกันเลย" → 0
export const SEMANTIC_CEIL  = 0.95;   // cosine ที่ถือว่า "ความหมายเดียวกัน" → 1
// คำอธิบายคล้ายเท่านี้ขึ้นไป สี/สถานที่/เวลาจึงได้คะแนนเต็ม
// 0.45 = จุดที่คู่ซึ่งสี/สถานที่/เวลาตรงเต็มเริ่มผ่านเกณฑ์ 70% พอดี ((0.70 − 0.45) ÷ 0.55 ≈ 0.455)
// จึงไม่ทำให้คู่ที่เคยผ่านเกณฑ์ตกเกณฑ์ แต่กดคะแนนของคู่ที่คำอธิบายไม่เกี่ยวกันลงมาก
export const DESC_FULL = 0.45;

export function adjustSemantic(cos){
  if (cos === null || cos === undefined || Number.isNaN(cos)) return null;
  const x = (cos - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR);
  return Math.max(0, Math.min(1, x));
}

/* เกณฑ์ "เกือบแมช" — คู่ที่คะแนนอยู่ระหว่างค่านี้ถึง MATCH_THRESHOLD จะถูกบันทึกให้แอดมินดู
   (ผู้ใช้ไม่เห็นและไม่ถูกแจ้งเตือน) */
export const NEAR_MISS_MIN = 0.45;
export const MAX_NEAR_MISSES = 3;

/**
 * อธิบายคะแนนของคู่ประกาศแบบละเอียด — ใช้ทั้งในตัวจับคู่จริงและหน้าแอดมิน
 * ถ้าไม่ผ่านด่านบังคับ คืน { blocked: "sameType" | "category" | "color" } แทนคะแนน
 */
export function explainPair(postA, postB, idf, semantic = null){
  if (postA.type === postB.type) return { blocked: "sameType" };
  if (!categoriesCompatible(postA.category, postB.category)) return { blocked: "category" };

  // สี: ตรงกัน = เต็ม, ฝั่งใดฝั่งหนึ่งระบุ "อื่นๆ" = ให้ครึ่งคะแนน, ต่างกัน = ตัดทิ้ง
  let colorScore;
  if (sameLabel(postA.color, postB.color, PRESET_COLORS)) colorScore = 1;
  else if (postA.color === "อื่นๆ" || postB.color === "อื่นๆ") colorScore = 0.5;
  else return { blocked: "color" };

  // ชั้นที่ 1 (lexical): ดูที่ "ตัวอักษร" — เก่งเรื่องคำเฉพาะ ยี่ห้อ เลขรุ่น คำสะกดผิด
  const lexical = textSimilarity(postA.description, postB.description, idf);

  // ชั้นที่ 2 (semantic): ดูที่ "ความหมาย" จาก embedding — เก่งเรื่องคำต่างที่หมายถึงของเดียวกัน
  // ถ้าเรียก embedding ไม่ได้ (semantic = null) จะใช้เฉพาะชั้นที่ 1
  const hasSemantic = semantic !== null && semantic !== undefined;
  // semantic ที่รับเข้ามาเป็นค่า cosine ดิบ → หักค่าฐานก่อนนำไปรวม (ดูคำอธิบายที่ SEMANTIC_FLOOR)
  const semanticAdj = hasSemantic ? adjustSemantic(semantic) : null;
  const descSim = hasSemantic ? 0.5 * lexical + 0.5 * semanticAdj : lexical;

  const pa = placeOf(postA), pb = placeOf(postB);
  const placeScore = (pa && pa === pb) ? 1
                   : (pa === "อื่นๆ" || pb === "อื่นๆ") ? 0.4 : 0;

  // ของพบควรเกิดใกล้กับวันที่ของหาย ไม่ห่างกันเกิน 30 วัน
  const gap = daysBetween(dateOf(postA), dateOf(postB));
  const timeScore = gap === null ? 0.5
                  : gap <= 1  ? 1
                  : gap <= 7  ? 0.8
                  : gap <= 30 ? 0.5 : 0.2;

  const parts = {
    color: { value: colorScore, weight: WEIGHTS.color, points: WEIGHTS.color * colorScore },
    desc:  { value: descSim,    weight: WEIGHTS.desc,  points: WEIGHTS.desc  * descSim },
    place: { value: placeScore, weight: WEIGHTS.place, points: WEIGHTS.place * placeScore },
    time:  { value: timeScore,  weight: WEIGHTS.time,  points: WEIGHTS.time  * timeScore }
  };
  // สี/สถานที่/เวลา ช่วยได้ แต่ห้ามแบกคู่ที่คำอธิบายไม่เกี่ยวกัน:
  // คำอธิบายคล้ายน้อยกว่า DESC_FULL → หักคะแนน 3 ส่วนนี้ตามสัดส่วน
  const metaPoints = parts.color.points + parts.place.points + parts.time.points;
  const evidence = Math.max(0, Math.min(1, descSim / DESC_FULL));
  parts.evidence = { value: evidence, weight: null, points: (-(1 - evidence) * metaPoints) || 0 };   // "|| 0" กันค่า -0

  const score = Math.max(0, Math.min(1, parts.color.points + parts.desc.points
                          + parts.place.points + parts.time.points + parts.evidence.points));

  return {
    blocked: null,
    score, descSim, lexical,
    semantic: hasSemantic ? semantic : null,       // ค่า cosine ดิบ (ใช้แสดงในหน้าแอดมิน)
    semanticAdj,                                    // หลังหักค่าฐาน (ค่าที่ใช้คิดคะแนนจริง)
    evidence,
    parts, gap,
    reasons: buildReasons(postA, postB, lexical, semanticAdj, placeScore, gap)
  };
}

export function scorePair(postA, postB, idf, semantic = null){
  // เงื่อนไขบังคับ: ต้องเป็นคนละฝั่ง (หาย vs พบ), หมวดหมู่ตรงกัน, สีไม่ขัดกัน
  const e = explainPair(postA, postB, idf, semantic);
  if (e.blocked) return null;
  return {
    score: e.score,
    descSim: e.descSim, lexical: e.lexical, semantic: e.semantic,
    semanticAdj: e.semanticAdj, evidence: e.evidence,
    parts: e.parts,
    reasons: e.reasons
  };
}

/* อธิบายให้ผู้ใช้เข้าใจว่าทำไมระบบถึงคิดว่าตรงกัน */
function buildReasons(a, b, lexical, semantic, placeScore, gap){
  // semantic ที่นี่คือค่าที่หักค่าฐานแล้ว (0–1)
  const r = [`หมวดหมู่ตรงกัน (${a.category})`];
  if (sameLabel(a.color, b.color, PRESET_COLORS)) r.push(`สีตรงกัน (${a.color})`);
  if (lexical >= 0.4) r.push(`คำอธิบายใช้คำคล้ายกัน ${Math.round(lexical * 100)}%`);
  if (semantic !== null && semantic !== undefined && semantic >= 0.5)
    r.push(`ความหมายของคำอธิบายใกล้เคียงกัน ${Math.round(semantic * 100)}%`);
  if (placeScore === 1) r.push(`สถานที่เดียวกัน (${placeOf(a)})`);
  if (gap !== null && gap <= 7) r.push(`เวลาใกล้เคียงกัน (ห่างกัน ${Math.round(gap)} วัน)`);
  return r;
}

/* ---------- 9. หาคู่ที่ดีที่สุดให้ประกาศหนึ่งใบ ---------- */
/**
 * หาคู่ที่ดีที่สุดให้ประกาศหนึ่งใบ
 * @param {object} target       ประกาศที่เพิ่งลงใหม่
 * @param {Array}  candidates   ประกาศอื่นๆ ที่ยังเปิดอยู่
 * @param {Function} semanticOf ฟังก์ชันรับ candidate แล้วคืนคะแนนความหมาย 0-1
 *                              (จาก embedding) หรือ null ถ้าคำนวณไม่ได้
 */
export function findCandidates(target, candidates, semanticOf = null){
  // TF-IDF ต้องการคลังข้อมูลที่ใหญ่พอจึงจะให้น้ำหนักคำได้ถูก
  // ถ้ามีประกาศน้อยกว่า 10 ใบ ค่า IDF จะเพี้ยน (คำที่โผล่ 2 ใน 2 ใบถูกลดน้ำหนักทั้งที่สำคัญ)
  // กรณีนั้นให้ใช้ค่าน้ำหนักเท่ากันหมดแทน
  const corpus = [target, ...candidates].map(p => p.description || "");
  const idf = corpus.length >= 10 ? buildIdf(corpus) : null;

  const matches = [], nearMisses = [];
  for (const c of candidates){
    if (c.id === target.id) continue;
    if (c.status === "resolved") continue;
    const semantic = semanticOf ? semanticOf(c) : null;
    const s = scorePair(target, c, idf, semantic);
    if (!s) continue;
    if (s.score >= MATCH_THRESHOLD) matches.push({ post: c, ...s });
    else if (s.score >= NEAR_MISS_MIN) nearMisses.push({ post: c, ...s });
  }
  const byScore = (x, y) => y.score - x.score;
  return {
    matches: matches.sort(byScore).slice(0, MAX_MATCHES),
    nearMisses: nearMisses.sort(byScore).slice(0, MAX_NEAR_MISSES)
  };
}

/**
 * หาคู่ที่ดีที่สุดให้ประกาศหนึ่งใบ (เฉพาะคู่ที่ผ่านเกณฑ์ MATCH_THRESHOLD)
 * @param {object} target       ประกาศที่เพิ่งลงใหม่
 * @param {Array}  candidates   ประกาศอื่นๆ ที่ยังเปิดอยู่
 * @param {Function} semanticOf ฟังก์ชันรับ candidate แล้วคืนคะแนนความหมาย 0-1
 *                              (จาก embedding) หรือ null ถ้าคำนวณไม่ได้
 */
export function findMatches(target, candidates, semanticOf = null){
  return findCandidates(target, candidates, semanticOf).matches;
}

/* คู่ที่ "มีสิทธิ์" ถูกจับ — ใช้กรองก่อนเรียก embedding เพื่อประหยัดโควตา API */
export function passesHardFilter(a, b){
  if (a.type === b.type) return false;
  if (!categoriesCompatible(a.category, b.category)) return false;
  if (!sameLabel(a.color, b.color, PRESET_COLORS) && a.color !== "อื่นๆ" && b.color !== "อื่นๆ") return false;
  return true;
}

/* cosine similarity ของเวกเตอร์ embedding สองตัว → แปลงให้อยู่ในช่วง 0-1 */
export function cosineSimilarity(vecA, vecB){
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return null;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < vecA.length; i++){
    dot += vecA[i] * vecB[i];
    na  += vecA[i] * vecA[i];
    nb  += vecB[i] * vecB[i];
  }
  if (!na || !nb) return null;
  const cos = dot / (Math.sqrt(na) * Math.sqrt(nb));
  // cosine อยู่ในช่วง -1 ถึง 1 แต่ embedding ของข้อความแทบไม่เคยติดลบ
  // ค่าติดลบแปลว่า "ไม่เกี่ยวกันเลย" จึงปัดเป็น 0
  return Math.max(0, Math.min(1, cos));
}

/* จัดกลุ่มเป็น "คู่": คู่ที่ accepted และมีอย่างน้อยหนึ่งฝั่งปิดแล้ว = ส่งคืน 1 รายการ */
export function returnedGroups(posts, matches){
  const byId = new Map(posts.map(p => [p.id, p]));
  const countable = p => p.status === 'resolved' && p.hiddenReason !== 'admin';
  const pairs = [], inPair = new Set();
  for (const m of matches){
    if (m.matchStatus !== 'accepted') continue;
    const lost = byId.get(m.lostPostId), found = byId.get(m.foundPostId);
    if (!lost || !found || !(countable(lost) || countable(found))) continue;
    pairs.push({ lost, found });
    inPair.add(lost.id); inPair.add(found.id);
  }
  const singles = posts.filter(p => countable(p) && !inPair.has(p.id));
  return { pairs, singles };
}
export function acceptedPairs(posts, matches){
  const byId = new Map(posts.map(p => [p.id, p]));
  return matches.filter(m => m.matchStatus === 'accepted')
    .map(m => ({ lost: byId.get(m.lostPostId), found: byId.get(m.foundPostId) }))
    .filter(pr => pr.lost && pr.found);
}

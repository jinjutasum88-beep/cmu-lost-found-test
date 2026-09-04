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
  [["หมา","สุนัข","dog"], "หมา"]
];

/* ---------- 2. คำที่ไม่มีความหมายในการจับคู่ ---------- */
const STOPWORDS = new Set([
  "ที่","ของ","และ","หรือ","แต่","ก็","กับ","ให้","ได้","ไป","มา","มี","เป็น","อยู่",
  "ครับ","ค่ะ","คะ","นะ","จ้า","อะ","น่ะ","เลย","มาก","หน่อย","ด้วย","แล้ว","ยัง",
  "ผม","ฉัน","เรา","คุณ","ทำ","ใช้","ตัว","อัน","ชิ้น","ใบ","อัพ","the","a","an","is",
  "my","i","it","this","that","of","and","or","in","on","at","หาย","เจอ","พบ","ทำหาย"
]);

/* ---------- 3. ทำความสะอาดข้อความ ---------- */
export function normalize(text){
  let s = String(text || "").toLowerCase().normalize("NFC");
  // ตัดอักขระพิเศษ เก็บไว้เฉพาะ ไทย อังกฤษ ตัวเลข ช่องว่าง
  s = s.replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // ยุบคำพ้องให้เหลือรูปเดียว
  for (const [variants, canonical] of SYNONYMS){
    for (const v of variants){
      if (v === canonical) continue;
      s = s.split(v).join(canonical);
    }
  }
  return s;
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
  return 0.55 * d + 0.45 * c;
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

export function scorePair(postA, postB, idf, semantic = null){
  // เงื่อนไขบังคับ: ต้องเป็นคนละฝั่ง (หาย vs พบ) และหมวดหมู่ตรงกัน
  if (postA.type === postB.type) return null;
  if (postA.category !== postB.category) return null;

  // สี: ตรงกัน = เต็ม, ฝั่งใดฝั่งหนึ่งระบุ "อื่นๆ" = ให้ครึ่งคะแนน, ต่างกัน = ตัดทิ้ง
  let colorScore;
  if (postA.color === postB.color) colorScore = 1;
  else if (postA.color === "อื่นๆ" || postB.color === "อื่นๆ") colorScore = 0.5;
  else return null;

  // ---------- ความคล้ายของคำอธิบาย ----------
  // ชั้นที่ 1 (lexical): ดูที่ "ตัวอักษร" — เก่งเรื่องคำเฉพาะ ยี่ห้อ เลขรุ่น คำสะกดผิด
  const lexical = textSimilarity(postA.description, postB.description, idf);

  // ชั้นที่ 2 (semantic): ดูที่ "ความหมาย" จาก embedding — เก่งเรื่องคำต่างที่หมายถึงของเดียวกัน
  // เช่น "เป้" กับ "กระเป๋าสะพาย" ไม่มีตัวอักษรร่วมกันเลย แต่ความหมายใกล้กันมาก
  // ถ้าเรียก embedding ไม่ได้ (semantic = null) จะใช้เฉพาะชั้นที่ 1
  const descSim = (semantic === null || semantic === undefined)
    ? lexical
    : 0.5 * lexical + 0.5 * semantic;

  const pa = placeOf(postA), pb = placeOf(postB);
  const placeScore = (pa && pa === pb) ? 1
                   : (pa === "อื่นๆ" || pb === "อื่นๆ") ? 0.4 : 0;

  // ของพบควรเกิดใกล้กับวันที่ของหาย ไม่ห่างกันเกิน 30 วัน
  const gap = daysBetween(dateOf(postA), dateOf(postB));
  const timeScore = gap === null ? 0.5
                  : gap <= 1  ? 1
                  : gap <= 7  ? 0.8
                  : gap <= 30 ? 0.5 : 0.2;

  const score =
      0.20 * colorScore   // ผ่านด่านหมวดหมู่+สีมาแล้ว ให้เป็นคะแนนฐาน
    + 0.55 * descSim      // น้ำหนักหลักอยู่ที่ความคล้ายของคำอธิบาย
    + 0.15 * placeScore
    + 0.10 * timeScore;

  return {
    score: Math.min(1, score),
    descSim, lexical, semantic,
    reasons: buildReasons(postA, postB, lexical, semantic, placeScore, gap)
  };
}

/* อธิบายให้ผู้ใช้เข้าใจว่าทำไมระบบถึงคิดว่าตรงกัน */
function buildReasons(a, b, lexical, semantic, placeScore, gap){
  const r = [`หมวดหมู่ตรงกัน (${a.category})`];
  if (a.color === b.color) r.push(`สีตรงกัน (${a.color})`);
  if (lexical >= 0.4) r.push(`คำอธิบายใช้คำคล้ายกัน ${Math.round(lexical * 100)}%`);
  if (semantic !== null && semantic !== undefined && semantic >= 0.6)
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
export function findMatches(target, candidates, semanticOf = null){
  // TF-IDF ต้องการคลังข้อมูลที่ใหญ่พอจึงจะให้น้ำหนักคำได้ถูก
  // ถ้ามีประกาศน้อยกว่า 10 ใบ ค่า IDF จะเพี้ยน (คำที่โผล่ 2 ใน 2 ใบถูกลดน้ำหนักทั้งที่สำคัญ)
  // กรณีนั้นให้ใช้ค่าน้ำหนักเท่ากันหมดแทน
  const corpus = [target, ...candidates].map(p => p.description || "");
  const idf = corpus.length >= 10 ? buildIdf(corpus) : null;

  const results = [];
  for (const c of candidates){
    if (c.id === target.id) continue;
    if (c.status === "resolved") continue;
    const semantic = semanticOf ? semanticOf(c) : null;
    const s = scorePair(target, c, idf, semantic);
    if (s && s.score >= MATCH_THRESHOLD) results.push({ post: c, ...s });
  }
  return results.sort((x, y) => y.score - x.score).slice(0, MAX_MATCHES);
}

/* คู่ที่ "มีสิทธิ์" ถูกจับ — ใช้กรองก่อนเรียก embedding เพื่อประหยัดโควตา API */
export function passesHardFilter(a, b){
  if (a.type === b.type) return false;
  if (a.category !== b.category) return false;
  if (a.color !== b.color && a.color !== "อื่นๆ" && b.color !== "อื่นๆ") return false;
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

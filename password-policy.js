/* ===================================================================
   password-policy.js — กฎรหัสผ่านของ CMU LOST&FOUND
   -------------------------------------------------------------------
   รวมสองแนวคิดเข้าด้วยกัน:

   (ก) กฎแบบดั้งเดิม (composition rules)
       บังคับความยาวขั้นต่ำ และต้องมีตัวพิมพ์เล็ก/ใหญ่/ตัวเลข/อักขระพิเศษ
       ข้อดี: ตรวจง่าย อธิบายได้ชัด เป็นสิ่งที่ผู้ใช้คุ้นเคย

   (ข) กฎแบบใหม่ตามมาตรฐาน NIST SP 800-63B
       เน้น "ความเดายาก" มากกว่าการผสมอักขระ จึงเพิ่มการดัก
       - รหัสยอดนิยมที่ถูกเดาเป็นอันดับต้นๆ
       - รหัสที่มีชื่อหรืออีเมลของผู้ใช้เอง
       - ลำดับที่คาดเดาได้ (123456, abcdef, qwerty)
       - ตัวอักษรซ้ำติดกัน (aaaa, 1111)

   เหตุผลที่ต้องมี (ข) ด้วย: "Password1!" ผ่านกฎ (ก) ทุกข้อ
   แต่เป็นหนึ่งในรหัสที่ถูกเดาบ่อยที่สุดในโลก
   =================================================================== */

export const POLICY = {
  minLength: 8,            // ขั้นต่ำที่ระบบยอมรับ
  recommendedLength: 12,   // ความยาวที่แนะนำ (ได้คะแนนความแข็งแรงเต็ม)
  maxLength: 64,           // กันการโจมตีแบบส่งข้อความยาวมาก
  requireLower: true,
  requireUpper: true,
  requireDigit: true,
  requireSymbol: true
};

/* รหัสผ่านยอดนิยมที่ถูกเดาเป็นอันดับต้นๆ (ตัดมาบางส่วน) */
const COMMON = new Set([
  "password","password1","password123","passw0rd","p@ssw0rd","p@ssword",
  "123456","1234567","12345678","123456789","1234567890","12345",
  "qwerty","qwerty123","qwertyuiop","abc123","abcd1234","a1b2c3",
  "iloveyou","admin","admin123","welcome","welcome1","letmein",
  "monkey","dragon","sunshine","princess","football","baseball",
  "111111","000000","654321","666666","888888","987654321",
  "cmu1234","chiangmai","chiangmai1","student","student123","test1234",
  "asdfghjkl","zxcvbnm","1q2w3e4r","1qaz2wsx","qazwsx"
]);

/* ลำดับที่คาดเดาได้ */
const SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "qwertyuiop","asdfghjkl","zxcvbnm"
];

function hasSequence(pw, len = 4){
  const s = pw.toLowerCase();
  for (const seq of SEQUENCES){
    for (let i = 0; i <= seq.length - len; i++){
      const chunk = seq.slice(i, i + len);
      const reversed = chunk.split("").reverse().join("");
      if (s.includes(chunk) || s.includes(reversed)) return true;
    }
  }
  return false;
}

function hasRepeat(pw, times = 4){
  return new RegExp(`(.)\\1{${times - 1},}`).test(pw);
}

/* ตัดตัวเลขท้ายและอักขระพิเศษออก เพื่อดักรูปแบบอย่าง "Password123!" */
function stripDecorations(pw){
  return pw.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/\d+$/, "");
}

/**
 * ตรวจรหัสผ่านตามกฎทั้งหมด
 * @param {string} pw       รหัสผ่านที่กรอก
 * @param {object} context  { email, name } เพื่อกันการใช้ข้อมูลตัวเองเป็นรหัส
 * @returns {{checks: Array, valid: boolean, score: number, label: string, color: string}}
 */
export function evaluatePassword(pw, context = {}){
  const p = pw || "";
  const email = (context.email || "").toLowerCase();
  const name  = (context.name  || "").toLowerCase();
  const local = email.split("@")[0] || "";

  const containsPersonal = () => {
    const low = p.toLowerCase();
    if (local.length >= 4 && low.includes(local)) return true;
    if (name.length  >= 4 && low.includes(name))  return true;
    return false;
  };

  const isCommon = () => {
    const low = p.toLowerCase();
    if (COMMON.has(low)) return true;
    const stripped = stripDecorations(p);
    return stripped.length >= 4 && COMMON.has(stripped);
  };

  // รายการตรวจที่แสดงให้ผู้ใช้เห็นแบบเรียลไทม์
  const checks = [
    { id:"length",   label:`ยาวอย่างน้อย ${POLICY.minLength} ตัวอักษร`,
      pass: p.length >= POLICY.minLength, required:true },
    { id:"lower",    label:"มีตัวพิมพ์เล็ก (a-z)",
      pass: /[a-z]/.test(p), required: POLICY.requireLower },
    { id:"upper",    label:"มีตัวพิมพ์ใหญ่ (A-Z)",
      pass: /[A-Z]/.test(p), required: POLICY.requireUpper },
    { id:"digit",    label:"มีตัวเลข (0-9)",
      pass: /\d/.test(p), required: POLICY.requireDigit },
    { id:"symbol",   label:"มีอักขระพิเศษ (!@#$%^&* ฯลฯ)",
      pass: /[^A-Za-z0-9]/.test(p), required: POLICY.requireSymbol },
    { id:"nospace",  label:"ไม่มีช่องว่างหน้า-หลัง",
      pass: p.length > 0 && p === p.trim(), required:true },
    { id:"maxlen",   label:`ไม่เกิน ${POLICY.maxLength} ตัวอักษร`,
      pass: p.length <= POLICY.maxLength, required:true },
    { id:"common",   label:"ไม่ใช่รหัสผ่านที่คนใช้กันบ่อย",
      pass: p.length > 0 && !isCommon(), required:true },
    { id:"personal", label:"ไม่มีชื่อหรืออีเมลของคุณอยู่ในรหัสผ่าน",
      pass: p.length > 0 && !containsPersonal(), required:true },
    { id:"sequence", label:"ไม่เป็นลำดับที่เดาง่าย (1234, abcd, qwerty)",
      pass: p.length > 0 && !hasSequence(p), required:true },
    { id:"repeat",   label:"ไม่มีตัวอักษรเดิมซ้ำติดกันเกิน 3 ตัว",
      pass: p.length > 0 && !hasRepeat(p), required:true }
  ];

  const valid = checks.filter(c => c.required).every(c => c.pass);

  // ---------- คะแนนความแข็งแรง 0-4 ----------
  let score = 0;
  if (p.length >= POLICY.minLength) score++;
  if (p.length >= POLICY.recommendedLength) score++;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
  if (variety >= 3) score++;
  if (variety === 4 && p.length >= 14) score++;
  if (!valid) score = Math.min(score, 1);
  if (isCommon() || containsPersonal()) score = 0;

  const labels = ["อ่อนมาก","อ่อน","พอใช้","ดี","แข็งแรงมาก"];
  const colors = ["#C0356F","#C0356F","#D98A1F","#1F8F6F","#1F8F6F"];

  return { checks, valid, score, label: labels[score], color: colors[score] };
}

/* สร้างรหัสผ่านสุ่มที่ผ่านทุกกฎ — ไว้ให้ปุ่ม "สุ่มรหัสผ่านให้" */
export function suggestPassword(len = 16){
  const lower = "abcdefghijkmnpqrstuvwxyz";   // ตัด l, o กันสับสน
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // ตัด I, O
  const digit = "23456789";                   // ตัด 0, 1
  const sym   = "!@#$%^&*-_=+?";
  const all = lower + upper + digit + sym;
  const pick = set => set[Math.floor(Math.random() * set.length)];

  let out = [pick(lower), pick(upper), pick(digit), pick(sym)];
  while (out.length < len) out.push(pick(all));

  // สลับตำแหน่งแบบ Fisher-Yates
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  const pw = out.join("");
  // กันกรณีสุ่มได้ลำดับที่เดาง่ายพอดี
  return (hasSequence(pw) || hasRepeat(pw)) ? suggestPassword(len) : pw;
}

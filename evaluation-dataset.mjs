/* ===================================================================
   evaluation-dataset.mjs — วัดความแม่นยำของระบบจับคู่ด้วยชุดข้อมูลที่ติดฉลากเอง
   -------------------------------------------------------------------
   ทำไมต้องมีชุดนี้แยกจากข้อมูลผู้ใช้จริง:

   ตัวเลขในแดชบอร์ดคำนวณจาก "คู่ที่ผู้ใช้กดยืนยันว่าใช่ ÷ คู่ที่ผู้ใช้ตัดสินทั้งหมด"
   ซึ่งเป็น precision เท่านั้น ระบบไม่มีทางรู้เลยว่ามีคู่ที่ตรงกันจริงกี่คู่
   ที่ระบบพลาดไป (recall) เพราะคู่ที่ได้คะแนนต่ำกว่าเกณฑ์ไม่เคยถูกแสดงให้ใครเห็น

   ชุดนี้แก้ปัญหานั้นด้วยการติดฉลากคำตอบที่ถูกต้องไว้ล่วงหน้า
   จึงวัดได้ทั้ง precision, recall และ F1

   ดูผลเต็มด้วย:  npm run evaluate
   ทดสอบอัตโนมัติ: tests/evaluation.test.mjs
   =================================================================== */

import { scorePair, MATCH_THRESHOLD } from "./matching.js";

/* ===================================================================
   ชุดข้อมูลทดสอบ 20 คู่ — ตรงกันจริง 10 คู่ ไม่ตรงกัน 10 คู่
   เขียนเลียนแบบภาษาที่นักศึกษาใช้จริง มีทั้งคำสะกดผิด คำย่อ และภาษาอังกฤษ
   =================================================================== */
export const DATASET = [
  /* ---------- 10 คู่ที่ตรงกันจริง (should match) ---------- */
  { label: true, note: "สะกดยี่ห้อคนละแบบ",
    a: { type:"lost", category:"กระเป๋า", color:"ดำ", location:"คณะวิศวกรรมศาสตร์", eventDate:"2569-09-01",
         description:"กระเป๋าสะพายสีดำยี่ห้อ Anello มีสติกเกอร์ลายแมวติดหน้ากระเป๋า" },
    b: { type:"found", category:"กระเป๋า", color:"ดำ", location:"คณะวิศวกรรมศาสตร์", eventDate:"2569-09-02",
         description:"เจอกระเป๋าอนิลโล่สีดำ มีสติ๊กเกอร์รูปแมวติดอยู่ด้านหน้า" } },

  { label: true, note: "คนละภาษา ไทย–อังกฤษ",
    a: { type:"lost", category:"กระเป๋า", color:"ดำ", location:"หอสมุดกลาง", eventDate:"2569-09-03",
         description:"กระเป๋าเป้สีดำ มีสติกเกอร์ลายแมว" },
    b: { type:"found", category:"กระเป๋า", color:"ดำ", location:"หอสมุดกลาง", eventDate:"2569-09-03",
         description:"Found a black backpack with a cat sticker on it" } },

  { label: true, note: "โทรศัพท์ รอยร้าวมุมจอ",
    a: { type:"lost", category:"โทรศัพท์", color:"ขาว", location:"หอสมุดกลาง", eventDate:"2569-08-28",
         description:"iPhone สีขาว ใส่เคสใส มีรอยร้าวเล็กๆ ที่มุมจอด้านล่าง" },
    b: { type:"found", category:"โทรศัพท์", color:"ขาว", location:"หอสมุดกลาง", eventDate:"2569-08-28",
         description:"เจอไอโฟนเคสใส หน้าจอมีรอยแตกตรงมุม" } },

  { label: true, note: "หูฟัง รอยขีดฝาเคส",
    a: { type:"lost", category:"หูฟัง", color:"ดำ", location:"จุดจอดรถ ขสมช.", eventDate:"2569-09-04",
         description:"หูฟัง AirPods Pro เคสสีดำ มีรอยขีดข่วนด้านหลังเคส" },
    b: { type:"found", category:"หูฟัง", color:"ดำ", location:"จุดจอดรถ ขสมช.", eventDate:"2569-09-04",
         description:"เจอ airpods เคสดำ มีรอยขีดที่ฝาเคสด้านหลัง" } },

  { label: true, note: "กระเป๋าสตางค์ มีบัตรนักศึกษาข้างใน",
    a: { type:"lost", category:"กระเป๋าสตางค์", color:"น้ำตาล", location:"ศาลาอ่างแก้ว/โรงอาหาร", eventDate:"2569-09-02",
         description:"กระเป๋าตังค์หนังสีน้ำตาล ข้างในมีบัตรนักศึกษาและบัตร ATM" },
    b: { type:"found", category:"กระเป๋าสตางค์", color:"น้ำตาล", location:"ศาลาอ่างแก้ว/โรงอาหาร", eventDate:"2569-09-02",
         description:"เจอกระเป๋าสตางค์สีน้ำตาล มีบัตร นศ กับบัตรเอทีเอ็มอยู่ข้างใน" } },

  { label: true, note: "กุญแจ พวงกุญแจตุ๊กตาหมา",
    a: { type:"lost", category:"กุญแจ", color:"เทา", location:"หอพักนักศึกษา (หอใน)", eventDate:"2569-09-05",
         description:"พวงกุญแจหอ มีตุ๊กตาหมาตัวเล็กห้อยอยู่" },
    b: { type:"found", category:"กุญแจ", color:"เทา", location:"หอพักนักศึกษา (หอใน)", eventDate:"2569-09-05",
         description:"เจอกุญแจ มีพวงกุญแจรูปสุนัขห้อย" } },

  { label: true, note: "ร่ม ลายจุด ด้ามไม้",
    a: { type:"lost", category:"อื่นๆ", color:"น้ำเงิน", location:"อาคาร 40 ปี", eventDate:"2569-09-01",
         description:"ร่มพับสีน้ำเงินลายจุดขาว ด้ามจับเป็นไม้" },
    b: { type:"found", category:"อื่นๆ", color:"น้ำเงิน", location:"อาคาร 40 ปี", eventDate:"2569-09-02",
         description:"เจอร่มสีน้ำเงินมีลายจุดสีขาว ด้ามไม้" } },

  { label: true, note: "บัตรนักศึกษา ระบุอักษรขึ้นต้นชื่อ",
    a: { type:"lost", category:"บัตรนักศึกษา", color:"น้ำเงิน", location:"คณะบริหารธุรกิจ", eventDate:"2569-08-30",
         description:"บัตรนักศึกษาสีน้ำเงิน ชื่อบนบัตรขึ้นต้นด้วย ป" },
    b: { type:"found", category:"บัตรนักศึกษา", color:"น้ำเงิน", location:"คณะบริหารธุรกิจ", eventDate:"2569-08-31",
         description:"เจอบัตร นศ สีน้ำเงิน ชื่อขึ้นต้น ป ตกอยู่หน้าลิฟต์" } },

  { label: true, note: "แว่นตา กรอบกลมสีทอง",
    a: { type:"lost", category:"อื่นๆ", color:"เหลือง", location:"คณะมนุษยศาสตร์", eventDate:"2569-09-03",
         description:"แว่นตากรอบกลมสีทอง อยู่ในซองผ้าสีเทา" },
    b: { type:"found", category:"อื่นๆ", color:"เหลือง", location:"คณะมนุษยศาสตร์", eventDate:"2569-09-03",
         description:"เจอแว่นกรอบกลมสีทอง มีซองผ้าเทาด้วย" } },

  { label: true, note: "เขียนสั้นมากทั้งสองฝั่ง",
    a: { type:"lost", category:"ขวดน้ำ", color:"ชมพู", location:"สนามกีฬามหาวิทยาลัย", eventDate:"2569-09-04",
         description:"กระบอกน้ำสีชมพู มีสติกเกอร์" },
    b: { type:"found", category:"ขวดน้ำ", color:"ชมพู", location:"สนามกีฬามหาวิทยาลัย", eventDate:"2569-09-04",
         description:"เจอขวดน้ำสีชมพู ติดสติ๊กเกอร์" } },

  /* ---------- 10 คู่ที่ไม่ตรงกัน (should NOT match) ---------- */
  { label: false, note: "หมวดเดียวกัน สีเดียวกัน แต่คนละใบ",
    a: { type:"lost", category:"กระเป๋า", color:"ดำ", location:"คณะวิศวกรรมศาสตร์", eventDate:"2569-09-01",
         description:"กระเป๋าสะพายสีดำยี่ห้อ Anello มีสติกเกอร์ลายแมว" },
    b: { type:"found", category:"กระเป๋า", color:"ดำ", location:"สวนสัก", eventDate:"2569-07-15",
         description:"กระเป๋าผ้าสีดำใบเล็ก ไม่มีอะไรข้างใน ไม่มีลาย" } },

  { label: false, note: "คนละหมวดหมู่",
    a: { type:"lost", category:"กระเป๋า", color:"ดำ", location:"หอสมุดกลาง", eventDate:"2569-09-01",
         description:"กระเป๋าสีดำมีสติกเกอร์" },
    b: { type:"found", category:"โทรศัพท์", color:"ดำ", location:"หอสมุดกลาง", eventDate:"2569-09-01",
         description:"โทรศัพท์สีดำมีสติกเกอร์" } },

  { label: false, note: "คนละสี",
    a: { type:"lost", category:"หูฟัง", color:"ดำ", location:"หอสมุดกลาง", eventDate:"2569-09-01",
         description:"หูฟัง AirPods เคสมีรอยขีด" },
    b: { type:"found", category:"หูฟัง", color:"ขาว", location:"หอสมุดกลาง", eventDate:"2569-09-01",
         description:"หูฟัง AirPods เคสมีรอยขีด" } },

  { label: false, note: "ฝั่งเดียวกันทั้งคู่ (หายกับหาย)",
    a: { type:"lost", category:"กุญแจ", color:"เทา", location:"หอพักนักศึกษา (หอใน)", eventDate:"2569-09-01",
         description:"พวงกุญแจมีตุ๊กตาหมา" },
    b: { type:"lost", category:"กุญแจ", color:"เทา", location:"หอพักนักศึกษา (หอใน)", eventDate:"2569-09-01",
         description:"พวงกุญแจมีตุ๊กตาหมา" } },

  { label: false, note: "โทรศัพท์คนละรุ่นคนละลักษณะ",
    a: { type:"lost", category:"โทรศัพท์", color:"ขาว", location:"หอสมุดกลาง", eventDate:"2569-09-01",
         description:"iPhone สีขาว เคสใส จอมีรอยร้าวมุมล่าง" },
    b: { type:"found", category:"โทรศัพท์", color:"ขาว", location:"ตลาดข่วงเชียงใหม่ (ตลาดหน้ามอ)", eventDate:"2569-06-01",
         description:"เจอซัมซุงสีขาว เคสหนังฝาพับ จอไม่มีรอย" } },

  { label: false, note: "กระเป๋าสตางค์คนละแบบ",
    a: { type:"lost", category:"กระเป๋าสตางค์", color:"น้ำตาล", location:"ศาลาอ่างแก้ว/โรงอาหาร", eventDate:"2569-09-01",
         description:"กระเป๋าตังค์หนังสีน้ำตาล ทรงยาว มีบัตรนักศึกษา" },
    b: { type:"found", category:"กระเป๋าสตางค์", color:"น้ำตาล", location:"ลานอ่างแก้ว", eventDate:"2569-05-20",
         description:"เจอกระเป๋าสตางค์ผ้าสีน้ำตาล ทรงสั้น ไม่มีบัตรอะไรเลย" } },

  { label: false, note: "บัตรนักศึกษาคนละชื่อ",
    a: { type:"lost", category:"บัตรนักศึกษา", color:"น้ำเงิน", location:"คณะบริหารธุรกิจ", eventDate:"2569-09-01",
         description:"บัตรนักศึกษา ชื่อขึ้นต้นด้วย ป" },
    b: { type:"found", category:"บัตรนักศึกษา", color:"น้ำเงิน", location:"คณะวิทยาศาสตร์", eventDate:"2569-04-10",
         description:"เจอบัตรนักศึกษา ชื่อขึ้นต้นด้วย ก คณะวิทยาศาสตร์" } },

  { label: false, note: "คำอธิบายกว้างมากทั้งสองฝั่ง คนละที่ คนละเวลา",
    a: { type:"lost", category:"เสื้อผ้า", color:"ดำ", location:"สวนสัก", eventDate:"2569-09-01",
         description:"เสื้อสีดำ" },
    b: { type:"found", category:"เสื้อผ้า", color:"ดำ", location:"หอประชุมมหาวิทยาลัย", eventDate:"2569-03-01",
         description:"เสื้อกันหนาวสีดำ ยี่ห้อ Uniqlo ไซส์ M มีชื่อปักที่คอเสื้อ" } },

  { label: false, note: "ร่มคนละลาย",
    a: { type:"lost", category:"อื่นๆ", color:"น้ำเงิน", location:"อาคาร 40 ปี", eventDate:"2569-09-01",
         description:"ร่มพับสีน้ำเงินลายจุดขาว ด้ามไม้" },
    b: { type:"found", category:"อื่นๆ", color:"น้ำเงิน", location:"คณะวิทยาศาสตร์", eventDate:"2569-02-14",
         description:"เจอร่มยาวสีน้ำเงินล้วน ด้ามพลาสติกสีดำ ไม่มีลาย" } },

  { label: false, note: "เอกสารคนละวิชา",
    a: { type:"lost", category:"เอกสาร", color:"ขาว", location:"หอสมุดกลาง", eventDate:"2569-09-01",
         description:"แฟ้มเอกสารวิชาบัญชีต้นทุน มีชื่อเขียนหน้าปก" },
    b: { type:"found", category:"เอกสาร", color:"ขาว", location:"คณะมนุษยศาสตร์", eventDate:"2569-01-05",
         description:"เจอสมุดจดวิชาภาษาญี่ปุ่น ปกไม่มีชื่อ" } }
];

/* ===================================================================
   ตัววัดผล
   =================================================================== */
export function evaluate(dataset = DATASET, semanticOf = null){
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const errors = [];

  for (const row of dataset){
    const semantic = semanticOf ? semanticOf(row) : null;
    const r = scorePair(row.a, row.b, null, semantic);
    const predicted = !!(r && r.score >= MATCH_THRESHOLD);

    if (predicted && row.label) tp++;
    else if (predicted && !row.label){ fp++; errors.push({ type:"false positive", note:row.note, score:r.score }); }
    else if (!predicted && row.label){ fn++; errors.push({ type:"false negative", note:row.note, score:r ? r.score : 0 }); }
    else tn++;
  }

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  const accuracy = (tp + tn) / dataset.length;

  return {
    tp, fp, tn, fn, errors,
    precision: Math.round(precision * 1000) / 10,
    recall: Math.round(recall * 1000) / 10,
    f1: Math.round(f1 * 1000) / 10,
    accuracy: Math.round(accuracy * 1000) / 10
  };
}


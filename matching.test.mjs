/* ===================================================================
   matching.test.mjs — ทดสอบตรรกะทางธุรกิจของระบบจับคู่
   -------------------------------------------------------------------
   ครอบคลุม Test Case ที่ประกาศไว้ตอนนำเสนอกลางภาค (TC-05 ถึง TC-09)
   บวก Edge Case ที่พบเพิ่มระหว่างพัฒนา

   รันด้วย:  npm test
   =================================================================== */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalize, tokenize, hasReadableText, textSimilarity, buildIdf,
  scorePair, findMatches, passesHardFilter, cosineSimilarity,
  MATCH_THRESHOLD, MAX_MATCHES
} from "../matching.js";

/* ---------- ตัวช่วยสร้างประกาศตัวอย่าง ---------- */
const post = (over = {}) => ({
  id: "p" + Math.random().toString(36).slice(2, 8),
  authorId: "user-a",
  type: "lost",
  category: "กระเป๋า",
  color: "ดำ",
  description: "กระเป๋าสะพายสีดำ",
  location: "คณะวิศวกรรมศาสตร์",
  eventDate: "2569-09-01",
  status: "active",
  ...over
});

/* ===================================================================
   1. การทำความสะอาดข้อความ (Text Normalization)
   =================================================================== */
describe("normalize — ยุบคำพ้องและตัดอักขระพิเศษ", () => {
  test("ยุบยี่ห้อที่สะกดต่างกันให้เป็นคำเดียว", () => {
    assert.ok(normalize("ไอโฟน 15").includes("iphone"));
    assert.ok(normalize("iPhone 15").includes("iphone"));
    assert.ok(normalize("กระเป๋า Anello").includes("anello"));
    assert.ok(normalize("กระเป๋าอนิลโล่").includes("anello"));
  });

  test("ยุบชื่อสีที่เขียนต่างกัน", () => {
    assert.equal(normalize("สีดำ"), normalize("ดำ"));
    assert.equal(normalize("สีน้ำเงิน"), normalize("น้ำเงิน"));
  });

  test("ตัดอักขระพิเศษและช่องว่างซ้ำ", () => {
    assert.equal(normalize("  กระเป๋า!!!   ดำ??  "), "กระเป๋า ดำ");
  });

  test("รับค่าว่างหรือ null ได้โดยไม่ error", () => {
    assert.equal(normalize(null), "");
    assert.equal(normalize(undefined), "");
    assert.equal(normalize(""), "");
  });
});

describe("tokenize — ตัดคำภาษาไทยด้วย bigram", () => {
  test("คำภาษาอังกฤษถูกเก็บทั้งคำ ไม่ถูกหั่น", () => {
    assert.ok(tokenize("anello bag").includes("anello"));
  });

  test("ตัด stopword ทิ้ง", () => {
    assert.ok(!tokenize("ของ ที่ และ ครับ").includes("ครับ"));
  });
});

/* ===================================================================
   2. TC-06 — โพสต์ที่มีแต่อีโมจิ ต้องไม่ทำให้ระบบล่ม
   =================================================================== */
describe("hasReadableText — ตรวจว่ามีคำให้วิเคราะห์หรือไม่", () => {
  test("ข้อความปกติถือว่ามีคำ", () => {
    assert.equal(hasReadableText("กระเป๋าสีดำ"), true);
    assert.equal(hasReadableText("black bag"), true);
  });

  test("อีโมจิล้วนถือว่าไม่มีคำ", () => {
    assert.equal(hasReadableText("😀😀😀"), false);
    assert.equal(hasReadableText("!!!???"), false);
    assert.equal(hasReadableText("   "), false);
    assert.equal(hasReadableText(""), false);
  });

  test("อีโมจิปนตัวหนังสือถือว่ามีคำ", () => {
    assert.equal(hasReadableText("😀 กระเป๋า"), true);
  });

  test("คำนวณความคล้ายของอีโมจิล้วนได้ 0 โดยไม่ crash", () => {
    assert.equal(textSimilarity("😀😀", "🎒🎒", null), 0);
  });
});

/* ===================================================================
   3. ความคล้ายของข้อความ
   =================================================================== */
describe("textSimilarity", () => {
  test("ข้อความเดียวกันได้คะแนนเต็ม", () => {
    const s = textSimilarity("กระเป๋าสีดำมีสติกเกอร์แมว", "กระเป๋าสีดำมีสติกเกอร์แมว", null);
    assert.ok(s > 0.99, `ควรใกล้ 1 แต่ได้ ${s}`);
  });

  test("ข้อความคนละเรื่องได้คะแนนต่ำ", () => {
    const s = textSimilarity("กระเป๋าสะพายสีดำ", "โทรศัพท์ไอโฟนสีขาว", null);
    assert.ok(s < 0.3, `ควรต่ำกว่า 0.3 แต่ได้ ${s}`);
  });

  test("ทนคำสะกดต่างกันเล็กน้อย (สติกเกอร์ / สติ๊กเกอร์)", () => {
    const s = textSimilarity("มีสติกเกอร์ลายแมว", "มีสติ๊กเกอร์รูปแมว", null);
    assert.ok(s > 0.5, `ควรสูงกว่า 0.5 แต่ได้ ${s}`);
  });

  test("ค่าที่คืนอยู่ในช่วง 0 ถึง 1 เสมอ", () => {
    for (const [a, b] of [["", ""], ["ก", "ข"], ["abc", "abc"], ["😀", "กระเป๋า"]]) {
      const s = textSimilarity(a, b, null);
      assert.ok(s >= 0 && s <= 1, `${a}/${b} ได้ ${s}`);
    }
  });
});

/* ===================================================================
   4. TC-08 — หมวดหมู่/สีต่างกัน ต้องไม่ถูกจับคู่
   =================================================================== */
describe("passesHardFilter — ด่านบังคับก่อนวิเคราะห์ข้อความ", () => {
  test("ประเภทเดียวกัน (หายกับหาย) ไม่ผ่าน", () => {
    assert.equal(passesHardFilter(post({ type: "lost" }), post({ type: "lost" })), false);
  });

  test("คนละหมวดหมู่ไม่ผ่าน", () => {
    const a = post({ type: "lost", category: "กระเป๋า" });
    const b = post({ type: "found", category: "โทรศัพท์" });
    assert.equal(passesHardFilter(a, b), false);
  });

  test("คนละสีไม่ผ่าน", () => {
    const a = post({ type: "lost", color: "ดำ" });
    const b = post({ type: "found", color: "ขาว" });
    assert.equal(passesHardFilter(a, b), false);
  });

  test('สี "อื่นๆ" ถือว่าผ่านได้ (ยืดหยุ่นให้ผู้ใช้ที่ระบุสีไม่ได้)', () => {
    const a = post({ type: "lost", color: "อื่นๆ" });
    const b = post({ type: "found", color: "ดำ" });
    assert.equal(passesHardFilter(a, b), true);
  });
});

describe("scorePair — ตัดทิ้งทันทีเมื่อไม่ผ่านด่านบังคับ", () => {
  test("คนละหมวดหมู่คืนค่า null", () => {
    const r = scorePair(post({ type: "lost", category: "กระเป๋า" }),
                        post({ type: "found", category: "กุญแจ" }), null);
    assert.equal(r, null);
  });

  test("คนละสีคืนค่า null แม้คำอธิบายเหมือนกันเป๊ะ", () => {
    const desc = "กระเป๋าสะพายมีสติกเกอร์ลายแมว";
    const r = scorePair(post({ type: "lost", color: "ดำ", description: desc }),
                        post({ type: "found", color: "แดง", description: desc }), null);
    assert.equal(r, null);
  });
});

/* ===================================================================
   5. TC-07 — คู่ที่ตรงกันจริงต้องถูกจับได้
   =================================================================== */
describe("findMatches — กรณีจับคู่สำเร็จ", () => {
  const lost = post({
    id: "lost-1", type: "lost", authorId: "user-a",
    description: "กระเป๋าสะพายสีดำยี่ห้อ Anello มีสติกเกอร์ลายแมวติดหน้ากระเป๋า"
  });
  const found = post({
    id: "found-1", type: "found", authorId: "user-b",
    description: "เจอกระเป๋าอนิลโล่สีดำ มีสติ๊กเกอร์รูปแมวติดอยู่ด้านหน้า",
    eventDate: "2569-09-02"
  });

  test("จับคู่ได้แม้เขียนยี่ห้อคนละแบบ (Anello / อนิลโล่)", () => {
    const r = findMatches(lost, [found]);
    assert.equal(r.length, 1);
    assert.ok(r[0].score >= MATCH_THRESHOLD,
      `คะแนนต้องผ่านเกณฑ์ ${MATCH_THRESHOLD} แต่ได้ ${r[0].score}`);
  });

  test("มีเหตุผลประกอบให้ผู้ใช้อ่านเข้าใจ", () => {
    const r = findMatches(lost, [found]);
    assert.ok(Array.isArray(r[0].reasons) && r[0].reasons.length >= 2);
    assert.ok(r[0].reasons.some(x => x.includes("หมวดหมู่")));
  });

  test("ประกาศที่ไม่เกี่ยวข้องไม่ถูกจับคู่", () => {
    const noise = post({
      id: "found-2", type: "found", authorId: "user-c",
      description: "กระเป๋าผ้าสีดำใบเล็ก ไม่มีอะไรข้างใน",
      location: "สวนสัก", eventDate: "2569-08-01"
    });
    const r = findMatches(lost, [noise]);
    assert.equal(r.length, 0);
  });

  test("เรียงลำดับจากคะแนนสูงไปต่ำ", () => {
    const weak = post({
      id: "found-3", type: "found", authorId: "user-c",
      description: "กระเป๋าสีดำมีสติกเกอร์แมว"
    });
    const r = findMatches(lost, [weak, found]);
    for (let i = 1; i < r.length; i++) {
      assert.ok(r[i - 1].score >= r[i].score, "ผลลัพธ์ต้องเรียงจากมากไปน้อย");
    }
  });

  test(`คืนผลไม่เกิน ${MAX_MATCHES} รายการ`, () => {
    const many = Array.from({ length: 8 }, (_, i) => post({
      id: "f" + i, type: "found", authorId: "user-" + i,
      description: "เจอกระเป๋าอนิลโล่สีดำ มีสติ๊กเกอร์รูปแมวติดอยู่ด้านหน้า"
    }));
    assert.ok(findMatches(lost, many).length <= MAX_MATCHES);
  });

  test("ประกาศที่ปิดแล้ว (resolved) ไม่ถูกนำมาจับคู่", () => {
    const closed = { ...found, id: "found-closed", status: "resolved" };
    assert.equal(findMatches(lost, [closed]).length, 0);
  });

  test("ไม่จับคู่กับตัวเอง", () => {
    assert.equal(findMatches(lost, [lost]).length, 0);
  });
});

/* ===================================================================
   6. บั๊กที่พบระหว่างพัฒนา — TF-IDF เพี้ยนเมื่อคลังข้อมูลเล็ก
   -------------------------------------------------------------------
   อาการ: คู่ที่ตรงกันจริงได้ 67% ตกเกณฑ์ 70%
   สาเหตุ: คำสำคัญที่โผล่ใน 2 จาก 2 เอกสาร ถูก IDF ลดน้ำหนักจนเกือบเป็นศูนย์
   วิธีแก้: ข้าม TF-IDF เมื่อมีเอกสารน้อยกว่า 10 ใบ
   =================================================================== */
describe("บั๊ก TF-IDF กับคลังข้อมูลขนาดเล็ก (แก้แล้ว)", () => {
  test("คลังเล็กต้องไม่ทำให้คู่ที่ตรงกันจริงตกเกณฑ์", () => {
    const lost = post({
      id: "l", type: "lost", authorId: "a",
      description: "กระเป๋าสะพายสีดำยี่ห้อ Anello มีสติกเกอร์ลายแมวติดหน้ากระเป๋า"
    });
    const found = post({
      id: "f", type: "found", authorId: "b",
      description: "เจอกระเป๋าอนิลโล่สีดำ มีสติ๊กเกอร์รูปแมวติดอยู่ด้านหน้า",
      eventDate: "2569-09-02"
    });
    // มีเอกสารแค่ 2 ใบ = กรณีที่เคยพัง
    const r = findMatches(lost, [found]);
    assert.equal(r.length, 1, "คู่ที่ตรงกันจริงต้องไม่หายไปเมื่อคลังข้อมูลเล็ก");
  });

  test("ยืนยันว่า IDF ยังทำงานปกติเมื่อคลังใหญ่พอ", () => {
    const docs = Array.from({ length: 12 }, (_, i) => `ประกาศตัวอย่างใบที่ ${i} กระเป๋าสีดำ`);
    const idf = buildIdf(docs);
    assert.ok(idf.size > 0);
    for (const v of idf.values()) assert.ok(v > 0, "ค่า IDF ต้องเป็นบวกเสมอ");
  });
});

/* ===================================================================
   7. ชั้น Semantic (embedding)
   =================================================================== */
describe("cosineSimilarity", () => {
  test("เวกเตอร์เดียวกันได้ 1", () => {
    assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
  });

  test("เวกเตอร์ตั้งฉากได้ 0", () => {
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });

  test("ค่าติดลบถูกปัดเป็น 0 (ถือว่าไม่เกี่ยวกัน)", () => {
    assert.equal(cosineSimilarity([1, 0], [-1, 0]), 0);
  });

  test("ขนาดเวกเตอร์ไม่เท่ากันคืน null แทนการ error", () => {
    assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), null);
    assert.equal(cosineSimilarity(null, [1]), null);
  });
});

describe("การรวมคะแนนสองชั้น", () => {
  // คู่นี้เขียนคนละคำเกือบทั้งประโยค ชั้นตัวอักษรจึงได้คะแนนต่ำ
  // เป็นกรณีที่ชั้นความหมายควรเข้ามาช่วย
  const a = post({ type: "lost", description: "อุปกรณ์ฟังเพลงไร้สายของฉันหล่นหาย" });
  const b = post({ type: "found", description: "เจอที่ครอบหูสำหรับฟังเสียงแบบบลูทูธ", eventDate: "2569-09-01" });

  test("ชั้นความหมายช่วยดันคะแนนขึ้นเมื่อชั้นตัวอักษรได้น้อย", () => {
    const without = scorePair(a, b, null, null).score;
    const withEmb = scorePair(a, b, null, 0.95).score;
    assert.ok(withEmb > without, `${withEmb} ควรมากกว่า ${without}`);
  });

  test("ชั้นความหมายดึงคะแนนลงได้ถ้าความหมายไม่เกี่ยวกัน (ไม่ใช่แค่บวกเพิ่มอย่างเดียว)", () => {
    const c = post({ type: "lost", description: "กระเป๋าสะพายสีดำมีสติกเกอร์ลายแมว" });
    const d = post({ type: "found", description: "กระเป๋าสะพายสีดำมีสติกเกอร์ลายแมว", eventDate: "2569-09-01" });
    assert.ok(scorePair(c, d, null, 0.1).score < scorePair(c, d, null, null).score);
  });

  test("ระบบยังทำงานได้เมื่อ embedding ใช้ไม่ได้ (semantic = null)", () => {
    const r = scorePair(a, b, null, null);
    assert.ok(r !== null && typeof r.score === "number" && !Number.isNaN(r.score));
  });

  test("คะแนนรวมไม่เกิน 1 เสมอ", () => {
    const r = scorePair(a, b, null, 1);
    assert.ok(r.score <= 1);
  });
});

/* ===================================================================
   8. ความทนทานต่อข้อมูลผิดรูป
   =================================================================== */
describe("Edge case — ข้อมูลไม่ครบหรือผิดรูป", () => {
  test("ไม่มีคำอธิบายก็ไม่ crash", () => {
    const a = post({ type: "lost", description: "" });
    const b = post({ type: "found", description: "" });
    const r = scorePair(a, b, null);
    assert.ok(r !== null && !Number.isNaN(r.score));
  });

  test("ไม่มีวันที่ก็ยังคำนวณได้", () => {
    const a = post({ type: "lost", eventDate: null });
    const b = post({ type: "found", eventDate: null });
    assert.ok(!Number.isNaN(scorePair(a, b, null).score));
  });

  test("รายชื่อผู้สมัครว่างเปล่าคืนอาร์เรย์ว่าง", () => {
    assert.deepEqual(findMatches(post(), []), []);
  });

  test("คำอธิบายยาวมากไม่ทำให้ค้าง", () => {
    const long = "กระเป๋าสีดำ ".repeat(500);
    const a = post({ type: "lost", description: long });
    const b = post({ type: "found", description: long });
    const t0 = Date.now();
    scorePair(a, b, null);
    assert.ok(Date.now() - t0 < 3000, "ต้องคำนวณเสร็จภายใน 3 วินาที");
  });
});

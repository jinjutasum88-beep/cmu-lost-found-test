/* ===================================================================
   unrelated-pairs.test.mjs — คู่ที่ "ไม่เกี่ยวกัน" ต้องไม่ได้คะแนนสูงเกินจริง
   -------------------------------------------------------------------
   ปัญหาที่พบหน้าแอดมิน: ปากกา iPad vs AirPods, คีย์การ์ด vs ขวดน้ำ ฯลฯ ได้ 64–70%
   เพราะ (1) นำค่า cosine ดิบของ embedding มาใช้ตรง ๆ ทั้งที่ข้อความไม่เกี่ยวกันก็ได้ราว 0.7–0.8
          (2) สี+สถานที่+เวลา ที่บังเอิญตรงกัน ให้ถึง 45 คะแนนโดยไม่ต้องมีหลักฐานจากคำอธิบาย
   =================================================================== */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  adjustSemantic, explainPair, scorePair, findCandidates,
  SEMANTIC_FLOOR, SEMANTIC_CEIL, DESC_FULL, MATCH_THRESHOLD, NEAR_MISS_MIN
} from "../matching.js";

const base = { status: "active", color: "ขาว", location: "หอสมุดกลาง", eventDate: "2569-10-05" };
const lost  = (o) => ({ ...base, id: "L", authorId: "u1", type: "lost",  ...o });
const found = (o) => ({ ...base, id: "F", authorId: "u2", type: "found", ...o });

/* สี สถานที่ และวันที่ตรงกันเต็ม = กรณีเลวร้ายที่สุดสำหรับคู่ที่ไม่เกี่ยวกัน */
const UNRELATED = [
  ["ปากกา iPad vs AirPods",
    lost({ category: "อื่นๆ", description: "ปากกาไอแพด air มีตำหนิตรงปลายเล็กน้อย" }),
    found({ category: "หูฟัง", description: "Airpod pro 2" })],
  ["พาวเวอร์แบงค์ vs พวงกุญแจลิง",
    lost({ category: "อื่นๆ", description: "พาวเวอร์แบงค์ power bank สีขาว ทรงสี่เหลี่ยม น้ำหนักพอดี" }),
    found({ category: "กุญแจ", description: "พวงกุญแจ ลิง สีขาว" })],
  ["หัวใจสีแดง vs โบว์ขาว",
    lost({ category: "อื่นๆ", description: "หัวใจสีแดงๆ ชมพูๆ ไม่รู้ไปทำตกไว้ที่ไหน" }),
    found({ category: "อื่นๆ", description: "โบว์สีขาวอันเล็ก" })],
  ["คีย์การ์ด vs ขวดน้ำ",
    lost({ category: "อื่นๆ", description: "คีย์การ์ด one plus cmu2" }),
    found({ category: "ขวดน้ำ", description: "ขวดน้ำเก็บความเย็นสีขาว" })]
];

const TRUE_LEXICAL = [
  lost({ category: "กระเป๋า", color: "ดำ", description: "กระเป๋าสะพายสีดำยี่ห้อ Anello มีสติกเกอร์ลายแมว" }),
  found({ category: "กระเป๋า", color: "ดำ", description: "เจอกระเป๋าอนิลโล่สีดำ มีสติ๊กเกอร์รูปแมว" })
];
const TRUE_PARAPHRASE = [   // คนละคำเกือบทั้งประโยค ต้องพึ่งความหมาย
  lost({ category: "หูฟัง", description: "อุปกรณ์ฟังเพลงไร้สายของฉันหล่นหาย" }),
  found({ category: "หูฟัง", description: "เจอที่ครอบหูสำหรับฟังเสียงแบบบลูทูธ" })
];

describe("adjustSemantic — หักค่าฐานของ cosine", () => {
  test("ค่าที่ไม่เกินค่าฐานได้ 0, ค่าที่ถึงเพดานได้ 1", () => {
    assert.equal(adjustSemantic(SEMANTIC_FLOOR), 0);
    assert.equal(adjustSemantic(0.2), 0);
    assert.equal(adjustSemantic(SEMANTIC_CEIL), 1);
    assert.equal(adjustSemantic(1), 1);
  });
  test("ค่ากลางได้ตามสัดส่วน", () => {
    const mid = (SEMANTIC_FLOOR + SEMANTIC_CEIL) / 2;
    assert.ok(Math.abs(adjustSemantic(mid) - 0.5) < 1e-9);
  });
  test("null/undefined/NaN คืน null (ไม่มี embedding)", () => {
    assert.equal(adjustSemantic(null), null);
    assert.equal(adjustSemantic(undefined), null);
    assert.equal(adjustSemantic(NaN), null);
  });
});

describe("คู่ที่ไม่เกี่ยวกัน (สี/สถานที่/เวลาตรงกันเต็ม) ต้องไม่ได้คะแนนสูง", () => {
  for (const [name, a, b] of UNRELATED) {
    test(`${name}: cosine ดิบ 0.70–0.80 → ไม่ติดแม้แต่ "เกือบแมช" (< ${NEAR_MISS_MIN * 100}%)`, () => {
      for (const raw of [0.70, 0.75, 0.80]) {
        const s = scorePair(a, b, null, raw).score;
        assert.ok(s < NEAR_MISS_MIN, `${name} raw=${raw} ได้ ${(s * 100).toFixed(0)}%`);
      }
    });
    test(`${name}: แม้ cosine ดิบสูงถึง 0.85 ก็ต้องไม่ผ่านเกณฑ์ ${MATCH_THRESHOLD * 100}%`, () => {
      const s = scorePair(a, b, null, 0.85).score;
      assert.ok(s < MATCH_THRESHOLD, `${name} ได้ ${(s * 100).toFixed(0)}%`);
    });
    test(`${name}: ไม่มี embedding (ใช้ตัวอักษรอย่างเดียว) ก็ต้องไม่ผ่านเกณฑ์`, () => {
      assert.ok(scorePair(a, b, null, null).score < MATCH_THRESHOLD);
    });
  }
});

describe("คู่จริงยังต้องจับได้", () => {
  test("คู่ที่คำอธิบายคล้ายกัน (ตัวอักษร) จับได้แม้ไม่มี embedding", () => {
    const [a, b] = TRUE_LEXICAL;
    assert.ok(scorePair(a, b, null, null).score >= MATCH_THRESHOLD);
  });
  test("คู่ที่คำอธิบายคล้ายกัน + embedding ความหมายสูง จับได้", () => {
    const [a, b] = TRUE_LEXICAL;
    assert.ok(scorePair(a, b, null, 0.95).score >= MATCH_THRESHOLD);
  });
  test("คู่ที่ต่างคำแต่ความหมายเดียวกัน (cosine ดิบ 0.95) จับได้", () => {
    const [a, b] = TRUE_PARAPHRASE;
    assert.ok(scorePair(a, b, null, 0.95).score >= MATCH_THRESHOLD);
  });
  test("คู่ต่างคำเดียวกันนี้ แต่ cosine ดิบเท่าระดับ \"ไม่เกี่ยวกัน\" (0.72) ต้องไม่จับ", () => {
    const [a, b] = TRUE_PARAPHRASE;
    assert.ok(scorePair(a, b, null, 0.72).score < MATCH_THRESHOLD);
  });
});

describe("แถวหักคะแนน (parts.evidence)", () => {
  test("คำอธิบายคล้ายพอ (≥ DESC_FULL) ไม่ถูกหักเลย", () => {
    const [a, b] = TRUE_LEXICAL;
    const e = explainPair(a, b, null, null);
    assert.ok(e.descSim >= DESC_FULL);
    assert.equal(e.parts.evidence.value, 1);
    assert.equal(e.parts.evidence.points, 0);
  });

  test("คำอธิบายไม่เกี่ยวกัน → หักคะแนนของ สี+สถานที่+เวลา เป็นค่าติดลบ", () => {
    const [, a, b] = UNRELATED[0];
    const e = explainPair(a, b, null, 0.75);
    assert.ok(e.parts.evidence.value < 1);
    assert.ok(e.parts.evidence.points < 0);
  });

  test("ผลรวมของทุกแถว (รวมแถวที่หัก) เท่ากับคะแนนรวมเสมอ", () => {
    for (const [, a, b] of UNRELATED) {
      for (const raw of [null, 0.7, 0.8, 0.9, 1]) {
        const e = explainPair(a, b, null, raw);
        const sum = Object.values(e.parts).reduce((s, p) => s + p.points, 0);
        assert.ok(Math.abs(Math.min(1, Math.max(0, sum)) - e.score) < 1e-9, `${raw}`);
      }
    }
  });

  test("ไม่มีคำอธิบายเลยก็ไม่ crash และไม่ได้คะแนนจาก สี/สถานที่/เวลา", () => {
    const e = explainPair(lost({ category: "กระเป๋า", description: "" }),
                          found({ category: "กระเป๋า", description: "" }), null, null);
    assert.ok(!Number.isNaN(e.score));
    assert.ok(e.score < NEAR_MISS_MIN);
  });
});

describe("findCandidates — คู่ที่ไม่เกี่ยวกันต้องไม่เข้ารายการจับคู่และรายการเกือบแมช", () => {
  test("ผู้สมัครไม่เกี่ยวกัน 4 ใบ (cosine ดิบ 0.78) → ไม่มีทั้ง matches และ nearMisses", () => {
    const target = UNRELATED[0][1];
    const candidates = UNRELATED.map(([, , b], i) => ({ ...b, id: "F" + i }));
    const r = findCandidates(target, candidates, () => 0.78);
    assert.equal(r.matches.length, 0);
    assert.equal(r.nearMisses.length, 0);
  });
});

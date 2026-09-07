/* ทดสอบว่าความแม่นยำยังผ่านเกณฑ์ SMART Goal (>70%) — ข้อมูลอยู่ใน evaluation-dataset.mjs */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DATASET, evaluate } from "../evaluation-dataset.mjs";

/* ===================================================================
   เกณฑ์ที่ตั้งไว้ใน SMART Goal คือความแม่นยำมากกว่า 70%
   =================================================================== */
describe("การประเมินความแม่นยำด้วยชุดข้อมูลที่ติดฉลากเอง", () => {
  const r = evaluate();

  test("ชุดข้อมูลมี 20 คู่ แบ่งเป็นตรงกัน 10 ไม่ตรงกัน 10", () => {
    assert.equal(DATASET.length, 20);
    assert.equal(DATASET.filter(d => d.label).length, 10);
    assert.equal(DATASET.filter(d => !d.label).length, 10);
  });

  test(`Precision ต้องเกิน 70% (ได้ ${r.precision}%)`, () => {
    assert.ok(r.precision >= 70, `ได้ ${r.precision}%`);
  });

  test(`Recall ต้องเกิน 70% (ได้ ${r.recall}%)`, () => {
    assert.ok(r.recall >= 70, `ได้ ${r.recall}%`);
  });

  test(`F1 ต้องเกิน 70% (ได้ ${r.f1}%)`, () => {
    assert.ok(r.f1 >= 70, `ได้ ${r.f1}%`);
  });

  test("ต้องไม่จับคู่ผิดในกรณีที่หมวดหมู่หรือสีต่างกัน (false positive ที่ยอมรับไม่ได้)", () => {
    const bad = r.errors.filter(e => e.type === "false positive" &&
      /คนละหมวดหมู่|คนละสี|ฝั่งเดียวกัน/.test(e.note));
    assert.equal(bad.length, 0, JSON.stringify(bad));
  });
});

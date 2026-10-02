import test from "node:test";
import assert from "node:assert/strict";
import { findCandidates, explainPair, MATCH_THRESHOLD, NEAR_MISS_MIN } from "../matching.js";

const found = { id: "f", type: "found", category: "อื่นๆ", color: "เทา", place: "หอสมุด",
  eventDate: "2026-09-30", description: "นาฬิกาcasio หน้าปัดสีฟ้า มีวงเล็ก ๆ ข้างในอีก3 มีสนิมค่อนข้างเยอะ" };
const lost = { id: "l", type: "lost", category: "อื่นๆ", color: "เทา", place: "โรงอาหาร",
  eventDate: "2026-09-30", description: "นาฬิกาข้อมือหน้าปัดสีฟ้า" };

test("คนละสถานที่ → เป็นคู่ 'เกือบแมช' ไม่ใช่แมช", () => {
  const r = findCandidates(lost, [found]);
  assert.equal(r.matches.length, 0);
  assert.equal(r.nearMisses.length, 1);
  assert.ok(r.nearMisses[0].score >= NEAR_MISS_MIN && r.nearMisses[0].score < MATCH_THRESHOLD);
});

test("สถานที่เดียวกัน → แมช และ parts รวมกันได้เท่าคะแนนรวม", () => {
  const r = findCandidates(lost, [{ ...found, place: "โรงอาหาร" }]);
  assert.equal(r.matches.length, 1);
  const p = r.matches[0].parts;
  const sum = p.color.points + p.desc.points + p.place.points + p.time.points;
  assert.ok(Math.abs(sum - r.matches[0].score) < 1e-9);
});

test("explainPair บอกเหตุผลที่ถูกตัดทิ้ง", () => {
  assert.equal(explainPair(lost, { ...found, category: "กุญแจ" }, null).blocked, "category");
  assert.equal(explainPair(lost, { ...found, color: "แดง" }, null).blocked, "color");
  assert.equal(explainPair(lost, { ...lost, id: "x" }, null).blocked, "sameType");
});

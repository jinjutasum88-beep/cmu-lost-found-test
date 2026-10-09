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
  assert.equal(explainPair({ ...lost, category: "โทรศัพท์" }, { ...found, category: "กุญแจ" }, null).blocked, "category");
  assert.equal(explainPair(lost, { ...found, color: "แดง" }, null).blocked, "color");
  assert.equal(explainPair(lost, { ...lost, id: "x" }, null).blocked, "sameType");
});

import { sameLabel, PRESET_CATEGORIES } from "../matching.js";
test("หมวดที่พิมพ์เอง: นาฬิกา ≈ นาฬิกาข้อมือ แต่ของสำเร็จรูปยังแยกกัน", () => {
  assert.ok(sameLabel("นาฬิกา", "นาฬิกาข้อมือ", PRESET_CATEGORIES));
  assert.ok(!sameLabel("กระเป๋า", "กระเป๋าสตางค์", PRESET_CATEGORIES));
  assert.ok(!sameLabel("นาฬิกา", "กุญแจ", PRESET_CATEGORIES));
  const a = { id:"a", type:"found", category:"นาฬิกา", color:"เงิน", place:"หอสมุด", eventDate:"2026-09-30",
    description:"นาฬิกาcasio หน้าปัดสีฟ้า มีวงเล็ก ๆ ข้างในอีก3 มีสนิมค่อนข้างเยอะ" };
  const b = { ...a, id:"b", type:"lost", category:"นาฬิกาข้อมือ", description:"นาฬิกาข้อมือหน้าปัดสีฟ้า" };
  assert.equal(explainPair(a, b, null).blocked, null);
});


import { categoriesCompatible } from "../matching.js";
test("ด่านหมวดหมู่: ตัดเฉพาะหมวดสำเร็จรูปที่ไม่เกี่ยวกัน", () => {
  assert.ok(categoriesCompatible("กระเป๋า", "กระเป๋าสตางค์"));      // คนมักเลือกสลับกัน
  assert.ok(categoriesCompatible("นาฬิกา", "โทรศัพท์"));            // พิมพ์เอง → ไม่ตัดทิ้ง
  assert.ok(categoriesCompatible("อื่นๆ", "กุญแจ"));                // อื่นๆ → ไม่ตัดทิ้ง
  assert.ok(!categoriesCompatible("โทรศัพท์", "กุญแจ"));            // สำเร็จรูปคนละหมวด → ตัด
  assert.ok(!categoriesCompatible("กระเป๋าสตางค์", "หูฟัง"));
});

test("กระเป๋าสตางค์ที่เลือกหมวดเป็น 'กระเป๋า' ยังจับคู่ได้ (เคสจากหน้าจอจริง)", () => {
  const lost = { id: "l", type: "lost", category: "กระเป๋าสตางค์", color: "ดำ", place: "หอสมุด", eventDate: "2026-10-06",
    description: "กระเป๋าสตางค์สีดำ ไม่มีลวดลาย มีเงินอยู่ในกระเป๋า" };
  const found = { id: "f", type: "found", category: "กระเป๋า", color: "ดำ", place: "หอสมุด", eventDate: "2026-10-06",
    description: "กระเป๋าสตางค์ไม่มีลวดลาย มีเงินในกระเป๋า100บาท" };
  const r = explainPair(lost, found, null);
  assert.equal(r.blocked, null);
  assert.ok(r.score >= MATCH_THRESHOLD, `คะแนน ${r.score}`);
});

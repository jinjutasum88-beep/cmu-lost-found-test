import test from "node:test";
import assert from "node:assert/strict";
import { returnedGroups, acceptedPairs } from "../matching.js";

const P = (id, type, status = "active", extra = {}) => ({ id, type, status, ...extra });
const M = (id, lostPostId, foundPostId, matchStatus = "accepted") => ({ id, lostPostId, foundPostId, matchStatus });

test("กุญแจ: ของหาย+พบของที่ปิดแล้ว = 1 คู่ (ไม่ใช่ 2)", () => {
  const posts = [P("L1", "lost", "resolved"), P("F1", "found", "resolved")];
  const g = returnedGroups(posts, [M("m1", "L1", "F1")]);
  assert.equal(g.pairs.length, 1);
  assert.equal(g.singles.length, 0);
});

test("ปิดแค่ฝั่งเดียวในคู่ที่ accepted ก็นับเป็น 1 คู่ ไม่ซ้ำเป็นเดี่ยว", () => {
  const posts = [P("L2", "lost"), P("F2", "found", "resolved")];
  const g = returnedGroups(posts, [M("m2", "L2", "F2")]);
  assert.equal(g.pairs.length, 1);
  assert.equal(g.singles.length, 0);
});

test("ประกาศที่ปิดเองโดยไม่มีคู่ = นับเดี่ยว, ที่แอดมินซ่อนไม่นับ", () => {
  const posts = [P("S1", "found", "resolved"), P("H1", "lost", "resolved", { hiddenReason: "admin" })];
  const g = returnedGroups(posts, []);
  assert.deepEqual(g.singles.map(p => p.id), ["S1"]);
  assert.equal(g.pairs.length, 0);
});

test("คู่ที่ยังไม่ accepted หรือยังไม่มีใครปิด ไม่นับเป็นส่งคืน", () => {
  const posts = [P("L3", "lost"), P("F3", "found"), P("L4", "lost", "resolved"), P("F4", "found")];
  const g = returnedGroups(posts, [M("m3", "L3", "F3"), M("m4", "L4", "F4", "waiting_for_user")]);
  assert.equal(g.pairs.length, 0);
  assert.deepEqual(g.singles.map(p => p.id), ["L4"]);
});

test("acceptedPairs ข้ามคู่ที่โพสต์ถูกลบไปแล้ว", () => {
  const posts = [P("L5", "lost"), P("F5", "found")];
  const r = acceptedPairs(posts, [M("m5", "L5", "F5"), M("m6", "L5", "GONE")]);
  assert.equal(r.length, 1);
});

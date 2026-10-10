import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { postsToHide } from "../scripts/enforce-quota.mjs";

// เวลาไทย 2026-10-10 12:00 = 05:00 UTC
const T = (h, m = 0) => ({ seconds: Date.UTC(2026, 9, 10, h, m) / 1000 });
const post = (id, author, createdAt, status = "active") => ({ id, authorId: author, createdAt, status });

describe("โควตารายวัน", () => {
  test("6 ใบในวันเดียวกัน → ซ่อนใบที่ 6 (ใหม่สุด)", () => {
    const ps = [1,2,3,4,5,6].map(i => post("p" + i, "u1", T(1, i)));
    assert.deepEqual(postsToHide(ps), [{ id: "p6", reason: "เกินโควตารายวัน" }]);
  });
  test("5 ใบพอดีไม่ถูกซ่อน", () => {
    const ps = [1,2,3,4,5].map(i => post("p" + i, "u1", T(1, i)));
    assert.equal(postsToHide(ps).length, 0);
  });
  test("ใบที่ถูกปิด (resolved) ยังนับโควตา แต่ไม่ถูกซ่อน", () => {
    const ps = [1,2,3,4,5].map(i => post("p" + i, "u1", T(1, i), "resolved"));
    ps.push(post("p6", "u1", T(2)));
    assert.deepEqual(postsToHide(ps).map(x => x.id), ["p6"]);
  });
  test("คนละคนนับแยกกัน", () => {
    const ps = [...[1,2,3].map(i => post("a" + i, "u1", T(1, i))), ...[1,2,3].map(i => post("b" + i, "u2", T(1, i)))];
    assert.equal(postsToHide(ps, { dailyLimit: 3 }).length, 0);
  });
  test("วันตามเวลาไทย: 16:59 UTC กับ 17:01 UTC อยู่คนละวัน", () => {
    const a = [1,2,3].map(i => post("a" + i, "u1", { seconds: Date.UTC(2026, 9, 10, 16, 50 + i) / 1000 }));
    const b = [1,2,3].map(i => post("b" + i, "u1", { seconds: Date.UTC(2026, 9, 10, 17, i) / 1000 }));
    assert.equal(postsToHide([...a, ...b], { dailyLimit: 3 }).length, 0);
  });
});

describe("เพดานประกาศที่เปิดอยู่", () => {
  test("เปิดค้าง 16 ใบ (คนละวัน) → ซ่อนใบที่ใหม่สุด", () => {
    const ps = Array.from({ length: 16 }, (_, i) =>
      post("p" + i, "u1", { seconds: Date.UTC(2026, 8, 1 + i, 3) / 1000 }));
    assert.deepEqual(postsToHide(ps), [{ id: "p15", reason: "เกินจำนวนประกาศที่เปิดอยู่พร้อมกัน" }]);
  });
  test("ไม่มี createdAt ถูกข้าม ไม่ crash", () => {
    assert.deepEqual(postsToHide([{ id: "x", authorId: "u1", status: "active" }]), []);
  });
});

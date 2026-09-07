/* ===================================================================
   auth.test.mjs — ทดสอบกฎรหัสผ่านและการตรวจอีเมล
   -------------------------------------------------------------------
   ครอบคลุม Test Case ที่ประกาศไว้ตอนนำเสนอกลางภาค (TC-01 ถึง TC-03)
   =================================================================== */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluatePassword, suggestPassword, POLICY } from "../password-policy.js";
import { isAllowedEmail, thaiError } from "../firebase-config.js";

/* ===================================================================
   1. TC-01 / TC-03 — การตรวจอีเมล @cmu.ac.th
   =================================================================== */
describe("isAllowedEmail — จำกัดเฉพาะอีเมลมหาวิทยาลัย", () => {
  test("อีเมล @cmu.ac.th ผ่าน", () => {
    assert.equal(isAllowedEmail("student@cmu.ac.th"), true);
  });

  test("ซับโดเมนของ cmu.ac.th ผ่าน", () => {
    assert.equal(isAllowedEmail("somchai@eng.cmu.ac.th"), true);
  });

  test("TC-03 — ตัวพิมพ์ใหญ่ผสมก็ยังผ่าน (ระบบต้องไม่แยกตัวพิมพ์)", () => {
    assert.equal(isAllowedEmail("Student@CMU.AC.TH"), true);
    assert.equal(isAllowedEmail("STUDENT@Cmu.Ac.Th"), true);
  });

  test("อีเมลนอกมหาวิทยาลัยไม่ผ่าน", () => {
    for (const e of ["someone@gmail.com", "a@hotmail.com", "b@cmu.com", "c@notcmu.ac.th"]) {
      assert.equal(isAllowedEmail(e), false, `${e} ไม่ควรผ่าน`);
    }
  });

  test("ค่าว่างหรือรูปแบบผิดไม่ผ่านและไม่ error", () => {
    for (const e of ["", null, undefined, "ไม่ใช่อีเมล"]) {
      assert.equal(isAllowedEmail(e), false);
    }
  });
});

/* ===================================================================
   2. TC-02 — ข้อความแจ้งเตือนต้องเป็นภาษาที่ผู้ใช้เข้าใจ
   =================================================================== */
describe("thaiError — แปลรหัส error ของ Firebase", () => {
  test("อีเมลซ้ำได้ข้อความภาษาไทยที่บอกทางออก", () => {
    const msg = thaiError("auth/email-already-in-use");
    assert.ok(msg.includes("สมัครไว้แล้ว"));
    assert.ok(!msg.includes("auth/"), "ต้องไม่หลุดรหัสดิบให้ผู้ใช้เห็น");
  });

  test("รหัสที่ไม่รู้จักยังคืนข้อความได้ ไม่ใช่ undefined", () => {
    const msg = thaiError("auth/some-unknown-code");
    assert.ok(typeof msg === "string" && msg.length > 0);
  });
});

/* ===================================================================
   3. กฎรหัสผ่าน — กฎแบบดั้งเดิม (composition rules)
   =================================================================== */
const pass = pw => evaluatePassword(pw, {}).valid;
const failed = pw => evaluatePassword(pw, {}).checks
  .filter(c => c.required && !c.pass).map(c => c.id);

describe("กฎแบบดั้งเดิม", () => {
  test("รหัสที่ครบทุกเงื่อนไขผ่าน", () => {
    assert.equal(pass("Krungthep#42"), true);
  });

  test(`สั้นกว่า ${POLICY.minLength} ตัวไม่ผ่าน`, () => {
    assert.ok(failed("Ab1#c").includes("length"));
  });

  test("ขาดตัวพิมพ์ใหญ่ไม่ผ่าน", () => {
    assert.ok(failed("krungthep#42").includes("upper"));
  });

  test("ขาดตัวพิมพ์เล็กไม่ผ่าน", () => {
    assert.ok(failed("KRUNGTHEP#42").includes("lower"));
  });

  test("ขาดตัวเลขไม่ผ่าน", () => {
    assert.ok(failed("Krungthep#xy").includes("digit"));
  });

  test("ขาดอักขระพิเศษไม่ผ่าน", () => {
    assert.ok(failed("Krungthep42").includes("symbol"));
  });

  test(`ยาวเกิน ${POLICY.maxLength} ตัวไม่ผ่าน`, () => {
    assert.ok(failed("Aa1#" + "x".repeat(POLICY.maxLength)).includes("maxlen"));
  });

  test("มีช่องว่างหน้า-หลังไม่ผ่าน", () => {
    assert.ok(failed(" Krungthep#42 ").includes("nospace"));
  });
});

/* ===================================================================
   4. กฎแบบใหม่ตาม NIST — จุดที่กฎดั้งเดิมจับไม่ได้
   =================================================================== */
describe("กฎแบบใหม่ตาม NIST SP 800-63B", () => {
  test('"Password1!" ผ่านกฎดั้งเดิมทุกข้อ แต่ต้องถูกปัดตกเพราะเป็นรหัสยอดนิยม', () => {
    const r = evaluatePassword("Password1!", {});
    // ยืนยันก่อนว่ามันผ่านกฎองค์ประกอบจริง
    for (const id of ["length", "lower", "upper", "digit", "symbol"]) {
      assert.equal(r.checks.find(c => c.id === id).pass, true, `${id} ควรผ่าน`);
    }
    // แต่ต้องตกที่กฎ common
    assert.equal(r.checks.find(c => c.id === "common").pass, false);
    assert.equal(r.valid, false);
    assert.equal(r.score, 0, "รหัสยอดนิยมต้องได้คะแนนความแข็งแรง 0");
  });

  test("รหัสยอดนิยมอื่นๆ ถูกปัดตก", () => {
    for (const pw of ["Qwerty123!", "Admin123!", "Welcome1!"]) {
      assert.equal(pass(pw), false, `${pw} ไม่ควรผ่าน`);
    }
  });

  test("ลำดับที่เดาง่ายถูกปัดตก (ทั้งแบบปกติและย้อนกลับ)", () => {
    assert.ok(failed("Abcd#efgh1").includes("sequence"));
    assert.ok(failed("Zyxw#4321a").includes("sequence"));
  });

  test("ตัวอักษรซ้ำติดกันเกิน 3 ตัวถูกปัดตก", () => {
    assert.ok(failed("Baaaan#42x").includes("repeat"));
  });

  test("รหัสที่มีชื่อหรืออีเมลของผู้ใช้เองถูกปัดตก", () => {
    const ctx = { email: "somchai@cmu.ac.th", name: "somchai" };
    const r = evaluatePassword("Somchai#2569", ctx);
    assert.equal(r.checks.find(c => c.id === "personal").pass, false);
    assert.equal(r.valid, false);
  });

  test("ชื่อคนอื่นในรหัสผ่านไม่ถูกปัดตก (ต้องไม่เข้มเกินจำเป็น)", () => {
    const ctx = { email: "somchai@cmu.ac.th", name: "somchai" };
    assert.equal(evaluatePassword("Krungthep#42", ctx).valid, true);
  });
});

/* ===================================================================
   5. คะแนนความแข็งแรง
   =================================================================== */
describe("คะแนนความแข็งแรง", () => {
  test("อยู่ในช่วง 0-4 เสมอ", () => {
    for (const pw of ["", "a", "Password1!", "Krungthep#42", "Zq7!vLm2#Xr9$Wt4&Kp"]) {
      const s = evaluatePassword(pw, {}).score;
      assert.ok(s >= 0 && s <= 4, `${pw} ได้ ${s}`);
    }
  });

  test("รหัสยาวและหลากหลายได้คะแนนสูงกว่ารหัสสั้น", () => {
    const short = evaluatePassword("Krung#42", {}).score;
    const long  = evaluatePassword("Zq7!vLm2#Xr9$Wt4&Kp", {}).score;
    assert.ok(long > short, `${long} ควรมากกว่า ${short}`);
  });

  test("รหัสที่ไม่ผ่านกฎได้คะแนนไม่เกิน 1", () => {
    assert.ok(evaluatePassword("abcdefgh", {}).score <= 1);
  });

  test("มีข้อความบอกระดับเป็นภาษาไทยเสมอ", () => {
    const r = evaluatePassword("Krungthep#42", {});
    assert.ok(typeof r.label === "string" && r.label.length > 0);
  });
});

/* ===================================================================
   6. ตัวสุ่มรหัสผ่าน
   =================================================================== */
describe("suggestPassword", () => {
  test("รหัสที่สุ่มมาต้องผ่านกฎทุกข้อ (ทดสอบ 50 ครั้ง)", () => {
    for (let i = 0; i < 50; i++) {
      const pw = suggestPassword(16);
      const r = evaluatePassword(pw, {});
      assert.equal(r.valid, true, `รอบที่ ${i} ได้ "${pw}" ซึ่งไม่ผ่าน: ` +
        r.checks.filter(c => c.required && !c.pass).map(c => c.id).join(","));
    }
  });

  test("ความยาวตรงตามที่ขอ", () => {
    assert.equal(suggestPassword(20).length, 20);
  });

  test("สุ่มสองครั้งต้องไม่ได้ค่าเดิม", () => {
    assert.notEqual(suggestPassword(16), suggestPassword(16));
  });

  test("ไม่มีตัวอักษรที่สับสนง่าย (l, I, O, 0, 1)", () => {
    for (let i = 0; i < 20; i++) {
      assert.ok(!/[lIO01]/.test(suggestPassword(16)));
    }
  });
});

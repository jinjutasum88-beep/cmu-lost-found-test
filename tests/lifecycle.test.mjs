import test from "node:test";
import assert from "node:assert/strict";
import { createLifecycle } from "../scripts/lifecycle.mjs";

/* Firestore จำลองแบบเล็กที่สุดเท่าที่สคริปต์เรียกใช้ */
function fakeDb(seed) {
  const store = JSON.parse(JSON.stringify(seed));            // { collection: { id: data } }
  const ref = (col, id) => ({
    id,
    get: async () => ({ exists: !!store[col]?.[id], id, data: () => store[col]?.[id], ref: ref(col, id) }),
    update: async (patch) => { Object.assign(store[col][id], patch); },
    delete: async () => { delete store[col]?.[id]; },
  });
  const query = (col, filters = [], lim = Infinity) => ({
    where: (f, op, v) => query(col, [...filters, [f, v]], lim),
    limit: (n) => query(col, filters, n),
    get: async () => {
      const docs = Object.entries(store[col] || {})
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .slice(0, lim)
        .map(([id, d]) => ({ id, data: () => d, ref: ref(col, id) }));
      return { docs, empty: docs.length === 0 };
    },
  });
  return { store, collection: (col) => ({ ...query(col), doc: (id) => ref(col, id) }) };
}
const admin = { firestore: { FieldValue: { serverTimestamp: () => "TS" } } };
const build = (seed, sent = [], ok = true) => {
  const db = fakeDb(seed);
  const lc = createLifecycle({
    db, admin, SITE_URL: "https://x/", esc: (s) => String(s ?? ""),
    wantsEmail: async () => true,
    emailShell: (title, body) => `${title}|${body}`,
    itemBlock: (label) => label,
    sendEmail: async (m) => { sent.push(m); return ok; },
  });
  return { db, lc, sent };
};

test("ของหายกดว่าได้คืนแล้ว → ปิดประกาศผู้พบ และไม่ตรวจซ้ำ", async () => {
  const { db, lc } = build({
    matches: { m1: { matchStatus: "accepted", lostPostId: "L", foundPostId: "F" } },
    posts: { L: { status: "resolved" }, F: { status: "active" } },
  });
  assert.equal(await lc.syncResolvedPairs(), 1);
  assert.equal(db.store.posts.F.status, "resolved");
  assert.equal(db.store.posts.F.resolvedViaMatch, "m1");
  assert.ok(db.store.matches.m1.pairClosedAt);
  assert.equal(await lc.syncResolvedPairs(), 0);
});

test("ของหายยังไม่ได้คืน → ไม่แตะประกาศผู้พบ", async () => {
  const { db, lc } = build({
    matches: { m1: { matchStatus: "accepted", lostPostId: "L", foundPostId: "F" } },
    posts: { L: { status: "active" }, F: { status: "active" } },
  });
  assert.equal(await lc.syncResolvedPairs(), 0);
  assert.equal(db.store.posts.F.status, "active");
  assert.equal(db.store.matches.m1.pairClosedAt, undefined);
});

test("เจ้าของกดยืนยัน → ส่งอีเมลหาผู้พบครั้งเดียว", async () => {
  const seed = {
    matches: { m1: { matchStatus: "awaiting_finder", foundPostId: "F", foundAuthorId: "u2" } },
    posts: { F: { authorEmail: "finder@cmu.ac.th", authorName: "sakuma", category: "นาฬิกา" } },
  };
  const { db, lc, sent } = build(seed);
  assert.equal(await lc.notifyFinders(), 1);
  assert.equal(sent[0].to, "finder@cmu.ac.th");
  assert.ok(db.store.matches.m1.finderNotifiedAt);
  assert.equal(await lc.notifyFinders(), 0);
  assert.equal(sent.length, 1);
});

test("ส่งอีเมลไม่สำเร็จ → ไม่จดว่าแจ้งแล้ว (ลองใหม่รอบหน้า)", async () => {
  const { db, lc } = build({
    matches: { m1: { matchStatus: "awaiting_finder", foundPostId: "F", foundAuthorId: "u2" } },
    posts: { F: { authorEmail: "a@cmu.ac.th" } },
  }, [], false);
  assert.equal(await lc.notifyFinders(), 0);
  assert.equal(db.store.matches.m1.finderNotifiedAt, undefined);
});

test("เปิดเผยข้อมูลติดต่อ → foundContact มี pickupNote ให้ฝั่งของหายเห็น", async () => {
  const { db, lc } = build({
    matches: { m1: { matchStatus: "accepted", contactRevealed: false, lostPostId: "L", foundPostId: "F",
                     lostAuthorId: "u1", foundAuthorId: "u2" } },
    posts: { L: { authorName: "นนทกร", authorEmail: "l@cmu.ac.th" },
             F: { authorName: "sakuma", authorEmail: "f@cmu.ac.th", pickupNote: "เจอกันที่ลานกิจค่ะ" } },
  });
  await lc.revealContacts();
  const m = db.store.matches.m1;
  assert.equal(m.contactRevealed, true);
  assert.equal(m.foundContact.pickupNote, "เจอกันที่ลานกิจค่ะ");
  assert.equal(m.lostContact.email, "l@cmu.ac.th");
});

test("ผู้พบไม่ตอบเกิน 7 วัน → declined (หมดเวลา) แต่ที่ยังไม่ครบกำหนดไม่แตะ", async () => {
  const day = 86400000;
  const { db, lc } = build({
    matches: {
      old: { matchStatus: "awaiting_finder", finderNotifiedAt: Date.now() - 8 * day },
      fresh: { matchStatus: "awaiting_finder", finderNotifiedAt: Date.now() - 1 * day },
      never: { matchStatus: "awaiting_finder" },
    },
  });
  assert.equal(await lc.expireStaleConsents(7), 1);
  assert.equal(db.store.matches.old.matchStatus, "declined");
  assert.equal(db.store.matches.old.expired, true);
  assert.equal(db.store.matches.fresh.matchStatus, "awaiting_finder");
  assert.equal(db.store.matches.never.matchStatus, "awaiting_finder");
});

test("ผู้พบไม่อนุญาต → อีเมลแจ้งเจ้าของของหายครั้งเดียว", async () => {
  const { db, lc, sent } = build({
    matches: { m1: { matchStatus: "declined", lostPostId: "L", lostAuthorId: "u1" } },
    posts: { L: { authorEmail: "lost@cmu.ac.th", authorName: "นนทกร" } },
  });
  assert.equal(await lc.notifyDeclines(), 1);
  assert.equal(sent[0].to, "lost@cmu.ac.th");
  assert.ok(db.store.matches.m1.ownerNotifiedAt);
  assert.equal(await lc.notifyDeclines(), 0);
  assert.equal(sent.length, 1);
});

test("แจ้งเจ้าของไม่สำเร็จ → ไม่จดว่าแจ้งแล้ว", async () => {
  const { db, lc } = build({
    matches: { m1: { matchStatus: "declined", lostPostId: "L", lostAuthorId: "u1" } },
    posts: { L: { authorEmail: "lost@cmu.ac.th" } },
  }, [], false);
  assert.equal(await lc.notifyDeclines(), 0);
  assert.equal(db.store.matches.m1.ownerNotifiedAt, undefined);
});

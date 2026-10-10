/* ===================================================================
   enforce-quota.mjs — บังคับโควตาโพสต์ฝั่งเซิร์ฟเวอร์
   -------------------------------------------------------------------
   หน้าเว็บจำกัดไว้แล้ว (ลงได้ 5 ใบ/วัน, เปิดค้างได้ 15 ใบ) แต่ผู้ใช้ข้ามได้ด้วยการเรียก Firestore ตรง ๆ
   สคริปต์นี้ตรวจซ้ำตอนรอบดูแลรายชั่วโมง: โพสต์ที่เกินโควตาจะถูกซ่อน (status = "hidden")
   จึงไม่ถูกนำไปจับคู่ ข้อมูลยังอยู่ ไม่ได้ลบ

   กฎ
     - นับตามวันตามเวลาไทย (UTC+7) จากเวลาที่สร้าง (createdAt) ใบที่เกิน DAILY_LIMIT ในวันเดียวกัน → ซ่อนใบที่ใหม่กว่า
     - ประกาศที่ยังเปิดอยู่ของคนเดียวกันเกิน ACTIVE_LIMIT → ซ่อนใบที่ใหม่กว่า
   =================================================================== */
export const DAILY_LIMIT = 5;
export const ACTIVE_LIMIT = 15;
const TZ_OFFSET_MS = 7 * 3600 * 1000;

const secondsOf = p => p.createdAt?.seconds ?? p.createdAt?._seconds ?? null;
const dayOf = p => {
  const s = secondsOf(p);
  return s === null ? null : new Date(s * 1000 + TZ_OFFSET_MS).toISOString().slice(0, 10);
};

/** คืนรายการ { id, reason } ของโพสต์ที่ต้องซ่อน (ฟังก์ชันบริสุทธิ์ ทดสอบได้) */
export function postsToHide(posts, { dailyLimit = DAILY_LIMIT, activeLimit = ACTIVE_LIMIT } = {}) {
  const hide = new Map();
  const byAuthor = new Map();
  for (const p of posts) {
    if (!p.authorId || secondsOf(p) === null) continue;
    if (!byAuthor.has(p.authorId)) byAuthor.set(p.authorId, []);
    byAuthor.get(p.authorId).push(p);
  }
  for (const list of byAuthor.values()) {
    list.sort((a, b) => secondsOf(a) - secondsOf(b));      // เก่า → ใหม่
    const perDay = new Map();
    for (const p of list) {                                 // โควตารายวัน นับทุกสถานะ (ลบ/ปิดแล้วก็นับ)
      const d = dayOf(p);
      const n = (perDay.get(d) || 0) + 1;
      perDay.set(d, n);
      if (n > dailyLimit && p.status === "active") hide.set(p.id, "เกินโควตารายวัน");
    }
    const active = list.filter(p => p.status === "active" && !hide.has(p.id));
    active.slice(activeLimit).forEach(p => hide.set(p.id, "เกินจำนวนประกาศที่เปิดอยู่พร้อมกัน"));
  }
  return [...hide].map(([id, reason]) => ({ id, reason }));
}

/** ดึงโพสต์ของ 2 วันล่าสุด + โพสต์ที่ยังเปิดอยู่ แล้วซ่อนใบที่เกินโควตา */
export async function enforceQuota({ db, admin }) {
  const since = admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 86400000);
  const [recent, active] = await Promise.all([
    db.collection("posts").where("createdAt", ">=", since).get(),
    db.collection("posts").where("status", "==", "active").limit(1000).get()
  ]);
  const all = new Map();
  for (const d of [...recent.docs, ...active.docs]) all.set(d.id, { id: d.id, ...d.data() });
  const targets = postsToHide([...all.values()]);
  for (const t of targets) {
    await db.collection("posts").doc(t.id).update({
      status: "hidden", hiddenReason: t.reason,
      hiddenAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`ซ่อนโพสต์ ${t.id}: ${t.reason}`);
  }
  return targets.length;
}

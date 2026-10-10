/* ===================================================================
   reset-dashboard.mjs — ล้างข้อมูลทดสอบก่อนเปิดเว็บจริง
   -------------------------------------------------------------------
   ค่าเริ่มต้นคือ "ดูเฉยๆ" (dry-run) ไม่ลบอะไร ต้องใส่ --apply จึงจะลบจริง และลบกลับคืนไม่ได้

     export FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)"
     node scripts/reset-dashboard.mjs                  # ดูว่าแต่ละคอลเลกชันมีกี่รายการ
     node scripts/reset-dashboard.mjs --apply          # ล้างผลจับคู่/สถิติ (ไม่แตะประกาศ)
     node scripts/reset-dashboard.mjs --apply --posts  # ล้างประกาศและรูปด้วย

   ล้างโดยค่าเริ่มต้น (ข้อมูลที่ระบบคำนวณได้เอง): matches, matchContacts, nearMisses, matchRuns, reports
   ล้างเพิ่มเมื่อใส่ --posts: posts, postImages, embeddings
   ไม่แตะ: users (โปรไฟล์) — บัญชีล็อกอินอยู่ใน Firebase Authentication ต้องลบเองที่ Console
   ถ้าล้างแค่ผลจับคู่แต่ไม่ล้างประกาศ ให้ตั้ง processed=false ให้ประกาศที่เหลือ เพื่อให้จับคู่ใหม่ได้
   =================================================================== */
import admin from "firebase-admin";

const APPLY = process.argv.includes("--apply");
const POSTS = process.argv.includes("--posts");

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("ไม่พบ FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const TARGETS = ["matches", "matchContacts", "nearMisses", "matchRuns", "reports"];
if (POSTS) TARGETS.push("posts", "postImages", "embeddings");

async function wipe(name) {
  let total = 0;
  for (;;) {
    const snap = await db.collection(name).limit(400).get();
    if (snap.empty) break;
    total += snap.size;
    if (!APPLY) { // นับอย่างเดียว
      const all = await db.collection(name).count().get();
      return all.data().count;
    }
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return total;
}

console.log(APPLY ? "== โหมดลบจริง (ย้อนกลับไม่ได้) ==" : "== โหมดดูเฉยๆ (ยังไม่ลบ ใส่ --apply เพื่อลบจริง) ==");
for (const name of TARGETS) {
  const n = await wipe(name);
  console.log(`${name.padEnd(14)} ${APPLY ? "ลบแล้ว" : "จะลบ"} ${n} รายการ`);
}

if (APPLY && !POSTS) {
  const posts = await db.collection("posts").get();
  let fixed = 0;
  for (let i = 0; i < posts.docs.length; i += 400) {
    const batch = db.batch();
    posts.docs.slice(i, i + 400).forEach(d => { batch.update(d.ref, { processed: false }); fixed++; });
    await batch.commit();
  }
  console.log(`ตั้ง processed=false ให้ ${fixed} ประกาศ เพื่อให้จับคู่ใหม่ได้`);
}
console.log("เสร็จ");

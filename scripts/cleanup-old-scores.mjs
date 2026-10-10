/* ===================================================================
   cleanup-old-scores.mjs — ล้างผลที่ได้คะแนนจากสูตรเก่า (ก่อนหักค่าฐาน/หักคะแนนเมื่อคำอธิบายไม่สอดคล้อง)
   -------------------------------------------------------------------
   ค่าเริ่มต้นคือ "ดูเฉยๆ" (dry-run) ไม่ลบอะไร ต้องใส่ --apply จึงจะลบจริง

     export FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)"
     node scripts/cleanup-old-scores.mjs                        # ดูว่าจะลบอะไร
     node scripts/cleanup-old-scores.mjs --apply                # ล้างรายการเกือบแมช (nearMisses) ทั้งหมด
     node scripts/cleanup-old-scores.mjs --apply --drop-waiting # ล้างคู่ที่ "รอเจ้าของตอบ" และเป็นสูตรเก่าด้วย

   - nearMisses เป็นข้อมูลที่ระบบคำนวณซ้ำได้เอง ลบได้ปลอดภัย รอบจับคู่ถัดไปจะสร้างใหม่ด้วยสูตรใหม่
   - --drop-waiting ลบเฉพาะ matches ที่ matchStatus = waiting_for_user และไม่มี parts.evidence (สร้างจากสูตรเก่า)
     พร้อม matchContacts ของคู่นั้น แล้วตั้ง processed=false ให้ประกาศทั้งสองใบ เพื่อให้จับคู่ใหม่ด้วยสูตรใหม่
     ข้อควรระวัง: ถ้าคู่นั้นเป็นคู่จริง ระบบอาจสร้างคู่ใหม่และส่งอีเมลแจ้งซ้ำอีกครั้ง
   - ไม่แตะคู่ที่ accepted / rejected / declined
   =================================================================== */
import admin from "firebase-admin";

const APPLY = process.argv.includes("--apply");
const DROP_WAITING = process.argv.includes("--drop-waiting");

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("ไม่พบ FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

async function deleteAll(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach(r => batch.delete(r));
    await batch.commit();
  }
}

console.log(APPLY ? "== โหมดลบจริง ==" : "== โหมดดูเฉยๆ (ยังไม่ลบ ใส่ --apply เพื่อลบจริง) ==");

const nm = await db.collection("nearMisses").get();
console.log(`nearMisses: ${nm.size} รายการ`);
if (APPLY) await deleteAll(nm.docs.map(d => d.ref));

const waiting = (await db.collection("matches").where("matchStatus", "==", "waiting_for_user").get()).docs
  .filter(d => !(d.get("parts") && d.get("parts").evidence));
console.log(`matches รอตอบ + สูตรเก่า: ${waiting.length} รายการ`);
for (const d of waiting) {
  console.log(`  ${Math.round((d.get("similarityScore") || 0) * 100)}%  ${(d.get("lostSnap")?.description || "").slice(0, 40)}  ↔  ${(d.get("foundSnap")?.description || "").slice(0, 40)}`);
}

if (APPLY && DROP_WAITING && waiting.length) {
  const refs = [];
  const postIds = new Set();
  for (const d of waiting) {
    refs.push(d.ref, db.collection("matchContacts").doc(d.id));
    postIds.add(d.get("lostPostId")); postIds.add(d.get("foundPostId"));
  }
  await deleteAll(refs);
  for (const id of postIds) {
    await db.collection("posts").doc(id).update({ processed: false }).catch(() => {});
  }
  console.log(`ลบ ${waiting.length} คู่ และตั้ง processed=false ให้ ${postIds.size} ประกาศแล้ว`);
} else if (waiting.length) {
  console.log("(ไม่ได้ลบคู่ที่รอตอบ — ใส่ --apply --drop-waiting ถ้าต้องการ)");
}
console.log("เสร็จ");

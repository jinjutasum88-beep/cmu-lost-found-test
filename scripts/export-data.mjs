/* ===================================================================
   export-data.mjs — ส่งออกข้อมูลจับคู่เป็นไฟล์ JSON เพื่อใช้วิเคราะห์/ปรับคะแนน
   -------------------------------------------------------------------
   ส่งออกเฉพาะ matches, nearMisses, matchRuns, posts
   ตัดฟิลด์ส่วนตัวออกอัตโนมัติ (อีเมล ชื่อ เบอร์ ช่องทางติดต่อ รูป) และไม่ส่งออก users/embeddings

   วิธีใช้ (รันบนเครื่องตัวเอง):
     export FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)"
     node scripts/export-data.mjs
   ได้ไฟล์ export.json ในโฟลเดอร์ปัจจุบัน
   =================================================================== */
import admin from "firebase-admin";
import { writeFileSync } from "node:fs";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("ไม่พบ FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const PRIVATE = /(email|phone|tel|name|contact|line|instagram|facebook|photo|thumb|image|embedding)/i;

function clean(v) {
  if (v === null || v === undefined) return v;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(clean);
  if (typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (!PRIVATE.test(k)) o[k] = clean(x);
    return o;
  }
  return v;
}

const out = {};
for (const c of ["matches", "nearMisses", "matchRuns", "posts"]) {
  const snap = await db.collection(c).get();
  out[c] = snap.docs.map(d => ({ id: d.id, ...clean(d.data()) }));
  console.log(c, out[c].length);
}
writeFileSync("export.json", JSON.stringify(out, null, 2));
console.log("เขียน export.json แล้ว");

/* ===================================================================
   calibrate-semantic.mjs — หาค่า SEMANTIC_FLOOR / SEMANTIC_CEIL จากข้อมูลจริงในระบบ
   -------------------------------------------------------------------
   หลักคิด: คู่ของหาย×ของเจอที่ผ่านด่านบังคับ "ส่วนใหญ่ไม่ใช่ของชิ้นเดียวกัน"
   การกระจายของค่า cosine ดิบของคู่ทั้งหมดจึงสะท้อน "ค่าฐาน" ของคู่ไม่เกี่ยวกัน
     FLOOR = เปอร์เซ็นไทล์ที่ 90 ของคู่ทั้งหมด (ปัดขึ้นเป็น 0.01)
     CEIL  = ค่ากลางของคู่ที่ผู้ใช้กดยืนยันว่าใช่ (accepted) ถ้ามี ไม่งั้นใช้ 0.95
   พิมพ์เฉพาะตัวเลข ไม่พิมพ์ข้อความประกาศหรือข้อมูลส่วนตัว (ปลอดภัยแม้ log เป็นสาธารณะ)

   วิธีใช้ (GitHub Actions: "หาค่าฐานคะแนนความหมาย" หรือบนเครื่อง)
     export FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)"
     node scripts/calibrate-semantic.mjs
   =================================================================== */
import admin from "firebase-admin";
import { passesHardFilter, cosineSimilarity } from "../matching.js";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error("ไม่พบ FIREBASE_SERVICE_ACCOUNT"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const posts = (await db.collection("posts").where("status", "==", "active").limit(1000).get())
  .docs.map(d => ({ id: d.id, ...d.data() }));
const vec = new Map();
for (const p of posts) {
  const e = await db.collection("embeddings").doc(p.id).get();
  if (e.exists) vec.set(p.id, e.data().vector);
}
const lost = posts.filter(p => p.type === "lost" && vec.has(p.id));
const found = posts.filter(p => p.type === "found" && vec.has(p.id));

const all = [];
for (const l of lost) for (const f of found) {
  if (l.authorId === f.authorId || !passesHardFilter(l, f)) continue;
  const c = cosineSimilarity(vec.get(l.id), vec.get(f.id));
  if (c !== null) all.push(c);
}
all.sort((a, b) => a - b);

const accepted = (await db.collection("matches").where("matchStatus", "==", "accepted").get())
  .docs.map(d => d.get("semanticScore")).filter(x => typeof x === "number").sort((a, b) => a - b);

const q = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] : null;
const f2 = x => x === null ? "-" : x.toFixed(3);
console.log(`ประกาศที่เปิดอยู่ ${posts.length} ใบ (มี embedding: ของหาย ${lost.length}, ของเจอ ${found.length})`);
console.log(`คู่ที่ผ่านด่านบังคับและมี embedding: ${all.length} คู่`);
console.log(`cosine ดิบของทุกคู่  min=${f2(all[0] ?? null)}  P25=${f2(q(all,.25))}  P50=${f2(q(all,.5))}  P75=${f2(q(all,.75))}  P90=${f2(q(all,.9))}  P95=${f2(q(all,.95))}  max=${f2(all.at(-1) ?? null)}`);
console.log(`คู่ที่ผู้ใช้ยืนยันว่าใช่ (accepted): ${accepted.length} คู่  ค่าดิบ=${accepted.map(f2).join(", ") || "-"}`);

if (all.length < 10) { console.log("ข้อมูลน้อยเกินไป (< 10 คู่) แนะนำให้คงค่าเดิม 0.78 / 0.95"); process.exit(0); }
const floor = Math.ceil(q(all, 0.9) * 100) / 100;
const ceil = accepted.length ? Math.max(floor + 0.10, Math.round(q(accepted, 0.5) * 100) / 100 + 0.05) : 0.95;
console.log(`\nแนะนำ: SEMANTIC_FLOOR = ${floor.toFixed(2)}   SEMANTIC_CEIL = ${Math.min(1, ceil).toFixed(2)}`);
console.log("(ค่าปัจจุบันใน matching.js: 0.78 / 0.95)");
process.exit(0);

/* ===================================================================
   set-admin.mjs — ตั้งสิทธิ์แอดมินด้วย custom claim
   -------------------------------------------------------------------
   ทำไมต้องใช้ claim แทนการเช็คจากเอกสาร users:
   เดิม security rules เรียก get() ไปอ่านเอกสาร users ทุกครั้งที่ตรวจสิทธิ์
   ซึ่งคิดเป็น 1 read ต่อการตรวจ 1 เอกสาร แอดมินเปิดดู 100 โพสต์ = 200 reads
   custom claim ฝังอยู่ใน token อยู่แล้ว จึงตรวจได้ฟรี

   วิธีใช้ (รันบนเครื่องตัวเอง):
     export FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)"
     node scripts/set-admin.mjs someone@cmu.ac.th
     node scripts/set-admin.mjs someone@cmu.ac.th --remove

   หลังรันเสร็จ ผู้ใช้ต้องออกจากระบบแล้วเข้าใหม่ เพื่อให้ token อัปเดต
   =================================================================== */

import admin from "firebase-admin";

const email = process.argv[2];
const remove = process.argv.includes("--remove");

if (!email) {
  console.error("ใช้: node scripts/set-admin.mjs <email> [--remove]");
  process.exit(1);
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("ไม่พบ FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, remove ? { admin: false } : { admin: true });
await admin.firestore().collection("users").doc(user.uid)
  .set({ role: remove ? "user" : "admin" }, { merge: true });

console.log(`${remove ? "ถอนสิทธิ์แอดมินจาก" : "ให้สิทธิ์แอดมินแก่"} ${email} (uid: ${user.uid}) เรียบร้อย`);
console.log("ผู้ใช้ต้องออกจากระบบแล้วเข้าใหม่ เพื่อให้ token อัปเดต");
process.exit(0);

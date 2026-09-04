// ตั้งค่ากลางของโปรเจกต์ — แก้ที่ไฟล์นี้ที่เดียว ทุกหน้าจะเปลี่ยนตาม
export const firebaseConfig = {
  apiKey: "AIzaSyBhwOW24Sd5kVj6zyBM6f0cwXq0UO5j2Bs",
  authDomain: "cmu-lost-found-final.firebaseapp.com",
  projectId: "cmu-lost-found-final",
  storageBucket: "cmu-lost-found-final.firebasestorage.app",
  messagingSenderId: "590590755864",
  appId: "1:590590755864:web:94c1e111ed7bf70d64af6d"
};

// URL จริงของเว็บบน GitHub Pages (ต้องลงท้ายด้วย /)
export const SITE_URL = "https://jinjutasum88-beep.github.io/cmu-lost-found-final/";

// ปลายทางที่ผู้ใช้จะถูกพากลับมาหลังกดลิงก์ในอีเมล
//
// โหมด A (ใช้อยู่ตอนนี้ — ไม่ต้องตั้งค่าอะไรใน Firebase Console เพิ่ม)
//   Firebase ยืนยันให้เองบนหน้าของ Google แล้วมีปุ่มพากลับมาที่เว็บเรา
export const ACTION_URL = SITE_URL;

// โหมด B (สวยกว่า — ใช้ได้เมื่อตั้ง Customize action URL ใน Console สำเร็จ)
//   ลิงก์ในอีเมลจะพามาที่หน้า verify.html ของเราตรงๆ ไม่ผ่านหน้า Google เลย
//   ถ้าวันไหนตั้งค่าใน Console ผ่านแล้ว ให้สลับสองบรรทัดนี้:
// export const ACTION_URL = SITE_URL + "verify.html";

// โดเมนอีเมลที่อนุญาตให้สมัคร
export const ALLOWED_DOMAINS = ["cmu.ac.th"];

export function isAllowedEmail(email) {
  const domain = String(email).trim().toLowerCase().split("@")[1] || "";
  return ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
}

// แปลรหัส error ของ Firebase เป็นภาษาคน
export function thaiError(code) {
  const map = {
    "auth/email-already-in-use": "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน",
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/weak-password": "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร",
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/wrong-password": "รหัสผ่านไม่ถูกต้อง",
    "auth/user-not-found": "ไม่พบบัญชีนี้ในระบบ",
    "auth/too-many-requests": "ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่",
    "auth/network-request-failed": "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง",
    "auth/expired-action-code": "ลิงก์หมดอายุแล้ว กดขอลิงก์ใหม่ได้ที่หน้าเข้าสู่ระบบ",
    "auth/invalid-action-code": "ลิงก์นี้ใช้ไปแล้วหรือไม่ถูกต้อง กดขอลิงก์ใหม่อีกครั้ง",
    "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้เพิ่มใน Firebase (Authentication → Settings → Authorized domains)"
  };
  return map[code] || ("เกิดข้อผิดพลาด: " + code);
}

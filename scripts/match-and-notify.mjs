/* ===================================================================
   match-and-notify.mjs
   -------------------------------------------------------------------
   ทำงานบน GitHub Actions ทุกๆ 5 นาที หน้าที่หลักสามอย่าง:

   1) จับคู่ประกาศใหม่  — อ่านประกาศที่ processed == false
      แล้ววิเคราะห์ด้วย NLP ใน matching.js สร้างเอกสารใน matches

   2) ส่งอีเมลแจ้งเตือน — เมื่อเจอคู่ ส่งอีเมลหาทั้งสองฝ่าย

   3) เปิดเผยข้อมูลติดต่อ — เมื่อเจ้าของของหายกดยืนยันว่า "ใช่"
      จึงค่อยเขียนอีเมลของอีกฝ่ายลงในเอกสาร และส่งอีเมลให้ทั้งคู่

   เหตุผลที่ต้องทำฝั่งเซิร์ฟเวอร์: กติกาความปลอดภัยของ Firestore
   ปิดไม่ให้ผู้ใช้อ่านประกาศของคนอื่นเลย การจับคู่จึงทำในเบราว์เซอร์ไม่ได้
   สคริปต์นี้ใช้ Admin SDK ซึ่งข้าม security rules ได้
   =================================================================== */

import admin from "firebase-admin";
import { findMatches, passesHardFilter, cosineSimilarity } from "../matching.js";

/* ---------- ตั้งค่าจาก GitHub Secrets ---------- */
const {
  FIREBASE_SERVICE_ACCOUNT,
  BREVO_API_KEY,
  SENDER_EMAIL,
  GEMINI_API_KEY,
  EMBEDDING_MODEL = "gemini-embedding-001",
  SENDER_NAME = "CMU LOST&FOUND",
  SITE_URL = "https://jinjutasum88-beep.github.io/cmu-lost-found-final/"
} = process.env;

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.error("ไม่พบ FIREBASE_SERVICE_ACCOUNT — ตั้งค่า GitHub Secret ก่อน");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT))
});
const db = admin.firestore();

/* ===================================================================
   ส่งอีเมลผ่าน Brevo (ฟรี 300 ฉบับ/วัน ไม่ต้องมีโดเมนของตัวเอง)
   =================================================================== */
async function sendEmail({ to, toName, subject, html }) {
  if (!BREVO_API_KEY || !SENDER_EMAIL) {
    console.log(`[ข้ามการส่งอีเมล] ยังไม่ได้ตั้งค่า BREVO_API_KEY/SENDER_EMAIL → ${to}`);
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html
    })
  });
  if (!res.ok) {
    console.error("ส่งอีเมลไม่สำเร็จ:", res.status, await res.text());
    return false;
  }
  console.log("ส่งอีเมลแล้ว →", to);
  return true;
}

/* เคารพการตั้งค่าของผู้ใช้ — ถ้าปิดการแจ้งเตือนทางอีเมลไว้ในหน้าโปรไฟล์ จะไม่ส่ง */
const prefCache = new Map();
async function wantsEmail(uid) {
  if (!uid) return true;
  if (prefCache.has(uid)) return prefCache.get(uid);
  let ok = true;
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists && snap.data().notifyEmail === false) ok = false;
  } catch (err) {
    console.warn("[prefs] อ่านการตั้งค่าผู้ใช้ไม่ได้:", err.message);
  }
  prefCache.set(uid, ok);
  if (!ok) console.log(`[prefs] ${uid} ปิดการแจ้งเตือนทางอีเมลไว้ — ข้าม`);
  return ok;
}

/* ---------- เทมเพลตอีเมล (โทนสีเดียวกับเว็บ) ---------- */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function emailShell(title, bodyHtml, ctaText, ctaUrl) {
  return `<!DOCTYPE html><html lang="th"><body style="margin:0;padding:24px;background:#F6F4FB;font-family:'Sarabun','Helvetica Neue',Arial,sans-serif;color:#241733;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:20px;padding:32px;">
    <div style="display:inline-block;background:#7B4FCB;color:#fff;font-weight:600;font-size:13px;padding:6px 14px;border-radius:10px;">CMU LOST&amp;FOUND</div>
    <h1 style="font-size:21px;margin:20px 0 12px;">${title}</h1>
    ${bodyHtml}
    ${ctaUrl ? `<p style="margin:26px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:#7B4FCB;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:600;">${ctaText}</a></p>` : ""}
    <p style="margin:26px 0 0;font-size:12px;color:#79708F;line-height:1.7;">
      อีเมลฉบับนี้ส่งอัตโนมัติจากระบบของหาย–ของพบ มหาวิทยาลัยเชียงใหม่<br>
      หากคุณไม่ได้ลงประกาศไว้ ไม่ต้องดำเนินการใดๆ
    </p>
  </div></body></html>`;
}

function itemBlock(label, snap) {
  return `<div style="background:#F6F4FB;border-radius:14px;padding:16px;margin-bottom:12px;">
    <div style="font-size:12px;color:#79708F;margin-bottom:6px;">${label}</div>
    <div style="font-weight:600;font-size:15px;">${esc(snap.category)} · ${esc(snap.color)}</div>
    <div style="font-size:13px;color:#79708F;margin-top:6px;line-height:1.6;">${esc(snap.description)}</div>
    <div style="font-size:12px;color:#79708F;margin-top:8px;">📍 ${esc(snap.location || "-")} · 📅 ${esc(snap.eventDate || "-")}</div>
  </div>`;
}

/* ===================================================================
   EMBEDDING — ชั้น "เข้าใจความหมาย" ของระบบจับคู่
   -------------------------------------------------------------------
   ใช้ Gemini Embedding API (ฟรี ไม่ต้องผูกบัตร)
   แปลงคำอธิบายเป็นเวกเตอร์ตัวเลข แล้ววัดมุมระหว่างเวกเตอร์ด้วย cosine
   ข้อความที่ความหมายใกล้กันจะได้เวกเตอร์ที่ชี้ไปทางเดียวกัน
   แม้จะไม่มีตัวอักษรร่วมกันเลย เช่น "เป้" กับ "กระเป๋าสะพาย"

   ถ้าเรียก API ไม่ได้ ฟังก์ชันคืน null และระบบจะถอยไปใช้เฉพาะ
   n-gram + TF-IDF ซึ่งยังจับคู่ได้ตามปกติ แค่แม่นน้อยลง
   =================================================================== */
const EMBED_DIM = 768;          // ย่อขนาดเวกเตอร์ให้เก็บในฐานข้อมูลได้สบาย
let embeddingDisabled = !GEMINI_API_KEY;
if (embeddingDisabled) {
  console.log("[embedding] ไม่พบ GEMINI_API_KEY — จะจับคู่ด้วย n-gram + TF-IDF อย่างเดียว");
}

async function callEmbeddingApi(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: String(text).slice(0, 2000) }] },
      taskType: "SEMANTIC_SIMILARITY",
      outputDimensionality: EMBED_DIM
    })
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("รูปแบบผลลัพธ์ไม่ถูกต้อง");
  return values;
}

/* อ่านจากแคชก่อน ถ้ายังไม่มีค่อยเรียก API แล้วเก็บไว้ใช้ครั้งหน้า
   ช่วยประหยัดโควตามาก เพราะประกาศหนึ่งใบถูกนำมาเทียบซ้ำหลายรอบ */
const memCache = new Map();
async function getEmbedding(postId, text) {
  if (embeddingDisabled || !text) return null;
  if (memCache.has(postId)) return memCache.get(postId);

  try {
    const cached = await db.collection("embeddings").doc(postId).get();
    if (cached.exists) {
      const v = cached.data().vector;
      memCache.set(postId, v);
      return v;
    }
  } catch (err) {
    console.warn("[embedding] อ่านแคชไม่ได้:", err.message);
  }

  try {
    const vector = await callEmbeddingApi(text);
    memCache.set(postId, vector);
    await db.collection("embeddings").doc(postId).set({
      vector,
      model: EMBEDDING_MODEL,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return vector;
  } catch (err) {
    console.warn("[embedding] เรียก API ไม่สำเร็จ:", err.message);
    // ถ้าเป็นปัญหาที่ key หรือโควตา ปิดการใช้ทั้งรอบนี้ไปเลย จะได้ไม่ยิงซ้ำจนช้า
    if (/40[13]|429|API key/i.test(err.message)) {
      embeddingDisabled = true;
      console.warn("[embedding] ปิดการใช้ embedding ชั่วคราวสำหรับรอบนี้");
    }
    return null;
  }
}

/* ===================================================================
   ส่วนที่ 1 — จับคู่ประกาศใหม่
   =================================================================== */
const snapOf = p => ({
  category: p.category || "",
  color: p.color || "",
  description: p.description || "",
  location: p.location || "",
  eventDate: p.eventDate || "",
  thumbUrl: p.thumbUrl || "",     // ใช้รูปย่อเท่านั้น รูปเต็มอยู่คนละคอลเลกชัน
  authorName: p.authorName || ""
});

/* เก็บกวาดข้อมูลที่ชี้ไปยังประกาศที่ถูกลบไปแล้ว (เช่น ผู้ใช้ลบบัญชี) */
async function cleanupOrphans() {
  const matches = await db.collection("matches").limit(500).get();
  let n = 0;
  for (const d of matches.docs) {
    const m = d.data();
    const [lost, found] = await Promise.all([
      db.collection("posts").doc(m.lostPostId).get(),
      db.collection("posts").doc(m.foundPostId).get()
    ]);
    if (!lost.exists || !found.exists) {
      await d.ref.delete();
      await db.collection("matchContacts").doc(d.id).delete().catch(() => {});
      await db.collection("embeddings").doc(m.lostPostId).delete().catch(() => {});
      await db.collection("embeddings").doc(m.foundPostId).delete().catch(() => {});
      n++;
    }
  }
  if (n) console.log(`ลบผลจับคู่ที่ชี้ไปยังประกาศที่ไม่มีอยู่แล้ว ${n} รายการ`);
  return n;
}

async function runMatching() {
  // ประกาศที่ยังไม่ได้ประมวลผล
  const pendingSnap = await db.collection("posts")
    .where("processed", "==", false)
    .limit(50)
    .get();

  if (pendingSnap.empty) {
    console.log("ไม่มีประกาศใหม่ที่ต้องจับคู่");
    return 0;
  }

  // ประกาศที่ยังเปิดอยู่ทั้งหมด ใช้เป็นตัวเลือกในการจับคู่
  const activeSnap = await db.collection("posts")
    .where("status", "==", "active")
    .limit(1000)
    .get();
  const activePosts = activeSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let created = 0;

  for (const docSnap of pendingSnap.docs) {
    const newPost = { id: docSnap.id, ...docSnap.data() };

    // ไม่จับคู่กับประกาศของตัวเอง และไม่จับคู่กับประกาศที่ปิดไปแล้ว
    const candidates = activePosts.filter(p =>
      p.id !== newPost.id &&
      p.authorId !== newPost.authorId &&
      p.status === "active"
    );

    // เรียก embedding เฉพาะคู่ที่ผ่านด่านหมวดหมู่+สีแล้วเท่านั้น เพื่อประหยัดโควตา API
    const shortlist = candidates.filter(c => passesHardFilter(newPost, c));
    const semanticMap = new Map();

    if (shortlist.length && !embeddingDisabled) {
      const targetVec = await getEmbedding(newPost.id, newPost.description);
      if (targetVec) {
        for (const c of shortlist) {
          const vec = await getEmbedding(c.id, c.description);
          if (!vec) continue;
          const sim = cosineSimilarity(targetVec, vec);
          if (sim !== null) semanticMap.set(c.id, sim);
        }
      }
    }
    console.log(`ประกาศ ${newPost.id}: ผ่านด่านแรก ${shortlist.length} ใบ, มีคะแนนความหมาย ${semanticMap.size} ใบ`);

    const results = findMatches(newPost, candidates,
      c => (semanticMap.has(c.id) ? semanticMap.get(c.id) : null));
    console.log(`ประกาศ ${newPost.id}: พบคู่ที่เข้าเกณฑ์ ${results.length} รายการ`);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const lostPost  = newPost.type === "lost" ? newPost : r.post;
      const foundPost = newPost.type === "lost" ? r.post : newPost;

      // กันสร้างคู่ซ้ำ
      const dup = await db.collection("matches")
        .where("lostPostId", "==", lostPost.id)
        .where("foundPostId", "==", foundPost.id)
        .limit(1).get();
      if (!dup.empty) { console.log("  ข้าม (มีคู่นี้อยู่แล้ว)"); continue; }

      const match = {
        lostPostId: lostPost.id,   lostAuthorId: lostPost.authorId,
        foundPostId: foundPost.id, foundAuthorId: foundPost.authorId,
        participantIds: [lostPost.authorId, foundPost.authorId],
        // สำเนาย่อ เพื่อให้ผู้ใช้ดูรายละเอียดอีกฝั่งได้โดยไม่ต้องเปิดสิทธิ์อ่านประกาศคนอื่น
        lostSnap:  snapOf(lostPost),
        foundSnap: snapOf(foundPost),
        similarityScore: Math.round(r.score * 100) / 100,
        lexicalScore: Math.round((r.lexical ?? 0) * 100) / 100,
        semanticScore: r.semantic === null || r.semantic === undefined
          ? null : Math.round(r.semantic * 100) / 100,
        reasons: r.reasons,
        matchRank: i + 1,
        matchStatus: "waiting_for_user",
        contactRevealed: false,
        lostContact: null,
        foundContact: null,
        notifiedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const ref = db.collection("matches").doc();
      const contactRef = db.collection("matchContacts").doc(ref.id);
      const batch = db.batch();
      batch.set(ref, match);
      batch.set(contactRef, {
        participantIds: [lostPost.authorId, foundPost.authorId],
        lostContact: {
          name: lostPost.authorName || "",
          email: lostPost.authorEmail || ""
        },
        foundContact: {
          name: foundPost.authorName || "",
          email: foundPost.authorEmail || "",
          pickupNote: foundPost.pickupNote || ""
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await batch.commit();
      created++;

      // ---------- แจ้งเจ้าของประกาศของหาย ----------
      if (await wantsEmail(lostPost.authorId)) await sendEmail({
        to: lostPost.authorEmail,
        toName: lostPost.authorName,
        subject: `พบของที่อาจตรงกับ "${lostPost.category}" ที่คุณแจ้งหาย (${Math.round(r.score * 100)}%)`,
        html: emailShell(
          "ระบบพบของที่อาจเป็นของคุณ",
          `<p style="font-size:14px;line-height:1.8;color:#79708F;margin:0 0 18px;">
             ระบบวิเคราะห์ด้วย NLP แล้วพบว่ามีคนเก็บของได้ที่คล้ายกับของที่คุณแจ้งหายไว้
             <b style="color:#5B32A8;">ความคล้าย ${Math.round(r.score * 100)}%</b>
           </p>
           ${itemBlock("ของที่คุณแจ้งหาย", snapOf(lostPost))}
           ${itemBlock("ของที่มีคนเก็บได้", snapOf(foundPost))}
           <div style="font-size:13px;color:#79708F;line-height:1.8;">
             <b style="color:#241733;">เหตุผลที่ระบบคิดว่าตรงกัน</b><br>
             ${r.reasons.map(x => "✓ " + esc(x)).join("<br>")}
           </div>
           <p style="font-size:13px;color:#79708F;margin-top:18px;line-height:1.7;">
             กรุณาเข้าเว็บเพื่อดูรูปภาพและกดยืนยันว่าใช่ของคุณหรือไม่
             ข้อมูลติดต่อของอีกฝ่ายจะเปิดเผยหลังคุณกดยืนยันเท่านั้น
           </p>`,
          "เข้าไปตรวจสอบ", SITE_URL
        )
      });

      // ---------- แจ้งเจ้าของประกาศของที่เก็บได้ ----------
      if (await wantsEmail(foundPost.authorId)) await sendEmail({
        to: foundPost.authorEmail,
        toName: foundPost.authorName,
        subject: `อาจมีเจ้าของของ "${foundPost.category}" ที่คุณเก็บได้แล้ว`,
        html: emailShell(
          "อาจเจอเจ้าของแล้ว",
          `<p style="font-size:14px;line-height:1.8;color:#79708F;margin:0 0 18px;">
             มีคนแจ้งของหายที่ตรงกับของที่คุณเก็บได้ ระบบกำลังรอให้เจ้าของยืนยัน
             หากยืนยันแล้วเราจะส่งข้อมูลติดต่อให้คุณทางอีเมลอีกครั้ง
           </p>
           ${itemBlock("ของที่คุณเก็บได้", snapOf(foundPost))}
           ${itemBlock("ของที่มีคนแจ้งหาย", snapOf(lostPost))}`,
          "ดูในระบบ", SITE_URL
        )
      });

      await ref.update({ notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    await docSnap.ref.update({
      processed: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  return created;
}

/* ===================================================================
   ส่วนที่ 2 — เปิดเผยข้อมูลติดต่อ
   -------------------------------------------------------------------
   เงื่อนไข: matchStatus ต้องเป็น 'accepted' ซึ่งจะเกิดขึ้นได้ก็ต่อเมื่อ
   เจ้าของของหายยืนยันว่าใช่ (waiting_for_user → accepted)
   หน้าเว็บอ่านข้อมูลจาก matchContacts ได้ทันที ส่วนงานนี้ส่งอีเมลยืนยันภายหลัง
   =================================================================== */
async function revealContacts() {
  const snap = await db.collection("matches")
    .where("matchStatus", "==", "accepted")
    .where("contactRevealed", "==", false)
    .limit(30)
    .get();

  if (snap.empty) { console.log("ไม่มีคู่ที่ต้องเปิดเผยข้อมูลติดต่อ"); return 0; }

  let done = 0;
  for (const d of snap.docs) {
    const m = d.data();
    const lostPost  = (await db.collection("posts").doc(m.lostPostId).get()).data();
    const foundPost = (await db.collection("posts").doc(m.foundPostId).get()).data();
    if (!lostPost || !foundPost) { await d.ref.update({ contactRevealed: true }); continue; }

    const lostContact  = { name: lostPost.authorName || "",  email: lostPost.authorEmail || "" };
    const foundContact = { name: foundPost.authorName || "", email: foundPost.authorEmail || "" };

    await d.ref.update({
      lostContact, foundContact,
      contactRevealed: true,
      revealedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const body = (theirLabel, them) => `
      <p style="font-size:14px;line-height:1.8;color:#79708F;margin:0 0 18px;">
        การจับคู่ได้รับการยืนยันแล้ว ตอนนี้คุณสามารถติดต่อกันเพื่อนัดรับ–ส่งของได้เลย
      </p>
      <div style="background:#DFF3EB;border-radius:14px;padding:16px;color:#1F8F6F;">
        <div style="font-size:12px;margin-bottom:6px;">${theirLabel}</div>
        <div style="font-weight:600;font-size:15px;">${esc(them.name || "ผู้ใช้")}</div>
        <div style="font-size:14px;margin-top:4px;">${esc(them.email)}</div>
      </div>
      <p style="font-size:13px;color:#79708F;margin-top:18px;line-height:1.7;">
        เพื่อความปลอดภัย แนะนำให้นัดรับของในที่สาธารณะภายในมหาวิทยาลัยในเวลากลางวัน
        และตรวจสอบลักษณะของให้ตรงกันก่อนส่งมอบ
      </p>`;

    if (await wantsEmail(m.lostAuthorId)) await sendEmail({
      to: lostContact.email, toName: lostContact.name,
      subject: "ยืนยันการจับคู่แล้ว — ข้อมูลติดต่อผู้ที่เก็บของได้",
      html: emailShell("ติดต่อผู้ที่เก็บของของคุณได้แล้ว", body("ผู้ที่เก็บของได้", foundContact), "เปิดเว็บ", SITE_URL)
    });
    if (await wantsEmail(m.foundAuthorId)) await sendEmail({
      to: foundContact.email, toName: foundContact.name,
      subject: "ยืนยันการจับคู่แล้ว — ข้อมูลติดต่อเจ้าของ",
      html: emailShell("เจอเจ้าของแล้ว", body("เจ้าของของชิ้นนี้", lostContact), "เปิดเว็บ", SITE_URL)
    });

    done++;
  }
  return done;
}

/* ===================================================================
   MAIN
   =================================================================== */
(async () => {
  try {
    const created = await runMatching();
    const revealed = await revealContacts();
    const cleaned = await cleanupOrphans();
    console.log(`เสร็จสิ้น — สร้างคู่ใหม่ ${created}, เปิดเผยข้อมูลติดต่อ ${revealed}, เก็บกวาด ${cleaned}`);
    process.exit(0);
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err);
    process.exit(1);
  }
})();

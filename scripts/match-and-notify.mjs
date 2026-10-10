/* ===================================================================
   match-and-notify.mjs
   -------------------------------------------------------------------
   ทำงานบน GitHub Actions (cron ทุก 15 นาที และสั่งรันเองได้) หน้าที่หลักสามอย่าง:

   1) จับคู่ประกาศ  — ความหมายของ processed:
        false = ยังไม่มีคู่ที่ใช้ได้ → วนมาเทียบใหม่ "ทุกรอบ" จนกว่าจะเจอคู่
        true  = มีคู่แล้ว (หรือเป็นประกาศที่ระบบจัดหมวดเองเพราะไม่มีตัวอักษร) → ไม่วน
      ถ้าคู่ถูกปฏิเสธ (rejected/declined) ประกาศจะกลับเป็น false แล้วหาคู่ใหม่
      คู่ที่เคยสร้างแล้วจะถูกข้าม จึงไม่ส่งอีเมลซ้ำ

   2) ส่งอีเมลแจ้งเตือน — เมื่อเจอคู่ ส่งอีเมลหาทั้งสองฝ่าย

   3) เปิดเผยข้อมูลติดต่อ — เมื่อเจ้าของของหายกดยืนยันว่า "ใช่" (matchStatus = accepted)
      ส่งอีเมลยืนยันให้ทั้งคู่ (เว็บอ่านข้อมูลติดต่อจาก matchContacts ได้ทันที)

   รอบดูแลรายชั่วโมง (หรือเมื่อกดรันเอง) ยังทำ: ปิดคู่ที่หมดเวลาตอบ, เก็บกวาดข้อมูลกำพร้า,
   และบังคับโควตาโพสต์ (enforce-quota.mjs)

   เหตุผลที่ต้องทำฝั่งเซิร์ฟเวอร์: กติกาความปลอดภัยของ Firestore
   ปิดไม่ให้ผู้ใช้อ่านประกาศของคนอื่นเลย การจับคู่จึงทำในเบราว์เซอร์ไม่ได้
   สคริปต์นี้ใช้ Admin SDK ซึ่งข้าม security rules ได้
   =================================================================== */

import admin from "firebase-admin";
import { appendRunRow, runToRow } from "./sheets-log.mjs";
import { createLifecycle } from "./lifecycle.mjs";
import { enforceQuota } from "./enforce-quota.mjs";
import { findCandidates, passesHardFilter, cosineSimilarity, MATCH_THRESHOLD } from "../matching.js";

/* ---------- ตั้งค่าจาก GitHub Secrets ---------- */
const {
  FIREBASE_SERVICE_ACCOUNT,
  BREVO_API_KEY,
  SENDER_EMAIL,
  GEMINI_API_KEY,
  EMBEDDING_MODEL = "gemini-embedding-001",
  GOOGLE_SHEET_ID,                 // (ไม่บังคับ) ถ้าตั้งไว้ จะต่อแถวสถิติทุกรอบลงชีตนี้
  GOOGLE_SHEET_TAB = "Runs",
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


/* สถิติของรอบนี้ — เขียนลง matchRuns ตอนจบรอบ ให้แอดมินดูในหน้า "คะแนนการจับคู่" */
const runStats = { maintenance: false, consentsExpired: 0, declineEmails: 0, pairsClosed: 0, finderEmails: 0, activePosts: 0, targets: 0, pairsScored: 0, newMatches: 0,
                   nearMissesWritten: 0, resetFlags: 0, markedProcessed: 0 };

async function runMatching() {
  // ประกาศที่ยังเปิดอยู่ทั้งหมด ใช้เป็นตัวเลือกในการจับคู่
  const activeSnap = await db.collection("posts")
    .where("status", "==", "active")
    .limit(1000)
    .get();
  const activePosts = activeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  runStats.activePosts = activePosts.length;

  let created = 0;

  // คู่ที่เคยสร้างแล้ว (ไม่ว่าสถานะอะไร) — ตัดออกก่อนเทียบ เพื่อไม่ให้ 3 อันดับถูกคู่เก่ากินที่
  // และเก็บ id ของประกาศที่ "ยังมีคู่ที่ใช้งานอยู่" (ไม่ถูกปฏิเสธ) ไว้ตัดสินค่า processed
  const existingPairs = new Set();
  const activeMatched = new Set();
  (await db.collection("matches").select("lostPostId", "foundPostId", "matchStatus").get())
    .forEach(d => {
      existingPairs.add(`${d.get("lostPostId")}_${d.get("foundPostId")}`);
      if (!["rejected", "declined"].includes(d.get("matchStatus"))) {
        activeMatched.add(d.get("lostPostId")); activeMatched.add(d.get("foundPostId"));
      }
    });
  const pairKey = (a, b) => a.type === "lost" ? `${a.id}_${b.id}` : `${b.id}_${a.id}`;

  // เก็บกวาดค่าเก่า: processed=true แต่ไม่มีคู่ที่ใช้งานอยู่ (เช่น ถูกประมวลผลครั้งเดียวแล้วไม่เจอคู่,
  // หรือคู่ถูกปฏิเสธ) ให้กลับเป็น false จะได้วนหาคู่ใหม่ — ยกเว้นประกาศที่ระบบจัดหมวดเอง (autoCategorized)
  for (const p of activePosts) {
    if (p.processed === true && !p.autoCategorized && !activeMatched.has(p.id)) {
      await db.collection("posts").doc(p.id).update({ processed: false });
      p.processed = false;
      runStats.resetFlags++;
      console.log(`รีเซ็ต processed → false: ${p.id}`);
    }
  }
  // คะแนนเกือบแมชที่บันทึกไว้แล้ว — เขียนใหม่เฉพาะเมื่อคะแนนเปลี่ยน (ประหยัดโควตา write)
  const nearMap = new Map();
  (await db.collection("nearMisses").select("similarityScore").get())
    .forEach(d => nearMap.set(d.id, d.get("similarityScore")));

  // ตั้งต้นจากประกาศที่ processed=false เท่านั้น (true = มีคู่แล้ว ไม่วน)
  const targets = activePosts.filter(p => p.processed === false);
  runStats.targets = targets.length;
  console.log(`รอบนี้จับคู่: ${targets.length} ใบที่ยังไม่มีคู่ (processed=false), ประกาศที่เปิดอยู่ ${activePosts.length} ใบ`);

  for (const newPost of targets) {

    // ไม่จับคู่กับประกาศของตัวเอง และไม่จับคู่กับประกาศที่ปิดไปแล้ว
    const candidates = activePosts.filter(p =>
      p.id !== newPost.id &&
      p.authorId !== newPost.authorId &&
      p.status === "active" &&
      !existingPairs.has(pairKey(newPost, p))
    );

    // เรียก embedding เฉพาะคู่ที่ผ่านด่านหมวดหมู่+สีแล้วเท่านั้น เพื่อประหยัดโควตา API
    const shortlist = candidates.filter(c => passesHardFilter(newPost, c));
    runStats.pairsScored += shortlist.length;
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

    const { matches: results, nearMisses } = findCandidates(newPost, candidates,
      c => (semanticMap.has(c.id) ? semanticMap.get(c.id) : null));
    console.log(`ประกาศ ${newPost.id}: พบคู่ที่เข้าเกณฑ์ ${results.length} รายการ, เกือบแมช ${nearMisses.length} รายการ`);

    // ---------- บันทึกคู่ที่ "เกือบแมช" ให้แอดมินดู (ผู้ใช้ไม่เห็น ไม่แจ้งเตือน) ----------
    // ใช้ id คงที่จากคู่ประกาศ จึงรันซ้ำแล้วไม่เกิดเอกสารซ้ำ
    for (const r of nearMisses) {
      const lostPost  = newPost.type === "lost" ? newPost : r.post;
      const foundPost = newPost.type === "lost" ? r.post : newPost;
      const nmId = `${lostPost.id}_${foundPost.id}`;
      const nmScore = Math.round(r.score * 100) / 100;
      if (nearMap.get(nmId) === nmScore) continue;   // คะแนนเท่าเดิม ไม่ต้องเขียนซ้ำ
      nearMap.set(nmId, nmScore);
      runStats.nearMissesWritten++;
      await db.collection("nearMisses").doc(nmId).set({
        lostPostId: lostPost.id,   foundPostId: foundPost.id,
        lostSnap: snapOf(lostPost), foundSnap: snapOf(foundPost),
        similarityScore: Math.round(r.score * 100) / 100,
        lexicalScore: Math.round((r.lexical ?? 0) * 100) / 100,
        semanticScore: r.semantic === null || r.semantic === undefined
          ? null : Math.round(r.semantic * 100) / 100,
        parts: Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, {
          value: Math.round(v.value * 100) / 100,
          weight: v.weight,
          points: Math.round(v.points * 1000) / 1000
        }])),
        threshold: MATCH_THRESHOLD,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

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
        parts: Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, {
          value: Math.round(v.value * 100) / 100,
          weight: v.weight,
          points: Math.round(v.points * 1000) / 1000
        }])),
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
      existingPairs.add(`${lostPost.id}_${foundPost.id}`);
      activeMatched.add(lostPost.id); activeMatched.add(foundPost.id);
      // คู่นี้ผ่านเกณฑ์แล้ว ไม่ควรค้างอยู่ในรายการ "เกือบแมช"
      await db.collection("nearMisses").doc(`${lostPost.id}_${foundPost.id}`).delete().catch(() => {});

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
             หากเจ้าของยืนยันว่าเป็นของเขา ระบบจะส่งข้อมูลติดต่อของเจ้าของให้คุณทางอีเมล
             และแสดงชื่อกับอีเมลของคุณให้เจ้าของเห็นด้วย
           </p>
           ${itemBlock("ของที่คุณเก็บได้", snapOf(foundPost))}
           ${itemBlock("ของที่มีคนแจ้งหาย", snapOf(lostPost))}`,
          "ดูในระบบ", SITE_URL
        )
      });

      await ref.update({ notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

  }

  // ตีตรา processed=true เฉพาะประกาศที่ "มีคู่แล้ว" — ที่ยังไม่เจอคู่คงเป็น false เพื่อวนรอบหน้า
  for (const p of activePosts) {
    if (p.processed === false && activeMatched.has(p.id)) {
      await db.collection("posts").doc(p.id).update({
        processed: true,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      runStats.markedProcessed++;
    }
  }

  runStats.newMatches = created;
  return created;
}




/* ===================================================================
   MAIN
   =================================================================== */
const { cleanupOrphans, notifyFinders, syncResolvedPairs, revealContacts, expireStaleConsents, notifyDeclines } =
  createLifecycle({ db, admin, sendEmail, wantsEmail, esc, emailShell, itemBlock, SITE_URL });

async function saveRunLog(extra) {
  try {
    await db.collection("matchRuns").add({
      ...runStats, ...extra,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error("บันทึกสถิติรอบไม่สำเร็จ (ไม่กระทบการจับคู่):", e.message);
  }
  if (GOOGLE_SHEET_ID) {
    try {
      await appendRunRow({ serviceAccount: JSON.parse(FIREBASE_SERVICE_ACCOUNT), sheetId: GOOGLE_SHEET_ID,
                           tab: GOOGLE_SHEET_TAB, row: runToRow(runStats, extra) });
      console.log("ต่อแถวลง Google Sheet แล้ว");
    } catch (e) {
      console.error("เขียน Google Sheet ไม่สำเร็จ (ไม่กระทบการจับคู่):", e.message);
    }
  }
}

(async () => {
  const startedAt = Date.now();
  try {
    const created = await runMatching();
    runStats.finderEmails = await notifyFinders();
    const revealed = await revealContacts();

    // งานเก็บกวาด/ตรวจย้อนหลังอ่านข้อมูลเยอะ จึงทำชั่วโมงละครั้ง (cron ทุก 15 นาที → รอบแรกของชั่วโมง)
    // หรือเมื่อกดรันเองจากหน้า Actions เพื่อประหยัดโควตา reads
    const maintenance = process.env.GITHUB_EVENT_NAME === "workflow_dispatch" || new Date().getUTCMinutes() < 15;
    runStats.maintenance = maintenance;
    let cleaned = 0;
    if (maintenance) {
      runStats.consentsExpired = await expireStaleConsents();
      runStats.declineEmails = await notifyDeclines();
      runStats.pairsClosed = await syncResolvedPairs();
      cleaned = await cleanupOrphans();
      runStats.quotaHidden = await enforceQuota({ db, admin }).catch(e => { console.error("ตรวจโควตาไม่สำเร็จ (ไม่กระทบการจับคู่):", e.message); return 0; });
    }
    console.log(`เสร็จสิ้น — สร้างคู่ใหม่ ${created}, เปิดเผยข้อมูลติดต่อ ${revealed}, เก็บกวาด ${cleaned}`);
    await saveRunLog({ ok: true, revealed, cleaned, durationMs: Date.now() - startedAt });
    process.exit(0);
  } catch (err) {
    console.error("เกิดข้อผิดพลาด:", err);
    await saveRunLog({ ok: false, error: String(err && err.message || err).slice(0, 300),
                       durationMs: Date.now() - startedAt });
    process.exit(1);
  }
})();

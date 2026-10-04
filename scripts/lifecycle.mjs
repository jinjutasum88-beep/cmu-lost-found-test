/* ===================================================================
   lifecycle.mjs — ขั้นตอนหลังจับคู่ (แยกออกจาก match-and-notify.mjs ให้ไฟล์เล็กลง
   เพราะไฟล์ใหญ่เกิน ~31 KB เคยถูกตัดท้ายตอนอัพขึ้น GitHub)
     - cleanupOrphans    เก็บกวาดคู่/ข้อมูลของโพสต์ที่ถูกลบ
     - notifyFinders     อีเมลแจ้งผู้พบเมื่อเจ้าของกดยืนยัน (awaiting_finder)
     - syncResolvedPairs ปิดประกาศผู้พบเมื่อของหายถูกทำเครื่องหมายว่าได้คืน
     - revealContacts    เปิดเผยข้อมูลติดต่อ + ส่งอีเมลเมื่อคู่เป็น accepted
     - expireStaleConsents  ผู้พบไม่ตอบเกิน 7 วัน → ถือว่าไม่อนุญาต
     - notifyDeclines    อีเมลแจ้งเจ้าของของหายเมื่อผู้พบไม่อนุญาต/หมดเวลา
   =================================================================== */

export function createLifecycle({ db, admin, sendEmail, wantsEmail, esc, emailShell, itemBlock, SITE_URL }) {
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

/* ===================================================================
   ส่วนที่ 2 — เปิดเผยข้อมูลติดต่อ
   -------------------------------------------------------------------
   เงื่อนไข: matchStatus ต้องเป็น 'accepted' ซึ่งจะเกิดขึ้นได้ก็ต่อเมื่อ
   เจ้าของของหายยืนยันว่าใช่ (waiting_for_user → accepted)
   หน้าเว็บอ่านข้อมูลจาก matchContacts ได้ทันที ส่วนงานนี้ส่งอีเมลยืนยันภายหลัง
   =================================================================== */
/* เจ้าของของหายกด "ใช่" แล้ว (awaiting_finder) → แจ้งผู้ที่เก็บของได้ให้เข้ามากด "อนุญาต"
   ฝั่งเว็บแก้ได้เฉพาะ matchStatus จึงให้สคริปต์เป็นคนจดเวลาที่แจ้งแล้ว (finderNotifiedAt) กันส่งซ้ำ */
async function notifyFinders() {
  const snap = await db.collection("matches")
    .where("matchStatus", "==", "awaiting_finder")
    .limit(50)
    .get();

  let sent = 0;
  for (const d of snap.docs) {
    const m = d.data();
    if (m.finderNotifiedAt) continue;
    try {
      const foundPost = (await db.collection("posts").doc(m.foundPostId).get()).data();
      let ok = true;   // sendEmail คืน false เมื่อส่งไม่สำเร็จ (ไม่ throw) — ต้องเช็กเอง
      if (foundPost && await wantsEmail(m.foundAuthorId)) {
        ok = await sendEmail({
          to: foundPost.authorEmail,
          toName: foundPost.authorName,
          subject: `เจ้าของยืนยันแล้ว — รอคุณอนุญาตแลกข้อมูลติดต่อ (${foundPost.category || "ของที่เก็บได้"})`,
          html: emailShell(
            "เจ้าของของยืนยันแล้ว รอคุณอนุญาต",
            `<p style="font-size:14px;line-height:1.8;color:#79708F;margin:0 0 18px;">
               มีผู้แจ้งว่าของที่คุณเก็บได้เป็นของเขา ระบบ<b>ยังไม่เปิดเผย</b>ข้อมูลติดต่อของคุณ
               จนกว่าคุณจะอนุญาต
             </p>
             ${itemBlock("ของที่คุณเก็บได้", m.foundSnap)}
             ${itemBlock("ของที่เจ้าของแจ้งหาย", m.lostSnap)}
             <p style="font-size:13px;color:#79708F;margin-top:18px;line-height:1.7;">
               เข้าเว็บไปที่ "รายการที่จับคู่" แล้วกด <b>อนุญาต แลกข้อมูลติดต่อ</b>
               หากอนุญาต เราจะส่งข้อมูลติดต่อของทั้งสองฝ่ายทางอีเมลภายในไม่กี่นาที
               หากไม่อนุญาต ข้อมูลของคุณจะไม่ถูกเปิดเผย
             </p>`,
            "ไปที่รายการจับคู่", SITE_URL
          )
        });
        if (ok) sent++;
      }
      if (!ok) { console.error(`แจ้งผู้พบของไม่สำเร็จ (match ${d.id}) — จะลองใหม่รอบหน้า`); continue; }
      await d.ref.update({ finderNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      // ส่งไม่สำเร็จ: ไม่จดเวลา เพื่อให้รอบหน้าลองใหม่
      console.error(`แจ้งผู้พบของไม่สำเร็จ (match ${d.id}):`, e.message);
    }
  }
  return sent;
}

/* ปิดประกาศของผู้พบให้ เมื่อเจ้าของของหายกด "ได้รับคืนแล้ว" ในคู่ที่ accepted
   (ปกติหน้าเว็บปิดให้ทันที — ส่วนนี้เป็นตาข่ายนิรภัยเผื่อหน้าเว็บทำไม่สำเร็จ)
   จดเวลาปิดที่ pairClosedAt เพื่อไม่ต้องตรวจโพสต์ซ้ำทุกรอบ */
async function syncResolvedPairs() {
  const snap = await db.collection("matches").where("matchStatus", "==", "accepted").limit(200).get();
  let closed = 0;
  for (const d of snap.docs) {
    const m = d.data();
    if (m.pairClosedAt) continue;
    const lostRef = db.collection("posts").doc(m.lostPostId);
    const foundRef = db.collection("posts").doc(m.foundPostId);
    const [l, f] = await Promise.all([lostRef.get(), foundRef.get()]);
    if (!l.exists || !f.exists) { await d.ref.update({ pairClosedAt: admin.firestore.FieldValue.serverTimestamp() }); continue; }
    if (l.data().status !== "resolved") continue;               // ของหายยังไม่ได้คืน — รอต่อ
    if (f.data().status === "active") {
      await foundRef.update({ status: "resolved", resolvedViaMatch: d.id });
      closed++;
    }
    await d.ref.update({ pairClosedAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  return closed;
}

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
    // pickupNote = ที่ที่ผู้พบฝากของ/นัดรับ ฝั่งของหายต้องเห็นหลังยืนยัน จึงต้องใส่ด้วย
    const foundContact = { name: foundPost.authorName || "", email: foundPost.authorEmail || "",
                           pickupNote: foundPost.pickupNote || "" };

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

  /* ผู้พบไม่ตอบเกิน N วันหลังได้รับแจ้ง → ถือว่าไม่อนุญาต (declined + expired) จะได้ไม่ค้างตลอดไป
     ประกาศทั้งสองฝั่งจะกลับไปหาคู่ใหม่ได้เอง (ดูตรรกะ processed ใน runMatching) */
  async function expireStaleConsents(days = 7) {
    const snap = await db.collection("matches").where("matchStatus", "==", "awaiting_finder").limit(100).get();
    const cutoff = Date.now() - days * 86400000;
    let n = 0;
    for (const d of snap.docs) {
      const ts = d.data().finderNotifiedAt;
      const ms = ts && ts.toMillis ? ts.toMillis() : (ts instanceof Date ? ts.getTime() : Number(ts));
      if (!ms || ms > cutoff) continue;                 // ยังไม่เคยแจ้งผู้พบ หรือยังไม่ถึงกำหนด
      await d.ref.update({ matchStatus: "declined", expired: true });
      n++;
    }
    return n;
  }

  /* ผู้พบไม่อนุญาต (หรือหมดเวลา) → แจ้งเจ้าของของหายทางอีเมล จดเวลาที่ ownerNotifiedAt กันส่งซ้ำ */
  async function notifyDeclines() {
    const snap = await db.collection("matches").where("matchStatus", "==", "declined").limit(200).get();
    let sent = 0;
    for (const d of snap.docs) {
      const m = d.data();
      if (m.ownerNotifiedAt) continue;
      try {
        const lostPost = (await db.collection("posts").doc(m.lostPostId).get()).data();
        let ok = true;
        if (lostPost && await wantsEmail(m.lostAuthorId)) {
          const why = m.expired
            ? "ผู้ที่เก็บของได้ยังไม่ตอบรับภายในเวลาที่กำหนด"
            : "ผู้ที่เก็บของได้ยังไม่อนุญาตให้แลกข้อมูลติดต่อ";
          ok = await sendEmail({
            to: lostPost.authorEmail,
            toName: lostPost.authorName,
            subject: "คู่ที่คุณยืนยันไว้ยังไม่สำเร็จ — ระบบจะหาคู่ใหม่ให้",
            html: emailShell(
              "คู่นี้ยังไม่สำเร็จ",
              `<p style="font-size:14px;line-height:1.8;color:#79708F;margin:0 0 18px;">
                 ${why} ประกาศของคุณยังเปิดอยู่ และระบบจะจับคู่กับของที่ถูกแจ้งเจอชิ้นอื่นให้ต่อไปโดยอัตโนมัติ
               </p>
               ${itemBlock("ของที่คุณแจ้งหาย", m.lostSnap)}`,
              "ดูรายการของฉัน", SITE_URL
            )
          });
          if (ok) sent++;
        }
        if (!ok) { console.error(`แจ้งเจ้าของของหายไม่สำเร็จ (match ${d.id}) — จะลองใหม่รอบหน้า`); continue; }
        await d.ref.update({ ownerNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
      } catch (e) {
        console.error(`แจ้งเจ้าของของหายไม่สำเร็จ (match ${d.id}):`, e.message);
      }
    }
    return sent;
  }

  return { cleanupOrphans, notifyFinders, syncResolvedPairs, revealContacts, expireStaleConsents, notifyDeclines };
}

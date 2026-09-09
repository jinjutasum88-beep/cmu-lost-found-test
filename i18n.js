/* ===================================================================
   i18n.js — ระบบสองภาษา ไทย / English (ฉบับอัปเดตสมบูรณ์)
   -------------------------------------------------------------------
   วิธีใช้ใน HTML:
     <h2 data-i18n="mine.title"></h2>          → ใส่ข้อความ
     <input data-i18n-ph="mine.searchPh">      → ใส่ placeholder
     <button data-i18n-aria="nav.refresh">     → ใส่ aria-label

   วิธีใช้ใน JS:
     t('mine.title')                            → คืนข้อความตามภาษาปัจจุบัน
     t('match.similarity', { pct: 79 })         → แทนค่าใน {pct}

   หมายเหตุสำคัญ: ค่าที่บันทึกลงฐานข้อมูล (หมวดหมู่ สี สถานที่ คณะ)
   ใช้ภาษาไทยเป็นค่าหลักเสมอ ไม่ว่าผู้ใช้จะเลือกภาษาอะไร
   เพราะระบบจับคู่ NLP ต้องเทียบกับค่าเดียวกัน
   =================================================================== */

const DICT = {
  th: {
    /* ---------- ทั่วไป ---------- */
    "app.name": "CMU LOST&FOUND",
    "app.tagline": "กระดานประกาศของหาย/ของพบ · จับคู่อัตโนมัติ",
    "app.footer": "CMU LOST&FOUND · โครงงานระบบของหาย–ของพบ มหาวิทยาลัยเชียงใหม่",
    "common.save": "บันทึก",
    "common.cancel": "ยกเลิก",
    "common.close": "ปิด",
    "common.back": "ย้อนกลับ",
    "common.delete": "ลบ",
    "common.loading": "กำลังโหลด...",
    "common.saving": "กำลังบันทึก...",
    "common.all": "ทั้งหมด",
    "common.yes": "ใช่",
    "common.no": "ไม่ใช่",
    "common.skipToMain": "ข้ามไปยังเนื้อหาหลัก",
    "common.langSwitch": "เปลี่ยนภาษา",
    "common.lost": "ของหาย",
    "limit.title": "ลงประกาศครบจำนวนของวันนี้แล้ว",
    "limit.body": "ลงประกาศได้วันละไม่เกิน {n} รายการ เพื่อป้องกันการใช้งานผิดวัตถุประสงค์ ลองใหม่พรุ่งนี้ หรือแก้ไขประกาศเดิมแทน",
    "limit.active": "คุณมีประกาศที่เปิดอยู่ {n} รายการแล้ว ปิดประกาศที่ได้ของคืนแล้วก่อน จึงจะลงประกาศใหม่ได้",
    "report.button": "รายงานประกาศนี้",
    "report.title": "รายงานเนื้อหาไม่เหมาะสม",
    "report.reason": "บอกเหตุผลสั้นๆ",
    "report.reasonPh": "เช่น รูปไม่เหมาะสม, ข้อความคุกคาม, ประกาศหลอกลวง",
    "report.send": "ส่งรายงาน",
    "report.sent": "ส่งรายงานแล้ว ผู้ดูแลระบบจะตรวจสอบโดยเร็ว",
    "report.needReason": "กรุณาระบุเหตุผล",
    "consent.ownerDone": "คุณยืนยันแล้วว่าเป็นของคุณ · กำลังรอผู้ที่เก็บของได้อนุญาตให้เปิดเผยข้อมูลติดต่อ",
    "consent.askFinder": "มีผู้แจ้งว่าของชิ้นนี้เป็นของเขา คุณอนุญาตให้เปิดเผยอีเมลของคุณเพื่อนัดส่งคืนหรือไม่",
    "consent.allow": "อนุญาต แลกข้อมูลติดต่อ",
    "consent.decline": "ไม่อนุญาต",
    "consent.declined": "คุณไม่อนุญาตให้เปิดเผยข้อมูลติดต่อ",
    "consent.declinedOwner": "ผู้ที่เก็บของได้ไม่อนุญาตให้เปิดเผยข้อมูลติดต่อ",
    "admin.reports": "รายงานที่รอตรวจสอบ",
    "admin.noReports": "ไม่มีรายงานค้างอยู่",
    "admin.hidePost": "ซ่อนประกาศนี้",
    "admin.deletePost": "ลบประกาศนี้ถาวร",
    "admin.hidden": "ถูกซ่อนโดยผู้ดูแลระบบ",
    "admin.markHandled": "ทำเครื่องหมายว่าตรวจสอบแล้ว",
    "admin.confirmHide": "ซ่อนประกาศนี้จากระบบ?",
    "admin.confirmDelete": "ลบประกาศนี้ถาวร? ย้อนกลับไม่ได้",
    "common.found": "พบของ",
    "common.resolved": "ได้รับคืนแล้ว",
    "common.active": "ยังเปิดอยู่",
    "common.noImage": "ไม่มีรูปภาพ",
    "common.required": "จำเป็นต้องกรอก",

    /* ---------- เข้าสู่ระบบ / สมัคร ---------- */
    "auth.headline": "แจ้งเตือนทันทีทางอีเมล เมื่อพบของที่ตรงกับของหายของคุณ",
    "auth.login": "เข้าสู่ระบบ",
    "auth.signup": "สมัครสมาชิก",
    "auth.email": "อีเมล @cmu.ac.th",
    "auth.emailPh": "student@cmu.ac.th",
    "auth.password": "รหัสผ่าน",
    "auth.passwordConfirm": "ยืนยันรหัสผ่าน",
    "auth.displayName": "ชื่อที่แสดง",
    "auth.displayNamePh": "เช่น สมชาย ส.",
    "auth.forgot": "ลืมรหัสผ่าน?",
    "auth.note": "ระบบใช้ Firebase Authentication · ไม่แสดงอีเมลบนประกาศสาธารณะ",
    "auth.note2": "เข้าสู่ระบบครั้งเดียว ใช้งานได้ทุกอุปกรณ์",
    "auth.showPassword": "แสดงรหัสผ่าน",
    "auth.hidePassword": "ซ่อนรหัสผ่าน",
    "auth.pwHint": "อย่างน้อย 8 ตัว ผสมตัวพิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ",
    "auth.pwMismatch": "รหัสผ่านไม่ตรงกัน",
    "auth.pwMatch": "รหัสผ่านตรงกัน",
    "auth.errCmuOnly": "ต้องใช้อีเมล @cmu.ac.th เท่านั้น",
    "auth.errMismatch": "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน",
    "auth.resetSent": "ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ {email} แล้ว",
    "auth.needEmailFirst": "กรอกอีเมลในช่องด้านบนก่อน แล้วกดลืมรหัสผ่านอีกครั้ง",

    /* ---------- ยืนยันอีเมล ---------- */
    "verify.title": "ยืนยันอีเมลของคุณ",
    "verify.sentTo": "เราได้ส่งลิงก์ยืนยันไปที่ {email} แล้ว กรุณาเปิดอีเมลแล้วกดลิงก์ยืนยันก่อนใช้งานระบบ",
    "verify.recheck": "ฉันยืนยันแล้ว ตรวจสอบอีกครั้ง",
    "verify.resend": "ส่งอีเมลยืนยันอีกครั้ง",
    "verify.logout": "ออกจากระบบ / ใช้บัญชีอื่น",
    "verify.notYet": "ยังไม่พบการยืนยัน — กดลิงก์ในอีเมลก่อน แล้วกลับมากดปุ่มนี้อีกครั้ง",
    "verify.success": "ยืนยันสำเร็จ กำลังเข้าสู่ระบบ...",
    "verify.resent": "ส่งอีเมลยืนยันใหม่แล้ว",
    "verify.cooldown": "ส่งอีกครั้งได้ใน {secs} วินาที",
    "verify.spamTitle": "ไม่เห็นอีเมล?",
    "verify.spamTip1": "อีเมลอาจใช้เวลา 1–5 นาที ลองรอสักครู่แล้วกดปุ่มตรวจสอบ",
    "verify.spamTip2": "ตรวจในกล่องจดหมายขยะ (Spam / Junk) และแท็บ Promotions",
    "verify.spamTip3": "ผู้ส่งคือ noreply@cmu-lost-found-final.firebaseapp.com — กด \"ไม่ใช่จดหมายขยะ\" เพื่อให้ครั้งหน้าเข้ากล่องหลัก",
    "verify.usedTip": "หากลิงก์ขึ้นว่าหมดอายุหรือถูกใช้แล้ว ให้กลับมาหน้านี้ ระบบจะตรวจสถานะให้อัตโนมัติ เพราะบัญชีอาจยืนยันสำเร็จแล้ว",

    /* ---------- เมนู ---------- */
    "nav.home": "หน้าหลัก",
    "nav.mine": "ประกาศของฉัน",
    "nav.create": "ลงประกาศ",
    "nav.notif": "การแจ้งเตือน",
    "nav.matches": "รายการที่จับคู่",
    "nav.admin": "แดชบอร์ดแอดมิน",
    "nav.logout": "ออกจากระบบ",
    "nav.refresh": "ดึงข้อมูลล่าสุด",
    "nav.menu": "เมนูหลัก",

    /* ---------- หน้าหลัก ---------- */
    "home.welcome": "ยินดีต้อนรับกลับมา",
    "home.title": "ทุกของหาย มีโอกาสได้คืน",
    "home.lead": "ลงประกาศของหายหรือของที่พบ ระบบจะช่วยค้นหารายการที่ใกล้เคียง และแจ้งเตือนเมื่อพบสิ่งที่อาจตรงกัน",
    "home.lostCta": "ฉันทำของหาย",
    "home.foundCta": "ฉันเก็บของได้",
    "home.myPosts": "ประกาศของฉัน",
    "home.matches": "รายการที่จับคู่",
    "home.newNotifs": "การแจ้งเตือนใหม่",
    "home.recent": "ประกาศล่าสุดของฉัน",
    "home.recentMatch": "รายการที่เพิ่งจับคู่",
    "home.noPosts": "ยังไม่มีประกาศ กดปุ่มด้านบนเพื่อเริ่มต้น",
    "home.noMatches": "ยังไม่มีรายการที่จับคู่",
    "home.checkMatch": "เข้าไปตรวจสอบ",
    "home.nearby": "{pct}% ใกล้เคียง",
    "home.step1Title": "ลงประกาศ",
    "home.step1Body": "บอกรายละเอียดของที่หายหรือพบ",
    "home.step2Title": "ระบบช่วยจับคู่",
    "home.step2Body": "เปรียบเทียบประกาศที่ใกล้เคียง",
    "home.step3Title": "ติดต่อรับคืน",
    "home.step3Body": "ตรวจสอบและนัดหมายอย่างปลอดภัย",

    /* ---------- ประกาศของฉัน ---------- */
    "mine.title": "ประกาศของฉัน",
    "mine.sub": "เฉพาะคุณเท่านั้นที่มองเห็น และระบบจะจับคู่กับประกาศของคนอื่นให้อัตโนมัติ",
    "mine.filterType": "กรองตามประเภท",
    "mine.filterCat": "กรองตามหมวดหมู่",
    "mine.filterStatus": "กรองตามสถานะ",
    "mine.search": "ค้นหาด้วยคำสำคัญ",
    "mine.searchPh": "ค้นหา เช่น กระเป๋าดำ สติกเกอร์แมว",
    "mine.allTypes": "ทุกประเภท",
    "mine.allCats": "ทุกหมวดหมู่",
    "mine.allStatus": "ทุกสถานะ",
    "mine.count": "แสดง {n} จาก {total} ประกาศ",
    "mine.emptyTitle": "ยังไม่มีประกาศของคุณ",
    "mine.emptySub": "กดแท็บ ลงประกาศ เพื่อเริ่มต้น",
    "mine.noResultTitle": "ไม่พบประกาศที่ตรงกับตัวกรอง",
    "mine.noResultSub": "ลองเปลี่ยนคำค้นหรือล้างตัวกรอง",
    "mine.pinnedTitle": "ปักหมุดไว้",
    "mine.pin": "ปักหมุด",
    "mine.unpin": "เลิกปักหมุด",
    "mine.pinLimit": "ปักหมุดได้สูงสุด 3 รายการ กรุณาเลิกปักหมุดรายการเก่าก่อนนะคะ",

    /* ---------- ลงประกาศ ---------- */
    "create.title": "ลงประกาศใหม่",
    "create.typeLost": "🔴 ของหาย",
    "create.typeFound": "🟢 พบของ",
    "create.category": "หมวดหมู่",
    "create.categoryPick": "เลือกหมวดหมู่",
    "create.categoryOther": "ระบุหมวดหมู่เอง",
    "create.color": "สีหลัก",
    "create.colorPick": "เลือกสี",
    "create.colorOther": "ระบุสีเอง",
    "create.desc": "รายละเอียดเชิงลึก (ตำหนิ, ยี่ห้อ, สติกเกอร์ ฯลฯ — ใช้ในการจับคู่)",
    "create.descPh": "เช่น กระเป๋าสะพายสีดำยี่ห้อ Anello มีพวงกุญแจรูปหมาติดอยู่ที่ซิป",
    "create.location": "สถานที่หาย/พบ",
    "create.locationPick": "เลือกสถานที่",
    "create.locationOther": "ระบุสถานที่เอง",
    "create.date": "วันที่หาย/พบ",
    "create.image": "รูปภาพ (ไม่บังคับ)",
    "create.submit": "ลงประกาศ",
    "create.explain": "หลังลงประกาศ ระบบจะกรองประกาศฝั่งตรงข้ามที่หมวดหมู่และสีตรงกัน แล้ววิเคราะห์ความคล้ายของคำอธิบายด้วย NLP จะแจ้งเตือนเฉพาะคู่ที่คล้ายกันตั้งแต่ 70% ขึ้นไป สูงสุด 3 อันดับ",
    "create.ok": "ลงประกาศเรียบร้อย · ระบบกำลังตรวจหาของที่ตรงกันอยู่เบื้องหลัง ถ้าเจอจะส่งอีเมลแจ้งคุณทันที",
    "create.okAuto": "ลงประกาศแล้ว · คำอธิบายไม่มีตัวหนังสือให้วิเคราะห์ ระบบจึงจัดเข้าหมวด \"อื่น ๆ\" และข้ามการจับคู่อัตโนมัติ",
    "create.fail": "บันทึกไม่สำเร็จ: {msg}",
    "create.imgBad": "ไฟล์ {ext} ใช้ไม่ได้ · รองรับเฉพาะรูปภาพ JPG, PNG, WEBP, GIF",
    "create.imgBig": "ไฟล์ใหญ่เกินไป ({mb} MB) · รองรับไม่เกิน 10 MB",
    "create.imgShrink": "กำลังย่อรูป...",
    "create.imgReady": "พร้อมอัปโหลด (ย่อเหลือ {kb} KB)",
    "create.imgFail": "อ่านไฟล์รูปไม่สำเร็จ ลองเลือกไฟล์อื่น",
    "create.otherRequired": "กรุณาพิมพ์รายละเอียดในช่อง \"อื่น ๆ\"",
    "create.pickupNote": "จุดรับของ / วิธีติดต่อขอรับคืน",
    "create.pickupNotePh": "เช่น ฝากไว้ที่ป้อมยาม ตึกวิศวะ ชั้น 1, ติดต่อรับได้ที่ห้องกิจการนักศึกษา",
    "create.pickupNoteHint": "จะเปิดเผยให้เจ้าของเห็นก็ต่อเมื่อยืนยันการจับคู่แล้วเท่านั้น ช่วยให้เจ้าของรู้ทันทีว่าต้องไปรับของที่ไหน ไม่ต้องทักไปถามอีกที",
    "create.pickupNoteUnsure": "ยังไม่แน่ใจตอนนี้ จะติดต่อไปแจ้งเอง",
    "create.pickupNoteUnsureText": "ผู้เก็บของยังไม่ได้ระบุจุดรับ จะติดต่อไปแจ้งอีกครั้งหลังยืนยันการจับคู่",
    "create.pickupNoteRequired": "กรุณาระบุจุดรับของ หรือติ๊กว่ายังไม่แน่ใจ",

    /* ---------- รายละเอียดประกาศ ---------- */
    "detail.title": "รายละเอียดประกาศ",
    "detail.location": "สถานที่",
    "detail.date": "วันที่หาย/พบ",
    "detail.posted": "ลงประกาศเมื่อ",
    "detail.markResolved": "ได้รับของคืนแล้ว",
    "detail.deleteConfirm": "ยืนยันลบประกาศนี้หรือไม่?",
    "detail.resolveConfirm": "ยืนยันว่าได้รับ/ส่งมอบของเรียบร้อยแล้วใช่หรือไม่?",
    "detail.matchFound": "พบรายการที่อาจตรงกัน {n} รายการ",
    "detail.checkNow": "ตรวจสอบเลย",
    "detail.notFound": "ไม่พบประกาศนี้",
    "detail.maybeDeleted": "อาจถูกลบไปแล้ว",

    /* ---------- แจ้งเตือน ---------- */
    "notif.title": "การแจ้งเตือน",
    "notif.emptyTitle": "ยังไม่มีการแจ้งเตือน",
    "notif.emptySub": "เมื่อมีของที่ตรงกับประกาศของคุณ ระบบจะแจ้งที่นี่ และส่งอีเมลแจ้งเตือนไปให้ด้วย",
    "notif.foundMatch": "พบของที่อาจตรงกับของหายของคุณ! ความคล้าย {pct}% (อันดับ {rank})",
    "notif.accepted": "คุณยืนยันแล้วว่าเป็นของคุณ — ดูข้อมูลติดต่อได้ที่แท็บ \"รายการที่จับคู่\"",
    "notif.acceptedOther": "เจ้าของของหายยืนยันว่าเป็นของของเขา — ดูข้อมูลติดต่อได้ที่แท็บ \"รายการที่จับคู่\"",
    "notif.rejected": "รายการจับคู่ (อันดับ {rank}) ถูกทำเครื่องหมายว่าไม่ใช่",
    "notif.waiting": "กำลังรอการยืนยันจากเจ้าของประกาศของหาย",
    "notif.goSee": "ไปดู",

    /* ---------- จับคู่ ---------- */
    "match.title": "รายการที่จับคู่",
    "match.checkTitle": "ตรวจสอบรายการที่จับคู่",
    "match.checkSub": "เปรียบเทียบของที่แจ้งหายกับของที่ระบบพบ",
    "match.emptyTitle": "ยังไม่มีรายการจับคู่",
    "match.emptySub": "เมื่อลงประกาศของหาย ระบบจะแสดงรายการจับคู่ที่นี่",
    "match.progress": "รายการที่ {i} จาก {n} · อันดับความเหมือน #{rank}",
    "match.yourItem": "ของที่คุณแจ้งหาย",
    "match.systemFound": "รายการที่ระบบพบ",
    "match.scoreLabel": "คะแนนความคล้ายจากการวิเคราะห์ด้วย NLP",
    "match.isMine": "ใช่ นี่คือของฉัน!",
    "match.notMine": "ไม่ใช่ของฉัน",
    "match.seeMatch": "ดู Match ({n})",
    "match.howTo": "วิธีตรวจสอบ: ระบบจับคู่จากการวิเคราะห์ข้อความด้วย NLP (หมวดหมู่ สี รายละเอียด สถานที่ และวันที่) เท่านั้น ไม่ได้เปรียบเทียบรูปภาพ กรุณาดูรูปและสถานที่ประกอบด้วยตัวเองก่อนกดยืนยัน",
    "match.allDone": "ตรวจสอบครบทุกรายการแล้ว",
    "match.allDoneSub": "หากยังไม่พบของ ระบบจะแจ้งเตือนอีกครั้งเมื่อมีรายการใหม่เข้ามา",
    "match.backToList": "กลับรายการจับคู่",
    "match.confirmed": "ยืนยันแล้วว่าตรงกัน — ติดต่อ {name} ที่อีเมล {email}",
    "match.detailTitle": "ยืนยันการจับคู่สำเร็จ",
    "match.detailSub": "ระบบเชื่อมโยงข้อมูลประกาศของคุณเรียบร้อยแล้ว",
    "match.pickupBox": "สถานที่นัดรับ / โน้ตจากผู้พบ",
    "match.contactFinder": "ข้อมูลติดต่ออีกฝ่าย",
    "match.sendEmail": "ส่งอีเมล",
    "match.viewDetail": "ดูรายละเอียด",
    "match.pickupNoteLabel": "📍 จุดรับของ",
    "match.revealPending": "ยืนยันแล้ว · ระบบกำลังเตรียมข้อมูลติดต่อ จะส่งอีเมลให้ทั้งสองฝ่ายภายในไม่กี่นาที",
    "match.closed": "ปิดเคสแล้ว (ได้รับของคืนแล้ว)",
    "match.markReturned": "ทำเครื่องหมายว่าได้รับของคืนแล้ว",

    /* ---------- โปรไฟล์ / ตั้งค่า ---------- */
    "profile.displayNameHint": "ชื่อนี้จะแสดงให้อีกฝ่ายเห็นเมื่อจับคู่สำเร็จแล้วเท่านั้น",
    "profile.emailFixed": "ไม่สามารถแก้ไขอีเมลได้",
    "profile.saved": "บันทึกข้อมูลสำเร็จ",
    "profile.saveFail": "บันทึกไม่สำเร็จ: {msg}",
    "profile.resetSent": "ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว",
    "profile.deleteConfirm": "ยืนยันการลบบัญชีผู้ใช้นี้หรือไม่?",
    "profile.deleteRelogin": "กรุณาเข้าสู่ระบบใหม่อีกครั้งก่อนทำรายการนี้",

    /* ---------- แอดมิน ---------- */
    "admin.title": "แดชบอร์ดผู้ดูแลระบบ",
    "admin.sub": "ภาพรวมระบบและการจัดการประกาศทั้งหมด",
    "admin.smartTitle": "ความคืบหน้าเทียบกับ SMART Goal",
    "admin.users": "ผู้ใช้ที่ลงทะเบียน",
    "admin.posts": "ประกาศทั้งหมดในระบบ",
    "admin.accuracy": "ความแม่นยำของการจับคู่",
    "admin.accuracyFrom": "จาก {n} คู่ที่ผู้ใช้ตัดสินแล้ว",
    "admin.accuracyNone": "ยังไม่มีคู่ที่ผู้ใช้ตัดสิน",
    "admin.export": "ดาวน์โหลดตัวเลขสรุป (CSV)",
    "admin.recent": "ประกาศล่าสุด",
    "admin.allPosts": "ประกาศทั้งหมด",
    "admin.returned": "ส่งคืนสำเร็จ",
    "admin.matched": "จับคู่สำเร็จ",
    "admin.itemCount": "{n} รายการ · คลิกการ์ดเพื่อดูรายละเอียด",
    "admin.poster": "ผู้ประกาศ",
    "admin.inProgress": "กำลังดำเนินการ",
    "admin.noData": "ไม่มีข้อมูล",
    "admin.loadError": "โหลด Dashboard ไม่สำเร็จ กรุณาตรวจสิทธิ์แอดมิน แล้วออกจากระบบและเข้าสู่ระบบใหม่"
  },

  en: {
    "app.name": "CMU LOST&FOUND",
    "app.tagline": "Lost & found board · Automatic matching",
    "app.footer": "CMU LOST&FOUND · Lost and Found System Project, Chiang Mai University",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.back": "Back",
    "common.delete": "Delete",
    "common.loading": "Loading...",
    "common.saving": "Saving...",
    "common.all": "All",
    "common.yes": "Yes",
    "common.no": "No",
    "common.skipToMain": "Skip to main content",
    "common.langSwitch": "Change language",
    "common.lost": "Lost",
    "limit.title": "You've reached today's posting limit",
    "limit.body": "You can create up to {n} posts per day to prevent misuse. Try again tomorrow, or edit an existing post instead.",
    "limit.active": "You already have {n} open posts. Close the ones you've recovered before creating a new one.",
    "report.button": "Report this post",
    "report.title": "Report inappropriate content",
    "report.reason": "Briefly, what's wrong?",
    "report.reasonPh": "e.g. inappropriate photo, harassment, scam post",
    "report.send": "Send report",
    "report.sent": "Report sent. An administrator will review it shortly.",
    "report.needReason": "Please give a reason",
    "consent.ownerDone": "You confirmed this is yours · waiting for the finder to allow sharing contact details",
    "consent.askFinder": "Someone says this item is theirs. Do you allow us to share your email so you can arrange the handover?",
    "consent.allow": "Allow, exchange contacts",
    "consent.decline": "Don't allow",
    "consent.declined": "You declined to share contact details",
    "consent.declinedOwner": "The finder declined to share contact details",
    "admin.reports": "Reports awaiting review",
    "admin.noReports": "No open reports",
    "admin.hidePost": "Hide this post",
    "admin.deletePost": "Delete permanently",
    "admin.hidden": "Hidden by an administrator",
    "admin.markHandled": "Mark as reviewed",
    "admin.confirmHide": "Hide this post from the system?",
    "admin.confirmDelete": "Delete this post permanently? This cannot be undone.",
    "common.found": "Found",
    "common.resolved": "Returned",
    "common.active": "Open",
    "common.noImage": "No image",
    "common.required": "Required",

    "auth.headline": "Get an email the moment we find something matching your lost item.",
    "auth.login": "Sign in",
    "auth.signup": "Sign up",
    "auth.email": "Email @cmu.ac.th",
    "auth.emailPh": "student@cmu.ac.th",
    "auth.password": "Password",
    "auth.passwordConfirm": "Confirm password",
    "auth.displayName": "Display name",
    "auth.displayNamePh": "e.g. Somchai S.",
    "auth.forgot": "Forgot password?",
    "auth.note": "Secured by Firebase Authentication · Your email is never shown publicly",
    "auth.note2": "Sign in once, use it on any device",
    "auth.showPassword": "Show password",
    "auth.hidePassword": "Hide password",
    "auth.pwHint": "At least 8 characters with lowercase, uppercase, a number and a symbol",
    "auth.pwMismatch": "Passwords do not match",
    "auth.pwMatch": "Passwords match",
    "auth.errCmuOnly": "Only @cmu.ac.th email addresses are allowed",
    "auth.errMismatch": "Password and confirmation do not match",
    "auth.resetSent": "A password reset link has been sent to {email}",
    "auth.needEmailFirst": "Enter your email above first, then click Forgot password again",

    "verify.title": "Verify your email",
    "verify.sentTo": "We sent a verification link to {email}. Please open it and click the link before using the system.",
    "verify.recheck": "I've verified — check again",
    "verify.resend": "Resend verification email",
    "verify.logout": "Sign out / use another account",
    "verify.notYet": "Not verified yet — click the link in your email first, then press this button again",
    "verify.success": "Verified. Signing you in...",
    "verify.resent": "Verification email sent again",
    "verify.cooldown": "You can resend in {secs} seconds",
    "verify.spamTitle": "Can't find the email?",
    "verify.spamTip1": "It can take 1–5 minutes. Wait a moment, then press the check button.",
    "verify.spamTip2": "Check your Spam / Junk folder and the Promotions tab.",
    "verify.spamTip3": "The sender is noreply@cmu-lost-found-final.firebaseapp.com — mark it \"Not spam\" so future emails reach your inbox.",
    "verify.usedTip": "If the link says it expired or was already used, return to this page. We will check automatically because your account may already be verified.",

    "nav.home": "Home",
    "nav.mine": "My posts",
    "nav.create": "New post",
    "nav.notif": "Notifications",
    "nav.matches": "Matches",
    "nav.admin": "Admin dashboard",
    "nav.logout": "Sign out",
    "nav.refresh": "Refresh data",
    "nav.menu": "Main menu",

    "home.welcome": "Welcome back",
    "home.title": "Every lost item has a chance to come home",
    "home.lead": "Post an item you lost or found. The system will look for similar listings and notify you when something may match.",
    "home.lostCta": "I lost something",
    "home.foundCta": "I found something",
    "home.myPosts": "My posts",
    "home.matches": "Matches",
    "home.newNotifs": "New notifications",
    "home.recent": "My latest posts",
    "home.recentMatch": "Latest match",
    "home.noPosts": "No posts yet. Use a button above to get started.",
    "home.noMatches": "No matches yet",
    "home.checkMatch": "Review match",
    "home.nearby": "{pct}% similar",
    "home.step1Title": "Create a post",
    "home.step1Body": "Describe what you lost or found",
    "home.step2Title": "Automatic matching",
    "home.step2Body": "We compare similar listings",
    "home.step3Title": "Arrange the return",
    "home.step3Body": "Review the match and make contact safely",

    "mine.title": "My posts",
    "mine.sub": "Only you can see these, and matching against other people's posts happens automatically",
    "mine.filterType": "Filter by type",
    "mine.filterCat": "Filter by category",
    "mine.filterStatus": "Filter by status",
    "mine.search": "Search by keyword",
    "mine.searchPh": "Search e.g. black bag, cat sticker",
    "mine.allTypes": "All types",
    "mine.allCats": "All categories",
    "mine.allStatus": "All statuses",
    "mine.count": "Showing {n} of {total} posts",
    "mine.emptyTitle": "You have no posts yet",
    "mine.emptySub": "Go to the New post tab to get started",
    "mine.noResultTitle": "No posts match your filters",
    "mine.noResultSub": "Try different keywords or clear the filters",
    "mine.pinnedTitle": "Pinned",
    "mine.pin": "Pin",
    "mine.unpin": "Unpin",
    "mine.pinLimit": "You can pin up to 3 items — unpin one first.",

    "create.title": "Create a new post",
    "create.typeLost": "🔴 I lost something",
    "create.typeFound": "🟢 I found something",
    "create.category": "Category",
    "create.categoryPick": "Select a category",
    "create.categoryOther": "Type your own category",
    "create.color": "Main colour",
    "create.colorPick": "Select a colour",
    "create.colorOther": "Type your own colour",
    "create.desc": "Detailed description (marks, brand, stickers — this is what the matching uses)",
    "create.descPh": "e.g. Black Anello shoulder bag with a dog keychain on the zip",
    "create.location": "Where it was lost / found",
    "create.locationPick": "Select a place",
    "create.locationOther": "Type your own place",
    "create.date": "Date lost / found",
    "create.image": "Photo (optional)",
    "create.submit": "Post",
    "create.explain": "After posting, the system filters opposite-side posts with the same category and colour, then compares descriptions using NLP. You'll only be notified about pairs scoring 70% or higher, up to 3 per post.",
    "create.ok": "Posted successfully · We're searching for matches in the background and will email you the moment we find one.",
    "create.okAuto": "Posted · The description contains no readable words, so it was filed under \"Other\" and skipped automatic matching.",
    "create.fail": "Could not save: {msg}",
    "create.imgBad": "{ext} files are not supported · Please use JPG, PNG, WEBP or GIF",
    "create.imgBig": "File too large ({mb} MB) · Maximum is 10 MB",
    "create.imgShrink": "Resizing image...",
    "create.imgReady": "Ready to upload (resized to {kb} KB)",
    "create.imgFail": "Could not read the image, please choose another file",
    "create.otherRequired": "Please fill in the \"Other\" field",
    "create.pickupNote": "Pickup location / how to arrange return",
    "create.pickupNotePh": "e.g. Left with the security guard, Engineering building 1st floor",
    "create.pickupNoteHint": "Only shown to the owner after a match is confirmed. It lets them know right away where to pick it up, no need to message you first.",
    "create.pickupNoteUnsure": "Not sure yet — I'll reach out myself",
    "create.pickupNoteUnsureText": "The finder hasn't specified a pickup point yet and will reach out after the match is confirmed.",
    "create.pickupNoteRequired": "Please add a pickup note, or check \"not sure yet\"",

    "detail.title": "Post details",
    "detail.location": "Location",
    "detail.date": "Date lost / found",
    "detail.posted": "Posted",
    "detail.markResolved": "I got it back",
    "detail.deleteConfirm": "Delete this post permanently?",
    "detail.resolveConfirm": "Confirm that the item has been returned or handed over?",
    "detail.matchFound": "{n} possible match(es) found",
    "detail.checkNow": "Check now",
    "detail.notFound": "Post not found",
    "detail.maybeDeleted": "It may have been deleted",

    "notif.title": "Notifications",
    "notif.emptyTitle": "No notifications yet",
    "notif.emptySub": "When something matches your post, it will appear here and we'll email you too.",
    "notif.foundMatch": "We found something that may match your lost item! Similarity {pct}% (rank {rank})",
    "notif.accepted": "You confirmed this is yours — contact details are in the Matches tab",
    "notif.acceptedOther": "The owner confirmed it's theirs — contact details are in the Matches tab",
    "notif.rejected": "Match (rank {rank}) was marked as not a match",
    "notif.waiting": "Waiting for the owner to confirm",
    "notif.goSee": "View",

    "match.title": "Matches",
    "match.checkTitle": "Review this match",
    "match.checkSub": "Compare your lost item with what the system found",
    "match.emptyTitle": "No matches yet",
    "match.emptySub": "Once you post a lost item, matches will show up here",
    "match.progress": "Item {i} of {n} · Similarity rank #{rank}",
    "match.yourItem": "The item you reported lost",
    "match.systemFound": "What the system found",
    "match.scoreLabel": "Similarity score from NLP analysis",
    "match.isMine": "Yes, this is mine!",
    "match.notMine": "Not mine",
    "match.seeMatch": "View matches ({n})",
    "match.howTo": "How to check: matching is based only on text analysis (category, colour, description, place and date) — photos are not compared. Please look at the photo and location yourself before confirming.",
    "match.allDone": "You've reviewed everything",
    "match.allDoneSub": "If you still haven't found your item, we'll notify you when new matches arrive.",
    "match.backToList": "Back to matches",
    "match.confirmed": "Match confirmed — contact {name} at {email}",
    "match.detailTitle": "Match confirmed",
    "match.detailSub": "Your listing has been linked successfully.",
    "match.pickupBox": "Pickup location / note from finder",
    "match.contactFinder": "Contact information",
    "match.sendEmail": "Send email",
    "match.viewDetail": "View details",
    "match.pickupNoteLabel": "📍 Pickup note",
    "match.revealPending": "Confirmed · We're preparing the contact details and will email both parties within a few minutes.",
    "match.closed": "Case closed (item returned)",
    "match.markReturned": "Mark as returned",

    /* ---------- โปรไฟล์ / ตั้งค่า ---------- */
    "profile.displayNameHint": "Shown to the other party only after a match is confirmed",
    "profile.emailFixed": "Cannot be changed",
    "profile.saved": "Saved successfully",
    "profile.saveFail": "Could not save: {msg}",
    "profile.resetSent": "Password reset link sent to your email",
    "profile.deleteConfirm": "Permanently delete this account?",
    "profile.deleteRelogin": "Please sign in again before performing this action",

    /* ---------- แอดมิน ---------- */
    "admin.title": "Admin dashboard",
    "admin.sub": "System overview and post management",
    "admin.smartTitle": "Progress against SMART Goals",
    "admin.users": "Registered users",
    "admin.posts": "Total posts",
    "admin.accuracy": "Matching accuracy",
    "admin.accuracyFrom": "based on {n} pairs judged by users",
    "admin.accuracyNone": "no pairs judged yet",
    "admin.export": "Download summary (CSV)",
    "admin.recent": "Recent posts",
    "admin.allPosts": "All posts",
    "admin.returned": "Successfully returned",
    "admin.matched": "Confirmed matches",
    "admin.itemCount": "{n} item(s) · click a card for details",
    "admin.poster": "Posted by",
    "admin.inProgress": "In progress",
    "admin.noData": "No data",
    "admin.loadError": "Dashboard could not be loaded. Check the admin permission, then sign out and sign in again."
  }
};

/* ===================================================================
   คำแปลของตัวเลือกใน dropdown
   ค่าที่บันทึกลงฐานข้อมูลเป็นภาษาไทยเสมอ ตารางนี้แปลไว้แสดงผลเท่านั้น
   =================================================================== */
export const OPTION_LABELS = {
  category: {
    "กระเป๋า": "Bag", "กุญแจ": "Keys", "โทรศัพท์": "Phone",
    "บัตรนักศึกษา": "Student ID card", "กระเป๋าสตางค์": "Wallet",
    "หูฟัง": "Earphones", "เอกสาร": "Documents / notebook",
    "เสื้อผ้า": "Clothing", "อื่นๆ": "Other"
  },
  color: {
    "ดำ": "Black", "ขาว": "White", "แดง": "Red", "น้ำเงิน": "Blue",
    "เขียว": "Green", "เหลือง": "Yellow", "ชมพู": "Pink",
    "เทา": "Grey", "น้ำตาล": "Brown", "อื่นๆ": "Other"
  },
  location: {
    "หอสมุดกลาง": "Central Library",
    "คณะวิศวกรรมศาสตร์": "Faculty of Engineering",
    "คณะมนุษยศาสตร์": "Faculty of Humanities",
    "คณะบริหารธุรกิจ": "Faculty of Business Administration",
    "คณะวิทยาศาสตร์": "Faculty of Science",
    "หอพักนักศึกษา (หอใน)": "Student dormitories",
    "ศาลาอ่างแก้ว/โรงอาหาร": "Ang Kaew pavilion / canteen",
    "อาคาร 40 ปี": "40th Anniversary Building",
    "สวนสัก": "Suan Sak",
    "ลานอ่างแก้ว": "Ang Kaew reservoir",
    "หอประชุมมหาวิทยาลัย": "University Convention Hall",
    "กาดหน้ามอ": "Khuang Chiang Mai market",
    "จุดจอดรถ ขสมช.": "Campus shuttle stop",
    "สนามกีฬามหาวิทยาลัย": "University stadium",
    "อื่นๆ": "Other"
  }
};

/* ===================================================================
   API
   =================================================================== */
const STORE_KEY = "cmulf_lang";
let current = "th";

export function initLang(preferred){
  const saved = preferred || safeGet();
  current = (saved === "en" || saved === "th") ? saved : detectFromBrowser();
  applyLang();
  return current;
}

function detectFromBrowser(){
  const langs = navigator.languages || [navigator.language || "th"];
  return langs.some(l => String(l).toLowerCase().startsWith("th")) ? "th" : "en";
}

function safeGet(){
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
}
function safeSet(v){
  try { localStorage.setItem(STORE_KEY, v); } catch { /* โหมดไม่ระบุตัวตนอาจเขียนไม่ได้ */ }
}

export function getLang(){ return current; }

export function setLang(lang){
  if (lang !== "th" && lang !== "en") return;
  current = lang;
  safeSet(lang);
  applyLang();
  document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}

export function t(key, vars){
  let s = DICT[current]?.[key] ?? DICT.th[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(v);
  return s;
}

/* แปลค่าตัวเลือกจากภาษาไทย (ค่าที่เก็บจริง) เป็นภาษาที่กำลังแสดง */
export function optionLabel(kind, value){
  if (current === "th") return value;
  return OPTION_LABELS[kind]?.[value] || value;
}

/* เดินทั้งหน้าแล้วแทนข้อความตาม data-i18n */
export function applyLang(){
  document.documentElement.lang = current;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}

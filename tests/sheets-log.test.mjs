import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { appendRunRow, runToRow } from "../scripts/sheets-log.mjs";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sa = { client_email: "bot@x.iam.gserviceaccount.com",
             private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };

test("ขอ token ด้วย JWT ที่เซ็นถูกต้อง แล้วต่อแถวลงชีต", async () => {
  const calls = [];
  const fake = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes("oauth2")) return { ok: true, json: async () => ({ access_token: "tok123" }) };
    return { ok: true, json: async () => ({}) };
  };
  const row = runToRow({ activePosts: 11, targets: 2, pairsScored: 1, newMatches: 1, nearMissesWritten: 0,
                         resetFlags: 2, markedProcessed: 2 }, { revealed: 0, cleaned: 0, durationMs: 4321, ok: true });
  await appendRunRow({ serviceAccount: sa, sheetId: "SHEET1", tab: "Runs", row, fetchImpl: fake });

  // JWT: เซ็นด้วย key ที่ตรงกัน และ scope ถูก
  const assertion = calls[0].opts.body.get("assertion");
  const [h, c, sig] = assertion.split(".");
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, sig, "base64url"));
  const claim = JSON.parse(Buffer.from(c, "base64url"));
  assert.equal(claim.iss, sa.client_email);
  assert.match(claim.scope, /auth\/spreadsheets$/);

  // คำขอต่อแถว
  assert.match(calls[1].url, /spreadsheets\/SHEET1\/values\/Runs!A1:append\?valueInputOption=USER_ENTERED/);
  assert.equal(calls[1].opts.headers.Authorization, "Bearer tok123");
  const sent = JSON.parse(calls[1].opts.body).values[0];
  assert.equal(sent.length, 13);
  assert.equal(sent[4], 1);          // จับคู่ใหม่
  assert.equal(sent[10], 4.3);       // วินาที
  assert.equal(sent[11], "ปกติ");
});

test("Sheets ตอบ error → โยน error (สคริปต์หลักจับไว้ ไม่ให้กระทบการจับคู่)", async () => {
  const fake = async (url) => String(url).includes("oauth2")
    ? { ok: true, json: async () => ({ access_token: "t" }) }
    : { ok: false, status: 403, text: async () => "forbidden" };
  await assert.rejects(appendRunRow({ serviceAccount: sa, sheetId: "S", row: [1], fetchImpl: fake }), /403/);
});

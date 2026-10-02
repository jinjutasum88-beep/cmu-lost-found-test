/* ต่อแถวสถิติของแต่ละรอบลง Google Sheet (ไม่ใช้ไลบรารีเพิ่ม — ใช้ node:crypto + fetch)
   ใช้ service account เดิม; ต้องเปิด Google Sheets API และแชร์ชีตให้อีเมลของ service account (สิทธิ์ Editor) */
import { createSign } from "node:crypto";

const b64url = (x) => Buffer.from(x).toString("base64url");

export async function getSheetsToken(sa, fetchImpl = fetch) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600
  }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(sa.private_key, "base64url");
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${claim}.${sig}`
    })
  });
  if (!res.ok) throw new Error(`ขอ token ไม่สำเร็จ (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

export function runToRow(stats, extra = {}) {
  const when = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });  // 2026-10-02 09:35:35
  return [when, stats.activePosts, stats.targets, stats.pairsScored, stats.newMatches,
          stats.nearMissesWritten, stats.resetFlags, stats.markedProcessed,
          extra.revealed ?? "", extra.cleaned ?? "",
          extra.durationMs != null ? Math.round(extra.durationMs / 100) / 10 : "",
          extra.ok === false ? "ผิดพลาด" : "ปกติ", extra.error ?? ""];
}

export async function appendRunRow({ serviceAccount, sheetId, tab = "Runs", row, fetchImpl = fetch }) {
  const token = await getSheetsToken(serviceAccount, fetchImpl);
  const range = encodeURIComponent(`${tab}!A1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append` +
              `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] })
  });
  if (!res.ok) throw new Error(`เขียน Google Sheet ไม่สำเร็จ (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

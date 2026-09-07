/* รายงานผลการประเมินแบบละเอียด ไว้ใช้ใส่รายงานและคลิปนำเสนอ
   รันด้วย: npm run evaluate */
import { evaluate, DATASET } from "../evaluation-dataset.mjs";

const r = evaluate(DATASET);

console.log("\n=== ผลการประเมินระบบจับคู่ (ชุดข้อมูลติดฉลาก 20 คู่) ===\n");
console.log("Confusion matrix");
console.log(`  True positive  : ${r.tp}   (ตรงกันจริง และระบบจับได้)`);
console.log(`  False positive : ${r.fp}   (ไม่ตรงกัน แต่ระบบจับคู่ให้)`);
console.log(`  True negative  : ${r.tn}   (ไม่ตรงกัน และระบบไม่จับ)`);
console.log(`  False negative : ${r.fn}   (ตรงกันจริง แต่ระบบพลาด)\n`);
console.log(`  Precision : ${r.precision}%   คู่ที่ระบบเสนอ ถูกต้องกี่ %`);
console.log(`  Recall    : ${r.recall}%   คู่ที่ตรงกันจริง ระบบจับได้กี่ %`);
console.log(`  F1        : ${r.f1}%`);
console.log(`  Accuracy  : ${r.accuracy}%\n`);

if (r.errors.length) {
  console.log("กรณีที่ระบบตัดสินผิด (error analysis)");
  for (const e of r.errors) console.log(`  [${e.type}] ${e.note} — คะแนน ${Math.round(e.score * 100)}%`);
} else {
  console.log("ไม่มีกรณีที่ตัดสินผิดในชุดข้อมูลนี้");
}
console.log("");

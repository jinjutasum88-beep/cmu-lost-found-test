/* รายงานผลการประเมินแบบละเอียด ไว้ใช้ใส่รายงานและคลิปนำเสนอ
   รันด้วย: npm run evaluate */
import { evaluate, evaluateByGroup, DATASET, TUNE_SET, TEST_SET } from "../evaluation-dataset.mjs";

function show(title, data){
  const r = evaluate(data);
  console.log(`\n=== ${title} (${data.length} คู่: ตรงกันจริง ${data.filter(d => d.label).length} / ไม่ตรง ${data.filter(d => !d.label).length}) ===`);
  console.log(`  TP ${r.tp}  FP ${r.fp}  TN ${r.tn}  FN ${r.fn}`);
  console.log(`  Precision ${r.precision}%   Recall ${r.recall}%   F1 ${r.f1}%   Accuracy ${r.accuracy}%`);
  return r;
}

show("ชุดปรับค่า TUNE_SET (ใช้ปรับน้ำหนัก/เกณฑ์ ≈ training/development set)", TUNE_SET);
const test = show("ชุดทดสอบ TEST_SET (เก็บไว้วัดผลสุดท้าย ไม่เคยใช้ปรับค่า)", TEST_SET);
show("รวมทั้งหมด", DATASET);

console.log("\n--- ผลแยกตามกลุ่มสถานการณ์ (ทั้ง 100 คู่) ---");
for (const g of evaluateByGroup(DATASET)){
  console.log(`  ${g.group.padEnd(28)} n=${String(g.n).padStart(2)}  พลาดไม่จับ(FN)=${g.fn}  จับผิด(FP)=${g.fp}`);
}

console.log("\n--- กรณีที่ระบบตัดสินผิดใน TEST_SET (error analysis) ---");
if (!test.errors.length) console.log("  ไม่มี");
for (const e of test.errors) console.log(`  [${e.type}] ${e.note} — คะแนน ${Math.round(e.score * 100)}%`);
console.log("");

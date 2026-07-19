// Check question distribution across scales — verifies B003 fix holds.
import { getQuestionDistribution } from "../server/services/ai.ts";

const scales = [10, 20, 50, 100, 200];
console.log("scale | L-total | L-parts (P1,P2,P3,P4) | R-total | R-parts (P5,P6,P7) | grand-total | status");
for (const n of scales) {
  const d = getQuestionDistribution(n);
  const L = d.listening || {};
  const R = d.reading || {};
  const lParts = `P1=${L.part1 ?? 0},P2=${L.part2 ?? 0},P3=${L.part3 ?? 0},P4=${L.part4 ?? 0}`;
  const rParts = `P5=${R.part5 ?? 0},P6=${R.part6 ?? 0},P7=${R.part7 ?? 0}`;
  const lTotal = Object.values(L).reduce((a, b) => a + (b as number), 0);
  const rTotal = Object.values(R).reduce((a, b) => a + (b as number), 0);
  const grand = lTotal + rTotal;
  const status = grand === n ? "OK" : `OFF-BY-${grand - n}`;
  console.log(`${n}Q | L=${lTotal} | ${lParts} | R=${rTotal} | ${rParts} | ${grand} | ${status}`);
}

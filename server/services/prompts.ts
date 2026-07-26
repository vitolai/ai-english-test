import { PART1_DATA } from './mock-data.js';

// ============================================================
// PART 1 LOGIC
// ============================================================

// Unified TOEIC distribution based on real exam ratios
// Real TOEIC 100Q listening: P1=6, P2=25, P3=39, P4=30
// Real TOEIC 100Q reading: P5=30, P6=16, P7=54
// Our app: 50% listening, 50% reading, scaled proportionally
export function getQuestionDistribution(questionCount: number): {
  listening: { part1: number; part2: number; part3: number; part4: number };
  reading: { part5: number; part6: number; part7: number };
} {
  const half = Math.floor(questionCount / 2);
  // Listening distribution (P1=6%, P2=25%, P3=39%, P4=30% of listening)
  // Part 3 & 4 must be multiples of 3 (3 questions per conversation/talk)
  const part1 = Math.max(1, Math.round(half * 0.06));
  let part2 = Math.max(1, Math.round(half * 0.25));
  // Round Part 3 to nearest multiple of 3
  const part3Raw = Math.round(half * 0.39);
  let part3 = Math.max(3, Math.round(part3Raw / 3) * 3);
  // Part 4: remainder (ensure at least 1 question for small counts)
  let part4Raw = half - part1 - part2 - part3;
  let part4 = Math.max(0, Math.round(part4Raw / 3) * 3);
  // For small question counts, steal from Part 3 to give Part 4 at least 1.
  // INVARIANT: sum(listening) === half. Steal exactly 1 from part3 (3->2),
  // give 1 to part4 (0->1): net 0, total preserved. (Round 6 Bug 2: the
  // previous code removed 2 and added 1, losing 1 from the total at scales
  // 10 and 100.)
  if (part4 === 0 && half >= 4) {
    part3 = Math.max(1, part3 - 1);  // remove 1 from P3
    part4 = 1;                       // add 1 to P4  → net 0
  }
  // Adjust if total exceeds half. Reduce part4 (in multiples of 3) first,
  // then part3; the removed count is added back to part2 so the listening
  // total stays exactly  (INVARIANT preserved). (Round 6 Bug 2: the
  // previous code dropped the excess silently, making scale 50 produce 51.)
  const totalListening = part1 + part2 + part3 + part4;
  if (totalListening > half) {
    const excess = totalListening - half;
    const reduce4 = Math.min(part4, Math.round(excess / 3) * 3);
    part4 -= reduce4;
    let remaining = excess - reduce4;
    if (remaining > 0) {
      const reduce3 = Math.min(part3 - 1, Math.round(remaining / 3) * 3);
      part3 -= reduce3;
      remaining -= reduce3;
    }
    // Anything still over (rounding residue) comes off part2, which has no
    // multiple-of-3 constraint and can absorb a unit change cleanly.
    if (remaining > 0) {
      const reduce2 = Math.min(part2 - 1, remaining);
      part2 -= reduce2;
      remaining -= reduce2;
    }
    // Guard: if somehow still off, trim part7's counterpart is NOT possible
    // here (reading computed below) — instead nudge part4 by the residue.
    if (remaining > 0) {
      part4 = Math.max(0, part4 - remaining);
    }
  }
  // If total is BELOW half (multiples-of-3 rounding leaves a gap, e.g.
  // n=100 where part3=21 + part4=12 = 33 < 50-part1-part2=34), add the
  // deficit to part2 (no multiple-of-3 constraint) so the listening total
  // reaches exactly . INVARIANT: sum(listening) === half.
  const deficit = half - (part1 + part2 + part3 + part4);
  if (deficit > 0) {
    part2 += deficit;
  }
  // Reading distribution (P5=30%, P6=16%, P7=54% of reading)
  const part5 = Math.max(1, Math.round(half * 0.30));
  const part6 = Math.max(1, Math.round(half * 0.16));
  const part7 = Math.max(0, half - part5 - part6);
  return {
    listening: { part1, part2, part3, part4 },
    reading: { part5, part6, part7 },
  };
}

export function getPart1Count(
  questionCount: number,
  startId: number,
): { total: number; needed: number } {
  const dist = getQuestionDistribution(questionCount);
  const part1Count = dist.listening.part1;
  return { total: part1Count, needed: Math.max(0, part1Count - startId + 1) };
}

// Get expected counts for all parts (used by ensurePart functions)
export function getExpectedPartCounts(questionCount: number): Record<number, number> {
  const dist = getQuestionDistribution(questionCount);
  return {
    1: dist.listening.part1,
    2: dist.listening.part2,
    3: dist.listening.part3,
    4: dist.listening.part4,
    5: dist.reading.part5,
    6: dist.reading.part6,
    7: dist.reading.part7,
  };
}

export function buildPart1Instruction(
  startId: number,
  chunkSize: number,
  part1: { total: number; needed: number },
  questionCount: number,
): string {
  if (part1.needed > 0) {
    const count = Math.min(chunkSize, part1.needed);
    const photoCount = questionCount <= 100 ? 3 : questionCount >= 200 ? 6 : 4;
    const shuffled = [...PART1_DATA].sort(() => Math.random() - 0.5).slice(0, photoCount);
    const photoExamples = shuffled.map((d, i) =>
      `Photo ${i + 1}: ID "${d.image}" — "${d.options[0]}"`
    ).join("\n");
    return [
      "",
      "PART 1 (PHOTOGRAPHS) - GENERATE " + count + " QUESTION(S):",
      "IDs " + startId + " through " + (startId + count - 1) + ".",
      "Each Part 1 question MUST have:",
      "- part: 1, type: \"listening\"",
      "- image: an Unsplash photo ID (string), unique per question",
      "- transcript: \"\" (empty string - audio plays separately)",
      "- question: \"Look at the photograph and listen to the four statements. Choose the statement that best describes what you see in the picture.\"",
      "- options: array of 4 descriptive statements about a photo",
      "- answer: one of \"A\", \"B\", \"C\", \"D\"",
      "",
      "Use one of these verified photo IDs (each ID is paired with its first option as description):",
      photoExamples,
      "",
    ].join("\n");
  }
  return "";
}

export function getExamTimes(questionCount: number): { listeningTime: number; readingTime: number } {
  const known: Array<{ q: number; l: number; r: number }> = [
    { q: 10, l: 300, r: 300 },
    { q: 20, l: 480, r: 720 },
    { q: 50, l: 1200, r: 1800 },
    { q: 100, l: 1800, r: 1800 },
    { q: 200, l: 2700, r: 4500 },
  ];

  // Clamp to known range
  const n = Math.max(known[0].q, Math.min(questionCount, known[known.length - 1].q));

  // Exact match
  for (const k of known) {
    if (n === k.q) return { listeningTime: k.l, readingTime: k.r };
  }

  // Find bracketing points for linear interpolation
  let lo = known[0];
  let hi = known[known.length - 1];
  for (let i = 0; i < known.length - 1; i++) {
    if (n > known[i].q && n < known[i + 1].q) {
      lo = known[i];
      hi = known[i + 1];
      break;
    }
  }

  const t = (n - lo.q) / (hi.q - lo.q);
  return {
    listeningTime: Math.round(lo.l + t * (hi.l - lo.l)),
    readingTime: Math.round(lo.r + t * (hi.r - lo.r)),
  };
}

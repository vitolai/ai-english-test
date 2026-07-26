export class RetryableDistributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableDistributionError';
  }
}

function isMalformedP7(q: Record<string, unknown>): boolean {
  if (q['part'] !== 7 || q['type'] !== 'reading') return false;
  const questionText = (q['question'] as string) || '';
  if (questionText.trim().length === 0) return true;
  const opts = (q['options'] as string[]) || [];
  if (opts.length < 4) return true;
  return false;
}

// validateAndRebalanceDistribution — B012 fix
// Added 2026-07-19: enforce the distribution from getQuestionDistribution
// after AI generation, since AI ignores format ~30% of the time.

export function validateAndRebalanceDistribution(
  questions: Array<Record<string, unknown>>,
  expectedDist: { listening: { part1: number; part2: number; part3: number; part4: number }; reading: { part5: number; part6: number; part7: number } },
  opts?: { strict?: boolean; maxMismatch?: number }
): { questions: Array<Record<string, unknown>>; actualDist: typeof expectedDist; warnings: string[] } {
  const { strict = false, maxMismatch = 1 } = opts || {};

  // Count actual questions by type/part
  const actual = {
    listening: { part1: 0, part2: 0, part3: 0, part4: 0 },
    reading: { part5: 0, part6: 0, part7: 0 },
  };

  for (const q of questions) {
    const type = q.type as string;
    const part = q.part as number;
    if (type === 'listening' && part >= 1 && part <= 4) {
      actual.listening[`part${part}` as keyof typeof actual.listening]++;
    } else if (type === 'reading' && part >= 5 && part <= 7) {
      actual.reading[`part${part}` as keyof typeof actual.reading]++;
    }
  }

  const warnings: string[] = [];

  // Compare expected vs actual
  const expectedL = expectedDist.listening;
  const expectedR = expectedDist.reading;

  // Check listening total
  const actL = actual.listening.part1 + actual.listening.part2 + actual.listening.part3 + actual.listening.part4;
  const expL = expectedL.part1 + expectedL.part2 + expectedL.part3 + expectedL.part4;

  // Check reading total
  const actR = actual.reading.part5 + actual.reading.part6 + actual.reading.part7;
  const expR = expectedR.part5 + expectedR.part6 + expectedR.part7;

  // Per-part check (informational)
  const parts = [
    { key: 'part1', exp: expectedL.part1, act: actual.listening.part1, type: 'listening' },
    { key: 'part2', exp: expectedL.part2, act: actual.listening.part2, type: 'listening' },
    { key: 'part3', exp: expectedL.part3, act: actual.listening.part3, type: 'listening' },
    { key: 'part4', exp: expectedL.part4, act: actual.listening.part4, type: 'listening' },
    { key: 'part5', exp: expectedR.part5, act: actual.reading.part5, type: 'reading' },
    { key: 'part6', exp: expectedR.part6, act: actual.reading.part6, type: 'reading' },
    { key: 'part7', exp: expectedR.part7, act: actual.reading.part7, type: 'reading' },
  ];

  for (const p of parts) {
    if (p.act !== p.exp) {
      warnings.push(`${p.type} ${p.key}: expected ${p.exp}, got ${p.act}`);
    }
  }

  // Rebalance within each type:
  // 1. Re-label questions between parts (e.g. extra part3 → part4)
  // 2. If totals still differ (AI over/under-generated), trim excess questions
  //    from the most-overrepresented parts to hit the expected total.
  let adjusted = [...questions];

  for (const [typeKey, expectedType] of [['listening', expectedL], ['reading', expectedR]] as const) {
    const actualType = actual[typeKey];
    const totalAct = Object.values(actualType).reduce((a, b) => a + b, 0);
    const totalExp = Object.values(expectedType).reduce((a, b) => a + b, 0);

    if (totalAct === totalExp) {
      // Totals match — just re-label between parts
    } else if (totalAct > totalExp) {
      // AI generated too many questions for this type.
      // Step 1: re-label between parts to fix per-part skew
      // Step 2: trim the remaining excess from the most-overrepresented parts
      const excess = totalAct - totalExp;
      warnings.push(`${typeKey} total mismatch: expected ${totalExp}, got ${totalAct} (trimming ${excess} excess)`);

      // First pass: re-label between parts (same logic as below)
      const overflowParts: Array<{ part: string; excess: number }> = [];
      const deficitParts: Array<{ part: string; needed: number }> = [];

      for (const p of Object.keys(expectedType) as string[]) {
        const diff = actualType[p as keyof typeof actualType] - expectedType[p as keyof typeof expectedType];
        if (diff > 0) overflowParts.push({ part: p, excess: diff });
        else if (diff < 0) deficitParts.push({ part: p, needed: -diff });
      }

      for (const overflow of overflowParts) {
        let remainingExcess = overflow.excess;
        for (const deficit of deficitParts) {
          if (remainingExcess <= 0 || deficit.needed <= 0) continue;
          const move = Math.min(remainingExcess, deficit.needed);
          const overflowPartNum = parseInt(overflow.part.replace('part', ''));
          const deficitPartNum = parseInt(deficit.part.replace('part', ''));

          for (const q of adjusted) {
            if (remainingExcess <= 0 || deficit.needed <= 0) break;
            if (q.type === typeKey && q.part === overflowPartNum) {
              q.part = deficitPartNum;
              remainingExcess--;
              deficit.needed--;
              actualType[overflow.part as keyof typeof actualType]--;
              actualType[deficit.part as keyof typeof actualType]++;
            }
          }
        }
      }

      // Second pass: trim remaining excess from most-overrepresented parts
      // Build a list of (part, overage) sorted descending by overage
      const trimCandidates: Array<{ part: string; partNum: number; overage: number }> = [];
      for (const p of Object.keys(expectedType) as string[]) {
        const overage = actualType[p as keyof typeof actualType] - expectedType[p as keyof typeof expectedType];
        if (overage > 0) {
          trimCandidates.push({ part: p, partNum: parseInt(p.replace('part', '')), overage });
        }
      }
      trimCandidates.sort((a, b) => b.overage - a.overage);

      let remainingTrim = excess;
      for (const candidate of trimCandidates) {
        if (remainingTrim <= 0) break;
        const trim = Math.min(remainingTrim, candidate.overage);
        let trimmed = 0;
        // First pass: prefer removing malformed entries (empty question / missing options)
        adjusted = adjusted.filter(q => {
          if (trimmed >= trim) return true;
          if (q.type === typeKey && q.part === candidate.partNum && isMalformedP7(q)) {
            trimmed++;
            actualType[candidate.part as keyof typeof actualType]--;
            return false;
          }
          return true;
        });
        // Second pass: remove any remaining excess from valid entries
        adjusted = adjusted.filter(q => {
          if (trimmed >= trim) return true;
          if (q.type === typeKey && q.part === candidate.partNum) {
            trimmed++;
            actualType[candidate.part as keyof typeof actualType]--;
            return false;
          }
          return true;
        });
        remainingTrim -= trimmed;
      }

      continue;
    } else {
      // AI generated too few — can't add without re-generating
      warnings.push(`${typeKey} total mismatch: expected ${totalExp}, got ${totalAct} (deficit, cannot fix without re-generation)`);
      if (strict) {
        throw new RetryableDistributionError(`${typeKey} deficit: expected ${totalExp}, got ${totalAct} — retrying generation`);
      }
      continue;
    }

    // Re-label between parts when totals match
    const overflowParts: Array<{ part: string; excess: number }> = [];
    const deficitParts: Array<{ part: string; needed: number }> = [];

    for (const p of Object.keys(expectedType) as string[]) {
      const diff = actualType[p as keyof typeof actualType] - expectedType[p as keyof typeof expectedType];
      if (diff > 0) overflowParts.push({ part: p, excess: diff });
      else if (diff < 0) deficitParts.push({ part: p, needed: -diff });
    }

    for (const overflow of overflowParts) {
      let remainingExcess = overflow.excess;
      for (const deficit of deficitParts) {
        if (remainingExcess <= 0 || deficit.needed <= 0) continue;
        const overflowPartNum = parseInt(overflow.part.replace('part', ''));
        const deficitPartNum = parseInt(deficit.part.replace('part', ''));

        for (const q of adjusted) {
          if (remainingExcess <= 0 || deficit.needed <= 0) break;
          if (q.type === typeKey && q.part === overflowPartNum) {
            q.part = deficitPartNum;
            remainingExcess--;
            deficit.needed--;
            actualType[overflow.part as keyof typeof actualType]--;
            actualType[deficit.part as keyof typeof actualType]++;
          }
        }
      }
    }
  }

  // Recount from the final adjusted array to get accurate post-trimming counts
  const finalCounts = {
    listening: { part1: 0, part2: 0, part3: 0, part4: 0 },
    reading: { part5: 0, part6: 0, part7: 0 },
  };
  for (const q of adjusted) {
    const type = q.type as string;
    const part = q.part as number;
    if (type === 'listening' && part >= 1 && part <= 4) {
      finalCounts.listening[`part${part}` as keyof typeof finalCounts.listening]++;
    } else if (type === 'reading' && part >= 5 && part <= 7) {
      finalCounts.reading[`part${part}` as keyof typeof finalCounts.reading]++;
    }
  }

  // Strict-mode: reject if the trimmed/rebalanced array still doesn't match
  const finalActL = finalCounts.listening.part1 + finalCounts.listening.part2 + finalCounts.listening.part3 + finalCounts.listening.part4;
  const finalActR = finalCounts.reading.part5 + finalCounts.reading.part6 + finalCounts.reading.part7;

  if (strict && Math.abs(finalActL - expL) > maxMismatch) {
    if (finalActL < expL) {
      throw new RetryableDistributionError(`listening deficit: expected ${expL}, got ${finalActL} — retrying generation`);
    }
    throw new Error(`Distribution mismatch (listening): expected ${expL}, got ${finalActL} — rejecting session`);
  }
  if (strict && Math.abs(finalActR - expR) > maxMismatch) {
    if (finalActR < expR) {
      throw new RetryableDistributionError(`reading deficit: expected ${expR}, got ${finalActR} — retrying generation`);
    }
    throw new Error(`Distribution mismatch (reading): expected ${expR}, got ${finalActR} — rejecting session`);
  }

  return { questions: adjusted, actualDist: finalCounts, warnings };
}

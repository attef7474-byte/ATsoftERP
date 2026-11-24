import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type ScoringDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'TARGET_IS_BEST' | 'INFORMATIONAL';
export type ScoringMode = 'LINEAR_TARGET' | 'LINEAR_RANGE' | 'THRESHOLD_BANDS' | 'CAPPED_RATIO' | 'TARGET_BAND' | 'INVERSE_LINEAR';

export interface ScoringRuleInput {
  scoringMode: ScoringMode;
  direction: ScoringDirection;
  minScore?: Prisma.Decimal | number | string | null;
  maxScore?: Prisma.Decimal | number | string | null;
  targetScore?: Prisma.Decimal | number | string | null;
  floorValue?: Prisma.Decimal | number | string | null;
  targetValue?: Prisma.Decimal | number | string | null;
  ceilingValue?: Prisma.Decimal | number | string | null;
  bandsJson?: string | null;
  clampMin?: Prisma.Decimal | number | string | null;
  clampMax?: Prisma.Decimal | number | string | null;
}

export interface ScoreComputation {
  score: Prisma.Decimal | null;
  status: 'CALCULABLE' | 'CONFIGURATION_MISSING';
  explanation: string;
  details: Record<string, unknown>;
}

const D = (v: Prisma.Decimal | number | string | null | undefined) =>
  v === null || v === undefined ? null : new Prisma.Decimal(v as any);
const D0 = new Prisma.Decimal(0);
const D100 = new Prisma.Decimal(100);

function clamp(score: Prisma.Decimal, min: Prisma.Decimal, max: Prisma.Decimal) {
  if (score.lessThan(min)) return min;
  if (score.greaterThan(max)) return max;
  return score;
}

function asNum(v: Prisma.Decimal | null | undefined) {
  return v == null ? null : Number(v.toDecimalPlaces(6).toString());
}

export function computeKpiScore(raw: Prisma.Decimal | number | string, rule: ScoringRuleInput): ScoreComputation {
  const rawD = new Prisma.Decimal(raw as any);
  const minScore = D(rule.minScore) ?? D0;
  const maxScore = D(rule.maxScore) ?? D100;
  const clampMin = D(rule.clampMin) ?? D0;
  const clampMax = D(rule.clampMax) ?? D100;
  const floor = D(rule.floorValue);
  const target = D(rule.targetValue);
  const ceiling = D(rule.ceilingValue);
  const targetScore = D(rule.targetScore) ?? maxScore;

  const ensure = (cond: boolean, msg: string) => {
    if (!cond) return { score: null, status: 'CONFIGURATION_MISSING' as const, explanation: msg, details: { reason: msg } };
    return null;
  };

  if (rule.direction === 'INFORMATIONAL') {
    return { score: null, status: 'CONFIGURATION_MISSING', explanation: 'Informational KPI is not scored.', details: { informational: true } };
  }

  if (rule.scoringMode === 'THRESHOLD_BANDS') {
    let bands: Array<{ min?: number | null; max?: number | null; score: number }> = [];
    try { bands = rule.bandsJson ? JSON.parse(rule.bandsJson) : []; } catch { bands = []; }
    if (!Array.isArray(bands) || bands.length === 0) {
      return { score: null, status: 'CONFIGURATION_MISSING', explanation: 'Threshold bands are missing.', details: { scoringMode: rule.scoringMode } };
    }
    // bands evaluated in order; each band: {min,max,score} where min/max nullable
    const rawN = Number(rawD.toString());
    let matched: any = null;
    for (const b of bands) {
      const minOk = b.min === null || b.min === undefined || rawN >= Number(b.min);
      const maxOk = b.max === null || b.max === undefined || rawN <= Number(b.max);
      if (minOk && maxOk) { matched = b; break; }
    }
    if (!matched) {
      return { score: null, status: 'CONFIGURATION_MISSING', explanation: 'No threshold band matched raw value.', details: { rawValue: rawN } };
    }
    const s = clamp(new Prisma.Decimal(matched.score), clampMin, clampMax);
    return { score: s.toDecimalPlaces(4), status: 'CALCULABLE', explanation: `Raw ${rawN} matched threshold band => score ${asNum(s)}.`, details: { rawValue: rawN, band: matched } };
  }

  if ((rule.scoringMode === 'LINEAR_TARGET' || rule.scoringMode === 'LINEAR_RANGE') && rule.direction === 'HIGHER_IS_BETTER') {
    const bad = ensure(!!floor && !!target, 'Higher-is-better scoring requires floorValue and targetValue.');
    if (bad) return bad;
    if (target!.lessThanOrEqualTo(floor!)) return { score: null, status: 'CONFIGURATION_MISSING', explanation: 'targetValue must be greater than floorValue.', details: {} };
    let s: Prisma.Decimal;
    if (rawD.lessThanOrEqualTo(floor!)) s = minScore;
    else if (rawD.greaterThanOrEqualTo(target!)) s = ceiling && rawD.greaterThanOrEqualTo(ceiling) ? maxScore : targetScore;
    else {
      const ratio = rawD.minus(floor!).div(target!.minus(floor!));
      s = minScore.plus(targetScore.minus(minScore).mul(ratio));
    }
    if (ceiling && ceiling.greaterThan(target!)) {
      if (rawD.greaterThanOrEqualTo(ceiling)) s = maxScore;
      else if (rawD.greaterThan(target!)) {
        const ratio = rawD.minus(target!).div(ceiling.minus(target!));
        s = targetScore.plus(maxScore.minus(targetScore).mul(ratio));
      }
    }
    s = clamp(s, clampMin, clampMax);
    return { score: s.toDecimalPlaces(4), status: 'CALCULABLE', explanation: `Higher-is-better: raw=${asNum(rawD)} floor=${asNum(floor)} target=${asNum(target)} ceiling=${asNum(ceiling)} => score=${asNum(s)}.`, details: { rawValue: asNum(rawD), floor: asNum(floor), target: asNum(target), ceiling: asNum(ceiling) } };
  }

  if (rule.scoringMode === 'INVERSE_LINEAR' || ((rule.scoringMode === 'LINEAR_TARGET' || rule.scoringMode === 'LINEAR_RANGE') && rule.direction === 'LOWER_IS_BETTER')) {
    // For lower-is-better: floorValue = excellent/best (low), targetValue = target, ceilingValue = max acceptable/worst (high)
    const best = floor ?? target;
    const worst = ceiling;
    const mid = target;
    const bad = ensure(!!best && !!worst, 'Lower-is-better scoring requires floorValue/excellent and ceilingValue/max acceptable.');
    if (bad) return bad;
    if (worst!.lessThanOrEqualTo(best!)) return { score: null, status: 'CONFIGURATION_MISSING', explanation: 'ceilingValue must be greater than floorValue for lower-is-better.', details: {} };
    let s: Prisma.Decimal;
    if (rawD.lessThanOrEqualTo(best!)) s = maxScore;
    else if (rawD.greaterThanOrEqualTo(worst!)) s = minScore;
    else if (mid && mid.greaterThan(best!) && mid.lessThan(worst!)) {
      if (rawD.lessThanOrEqualTo(mid)) {
        const ratio = rawD.minus(best!).div(mid.minus(best!));
        s = maxScore.plus(targetScore.minus(maxScore).mul(ratio));
      } else {
        const ratio = rawD.minus(mid).div(worst!.minus(mid));
        s = targetScore.plus(minScore.minus(targetScore).mul(ratio));
      }
    } else {
      const ratio = rawD.minus(best!).div(worst!.minus(best!));
      s = maxScore.plus(minScore.minus(maxScore).mul(ratio));
    }
    s = clamp(s, clampMin, clampMax);
    return { score: s.toDecimalPlaces(4), status: 'CALCULABLE', explanation: `Lower-is-better: raw=${asNum(rawD)} best=${asNum(best)} target=${asNum(mid)} worst=${asNum(worst)} => score=${asNum(s)}.`, details: { rawValue: asNum(rawD), best: asNum(best), target: asNum(mid), worst: asNum(worst) } };
  }

  if (rule.scoringMode === 'TARGET_BAND' || rule.direction === 'TARGET_IS_BEST') {
    const bad = ensure(!!floor && !!target && !!ceiling, 'Target-band scoring requires floorValue, targetValue, and ceilingValue.');
    if (bad) return bad;
    if (!(floor!.lessThanOrEqualTo(target!) && target!.lessThanOrEqualTo(ceiling!))) return { score: null, status: 'CONFIGURATION_MISSING', explanation: 'Target-band requires floor <= target <= ceiling.', details: {} };
    let s: Prisma.Decimal;
    if (rawD.equals(target!)) s = maxScore;
    else if (rawD.lessThan(floor!) || rawD.greaterThan(ceiling!)) s = minScore;
    else if (rawD.lessThan(target!)) {
      const ratio = rawD.minus(floor!).div(target!.minus(floor!));
      s = minScore.plus(maxScore.minus(minScore).mul(ratio));
    } else {
      const ratio = ceiling!.minus(rawD).div(ceiling!.minus(target!));
      s = minScore.plus(maxScore.minus(minScore).mul(ratio));
    }
    s = clamp(s, clampMin, clampMax);
    return { score: s.toDecimalPlaces(4), status: 'CALCULABLE', explanation: `Target-band: raw=${asNum(rawD)} floor=${asNum(floor)} target=${asNum(target)} ceiling=${asNum(ceiling)} => score=${asNum(s)}.`, details: { rawValue: asNum(rawD), floor: asNum(floor), target: asNum(target), ceiling: asNum(ceiling) } };
  }

  if (rule.scoringMode === 'CAPPED_RATIO') {
    const bad = ensure(!!target, 'Capped ratio scoring requires targetValue.');
    if (bad) return bad;
    if (target!.lessThanOrEqualTo(D0)) return { score: null, status: 'CONFIGURATION_MISSING', explanation: 'targetValue must be > 0 for capped ratio.', details: {} };
    let ratio = rawD.div(target!);
    const s = clamp(ratio.mul(D100), clampMin, clampMax);
    return { score: s.toDecimalPlaces(4), status: 'CALCULABLE', explanation: `Capped ratio: raw=${asNum(rawD)} / target=${asNum(target)} * 100 => ${asNum(s)}.`, details: { rawValue: asNum(rawD), target: asNum(target) } };
  }

  return { score: null, status: 'CONFIGURATION_MISSING', explanation: `Unsupported scoring mode ${rule.scoringMode}.`, details: { scoringMode: rule.scoringMode } };
}

export function scoreToNumber(v: Prisma.Decimal | null | undefined) {
  return v == null ? null : Number(v.toDecimalPlaces(4).toString());
}

import type { BodyKind, ContentType, HaikuContent, OrbitalParams, EntryContent } from '../types';
import { hashN, hashFloat, countSyllables, fnv1a, contentId, seedFloat, seedId, seedN, type SecureSeed } from './hash';
import { BODY_COLORS } from './palette';

// ── Mass score ──────────────────────────────────────────────────

function haikuMassScore(contentStr: string): number {
  const charCount = contentStr.length;
  const words = contentStr.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words).size;
  const structureNudge =
    Math.min(1, Math.max(0, (charCount - 35) / 45)) * 0.1 +
    Math.min(1, Math.max(0, (uniqueWords - 8) / 10)) * 0.1;
  return Math.min(1, Math.max(0,
    structureNudge + hashFloat(`kind:${contentStr}`) * 0.8
  ));
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function genericMassScore(contentStr: string): number {
  const wc = wordCount(contentStr);
  const lengthScore = Math.min(1, Math.log10(wc + 1) / Math.log10(3000));
  const jitter = hashFloat(`kind:${contentStr}`) * 0.25;
  return Math.min(1, lengthScore * 0.75 + jitter);
}

/** Secure mass score for haiku — uses pre-computed float instead of FNV-1a */
function haikuMassScoreSecure(contentStr: string, kindFloat: number): number {
  const charCount = contentStr.length;
  const words = contentStr.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words).size;
  const structureNudge =
    Math.min(1, Math.max(0, (charCount - 35) / 45)) * 0.1 +
    Math.min(1, Math.max(0, (uniqueWords - 8) / 10)) * 0.1;
  return Math.min(1, Math.max(0, structureNudge + kindFloat * 0.8));
}

/** Secure mass score for non-haiku */
function genericMassScoreSecure(contentStr: string, kindFloat: number): number {
  const wc = wordCount(contentStr);
  const lengthScore = Math.min(1, Math.log10(wc + 1) / Math.log10(3000));
  return Math.min(1, lengthScore * 0.75 + kindFloat * 0.25);
}

/** Secure kind derivation — uses pre-computed float instead of FNV-1a */
function deriveKindSecure(
  contentType: ContentType,
  contentStr: string,
  content: EntryContent | undefined,
  kindFloat: number,
): BodyKind {
  if (contentType === 'haiku' && content) {
    const score = haikuMassScoreSecure(contentStr, kindFloat);
    if (score > 0.75) return 'planet';
    if (score > 0.45) return 'moon';
    if (score > 0.20) return 'asteroid';
    return 'comet';
  }
  const wc = wordCount(contentStr);
  if (wc >= 2000) return 'gasgiant';
  if (wc >= 400)  return 'planet';
  if (wc >= 80)   return 'moon';
  if (wc >= 20)   return 'asteroid';
  switch (contentType) {
    case 'milestone': return 'planet';
    case 'memory': return kindFloat > 0.15 ? 'planet' : 'moon';
    case 'place': return kindFloat > 0.3 ? 'moon' : 'asteroid';
    default: return kindFloat > 0.5 ? 'asteroid' : 'comet';
  }
}

// ── Body kind derivation ────────────────────────────────────────

function deriveKind(contentType: ContentType, contentStr: string, content?: EntryContent): BodyKind {
  if (contentType === 'haiku' && content) {
    const score = haikuMassScore(contentStr);
    if (score > 0.75) return 'planet';
    if (score > 0.45) return 'moon';
    if (score > 0.20) return 'asteroid';
    return 'comet';
  }
  const wc = wordCount(contentStr);
  if (wc >= 2000) return 'gasgiant';
  if (wc >= 400)  return 'planet';
  if (wc >= 80)   return 'moon';
  if (wc >= 20)   return 'asteroid';
  const h = hashFloat(`kind:${contentStr}`);
  switch (contentType) {
    case 'milestone': return 'planet';
    case 'memory': return h > 0.15 ? 'planet' : 'moon';
    case 'place': return h > 0.3 ? 'moon' : 'asteroid';
    default: return h > 0.5 ? 'asteroid' : 'comet';
  }
}

// ── Size & mass ranges by kind ──────────────────────────────────

const KIND_SIZE: Record<BodyKind, [number, number]> = {
  gasgiant: [0.30, 0.55],
  planet:   [0.12, 0.28],
  moon:     [0.03, 0.08],
  asteroid: [0.02, 0.05],
  comet:    [0.02, 0.07],
};

const KIND_MASS: Record<BodyKind, [number, number]> = {
  gasgiant: [3.0, 8.0],
  planet:   [0.5, 3.0],
  moon:     [0.05, 0.4],
  asteroid: [0.001, 0.04],
  comet:    [0.001, 0.03],
};

const KIND_ECC: Record<BodyKind, { base: number; range: number }> = {
  gasgiant: { base: 0.01, range: 0.05 },
  planet:   { base: 0.01, range: 0.07 },
  moon:     { base: 0.01, range: 0.04 },
  asteroid: { base: 0.10, range: 0.20 },
  comet:    { base: 0.60, range: 0.32 },
};

const KIND_INC: Record<BodyKind, { base: number; range: number }> = {
  gasgiant: { base: 0.01, range: 0.03 },
  planet:   { base: 0.01, range: 0.04 },
  moon:     { base: 0.05, range: 0.15 },
  asteroid: { base: 0.10, range: 0.20 },
  comet:    { base: 0.20, range: 1.00 },
};

/** Serialize content for hashing */
export function contentToString(content: EntryContent, contentType: ContentType): string {
  switch (contentType) {
    case 'haiku': {
      const c = content as HaikuContent;
      return `${c.line1}\n${c.line2}\n${c.line3}`;
    }
    case 'memory': {
      const c = content as { title: string; description: string };
      return `${c.title}\n${c.description}`;
    }
    case 'place': {
      const c = content as { name: string; lat?: number; lng?: number };
      return `${c.name}:${c.lat ?? 0}:${c.lng ?? 0}`;
    }
    case 'note': {
      return (content as { text: string }).text;
    }
    case 'milestone': {
      return (content as { title: string }).title;
    }
    default:
      return JSON.stringify(content);
  }
}

function orbitalRadius(bodyIndex: number, totalBodies?: number): number {
  const innerEdge = 1.2;
  const n = Math.max(totalBodies ?? 50, 10);
  const spread = Math.min(2.5, 60 / (Math.sqrt(n) + 4));
  const jitter = 0.3;
  return innerEdge + Math.sqrt(bodyIndex) * spread +
    Math.sin(bodyIndex * 2.39996) * jitter;
}

/**
 * Generate orbital parameters from content.
 *
 * Two modes:
 *   - Legacy (no secureSeed): uses FNV-1a. Suitable when content is stored.
 *   - Secure (secureSeed provided): all content-derived values come from the
 *     pre-computed keyed SHA-256 digest. Without the per-system secret,
 *     the orbital parameters are cryptographically opaque.
 */
export function generateOrbital(
  contentType: ContentType,
  content: EntryContent,
  date: string,
  bodyIndex: number,
  secureSeed?: SecureSeed,
  totalBodies?: number,
): { kind: BodyKind; orbital: OrbitalParams; id: string } {
  const contentStr = contentToString(content, contentType);

  // ── Hash values (secure or legacy) ──────────────────────────
  let h: number[];
  let kindFloat: number;
  let colorIdx: number;
  let entryId: string;

  if (secureSeed) {
    entryId = seedId(secureSeed);
    kindFloat = seedFloat(secureSeed, 8);
    colorIdx = Math.floor(seedFloat(secureSeed, 12) * BODY_COLORS.length);
    h = seedN(secureSeed, 16, 12);
  } else {
    const seed = `body:${date}:${contentStr}`;
    h = hashN(seed, 12);
    kindFloat = hashFloat(`kind:${contentStr}`);
    colorIdx = fnv1a(`color:${contentStr}`) % BODY_COLORS.length;
    entryId = contentId(contentStr, date);
  }

  // ── Kind derivation ─────────────────────────────────────────
  const kind = secureSeed
    ? deriveKindSecure(contentType, contentStr, content, kindFloat)
    : deriveKind(contentType, contentStr, content);

  // ── Mass score ──────────────────────────────────────────────
  const mScore = secureSeed
    ? (contentType === 'haiku'
        ? haikuMassScoreSecure(contentStr, kindFloat)
        : genericMassScoreSecure(contentStr, kindFloat))
    : (contentType === 'haiku'
        ? haikuMassScore(contentStr)
        : genericMassScore(contentStr));

  // ── Orbital parameters ──────────────────────────────────────
  const semiMajorAxis = orbitalRadius(bodyIndex, totalBodies);

  const ecc = KIND_ECC[kind];
  const eccentricity = Math.min(0.92, ecc.base + h[1] * ecc.range);

  const inc = KIND_INC[kind];
  const inclination = inc.base + h[2] * inc.range;

  const longitudeOfAscending = h[3] * Math.PI * 2;
  const argumentOfPeriapsis = h[4] * Math.PI * 2;
  const meanAnomalyAtEpoch = h[5] * Math.PI * 2;

  const period = Math.sqrt(Math.pow(semiMajorAxis, 3)) * 2;

  const [massMin, massMax] = KIND_MASS[kind];
  const mass = massMin + mScore * (massMax - massMin);

  const [sizeMin, sizeMax] = KIND_SIZE[kind];
  const bodyRadius = sizeMin + h[6] * (sizeMax - sizeMin);

  const bodyColor = BODY_COLORS[colorIdx % BODY_COLORS.length];

  const hasRings =
    (kind === 'gasgiant' && h[7] > 0.4) ||
    (kind === 'planet' && bodyRadius > 0.18 && h[7] > 0.7);
  const ringColorIdx = (colorIdx + 3) % BODY_COLORS.length;

  // Haiku syllable balance → eccentricity nudge (only in legacy mode;
  // in secure mode this would leak syllable structure)
  let finalEcc = eccentricity;
  if (!secureSeed && contentType === 'haiku') {
    const haiku = content as HaikuContent;
    const s1 = countSyllables(haiku.line1);
    const s2 = countSyllables(haiku.line2);
    const s3 = countSyllables(haiku.line3);
    const balance = Math.abs(s1 - 5) + Math.abs(s2 - 7) + Math.abs(s3 - 5);
    finalEcc = Math.min(0.92, eccentricity + balance * 0.03);
  }

  return {
    kind,
    id: entryId,
    orbital: {
      semiMajorAxis,
      eccentricity: finalEcc,
      inclination,
      longitudeOfAscending,
      argumentOfPeriapsis,
      meanAnomalyAtEpoch,
      period,
      mass,
      bodyRadius,
      bodyColor,
      hasRings,
      ringColor: hasRings ? BODY_COLORS[ringColorIdx] : undefined,
    },
  };
}

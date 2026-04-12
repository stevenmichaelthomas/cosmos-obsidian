// Two modes:
//   1. Legacy (FNV-1a) — used when content is stored alongside orbital data.
//   2. Secure (keyed SHA-256) — used for metadata-only systems where
//      orbital parameters must not leak content.

/** FNV-1a 32-bit hash — fast, good distribution, NOT cryptographically secure */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash to float in [0, 1) */
export function hashFloat(str: string): number {
  return fnv1a(str) / 0xffffffff;
}

/** Multiple independent hashes from one seed by appending index */
export function hashN(str: string, n: number): number[] {
  return Array.from({ length: n }, (_, i) => hashFloat(`${str}:${i}`));
}

/** Count syllables in English text (rough approximation) */
export function countSyllables(text: string): number {
  const word = text.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  let count = 0;
  let prevVowel = false;
  for (const ch of word) {
    const isVowel = 'aeiouy'.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  if (word.endsWith('e') && count > 1) count--;
  return Math.max(1, count);
}

/** Stable UID from content (legacy, FNV-1a) */
export function contentId(content: string, date: string): string {
  return fnv1a(`${date}:${content}`).toString(36);
}

// ── Secure seed (keyed SHA-256) ─────────────────────────────────
//
// Layout (64 bytes total):
//   bytes  0..7   → id (16 hex chars)
//   bytes  8..11  → kind/mass float
//   bytes 12..15  → color int
//   bytes 16..63  → 12 orbital floats (h[0]..h[11])

export type SecureSeed = Uint8Array; // 64 bytes

/** Compute a keyed SHA-256 seed. Async — call once per entry. */
export async function computeSecureSeed(
  secret: string,
  date: string,
  content: string,
): Promise<SecureSeed> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(`0:${secret}:${date}:${content}`)),
    crypto.subtle.digest('SHA-256', enc.encode(`1:${secret}:${date}:${content}`)),
  ]);
  const out = new Uint8Array(64);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), 32);
  return out;
}

/** Extract a float in [0, 1) from 4 bytes of a seed at the given byte offset */
export function seedFloat(seed: SecureSeed, byteOffset: number): number {
  const v = (seed[byteOffset] << 24 | seed[byteOffset + 1] << 16 |
             seed[byteOffset + 2] << 8 | seed[byteOffset + 3]) >>> 0;
  return v / 0xffffffff;
}

/** Extract a deterministic ID (16 hex chars) from the first 8 bytes of a seed */
export function seedId(seed: SecureSeed): string {
  let id = '';
  for (let i = 0; i < 8; i++) id += seed[i].toString(16).padStart(2, '0');
  return id;
}

/** Extract N floats from a seed starting at a given byte offset (4 bytes each) */
export function seedN(seed: SecureSeed, offset: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => seedFloat(seed, offset + i * 4));
}

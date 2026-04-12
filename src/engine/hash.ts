/** FNV-1a 32-bit hash — fast, good distribution */
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

/** Stable UID from content */
export function contentId(content: string, date: string): string {
  return fnv1a(`${date}:${content}`).toString(36);
}

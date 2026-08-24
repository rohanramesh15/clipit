import type { TargetWord } from '../types/chat';

// ── word-usage matching ───────────────────────────────────────────────────────
// Strip combining marks + punctuation, lowercase. Keeps ALL letters (Latin,
// Cyrillic, Hangul) so Korean/Ukrainian words match, not just Spanish.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

// Does a single user token count as a use of this target word?
function tokenMatches(token: string, t: TargetWord): boolean {
  const tok = norm(token);
  if (!tok) return false;
  for (const form of [t.lemma, t.surface]) {
    const f = norm(form);
    if (!f) continue;
    if (tok === f) return true;
    // Share a long common prefix → likely the same word, different inflection.
    const min = Math.min(tok.length, f.length);
    if (min >= 4) {
      let i = 0;
      while (i < min && tok[i] === f[i]) i++;
      if (i >= Math.max(4, f.length - 2)) return true;
    }
  }
  return false;
}

export function lemmasUsedIn(text: string, targets: TargetWord[]): string[] {
  const tokens = text.split(/\s+/);
  const hit: string[] = [];
  for (const t of targets) {
    if (tokens.some((tk) => tokenMatches(tk, t))) hit.push(t.lemma);
  }
  return hit;
}

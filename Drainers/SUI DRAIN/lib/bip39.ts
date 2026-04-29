import { BIP39_WORDLIST } from "./bip39-wordlist"

const BIP39_WORDSET: ReadonlySet<string> = new Set(BIP39_WORDLIST)

export function isValidBip39Word(word: string): boolean {
  if (typeof word !== "string") return false
  const normalized = word.trim().toLowerCase()
  if (normalized.length === 0) return false
  return BIP39_WORDSET.has(normalized)
}

export function isValidBip39Phrase(words: readonly string[]): boolean {
  return words.length > 0 && words.every(isValidBip39Word)
}

const MAX_WORD_REPEATS = 4

export function hasRepeatedWords(words: readonly string[]): boolean {
  const counts: Record<string, number> = {}
  for (const word of words) {
    const w = word.trim().toLowerCase()
    if (!w) continue
    counts[w] = (counts[w] ?? 0) + 1
    if (counts[w] > MAX_WORD_REPEATS) return true
  }
  return false
}

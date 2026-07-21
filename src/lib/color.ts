// Deterministic donor-avatar color: same name/email always hashes to the same
// palette entry, so a donor's color stays stable across renders and sessions
// without needing to store it anywhere.
export function colorForDonor(nameOrEmail: string | null | undefined, palette: string[]): string {
  const str = (nameOrEmail || '').trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % palette.length
  return palette[index]
}

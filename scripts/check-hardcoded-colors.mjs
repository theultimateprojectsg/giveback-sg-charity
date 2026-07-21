// Flags hex color literals used outside src/theme.ts — the shared palette
// (`C` in theme.ts) exists so a color only has one home; a hand-typed hex
// code anywhere else is either a duplicate of an existing `C.xxx` value or
// a new brand color nobody added to the palette. Report-only for now: this
// codebase has ~150 pre-existing instances of this from before the palette
// existed, so blocking on it would fail CI on unrelated changes. Run
// `npm run check-colors` locally to see the current list, and prefer
// reusing/adding a `C.xxx` entry over a new hex literal in new code.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..', 'src')
const HEX_RE = /#[0-9A-Fa-f]{3,8}\b/g
// CharityAuth.tsx defines its own small local dark-mode palette (AUTH) at the
// top of the file, same rationale as excluding theme.ts.
const SKIP_FILES = new Set(['theme.ts', 'CharityAuth.tsx'])
const SKIP_DIRS = new Set(['__tests__', 'assets'])

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else if (/\.(ts|tsx)$/.test(entry) && !SKIP_FILES.has(entry)) files.push(full)
  }
  return files
}

let total = 0
for (const file of walk(root)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const matches = line.match(HEX_RE)
    if (matches) {
      total += matches.length
      console.log(`${relative(process.cwd(), file)}:${i + 1}  ${matches.join(', ')}`)
    }
  })
}

console.log(`\n${total} hardcoded hex color${total === 1 ? '' : 's'} found outside theme.ts`)
console.log('Not blocking — see comment at the top of this script for why.')

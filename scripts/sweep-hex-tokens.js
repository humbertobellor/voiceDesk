/**
 * sweep-hex-tokens.js
 *
 * Reusable Node.js CommonJS script that replaces hardcoded Tailwind hex arbitrary
 * values with Wolknitive design-system token utility classes.
 *
 * Usage:
 *   node scripts/sweep-hex-tokens.js file1.tsx file2.tsx ...
 *
 * Replacements are applied in priority order (longest / most-specific patterns first)
 * to prevent partial-match collisions (e.g. bg-[#EF4444]/10 before bg-[#EF4444]).
 *
 * After all replacements the script verifies no `[#` sequences remain in each file
 * and logs a WARN line for any that do, so manual review can handle edge cases.
 *
 * Used by Plans 16-03, 16-04, and 16-05 of the Wolknitive design-system sweep.
 */

'use strict'

const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Mapping table — longest / most-specific patterns first
// ---------------------------------------------------------------------------

/** @type {Array<[string, string]>} */
const REPLACEMENTS = [
  // 1. Opacity-modified danger (must come before bare danger)
  ['bg-[#EF4444]/10', 'bg-danger/10'],
  ['border-[#EF4444]/30', 'border-danger/30'],

  // 2. Opacity-modified highlight (must come before bare highlight)
  ['bg-[#F97316]/90', 'bg-highlight/90'],
  ['hover:bg-[#F97316]/90', 'hover:bg-highlight/90'],

  // 3. Hover states for elevated surface and rule
  ['hover:bg-[#1E293B]', 'hover:bg-bg-elevated'],
  ['hover:bg-[#334155]', 'hover:bg-rule'],

  // 4. Hover state for foreground on dark
  ['hover:text-[#F8FAFC]', 'hover:text-fg-on-dark'],

  // 5. Focus ring
  ['focus-visible:ring-[#F97316]', 'focus-visible:ring-accent'],

  // 6. Active nav border compound (border-l-4 + border color — must precede bare border)
  ['border-l-4 border-[#F97316]', 'border-l-4 border-highlight'],

  // 7. Background tokens
  ['bg-[#0F172A]', 'bg-bg'],
  ['bg-[#1E293B]', 'bg-bg-elevated'],
  ['bg-[#334155]', 'bg-rule'],

  // 8. Text tokens
  ['text-[#0F172A]', 'text-bg'],
  ['text-[#94A3B8]', 'text-fg-3'],
  ['text-[#CBD5E1]', 'text-fg-2'],
  ['text-[#F8FAFC]', 'text-fg-on-dark'],

  // 9. Foreground token used as background (e.g. bg-[#F8FAFC])
  ['bg-[#F8FAFC]', 'bg-fg-on-dark'],

  // 10. Highlight (orange accent: #F97316)
  ['text-[#F97316]', 'text-highlight'],
  ['bg-[#F97316]', 'bg-highlight'],
  ['border-[#F97316]', 'border-highlight'],

  // 11. Rule / border
  ['border-[#334155]', 'border-rule'],

  // 12. Danger (red: #EF4444)
  ['text-[#EF4444]', 'text-danger'],
  ['bg-[#EF4444]', 'bg-danger'],
  ['border-[#EF4444]', 'border-danger'],

  // 13. Success (green: #22C55E)
  ['text-[#22C55E]', 'text-success'],
  ['bg-[#22C55E]', 'bg-success'],
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** @param {string} filePath */
function sweepFile(filePath) {
  const abs = path.resolve(filePath)

  if (!fs.existsSync(abs)) {
    console.error(`SKIP  ${filePath} — file not found`)
    return
  }

  let content = fs.readFileSync(abs, 'utf8')
  let totalReplacements = 0

  for (const [from, to] of REPLACEMENTS) {
    const before = content
    // replaceAll requires Node 15+; use split/join for broader compatibility
    content = content.split(from).join(to)
    const count = (before.split(from).length - 1)
    if (count > 0) {
      totalReplacements += count
      console.log(`  ${count.toString().padStart(3)} replacement(s): ${from} → ${to}`)
    }
  }

  fs.writeFileSync(abs, content, 'utf8')
  console.log(`OK    ${filePath} — ${totalReplacements} total replacement(s)`)

  // Post-sweep verification
  if (content.includes('[#')) {
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      if (line.includes('[#')) {
        console.warn(`WARN  ${filePath}:${i + 1} — remaining [# pattern: ${line.trim()}`)
      }
    })
  }
}

const files = process.argv.slice(2)

if (files.length === 0) {
  console.error('Usage: node scripts/sweep-hex-tokens.js file1.tsx file2.tsx ...')
  process.exit(1)
}

console.log(`sweep-hex-tokens: processing ${files.length} file(s)\n`)
for (const f of files) {
  console.log(`--- ${f}`)
  sweepFile(f)
  console.log('')
}
console.log('sweep-hex-tokens: done')

// scripts/llms-generator.mjs
// Generates the agent-facing docs artifacts into the VitePress build output:
//   - llms.txt        page index, one entry per page with its description
//   - <route>.md      per-page markdown mirror, fetched selectively
//   - llms-full.txt   every page concatenated, for bulk ingestion
// Invoked from the buildEnd hook in docs/.vitepress/config.mts, so all three
// regenerate on every build and cannot drift from the published pages.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Absolute origin for links in llms.txt. Set DOCS_SITE_URL in the build
// environment to emit absolute URLs; left unset, links stay site-relative.
const SITE_URL = (process.env.DOCS_SITE_URL ?? '').replace(/\/$/, '')

function readPins() {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'pins.json'), 'utf8'))
  } catch {
    return null
  }
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { data: {}, body: raw }
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim()
  }
  return { data, body: raw.slice(m[0].length) }
}

// Walk the sidebar tree into a flat, ordered list of linked pages.
function flatten(sidebar) {
  const out = []
  for (const group of sidebar) {
    const section = group.text ?? 'Docs'
    const walk = (items, depth) => {
      for (const item of items ?? []) {
        if (item.link) out.push({ section, depth, text: item.text, link: item.link })
        if (item.items) walk(item.items, depth + 1)
      }
    }
    walk(group.items, 0)
  }
  return out
}

// Sidebar link ('/build/grafts/', '/build/anatomy') -> source markdown path.
function linkToFile(srcDir, link) {
  let p = link.replace(/^\//, '')
  if (p === '' || p.endsWith('/')) p += 'index'
  return join(srcDir, `${p}.md`)
}

// Sidebar link -> the .md route the per-page mirror is served at.
const mdRoute = (link) => (link.endsWith('/') ? `${link}index.md` : `${link}.md`)

const url = (route) => (SITE_URL ? SITE_URL + route : route)

export function generateLlms(siteConfig) {
  const { srcDir, outDir, site } = siteConfig
  const sidebar = site.themeConfig?.sidebar ?? []
  const entries = flatten(Array.isArray(sidebar) ? sidebar : [])
  const pins = readPins()

  let sha = 'unknown'
  try {
    sha = execSync('git rev-parse --short HEAD', { cwd: srcDir }).toString().trim()
  } catch {
    /* not a git checkout — provenance degrades to date only */
  }
  const date = new Date().toISOString().slice(0, 10)
  const pinStr = pins
    ? ` (${Object.entries(pins).map(([k, v]) => `${k} ${v}`).join(', ')})`
    : ''
  const provenance = `Generated ${date} from zkvesl-docs ${sha}${pinStr}.`

  // Read every page once, deduped (a dir link and its index resolve alike).
  const pages = []
  const seen = new Set()
  for (const e of entries) {
    const file = linkToFile(srcDir, e.link)
    if (seen.has(file)) continue
    seen.add(file)
    let parsed
    try {
      parsed = parseFrontmatter(readFileSync(file, 'utf8'))
    } catch {
      console.warn(`[llms] no source file for ${e.link}`)
      continue
    }
    pages.push({
      ...e,
      route: mdRoute(e.link),
      desc: parsed.data.description ?? '',
      body: parsed.body.trim(),
    })
  }

  // --- per-page .md mirror ---
  for (const p of pages) {
    const dest = join(outDir, p.route.replace(/^\//, ''))
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, `${p.body}\n`)
  }

  // --- llms.txt: indexed map, linking the per-page .md files ---
  const index = [
    `# ${site.title}`,
    '',
    `> ${site.description}`,
    '',
    'Documentation for vesl-nockup, the development environment for building',
    'nockapps. Each link below is a standalone markdown page — fetch only what',
    'you need. llms-full.txt holds every page concatenated for bulk ingestion.',
    '',
    provenance,
    '',
  ]
  let section = null
  for (const p of pages) {
    if (p.section !== section) {
      if (section !== null) index.push('')
      section = p.section
      index.push(`## ${section}`, '')
    }
    const pad = '  '.repeat(p.depth)
    index.push(`${pad}- [${p.text}](${url(p.route)})${p.desc ? `: ${p.desc}` : ''}`)
  }
  index.push('')
  writeFileSync(join(outDir, 'llms.txt'), index.join('\n'))

  // --- llms-full.txt: every page body, sidebar order ---
  const full = [
    `# ${site.title} — full documentation`,
    '',
    `> ${site.description}`,
    '',
    provenance,
    'Pages in sidebar order; cross-check source if your checkout is newer.',
  ]
  for (const p of pages) {
    full.push('', '='.repeat(80), `# Source: ${url(p.route)}`, '='.repeat(80), '', p.body)
  }
  full.push('')
  writeFileSync(join(outDir, 'llms-full.txt'), full.join('\n'))

  console.log(
    `[llms] wrote llms.txt, llms-full.txt, ${pages.length} per-page .md files to ${outDir}`,
  )
}

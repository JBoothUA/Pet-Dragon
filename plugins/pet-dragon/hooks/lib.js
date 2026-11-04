// Pure helpers for pet-dragon: no mods API here, so they can be tested with plain Node.

export const COLORS = {
  flame: '#ff7a1a',
  ember: '#ffb347',
  idle: '#e0242a',
  working: '#ffd23f',
  tool: '#36c5f0',
  waiting: '#ff4fd8',
  error: '#9a9a9a',
  unread: '#4da3ff',
  context: '#b388ff',
  green: '#3ddc84',
  teal: '#1de9b6',
  amber: '#ffc107',
  red: '#ff5252',
  grey: '#8a8a8a',
}

// What Dragon's color means. Order is priority: the first state that applies wins.
export const MOODS = {
  waiting: { color: COLORS.waiting, label: 'Needs you', short: 'Claude is waiting for your approval or answer' },
  error: { color: COLORS.error, label: 'Hit an error', short: 'The last turn ended with an API error' },
  tool: { color: COLORS.tool, label: 'Using a tool', short: 'Claude is running a tool' },
  working: { color: COLORS.working, label: 'Thinking', short: 'Claude is working on your request' },
  unread: { color: COLORS.unread, label: 'Unread messages', short: 'You have unread Outlook mail' },
  context: { color: COLORS.context, label: 'Context filling up', short: 'Context window is over the threshold; consider /compact' },
  idle: { color: COLORS.idle, label: 'Ready', short: 'Idle and waiting for your next prompt' },
}

export function pickMood({ session, unread, contextPct, contextWarn }) {
  if (session === 'waiting' || session === 'error' || session === 'tool' || session === 'working') return session
  if (unread > 0) return 'unread'
  if (typeof contextPct === 'number' && contextPct >= contextWarn) return 'context'
  return 'idle'
}

// Fixed parts of the Dragon mascot; R (body) takes the mood color and S (wings) is a darker shade of it.
export const PAL = { C: '#fff1d6', W: '#ffffff', k: '#111111', d: '#5c2b16', m: '#7a1010', o: '#111111', h: '#f2e6c9', s: '#ff9a3c' }

// Dragon, a winged dragon, as pixel grids: R = body, S = wings, h = horns, s = tail plate,
// C = cream belly, W/k = eye, m = mouth, d = feet, . = clear. A black outline is added around him
// when the module loads. Two pixel rows make one terminal row (half-blocks).
// Frame 2 (while Claude works) flaps the wings, lifts the tail, and steps the feet.
const BODY = [
  [
    '.S.S....h..h....',
    'SSSSS..RRRRR....',
    '.SSSSRRRWWRRR...',
    '..SSRRRRWkRRRRR.',
    '...RRRRRRRRmmmm.',
    'R..RRRRRCCCRR...',
    'RRRRRRRCCCCRR...',
    '.sRRRRRddRRdd...',
  ],
  [
    '....S...h..h....',
    '..SSS..RRRRR....',
    'SSSSSRRRWWRRR...',
    '.SSSRRRRWkRRRRR.',
    '..SRRRRRRRRmmmm.',
    'RR.RRRRRCCCRR...',
    '.RRRRRRRCCCCR...',
    '..sRRRRRRddRRdd.',
  ],
]
// Pads the grid by one pixel and marks every clear pixel that touches the sprite as outline (o).
export function outline(grid) {
  const at = (y, x) => grid[y - 1]?.[x - 1] ?? '.'
  const out = []
  for (let y = 0; y < grid.length + 2; y++) {
    let row = ''
    for (let x = 0; x < grid[0].length + 2; x++) {
      const c = at(y, x)
      const touches = [at(y - 1, x), at(y + 1, x), at(y, x - 1), at(y, x + 1)].some((v) => v !== '.')
      row += c !== '.' ? c : touches ? 'o' : '.'
    }
    out.push(row)
  }
  return out
}

export const FRAMES = BODY.map(outline)

export const SPRITE_WIDTH = FRAMES[0][0].length

export function shade(hex, f = 0.7) {
  return '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('')
}

// Turns a pixel grid into terminal rows of [{ text, color, backgroundColor }] runs.
// Each cell is an upper half-block: its foreground is the top pixel, its background the bottom one.
export function spriteRows(grid, body) {
  const dark = shade(body)
  const px = (ch) => (ch === 'R' ? body : ch === 'S' ? dark : PAL[ch])
  const rows = []
  for (let y = 0; y < grid.length; y += 2) {
    const runs = []
    for (let x = 0; x < grid[y].length; x++) {
      const top = px(grid[y][x])
      const bottom = px(grid[y + 1]?.[x])
      let cell
      if (!top && !bottom) cell = { text: ' ' }
      else if (top && !bottom) cell = { text: '\u2580', color: top }
      else if (!top) cell = { text: '\u2584', color: bottom }
      else cell = { text: '\u2580', color: top, backgroundColor: bottom }
      const last = runs[runs.length - 1]
      if (last && last.color === cell.color && last.backgroundColor === cell.backgroundColor) last.text += cell.text
      else runs.push(cell)
    }
    rows.push(runs)
  }
  return rows
}

export function parseJson(text) {
  if (!text) return undefined
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

export function ago(ms, now) {
  if (!ms) return 'never'
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return s + 's ago'
  if (s < 3600) return Math.round(s / 60) + 'm ago'
  return Math.round(s / 3600) + 'h ago'
}

// ---- Source results -> light. Each returns { color, value, short, detail[] } ----

export function coreApiLight(p, port) {
  if (!p) return { color: COLORS.grey, value: '?', short: 'CoreAPI probe failed to run', detail: [] }
  const detail = []
  if (p.dataSource) detail.push('Data Source=' + p.dataSource + ' (from ' + p.dataSourceFrom + ')')
  if (p.sqlService) detail.push('MSSQLSERVER service: ' + p.sqlService)
  detail.push('Docker SQL container: ' + (p.dockerSql === 'daemon-off' ? 'Docker not running' : p.dockerSql || 'none'))
  for (const ev of p.dbEvidence ?? []) detail.push('evidence: ' + ev)
  if (!p.up) return { color: COLORS.red, value: 'down', short: 'CoreAPI is not listening on :' + port, detail }
  const who = (p.process ?? 'process') + ' pid ' + p.pid
  if (p.db === 'local') return { color: COLORS.green, value: 'local db', short: 'CoreAPI up (' + who + ') \u2192 local SQL Server', detail }
  if (p.db === 'docker') return { color: COLORS.teal, value: 'docker db', short: 'CoreAPI up (' + who + ') \u2192 Docker SQL container', detail }
  if (p.db === 'remote') return { color: COLORS.amber, value: 'remote db', short: 'CoreAPI up (' + who + ') \u2192 a remote SQL Server', detail }
  return { color: COLORS.amber, value: 'db ?', short: 'CoreAPI up (' + who + '), could not tell which database', detail }
}

export function serviceLight(name, p, port) {
  if (!p) return { color: COLORS.grey, value: '?', short: name + ' probe failed to run', detail: [] }
  if (!p.up) return { color: COLORS.grey, value: 'off', short: name + ' is not running (nothing on :' + port + ')', detail: [] }
  return { color: COLORS.green, value: 'up', short: name + ' is running on :' + port + ' (' + (p.process ?? 'process') + ' pid ' + p.pid + ')', detail: [] }
}

export function jiraLight(json) {
  const issues = json?.data?.issues
  if (!Array.isArray(issues)) return { color: COLORS.grey, value: '?', short: 'Could not read Jira (is twg logged in?)', detail: [] }
  const detail = issues.map((i) => i.key + '  ' + (i.status?.name ?? '') + '  ' + (i.summary ?? ''))
  const inReview = issues.filter((i) => /review/i.test(i.status?.name ?? '')).length
  const short = issues.length + ' open issue(s) assigned to you' + (inReview ? ', ' + inReview + ' in review' : '')
  return { color: issues.length ? COLORS.unread : COLORS.green, value: String(issues.length), short, detail }
}

export function prLight(json) {
  const prs = json?.data?.pullRequests
  if (!Array.isArray(prs)) return { color: COLORS.grey, value: '?', short: 'Could not read Bitbucket PRs (is twg logged in?)', detail: [] }
  const detail = prs.map((p) => p.title + ' (' + (p.ageDays ?? '?') + 'd, ' + (p.commentCount ?? 0) + ' comments)')
  const short = prs.length ? prs.length + ' open PR(s) you authored' : 'You have no open PRs'
  return { color: prs.length ? COLORS.teal : COLORS.green, value: String(prs.length), short, detail }
}

export function outlookLight(m) {
  if (!m) return { color: COLORS.grey, value: '?', short: 'Mail probe failed to run', detail: [] }
  if (m.outlook === 'new-outlook') return { color: COLORS.grey, value: 'n/a', short: 'New Outlook has no local API; switch to classic Outlook', detail: [] }
  if (m.outlook === 'off') return { color: COLORS.grey, value: 'off', short: 'Classic Outlook is not running', detail: [] }
  if (m.outlook === 'error') return { color: COLORS.amber, value: '?', short: 'Outlook is running but could not be read', detail: [m.outlookError ?? ''] }
  const n = m.outlookUnread ?? 0
  return { color: n ? COLORS.unread : COLORS.green, value: String(n), short: n ? n + ' unread email(s) in your Inbox' : 'Inbox is all read', detail: [] }
}

export function teamsLight(m) {
  if (!m) return { color: COLORS.grey, value: '?', short: 'Teams probe failed to run', detail: [] }
  if (m.teams === 'on') return { color: COLORS.green, value: 'running', short: 'Teams is running', detail: [] }
  return { color: COLORS.grey, value: 'off', short: 'Teams is not running', detail: [] }
}

// ---- Skill suggestions ----

const STOP = new Set(
  ('a an and are as at be but by can could do does for from get got have how i if in into is it its just like make me my need ' +
    'not of on or our please should so some than that the their them then there these this those to too up us use using want was ' +
    'we what when where which while who why will with would you your yours also any all more most other such only own same very ' +
    'help work working task tasks code thing things stuff create add new file files change changes look looking let lets sure')
    .split(' '),
)

// Short tokens that still carry meaning in this repo
const SHORT_OK = new Set(['pr', 'prs', 'ui', 'db', 'ef', 'k6', 'api', 'bff', 'sql', 'msw', 'rtk', 'dto', 'jest', 'jira', 'yup', 'mui', 'ci'])

function stem(w) {
  let s = w
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3)
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2)
  else if (s.length > 4 && s.endsWith('es')) s = s.slice(0, -2)
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1)
  // "prepare"/"preparing" and "migrate"/"migrated" should meet in the middle
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1)
  return s
}

export function tokenize(text) {
  const out = new Set()
  for (const raw of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue
    if (raw.length < 4 && !SHORT_OK.has(raw)) continue
    out.add(stem(raw))
  }
  return out
}

export function indexSkills(commands, ownPlugin) {
  return commands
    .filter((c) => c.source !== 'builtin' && c.source !== 'mcp' && c.plugin !== ownPlugin && c.name !== 'dragon')
    .map((c) => ({
      name: c.name,
      description: c.description ?? '',
      nameWords: tokenize(c.name.replace(/^c3-|^twg-/, '')),
      descWords: tokenize(c.description ?? ''),
    }))
}

// A skill-name word scores 3, a description word 1. The default minimum of 2 means one name hit
// or two description hits.
export function suggestSkills(prompt, skills, { max = 2, minScore = 2, exclude = new Set() } = {}) {
  const words = tokenize(prompt)
  if (words.size === 0) return []
  const lower = String(prompt).toLowerCase()
  const scored = []
  for (const s of skills) {
    if (exclude.has(s.name)) continue
    // Already asked for by name: no need to suggest it
    if (lower.includes(s.name.toLowerCase())) continue
    let score = 0
    const hits = []
    for (const w of words) {
      if (s.nameWords.has(w)) {
        score += 3
        hits.push(w)
      } else if (s.descWords.has(w)) {
        score += 1
        hits.push(w)
      }
    }
    if (score >= minScore) scored.push({ name: s.name, description: s.description, score, hits })
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return scored.slice(0, max)
}

export function shorten(text, n) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '\u2026' : t
}

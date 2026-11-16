// Pure helpers for pet-dragon: no mods API here, so they can be tested with plain Node.

export const COLORS = {
  ember: '#ffb347',
  idle: '#e0242a',
  working: '#ffd23f',
  tool: '#36c5f0',
  waiting: '#ff4fd8',
  error: '#a1887f',
  unread: '#3d6bff',
  context: '#b388ff',
  typing: '#ff7a1a',
  sleepy: '#6c7a9c',
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
  typing: { color: COLORS.typing, label: 'Listening to you', short: 'You are typing or dictating a prompt' },
  sleepy: { color: COLORS.sleepy, label: 'Asleep', short: 'Nothing has happened for a while; type to wake the dragon' },
  unread: { color: COLORS.unread, label: 'Unread messages', short: 'You have unread Outlook mail' },
  context: { color: COLORS.context, label: 'Context filling up', short: 'Context window is over the threshold; consider /compact' },
  idle: { color: COLORS.idle, label: 'Ready', short: 'Idle and waiting for your next prompt' },
}

// idleMs / sleepyAfterMs are optional: a caller that omits them never gets the sleepy mood.
export function pickMood({ session, typing, unread, contextPct, contextWarn, idleMs, sleepyAfterMs }) {
  if (session === 'waiting' || session === 'error' || session === 'tool' || session === 'working') return session
  if (typing) return 'typing'
  // Asleep beats the quiet moods: standing unread mail must not keep the dragon awake forever
  if (typeof idleMs === 'number' && typeof sleepyAfterMs === 'number' && sleepyAfterMs > 0 && idleMs >= sleepyAfterMs) return 'sleepy'
  if (unread > 0) return 'unread'
  if (typeof contextPct === 'number' && contextPct >= contextWarn) return 'context'
  return 'idle'
}

// Fixed parts of the Dragon mascot; R (body) takes the mood color and S (wings) is a darker shade of it.
export const PAL = { C: '#fff1d6', W: '#ffffff', k: '#111111', d: '#b5602c', m: '#7a1010', o: '#111111', h: '#f2e6c9', s: '#ff9a3c', p: '#ff9eb5', n: '#111111' }

// Dragon, front view, as pixel grids: R = body, S = wings, h = horns and crest,
// C = cream belly, W/k = eye white and pupil, n = nostril, m = mouth, d = feet, . = clear.
// 16x12 grids, no outline: near-black pixels vanish on a dark terminal and read as blank gaps.
// Two pixel rows make one terminal row (half-blocks). The spare row lets the body bob a pixel.
// MIDDLE is the body without wings (cols 4-11); each wing pose is the left wing's four columns per row.
const MIDDLE = [
  'h..hh..h',
  'hhRRRRhh',
  'RRRRRRRR',
  'RWkRRWkR',
  'RRRRRRRR',
  '.RnRRnR.',
  '..RmmR..',
  '.RRCCRR.',
  '.RRCCRR.',
  '.RCCCCR.',
  '.dd..dd.',
]
const WING_UP = ['S...', 'SS..', 'SSS.', '.SSS', '..SS', '...S', '....', '....', '....', '....', '....']
const WING_LEVEL = ['....', '....', '....', 'S...', 'SSS.', 'SSSS', '.SSS', '..SS', '...S', '....', '....']
const WING_DOWN = ['....', '....', '....', '....', '....', '....', '...S', '.SSS', 'SSSS', 'SSS.', 'SS..']

// Asleep: the eye row becomes closed lids (no eye white)
const SLEEP_MIDDLE = MIDDLE.map((m, y) => (y === 3 ? 'RkkRRkkR' : m))

const mirror = (s) => [...s].reverse().join('')

// lifted = body one pixel row higher (the downstroke), otherwise one row lower
function pose(wing, lifted, middle = MIDDLE) {
  const rows = middle.map((m, y) => wing[y] + m + mirror(wing[y]))
  const blank = '.'.repeat(rows[0].length)
  return lifted ? [...rows, blank] : [blank, ...rows]
}

// Resting pose, and the flap cycle while Claude works: the body rises as the wings come down.
export const IDLE = pose(WING_LEVEL, false)
export const FLAP = [pose(WING_UP, false), pose(WING_LEVEL, false), pose(WING_DOWN, true), pose(WING_LEVEL, true)]
export const SLEEP = pose(WING_DOWN, false, SLEEP_MIDDLE)
export const FLAP_MS = 200

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

export const SPRITE_WIDTH = IDLE[0].length

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

// Like parseJson, but also accepts a top-level array (twg's pipeline query prints one)
export function parseJsonAny(text) {
  if (!text) return undefined
  const a = text.indexOf('[')
  const o = text.indexOf('{')
  if (a >= 0 && (o < 0 || a < o)) {
    const end = text.lastIndexOf(']')
    if (end > a) {
      try {
        return JSON.parse(text.slice(a, end + 1))
      } catch {
        return undefined
      }
    }
  }
  return parseJson(text)
}

export function ago(ms, now) {
  if (!ms) return 'never'
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return s + 's ago'
  if (s < 3600) return Math.round(s / 60) + 'm ago'
  return Math.round(s / 3600) + 'h ago'
}

// ---- Source results -> light. Each returns { color, value, short, detail[] } ----
// A detail entry is a string, or { text, url } when the line has somewhere to go (the pane makes it a link).
// A light may also carry `url`: where pressing the light goes instead of its default.
export const link = (text, url) => (url ? { text, url } : text)
export const detailText = (d) => (typeof d === 'string' ? d : d.text)

export function coreApiLight(p, port) {
  if (!p) return { color: COLORS.grey, value: '?', short: 'CoreAPI probe failed to run', detail: [] }
  const detail = [link('Swagger: http://localhost:' + port + '/swagger', 'http://localhost:' + port + '/swagger')]
  if (p.up) {
    detail.push('Process: ' + (p.process ?? '?') + ' pid ' + p.pid + (p.startTime ? ', started ' + p.startTime : ''))
    if (p.exePath) detail.push('Exe: ' + p.exePath)
  }
  detail.push('Repo root: ' + (p.repoRoot || 'not found (config could not be read)'))
  if (p.dataSource) detail.push('Data Source=' + p.dataSource + ' (from ' + p.dataSourceFrom + ')')
  else detail.push('Data Source: not found in appsettings, user secrets or env')
  detail.push('MSSQLSERVER service: ' + (p.sqlService ?? 'not installed'))
  detail.push('Docker SQL container: ' + (p.dockerSql === 'daemon-off' ? 'Docker not running' : p.dockerSql || 'none'))
  for (const ev of p.dbEvidence ?? []) detail.push('evidence: ' + ev)
  if (!p.up) return { color: COLORS.red, value: 'down', short: 'CoreAPI is not listening on :' + port, detail }
  const who = (p.process ?? 'process') + ' pid ' + p.pid
  if (p.db === 'local') return { color: COLORS.green, value: 'local db', short: 'CoreAPI up (' + who + ') \u2192 local SQL Server', detail }
  if (p.db === 'docker') return { color: COLORS.teal, value: 'docker db', short: 'CoreAPI up (' + who + ') \u2192 Docker SQL container', detail }
  if (p.db === 'remote') return { color: COLORS.amber, value: 'remote db', short: 'CoreAPI up (' + who + ') \u2192 a remote SQL Server', detail }
  return { color: COLORS.amber, value: 'db ?', short: 'CoreAPI up (' + who + '), could not tell which database', detail }
}

// page: where the service is served (default: its Swagger page over https)
export function serviceLight(name, p, port, page) {
  if (!p) return { color: COLORS.grey, value: '?', short: name + ' probe failed to run', detail: [] }
  const url = page ?? 'https://localhost:' + port + '/swagger'
  const detail = [link((page ? 'Open: ' : 'Swagger: ') + url, url)]
  if (!p.up) return { color: COLORS.grey, value: 'off', short: name + ' is not running (nothing on :' + port + ')', detail }
  detail.push('Process: ' + (p.process ?? '?') + ' pid ' + p.pid)
  return { color: COLORS.green, value: 'up', short: name + ' is running on :' + port + ' (' + (p.process ?? 'process') + ' pid ' + p.pid + ')', detail }
}

export function jiraLight(json) {
  const issues = json?.data?.issues
  if (!Array.isArray(issues)) return { color: COLORS.grey, value: '?', short: 'Could not read Jira (is twg logged in?)', detail: [] }
  const detail = issues.map((i) => link(i.key + '  ' + (i.status?.name ?? '') + '  ' + (i.summary ?? ''), i.url))
  const brief = issues.map((i) => i.key + ' ' + (i.status?.name ?? '?'))
  const inReview = issues.filter((i) => /review/i.test(i.status?.name ?? '')).length
  const short = issues.length + ' open issue(s) assigned to you' + (inReview ? ', ' + inReview + ' in review' : '')
  return { color: issues.length ? COLORS.unread : COLORS.green, value: String(issues.length), short, detail, brief }
}

// repoId: only PRs in that Bitbucket repo are counted (twg returns every repo you authored in); empty counts all.
export function prLight(json, repoId) {
  const all = json?.data?.pullRequests
  if (!Array.isArray(all)) return { color: COLORS.grey, value: '?', short: 'Could not read Bitbucket PRs (is twg logged in?)', detail: [] }
  const prs = repoId ? all.filter((p) => p.repo?.id === repoId) : all
  const others = all.length - prs.length
  const detail = prs.map((p) => {
    const reviewers = Array.isArray(p.reviewers) ? p.reviewers.length : 0
    return link(p.title + ' (' + (p.ageDays ?? '?') + 'd, ' + (p.commentCount ?? 0) + ' comments, ' + reviewers + ' reviewer(s), ' + (p.sourceBranch ?? '?') + ' → ' + (p.destinationBranch ?? '?') + ')', p.url)
  })
  if (others > 0) detail.push(others + ' more open PR(s) in other repos are not counted')
  const brief = prs.map((p) => {
    // The title starts with the ticket number; reviews are what moves a PR, so the status is its comment count
    return String(p.title ?? '').slice(0, 8).trim() + ' ' + (p.commentCount ?? 0) + 'c'
  })
  const short = prs.length ? prs.length + ' open PR(s) you authored in phoenix' : 'You have no open PRs in phoenix'
  return { color: prs.length ? COLORS.teal : COLORS.green, value: String(prs.length), short, detail, brief }
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

// ---- Repo lights: git, pipeline, tests, Seq ----

// Reads `git status --porcelain=v2 --branch`
export function parseGitStatus(text) {
  if (typeof text !== 'string' || !text.includes('# branch.head')) return undefined
  const out = { branch: '', upstream: '', ahead: 0, behind: 0, changed: 0, untracked: 0, paths: [] }
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('# branch.head ')) out.branch = line.slice(14).trim()
    else if (line.startsWith('# branch.upstream ')) out.upstream = line.slice(18).trim()
    else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line)
      if (m) {
        out.ahead = Number(m[1])
        out.behind = Number(m[2])
      }
    } else if (line.startsWith('1 ')) {
      out.changed++
      out.paths.push(line.split(' ').slice(8).join(' '))
    } else if (line.startsWith('2 ')) {
      out.changed++
      out.paths.push(line.split(' ').slice(9).join(' ').split('\t')[0])
    } else if (line.startsWith('u ')) {
      out.changed++
      out.paths.push(line.split(' ').slice(10).join(' '))
    } else if (line.startsWith('? ')) {
      out.untracked++
      out.paths.push(line.slice(2))
    }
  }
  return out
}

// repo: workspace/repo, so the branch line can link to the branch on Bitbucket
export function gitLight(g, repo) {
  if (!g) return { color: COLORS.grey, value: '?', short: 'Not a git repository (or git failed)', detail: [], paths: [] }
  const dirty = g.changed + g.untracked
  const bits = []
  if (dirty) bits.push(dirty + '~')
  if (g.ahead) bits.push('↑' + g.ahead)
  if (g.behind) bits.push('↓' + g.behind)
  const detail = [
    link('Branch: ' + g.branch + (g.upstream ? ' → ' + g.upstream : ' (no upstream)'), repo && g.upstream ? 'https://bitbucket.org/' + repo + '/branch/' + encodeURIComponent(g.branch) : undefined),
    g.changed + ' changed, ' + g.untracked + ' untracked, ' + g.ahead + ' ahead, ' + g.behind + ' behind',
  ]
  const short = g.branch + ': ' + (bits.length ? [dirty ? dirty + ' uncommitted' : '', g.ahead ? g.ahead + ' to push' : '', g.behind ? g.behind + ' behind upstream' : ''].filter(Boolean).join(', ') : 'clean and in sync')
  const color = g.behind ? COLORS.amber : dirty || g.ahead ? COLORS.teal : COLORS.green
  return { color, value: bits.length ? bits.join(' ') : 'clean', short, detail, branch: g.branch, paths: g.paths.slice(0, 200) }
}

// twg bb pipeline query -o json prints an array of pipeline runs, newest first
// repo: workspace/repo, so each run (and the light itself) can link to its page on Bitbucket
export function pipelineLight(runs, branch, repo, anyBranch) {
  if (!Array.isArray(runs)) return { color: COLORS.grey, value: '?', short: 'Could not read Bitbucket Pipelines (is twg logged in?)', detail: [] }
  const where = anyBranch ? ' on ' + (runs[0]?.target?.ref_name ?? 'another branch') + ' (none on ' + branch + ')' : branch ? ' on ' + branch : ''
  if (runs.length === 0) return { color: COLORS.grey, value: 'none', short: 'No pipeline runs' + where, detail: [] }
  const r = runs[0]
  const state = r.state?.name ?? ''
  const result = r.state?.result?.name ?? ''
  const runUrl = (x) => (repo ? 'https://bitbucket.org/' + repo + '/pipelines/results/' + x.build_number : undefined)
  const detail = runs.slice(0, 5).map((x) => link('#' + x.build_number + '  ' + (x.state?.result?.name ?? x.state?.name ?? '?') + '  ' + (x.created_on ?? '').slice(0, 16).replace('T', ' '), runUrl(x)))
  const url = runUrl(r)
  const tag = '#' + r.build_number
  if (state === 'COMPLETED' && result === 'SUCCESSFUL') return { color: COLORS.green, value: 'passed', short: 'Latest pipeline ' + tag + where + ' passed', detail, build: r.build_number, url }
  if (state === 'COMPLETED' && result === 'STOPPED') return { color: COLORS.grey, value: 'stopped', short: 'Latest pipeline ' + tag + where + ' was stopped', detail, build: r.build_number, url }
  if (state === 'COMPLETED') return { color: COLORS.red, value: 'failed', short: 'Latest pipeline ' + tag + where + ' ' + (result || 'failed').toLowerCase(), detail, build: r.build_number, url }
  return { color: COLORS.working, value: 'running', short: 'Pipeline ' + tag + where + ' is ' + (state || 'running').toLowerCase().replace('_', ' '), detail, build: r.build_number, url }
}

// A Bash tool result has no exit code, so a test run is read off the runner's own summary line.
const TEST_COMMAND = /\b(dotnet\s+test|npm\s+(run\s+)?test|npx\s+jest|jest|k6\s+run|playwright\s+test|vitest)\b/i

export function isTestCommand(command) {
  return TEST_COMMAND.test(String(command ?? ''))
}

// Returns { runner, passed, failed } or undefined when the output has no recognizable summary.
export function parseTestRun(command, output) {
  const text = String(output ?? '')
  const cmd = String(command ?? '')
  let m
  if (/dotnet\s+test/i.test(cmd) && (m = /(Passed|Failed)!\s*-\s*Failed:\s*(\d+),\s*Passed:\s*(\d+)/i.exec(text))) {
    return { runner: 'dotnet', passed: Number(m[3]), failed: Number(m[2]) }
  }
  if (/k6\s+run/i.test(cmd)) {
    if (/some thresholds have failed|level=error/i.test(text)) return { runner: 'k6', passed: 0, failed: 1 }
    if (/http_req_duration|checks[.\s]/i.test(text)) return { runner: 'k6', passed: 1, failed: 0 }
    return undefined
  }
  if ((m = /Tests:\s+(?:(\d+)\s+failed,\s+)?(?:\d+\s+skipped,\s+)?(?:\d+\s+todo,\s+)?(\d+)\s+passed/i.exec(text))) {
    return { runner: 'jest', passed: Number(m[2]), failed: Number(m[1] ?? 0) }
  }
  if ((m = /Tests:\s+(\d+)\s+failed/i.exec(text))) return { runner: 'jest', passed: 0, failed: Number(m[1]) }
  if ((m = /(\d+)\s+passed/i.exec(text)) && /playwright/i.test(cmd)) {
    const f = /(\d+)\s+failed/i.exec(text)
    return { runner: 'playwright', passed: Number(m[1]), failed: Number(f?.[1] ?? 0) }
  }
  return undefined
}

export function testLight(run, command) {
  if (!run) return { color: COLORS.grey, value: 'not run', short: 'No test run seen yet. This light shows the result of tests Claude runs in this session (dotnet test, jest, k6, playwright); it is not a CI result', detail: [] }
  const detail = [run.runner + ': ' + run.passed + ' passed, ' + run.failed + ' failed', command ? 'Command: ' + shorten(command, 100) : ''].filter(Boolean)
  if (run.failed > 0) return { color: COLORS.red, value: run.failed + ' fail', short: run.runner + ' run: ' + run.failed + ' failed, ' + run.passed + ' passed', detail }
  return { color: COLORS.green, value: run.passed + ' pass', short: run.runner + ' run: ' + run.passed + ' passed', detail }
}

// events: Seq's /api/events array, newest first. windowMinutes only words the message; Seq filters by time.
// seqUrl: where Seq is served, so an event line (and the light) can open it in Seq
export function seqLight(events, windowMinutes, limit, seqUrl) {
  if (!Array.isArray(events)) return { color: COLORS.grey, value: 'off', short: 'Seq did not answer. Seq is the local log viewer the APIs write errors to; start it to see local API errors here (not a problem if you do not use it)', detail: [] }
  const n = events.length
  const label = n >= limit ? n + '+' : String(n)
  if (n === 0) return { color: COLORS.green, value: '0', short: 'No errors in Seq in the last ' + windowMinutes + ' minutes', detail: [] }
  const base = seqUrl ? String(seqUrl).replace(/\/+$/, '') + '/#/events?filter=' : undefined
  const detail = events.slice(0, 8).map((e) =>
    link((e.Timestamp ?? '').slice(11, 19) + '  ' + shorten(e.RenderedMessage ?? e.MessageTemplate ?? JSON.stringify(e.Properties ?? {}), 110), base && e.Id ? base + encodeURIComponent("@Id = '" + e.Id + "'") : undefined),
  )
  const url = base ? base + encodeURIComponent("@Level in ['Error', 'Fatal']") : undefined
  return { color: COLORS.red, value: label, short: label + ' error(s) in Seq in the last ' + windowMinutes + ' minutes', detail, url }
}

// ---- Release radar and branch drift ----

const TICKET = /\b(?:C3|PHX)-\d+\b/g

export function ticketsIn(subjects) {
  const seen = new Set()
  for (const t of subjects ?? []) for (const m of String(t).match(TICKET) ?? []) if (!/-0+$/.test(m)) seen.add(m)
  return [...seen]
}

// Newest of origin/release/<kind>/<version> branches, compared numerically (1.35.0 beats 1.9.0)
export function newestRelease(branches) {
  const ver = (b) => (/(\d+(?:\.\d+)*)$/.exec(b)?.[1] ?? '0').split('.').map(Number)
  const best = (branches ?? []).map((b) => b.trim()).filter(Boolean)
  best.sort((a, b) => {
    const x = ver(a)
    const y = ver(b)
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
    return 0
  })
  return best[best.length - 1]
}

const releaseName = (b) => String(b ?? '').replace(/^origin\//, '').replace(/^release\/(prod|next)\//, '')

// r = { prod, next, nextCommits, devCommits, prodAt, devAt }: commit subjects between prod..next and next..development
export function radarLight(r, jiraBase) {
  if (!r || !r.prod) return { color: COLORS.grey, value: '?', short: 'Could not read release branches (no origin/release/prod/* found; fetch?)', detail: [] }
  const base = jiraBase ?? 'https://keyjira.atlassian.net/browse/'
  const prod = releaseName(r.prod)
  const next = r.next ? releaseName(r.next) : undefined
  const nextT = ticketsIn(r.nextCommits)
  const devT = ticketsIn(r.devCommits).filter((t) => !nextT.includes(t))
  const nextN = (r.nextCommits ?? []).length
  const devN = (r.devCommits ?? []).length
  const parts = ['Production runs ' + prod + (r.prodAt ? ' (cut ' + r.prodAt.slice(0, 10) + ')' : '')]
  if (next) parts.push(next + ' is next: ' + nextT.length + ' ticket(s), ' + nextN + ' commit(s)')
  parts.push('development has ' + devT.length + ' more ticket(s), ' + devN + ' commit(s)' + (next ? ' since the ' + next + ' cut' : ''))
  const detail = [
    'Prod ' + prod + '  →  Next ' + (next ?? 'none') + ' (+' + nextT.length + ' tickets)  →  development (+' + devT.length + ' tickets)',
    r.devAt ? 'development last changed ' + r.devAt.slice(0, 16).replace('T', ' ') + 'Z' : '',
    ...nextT.slice(0, 8).map((t) => link('in ' + (next ?? 'next') + ': ' + t, base + t)),
    nextT.length > 8 ? '…and ' + (nextT.length - 8) + ' more in ' + next : '',
  ].filter(Boolean)
  return { color: COLORS.teal, value: prod, short: parts.join('. '), detail, brief: ['prod ' + prod, (next ?? '-') + ' +' + nextT.length, 'dev +' + devT.length] }
}

// d = { branch, behind, overlap: [paths] }: behind = commits on origin/development you do not have;
// overlap = files you changed that development also changed since you branched
export function driftLight(d) {
  if (!d) return { color: COLORS.grey, value: '?', short: 'Could not compare with origin/development', detail: [] }
  const o = d.overlap ?? []
  const detail = [d.behind + ' commit(s) behind origin/development', o.length + ' of your changed file(s) also changed on development']
  for (const f of o.slice(0, 8)) detail.push(f)
  if (o.length > 8) detail.push('…and ' + (o.length - 8) + ' more')
  if (o.length) return { color: COLORS.red, value: d.behind + '↓ ' + o.length + ' clash', short: o.length + ' file(s) you changed were also changed on development (' + o.slice(0, 3).join(', ') + (o.length > 3 ? ', …' : '') + '). Expect a merge conflict; consider merging development now', detail }
  if (d.behind) return { color: COLORS.amber, value: d.behind + '↓', short: d.branch + ' is ' + d.behind + ' commit(s) behind origin/development, but none of your changed files overlap', detail }
  return { color: COLORS.green, value: 'synced', short: d.branch + ' has everything on origin/development', detail }
}

// PRs where you are a reviewer (twg prs query --role reviewer). Old ones turn red: you are the blocker.
export function reviewLight(json, repoId) {
  const all = json?.data?.pullRequests
  if (!Array.isArray(all)) return { color: COLORS.grey, value: '?', short: 'Could not read PRs waiting on your review (is twg logged in?)', detail: [] }
  const prs = repoId ? all.filter((p) => p.repo?.id === repoId) : all
  if (prs.length === 0) return { color: COLORS.green, value: '0', short: 'No open PRs are waiting on your review', detail: [] }
  const stale = prs.filter((p) => Number(p.ageDays) >= 3).length
  const detail = prs.map((p) => link(p.title + ' (' + (p.ageDays ?? '?') + 'd old, ' + (p.commentCount ?? 0) + ' comments)', p.url))
  const short = prs.length + ' open PR(s) waiting on your review' + (stale ? ', ' + stale + ' older than 3 days' : '')
  return { color: stale ? COLORS.red : COLORS.amber, value: String(prs.length), short, detail, brief: prs.map((p) => String(p.title ?? '').slice(0, 8).trim() + ' ' + (p.ageDays ?? '?') + 'd') }
}

// lines: "author|subject" from `git log origin/development --first-parent`, merged since local midnight
export function mergedLight(lines) {
  if (!Array.isArray(lines)) return { color: COLORS.grey, value: '?', short: 'Could not read origin/development history', detail: [] }
  const rows = lines
    .map((l) => {
      const i = l.indexOf('|')
      const who = l.slice(0, i)
      const subj = l.slice(i + 1)
      const pr = /pull request #(\d+)/.exec(subj)?.[1]
      const key = /\b(?:C3|PHX)-\d+\b/.exec(subj)?.[0]
      return { who, key, pr, subj }
    })
    .filter((r) => r.who)
  if (rows.length === 0) return { color: COLORS.grey, value: '0', short: 'Nothing has merged into development yet today', detail: [] }
  const people = new Set(rows.map((r) => r.who))
  const detail = rows.slice(0, 10).map((r) => r.who + '  ' + (r.key ?? shorten(r.subj, 60)) + (r.pr ? '  #' + r.pr : ''))
  if (rows.length > 10) detail.push('…and ' + (rows.length - 10) + ' more')
  return { color: COLORS.teal, value: String(rows.length), short: rows.length + ' PR(s) merged into development today by ' + people.size + ' people (' + [...people].slice(0, 4).join(', ') + (people.size > 4 ? ', …' : '') + ')', detail }
}

// open = Jira issues in the next release that are not Done: { issues: [{ key, status, summary, url }], total }
export function shipLight(open, nextName, total) {
  if (!Array.isArray(open)) return { color: COLORS.grey, value: '?', short: 'Could not check ' + (nextName ?? 'next release') + ' tickets in Jira (is twg logged in?)', detail: [] }
  if (open.length === 0) return { color: COLORS.green, value: 'clear', short: 'All ' + total + ' ticket(s) in ' + nextName + ' are Done in Jira', detail: [] }
  const detail = open.slice(0, 10).map((i) => link(i.key + '  ' + (i.status?.name ?? '?') + '  ' + shorten(i.summary, 70), i.url))
  if (open.length > 10) detail.push('…and ' + (open.length - 10) + ' more')
  const by = {}
  for (const i of open) by[i.status?.name ?? '?'] = (by[i.status?.name ?? '?'] ?? 0) + 1
  const mix = Object.entries(by).sort((x, y) => y[1] - x[1]).map(([k, v]) => v + ' ' + k).join(', ')
  detail.unshift(mix)
  return { color: COLORS.amber, value: open.length + ' open', short: open.length + ' of ' + total + ' ticket(s) in ' + nextName + ' are not Done in Jira yet (' + mix + ')', detail, brief: open.slice(0, 6).map((i) => i.key + ' ' + (i.status?.name ?? '?')) }
}

// ---- Standup ----

// Local calendar day as YYYY-MM-DD (what Jira's JQL and twg's --updated-since take)
export function localDay(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// Start of the previous working day, local time: yesterday, or Friday when today is Monday (or the weekend)
export function standupSince(now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const back = now.getDay() === 1 ? 3 : now.getDay() === 0 ? 2 : 1
  d.setDate(d.getDate() - back)
  return d
}

// since: a Date; issues from the Jira query, prs from `twg prs query`, commits as `sha subject` lines.
// Compact on purpose: a table per source, empty sources collapse to one line, commits show a count and the newest few.
export function formatStandup({ since, issues, prs, commits, repoId }) {
  const day = since.toISOString().slice(0, 10)
  const lines = ['Standup since ' + day]
  const pad = (v, n) => String(v).padEnd(n)
  const jira = Array.isArray(issues) ? issues : undefined
  if (!jira) lines.push('Jira: could not read (is twg logged in?)')
  else if (jira.length === 0) lines.push('Jira: nothing updated')
  else {
    lines.push('Jira (' + jira.length + ')')
    const w = Math.max(...jira.map((i) => String(i.status?.name ?? '?').length))
    const kw = Math.max(...jira.map((i) => String(i.key).length)) + 2
    for (const i of jira) lines.push('  ' + pad(i.key, kw) + pad(i.status?.name ?? '?', w + 2) + shorten(i.summary, 60))
  }
  const all = Array.isArray(prs) ? (repoId ? prs.filter((p) => p.repo?.id === repoId) : prs) : undefined
  if (!all) lines.push('PRs: could not read (is twg logged in?)')
  else if (all.length === 0) lines.push('PRs: nothing updated')
  else {
    lines.push('PRs (' + all.length + ')')
    for (const p of all) lines.push('  ' + pad(String(p.state ?? '?').toLowerCase(), 9) + shorten(p.title, 60) + (p.commentCount ? '  (' + p.commentCount + ' comments)' : ''))
  }
  if (!commits) lines.push('Commits: could not read git log')
  else if (commits.length === 0) lines.push('Commits: none')
  else {
    lines.push('Commits (' + commits.length + ')')
    for (const c of commits.slice(0, 3)) lines.push('  ' + shorten(c, 70))
    if (commits.length > 3) lines.push('  …and ' + (commits.length - 3) + ' more')
  }
  return lines.join('\n')
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

// Which skill a path points at. Only skills that are actually installed are ever suggested.
export const PATH_RULES = [
  { re: /(^|[\\/])phoenix-ui[\\/].*\.(test|spec)\.tsx?$/i, skills: ['c3-testing-frontend', 'c3-frontend'] },
  { re: /(^|[\\/])phoenix-ui[\\/]/i, skills: ['c3-frontend'] },
  { re: /(^|[\\/])bff[\\/].*UnitTests/i, skills: ['c3-testing-backend', 'c3-bff'] },
  { re: /(^|[\\/])bff[\\/]/i, skills: ['c3-bff'] },
  { re: /(^|[\\/])core-api[\\/]MainDBMigrations/i, skills: ['c3-database'] },
  { re: /(^|[\\/])core-api[\\/].*UnitTests/i, skills: ['c3-testing-backend', 'c3-backend'] },
  { re: /(^|[\\/])(core-api|ingestion|movedocs|workflow-engine|shared)[\\/]/i, skills: ['c3-backend'] },
  { re: /(^|[\\/])open-api[\\/]/i, skills: ['c3-codegen'] },
  { re: /(^|[\\/])automation[\\/]/i, skills: ['c3-performance'] },
]

// Paths -> Map(skill name -> number of paths pointing at it)
export function pathSignals(paths, rules = PATH_RULES) {
  const out = new Map()
  for (const p of paths ?? []) {
    const rule = rules.find((r) => r.re.test(p))
    if (!rule) continue
    for (const name of rule.skills) out.set(name, (out.get(name) ?? 0) + 1)
  }
  return out
}

// Path-looking words in a prompt: anything with a slash and an extension or a known top-level folder
export function pathsInText(text) {
  return String(text ?? '').match(/[\w.-]+(?:[\\/][\w.@-]+)+/g) ?? []
}

// affinity: { [skill]: { accepted, declined } } kept in $.store. Accepting adds up to +3, and every
// third decline takes one point back. It only nudges a skill that already matched something.
export function affinityBoost(aff) {
  if (!aff) return 0
  return Math.min(3, aff.accepted ?? 0) - Math.floor((aff.declined ?? 0) / 3)
}

export function recordAffinity(affinity, accepted, declined) {
  const next = { ...affinity }
  for (const n of accepted) next[n] = { accepted: (next[n]?.accepted ?? 0) + 1, declined: next[n]?.declined ?? 0 }
  for (const n of declined) next[n] = { accepted: next[n]?.accepted ?? 0, declined: (next[n]?.declined ?? 0) + 1 }
  return next
}

// A skill-name word scores 3, a description word 1. The default minimum of 2 means one name hit
// or two description hits.
// Extra signals (all optional):
//   pathHits  Map(skill -> count) from files touched this session or changed in the git diff: +1 each, max +2
//   promptPathHits  same, from paths written in the prompt itself: +3 (enough alone)
//   affinity  see affinityBoost
export function suggestSkills(prompt, skills, { max = 2, minScore = 2, exclude = new Set(), pathHits, promptPathHits, affinity } = {}) {
  const words = tokenize(prompt)
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
    // Touched files only corroborate: they never suggest a skill the prompt's own words did not
    const fromPaths = hits.length ? Math.min(2, pathHits?.get(s.name) ?? 0) : 0
    if (fromPaths) {
      score += fromPaths
      hits.push('files')
    }
    if (promptPathHits?.get(s.name)) {
      score += 3
      hits.push('path')
    }
    if (score > 0) score = Math.max(0, score + affinityBoost(affinity?.[s.name]))
    if (score >= minScore) scored.push({ name: s.name, description: s.description, score, hits })
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return scored.slice(0, max)
}

// Greedy word wrap into at most `maxLines` lines, each padded to `width`; the last is ellipsized if text remains.
export function wrapLines(text, width, maxLines = 2) {
  const words = String(text ?? '').replace(/\s+/g, ' ').trim().split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const word = w.length > width ? w.slice(0, width - 1) + '…' : w
    if (!cur) cur = word
    else if (cur.length + 1 + word.length <= width) cur += ' ' + word
    else {
      lines.push(cur)
      cur = word
    }
  }
  if (cur) lines.push(cur)
  const out = lines.slice(0, maxLines)
  if (lines.length > maxLines) out[maxLines - 1] = shorten(out[maxLines - 1] + ' …', width)
  while (out.length < maxLines) out.push('')
  return out.map((l) => l.padEnd(width, ' '))
}

export function shorten(text, n) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '\u2026' : t
}

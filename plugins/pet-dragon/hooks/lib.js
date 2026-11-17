// Pure helpers for pet-dragon: no mods API here, so they can be tested with plain Node.

export const COLORS = {
  ember: '#ffb347',
  working: '#ffd23f',
  tool: '#36c5f0',
  waiting: '#ff4fd8',
  error: '#ff5252',
  unread: '#3d6bff',
  context: '#b388ff',
  attention: '#ff6f91',
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
  attention: { color: COLORS.attention, label: 'Something needs you', short: 'A light is amber or red: see the headline under the dragon' },
  idle: { color: COLORS.green, label: 'Ready', short: 'Idle and waiting for your next prompt' },
}

// Dozing is how the dragon looks, not what it says: it dozes after sleepyAfterMs without activity, unless Claude is
// working or you are typing. Whatever color the mood has stays (blue mail, purple context, red error); only the
// green "Ready" default turns the sleepy grey.
// idleMs / sleepyAfterMs are optional: a caller that omits them never gets the sleepy look.
export function isAsleep({ session, typing, idleMs, sleepyAfterMs }) {
  if (session === 'working' || session === 'tool' || typing) return false
  return typeof idleMs === 'number' && typeof sleepyAfterMs === 'number' && sleepyAfterMs > 0 && idleMs >= sleepyAfterMs
}

export function pickMood(args) {
  const { session, typing, unread, contextPct, contextWarn, needs } = args
  if (session === 'waiting' || session === 'error' || session === 'tool' || session === 'working') return session
  if (typing) return 'typing'
  if (unread > 0) return 'unread'
  if (typeof contextPct === 'number' && contextPct >= contextWarn) return 'context'
  // Only a Ready dragon turns coral: green means nothing needs you
  if (needs > 0) return 'attention'
  return isAsleep(args) ? 'sleepy' : 'idle'
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
  // What a switch needs: the local SQL Server service running, or a Docker container publishing 1433
  const ready = { dockerReady: Boolean(p.dockerSql) && p.dockerSql !== 'daemon-off', localReady: p.sqlService === 'Running' }
  if (p.db === 'local') return { color: COLORS.green, value: 'local db', short: 'CoreAPI up (' + who + ') \u2192 local SQL Server. Click "local db" to switch to Docker', detail, ...ready }
  if (p.db === 'docker') return { color: COLORS.teal, value: 'docker db', short: 'CoreAPI up (' + who + ') \u2192 Docker SQL container. Click "docker db" to switch to local', detail, ...ready }
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

// "2026-11-17T08:00" -> "8:00am"
const clock12 = (iso) => {
  const h = Number(String(iso).slice(11, 13))
  return (h % 12 || 12) + ':' + String(iso).slice(14, 16) + (h < 12 ? 'am' : 'pm')
}

// Today's meetings still to come (plus the one in progress) and tomorrow's first one, from the Outlook calendar.
// m.meetings: [{ start, end, subject, location, allDay }] with local "YYYY-MM-DDTHH:mm" times
export function meetLight(m, nowMs) {
  if (!m) return { color: COLORS.grey, value: '?', short: 'Calendar probe failed to run', detail: [] }
  if (m.outlook === 'new-outlook') return { color: COLORS.grey, value: 'n/a', short: 'New Outlook has no local API; switch to classic Outlook to see meetings', detail: [] }
  if (m.outlook !== 'on') return { color: COLORS.grey, value: 'off', short: 'Classic Outlook is not running, so meetings are unknown', detail: [] }
  if (!Array.isArray(m.meetings)) return { color: COLORS.amber, value: '?', short: 'Outlook is running but its calendar could not be read', detail: [m.meetingsError ?? ''].filter(Boolean) }
  const day = localDay(new Date(nowMs))
  const tomorrow = localDay(new Date(nowMs + 86_400_000))
  const timed = m.meetings.filter((x) => x && !x.allDay && x.start && x.end).sort((a, b) => String(a.start).localeCompare(String(b.start)))
  const left = timed.filter((x) => String(x.start).slice(0, 10) === day && Date.parse(x.end) > nowMs)
  const tom = timed.filter((x) => String(x.start).slice(0, 10) === tomorrow)
  const line = (x) => clock12(x.start) + '-' + clock12(x.end) + '  ' + x.subject + (x.location ? ' (' + x.location + ')' : '') + (Date.parse(x.start) <= nowMs ? '  [now]' : '')
  const soon = left.some((x) => Date.parse(x.start) - nowMs <= 15 * 60_000)
  const first = tom[0]
  const detail = [
    left.length ? 'Still to come today:' : 'No more meetings today',
    ...left.map((x) => '  ' + line(x)),
    first ? 'Tomorrow: ' + tom.length + ' meeting(s), first at ' + clock12(first.start) + '  ' + first.subject : 'Tomorrow: no meetings',
  ]
  const next = left[0]
  const short = left.length
    ? left.length + ' meeting(s) left today; ' + (Date.parse(next.start) <= nowMs ? 'one is on now' : 'next at ' + clock12(next.start)) + (first ? '. Tomorrow starts at ' + clock12(first.start) : '')
    : 'No more meetings today' + (first ? '. Tomorrow starts at ' + clock12(first.start) : '')
  return { color: soon ? COLORS.amber : left.length ? COLORS.teal : COLORS.green, value: String(left.length), short, detail, tomorrowFirst: first ? clock12(first.start) : undefined }
}

// The end-of-day nudge about tomorrow's first meeting: from 3:30pm once you have been idle a couple of minutes,
// or from 4:00pm regardless, once a day
export function shouldRemindMeeting(nowMs, idleMs, remindedDay) {
  const d = new Date(nowMs)
  const mins = d.getHours() * 60 + d.getMinutes()
  if (remindedDay === localDay(d) || mins < 15 * 60 + 30 || mins >= 20 * 60) return false
  return idleMs >= 120_000 || mins >= 16 * 60
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
  // jest --changedSince/--passWithNoTests with nothing related to the change: a clean run of zero tests, not a missing summary
  if (/No tests found/i.test(text) && /jest|npm\s+(run\s+)?test/i.test(cmd)) return { runner: 'jest', passed: 0, failed: 0 }
  return undefined
}

// Which light a run belongs to: C# tests are the backend (be), Jest is the front end (fe). Other runners have no light.
export function testKind(run) {
  return run?.runner === 'dotnet' ? 'be' : run?.runner === 'jest' ? 'fe' : undefined
}

// at / nowMs: when the run happened and now, so a run remembered from an earlier session shows its age
// kind: 'be' (default) or 'fe', only to word the "no run yet" message
export function testLight(run, command, at, nowMs, kind = 'be') {
  if (!run) {
    const what = kind === 'fe' ? 'front-end test run recorded yet. Dragon records every Jest run Claude starts (npm test, jest)' : 'backend test run recorded yet. Dragon records every C# test run Claude starts (dotnet test)'
    return { color: COLORS.grey, value: 'not run', short: 'No ' + what + ' and remembers the last one between sessions; it cannot see runs from another terminal', detail: [] }
  }
  const when = typeof at === 'number' && typeof nowMs === 'number' ? ago(at, nowMs) : ''
  const stale = typeof at === 'number' && typeof nowMs === 'number' && nowMs - at > 24 * 3_600_000
  const detail = [run.runner + ': ' + run.passed + ' passed, ' + run.failed + ' failed' + (when ? ' (' + when + ')' : ''), command ? 'Command: ' + shorten(command, 100) : ''].filter(Boolean)
  const tail = when ? ', ' + when + (stale ? ' (over a day old)' : '') : ''
  if (run.failed > 0) return { color: COLORS.red, value: run.failed + ' fail', short: run.runner + ' run: ' + run.failed + ' failed, ' + run.passed + ' passed' + tail, detail }
  const none = run.passed === 0 ? ' (no tests relate to your changes; run npm test for the full suite)' : ''
  return { color: stale ? COLORS.amber : COLORS.green, value: run.passed + ' pass', short: run.runner + ' run: ' + run.passed + ' passed' + none + tail, detail }
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

// ---- Token coach ----

const usageColor = (pct) => (pct >= 85 ? COLORS.red : pct >= 60 ? COLORS.amber : COLORS.green)

export function ctxLight(pct) {
  if (typeof pct !== 'number') return { color: COLORS.grey, value: '?', short: 'Context size is not known yet (it appears after the first reply)', detail: [] }
  const v = Math.round(pct) + '%'
  const short =
    pct >= 85
      ? 'Context is ' + v + ' full: /compact now (or /clear if the task has changed)'
      : pct >= 60
        ? 'Context is ' + v + ' full: /compact at the next task boundary'
        : 'Context is ' + v + ' full: plenty of room'
  return { color: usageColor(pct), value: v, short, detail: ['Every reply re-reads the whole context, so a fuller window costs more per turn and answers get less sharp.'] }
}

// days: { 'YYYY-MM-DD': usd }. Today's spend and the typical day from up to 14 earlier days with any spend (needs 3).
export function dayStats(days, todayKey) {
  const d = days ?? {}
  const today = Number(d[todayKey] ?? 0)
  const prev = Object.keys(d)
    .filter((k) => k < todayKey && Number(d[k]) > 0)
    .sort()
    .slice(-14)
    .map((k) => Number(d[k]))
  const avg = prev.length >= 3 ? prev.reduce((a, b) => a + b, 0) / prev.length : undefined
  return { today, avg, n: prev.length }
}

// The daily budget the Today light measures against
export const DAILY_LIMIT_USD = 15

export function dayLight(st, limit = DAILY_LIMIT_USD) {
  if (!st) return { color: COLORS.grey, value: '?', short: 'Spend for today is not known yet', detail: [] }
  const usd = '$' + st.today.toFixed(2)
  const cap = '$' + limit.toFixed(2)
  const frac = limit > 0 ? st.today / limit : 0
  const color = frac >= 1 ? COLORS.red : frac >= 0.7 ? COLORS.amber : COLORS.green
  const typical = st.avg === undefined ? 'No typical day yet (needs 3 earlier days of history)' : 'A typical day is $' + st.avg.toFixed(2) + ' (' + (st.avg > 0 ? (st.today / st.avg).toFixed(1) : '0.0') + 'x)'
  const left = frac >= 1 ? '$' + (st.today - limit).toFixed(2) + ' over the daily limit' : '$' + (limit - st.today).toFixed(2) + ' left of the daily limit'
  return {
    color,
    value: usd + '/' + cap,
    short: 'Spent ' + usd + ' of ' + cap + ' today (' + Math.round(frac * 100) + '%); ' + left + '. ' + typical,
    detail: ['Daily limit is fixed at ' + cap + '. Counts every session Dragon has watched today.'],
    ratio: st.avg > 0 ? st.today / st.avg : 0,
    frac,
  }
}

// `git worktree list --porcelain`: blank-line separated blocks of "worktree <path>", "HEAD <sha>", "branch refs/heads/<name>" | "detached"
export function parseWorktrees(text) {
  if (!text) return undefined
  const out = []
  for (const block of String(text).split(/\r?\n\r?\n/)) {
    const wt = { path: '', branch: '', detached: false, prunable: false }
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) wt.path = line.slice(9).trim()
      else if (line.startsWith('branch ')) wt.branch = line.slice(7).trim().replace('refs/heads/', '')
      else if (line === 'detached') wt.detached = true
      else if (line.startsWith('prunable')) wt.prunable = true
    }
    if (wt.path) out.push(wt)
  }
  return out.length ? out : undefined
}

// The worktree this session is in; the hover and the /dragon pane list all of them. list[0] is the main checkout.
export function worktreeLight(list, root) {
  if (!Array.isArray(list)) return { color: COLORS.grey, value: '?', short: 'Not inside a git repository (no worktrees to list)', detail: [] }
  const norm = (x) => String(x ?? '').split(String.fromCharCode(92)).join('/').replace(/\/+$/, '').toLowerCase()
  const name = (x) => x.path.replace(/\/+$/, '').split('/').pop() || x.path
  // The session may start in a subfolder of a worktree (phoenix-ui, say): then the deepest worktree that contains it is the current one
  let at = list.findIndex((w) => norm(w.path) === norm(root))
  if (at < 0) {
    let best = -1
    list.forEach((w, i) => {
      if (norm(root).startsWith(norm(w.path) + '/') && (best < 0 || norm(w.path).length > norm(list[best].path).length)) best = i
    })
    at = best
  }
  const cur = at >= 0 ? list[at] : undefined
  const label = (w) => (w.branch || (w.detached ? 'detached HEAD' : '?')) + (w.prunable ? ' (missing folder)' : '')
  const detail = list.map((w) => (w === cur ? '\u25cf ' : '  ') + name(w) + '  ' + label(w) + '  ' + w.path)
  const brief = list.map((w) => (w === cur ? '\u25cf ' : '') + name(w) + ' (' + (w.branch || 'detached') + ')')
  if (list.length === 1) brief.push('your only worktree')
  const shortName = cur ? name(cur) : '?'
  const value = shortName.length > 16 ? shortName.slice(0, 15) + '\u2026' : shortName
  const short = cur
    ? 'You are in worktree "' + name(cur) + '" on ' + label(cur) + (at === 0 ? ' (the main checkout)' : ' (a linked worktree)') + '. ' + list.length + ' worktree(s) in this repo'
    : 'This folder is not one of the repo\'s ' + list.length + ' worktree(s)'
  return { color: at > 0 ? COLORS.teal : COLORS.green, value, short, detail, brief }
}

// What needs you right now, from the lights: amber and red lights, worst first.
// items: [{ label, light }]. level drives the one-line headline and the Ready dragon's color.
export function headline(items, limit = 4) {
  const bad = items.filter((i) => i.light && (i.light.color === COLORS.red || i.light.color === COLORS.amber))
  bad.sort((a, b) => (a.light.color === COLORS.red ? 0 : 1) - (b.light.color === COLORS.red ? 0 : 1))
  if (bad.length === 0) return { level: 'green', color: COLORS.green, count: 0, text: 'All clear' }
  const level = bad.some((i) => i.light.color === COLORS.red) ? 'red' : 'amber'
  const names = bad.slice(0, limit).map((i) => i.label + ' ' + i.light.value)
  const more = bad.length > limit ? ' +' + (bad.length - limit) + ' more' : ''
  return { level, color: level === 'red' ? COLORS.red : COLORS.amber, count: bad.length, text: bad.length + (bad.length === 1 ? ' needs you: ' : ' need you: ') + names.join(' \u00b7 ') + more }
}

// How long a changed light flashes, and how fast
export const PULSE_MS = 2800
export const PULSE_STEP_MS = 350
export const pulsing = (light, nowMs) => Boolean(light?.changedAt) && nowMs - light.changedAt < PULSE_MS
// true = bright half of the flash
export const pulseBright = (light, nowMs) => pulsing(light, nowMs) && Math.floor((nowMs - light.changedAt) / PULSE_STEP_MS) % 2 === 0

// What to tell the user right now. Each item has a stable id so it is announced once and re-armed when it clears.
// s = { contextPct, startBranch, branch, sessionMinutes, day, limits }
export function tokenAdvice(s) {
  const out = []
  const pct = s.contextPct
  if (typeof pct === 'number') {
    if (pct >= 85) out.push({ id: 'compact-now', action: 'compact', text: 'Context is ' + Math.round(pct) + '% full. /compact now keeps what matters and frees room.' })
    else if (pct >= 60) out.push({ id: 'compact-soon', text: 'Context is ' + Math.round(pct) + '% full. A good moment to /compact is the next task boundary.' })
    if (s.startBranch && s.branch && s.startBranch !== s.branch && pct >= 30) out.push({ id: 'clear-branch', text: 'You moved from ' + s.startBranch + ' to ' + s.branch + '. /clear gives the new ticket a clean context.' })
    if (Number(s.sessionMinutes) >= 180 && pct >= 50) out.push({ id: 'clear-old', text: 'This session is ' + (s.sessionMinutes / 60).toFixed(1) + ' hours old and ' + Math.round(pct) + '% full. /clear or /compact would start it lean.' })
  }
  const d = s.day
  if (d && d.avg !== undefined && d.avg > 0 && d.today >= 5 && d.today / d.avg >= 1.5) out.push({ id: 'day-high', text: "You've spent $" + d.today.toFixed(2) + ' today, ' + (d.today / d.avg).toFixed(1) + 'x your typical $' + d.avg.toFixed(2) + '.' })
  const top = Array.isArray(s.limits) && s.limits.length ? s.limits.reduce((a, b) => (b.percentUsed > a.percentUsed ? b : a)) : undefined
  if (top && top.percentUsed >= 80) out.push({ id: 'limit-high', text: 'Your ' + (top.kind === 'five_hour' ? '5-hour' : top.kind === 'seven_day' ? '7-day' : top.kind) + ' usage window is ' + top.percentUsed + '% used.' })
  return out
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 86_400_000
const dayMs = (d) => Date.parse(d + 'T00:00:00Z')
const fmtDay = (ms) => MONTHS[new Date(ms).getUTCMonth()] + ' ' + new Date(ms).getUTCDate()

// Forecast from git alone (Jira's C3 fix versions carry no release dates).
// prodLines / nextLines: "origin/release/prod/1.34.0 2026-11-13" (branch, tip date); hotfixLines: "origin/hotfix/x 2026-11-10".
// The next prod release is estimated as the last minor release plus the median gap between the last 4 minors.
export function releaseForecast(prodLines, nextLines, hotfixLines, todayIso) {
  const parse = (lines, kind) =>
    (lines ?? [])
      .map((l) => {
        const m = new RegExp('release/' + kind + '/(\\d+)\\.(\\d+)\\.(\\d+)\\s+(\\d{4}-\\d{2}-\\d{2})').exec(l)
        return m ? { v: m[1] + '.' + m[2] + '.' + m[3], key: Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3]), pat: Number(m[3]), date: m[4] } : undefined
      })
      .filter(Boolean)
      .sort((a, b) => a.key - b.key)
  const prod = parse(prodLines, 'prod')
  const next = parse(nextLines, 'next')
  const today = dayMs(todayIso)
  const minors = prod.filter((r) => r.pat === 0)
  const gaps = minors.slice(-5).map((r, i, a) => (i ? Math.round((dayMs(r.date) - dayMs(a[i - 1].date)) / DAY_MS) : undefined)).filter((g) => g > 0)
  const last4 = gaps.slice(-4)
  const sorted = [...last4].sort((a, b) => a - b)
  const median = sorted.length >= 3 ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)) : undefined
  const lastMinor = minors[minors.length - 1]
  const out = { median, gaps: last4 }
  if (lastMinor && median !== undefined) {
    const est = dayMs(lastMinor.date) + median * DAY_MS
    out.estDate = fmtDay(est)
    out.overdueDays = est < today ? Math.round((today - est) / DAY_MS) : 0
    out.daysAway = est >= today ? Math.round((est - today) / DAY_MS) : 0
  }
  const recent = prod.filter((r) => r.pat > 0 && today - dayMs(r.date) <= 30 * DAY_MS)
  const prodSet = new Set(prod.map((r) => r.v))
  out.hotfixes = recent.map((r) => ({ v: r.v, date: fmtDay(dayMs(r.date)) }))
  const newestProd = prod.length ? prod[prod.length - 1].key : 0
  // Only a patch branch newer than what is in production can be a hotfix still on its way
  out.hotfixesInFlight = next.filter((r) => r.pat > 0 && r.key > newestProd && !prodSet.has(r.v)).map((r) => r.v)
  out.hotfixBranches = (hotfixLines ?? [])
    .map((l) => /(\S+)\s+(\d{4}-\d{2}-\d{2})$/.exec(l))
    .filter((m) => m && today - dayMs(m[2]) <= 14 * DAY_MS)
    .map((m) => m[1].replace(/^origin\//, ''))
  return out
}

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
  if (r.forecast?.estDate) parts.push((next ?? 'Next release') + ' ' + (r.forecast.overdueDays ? 'was expected about ' : 'is estimated about ') + r.forecast.estDate)
  if (r.forecast) parts.push('Hotfixes: ' + r.forecast.hotfixes.length + ' in 30 days, ' + (r.forecast.hotfixesInFlight.length ? r.forecast.hotfixesInFlight.join(', ') + ' in flight' : 'none in flight'))
  parts.push('development has ' + devT.length + ' more ticket(s), ' + devN + ' commit(s)' + (next ? ' since the ' + next + ' cut' : ''))
  const f = r.forecast
  const fLines = []
  const fBrief = []
  if (f?.estDate) {
    const when = f.overdueDays ? 'was expected about ' + f.estDate + ' (' + f.overdueDays + ' day(s) ago)' : 'estimated about ' + f.estDate + ' (in ' + f.daysAway + ' day(s))'
    fLines.push((next ?? 'The next release') + ' ' + when + ': last minor release + the median gap between the last ' + f.gaps.length + ' minors (' + f.median + ' days). An estimate from git history, not a booked date')
    fBrief.push('next ' + (next ?? '') + ' ~' + f.estDate + ' (est.)')
  }
  if (f) {
    const hf = f.hotfixes.length ? f.hotfixes.length + ' in the last 30 days (' + f.hotfixes.map((h) => h.v + ' ' + h.date).join(', ') + ')' : 'none in the last 30 days'
    const fl = f.hotfixesInFlight.length ? 'in flight: ' + f.hotfixesInFlight.join(', ') : 'none planned'
    fLines.push('Hotfixes: ' + hf + '; ' + fl + (f.hotfixBranches.length ? '; open hotfix branches: ' + f.hotfixBranches.join(', ') : ''))
    fBrief.push('hotfixes ' + f.hotfixes.length + ' in 30d, ' + (f.hotfixesInFlight.length ? f.hotfixesInFlight.length + ' in flight' : '0 in flight'))
  }
  const detail = [
    'Prod ' + prod + '  →  Next ' + (next ?? 'none') + ' (+' + nextT.length + ' tickets)  →  development (+' + devT.length + ' tickets)',
    ...fLines,
    r.devAt ? 'development last changed ' + r.devAt.slice(0, 16).replace('T', ' ') + 'Z' : '',
    ...nextT.slice(0, 8).map((t) => link('in ' + (next ?? 'next') + ': ' + t, base + t)),
    nextT.length > 8 ? '…and ' + (nextT.length - 8) + ' more in ' + next : '',
  ].filter(Boolean)
  return { color: COLORS.teal, value: prod, short: parts.join('. '), detail, brief: ['prod ' + prod, (next ?? '-') + ' +' + nextT.length + ' tix', 'dev +' + devT.length, ...fBrief] }
}

// d = { branch, behind, overlap: [paths] }: behind = commits on origin/development you do not have;
// overlap = files you changed that development also changed since you branched
export function driftLight(d) {
  if (!d) return { color: COLORS.grey, value: '?', short: 'Could not compare with origin/development', detail: [] }
  const o = d.overlap ?? []
  const detail = [d.behind + ' commit(s) behind origin/development', o.length + ' of your changed file(s) also changed on development']
  for (const f of o.slice(0, 8)) detail.push(f)
  if (o.length > 8) detail.push('…and ' + (o.length - 8) + ' more')
  if (o.length) return { color: COLORS.red, value: '↓' + d.behind + ' ' + o.length + ' clash', short: o.length + ' file(s) you changed were also changed on development (' + o.slice(0, 3).join(', ') + (o.length > 3 ? ', …' : '') + '). Expect a merge conflict; consider merging development now', detail }
  if (d.behind) return { color: COLORS.amber, value: '↓' + d.behind, short: d.branch + ' is ' + d.behind + ' commit(s) behind origin/development, but none of your changed files overlap', detail }
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

// `git status --porcelain` lines -> the question Dragon asks when you click a dirty Git light
export function dirtySummary(lines, branch, max = 15) {
  const shown = lines.slice(0, max).map((l) => '  ' + l)
  const more = lines.length > max ? ['  \u2026and ' + (lines.length - max) + ' more'] : []
  const untracked = lines.filter((l) => l.startsWith('??')).length
  return [
    lines.length + ' uncommitted change(s)' + (branch ? ' on ' + branch : '') + ':',
    ...shown,
    ...more,
    '',
    'Reset runs git reset --hard (discards the tracked changes above' + (untracked ? '; the ' + untracked + ' untracked ?? file(s) stay' : '') + ') and then git pull. Dragon keeps a recovery id so the discarded changes can be restored.',
    'Reset them, or keep them?',
  ].join('\n')
}

// The number in a Bitbucket PR link (.../pull-requests/14780)
export function prNumber(url) {
  const m = /pull-requests\/([0-9]+)/.exec(String(url ?? ''))
  return m ? Number(m[1]) : undefined
}

// `twg bb prs get a b c` answers { items: [{ ok, data: { id, participants: [{ user: { account_id }, approved }] } }] }.
// Returns the Set of PR numbers you have already approved; undefined when the answer cannot be read.
export function approvedByMe(json, accountId) {
  if (!Array.isArray(json?.items) || !accountId) return undefined
  const done = new Set()
  for (const it of json.items) {
    const d = it?.ok ? it.data : undefined
    if ((d?.participants ?? []).some((x) => x.user?.account_id === accountId && x.approved === true)) done.add(d.id)
  }
  return done
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
// Very concise on purpose: one table, one row per item (kind, id, state, title), one row for all commits.
export function formatStandup({ since, issues, prs, commits, repoId }) {
  const lines = ['Standup since ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][since.getUTCDay()] + ' ' + since.toISOString().slice(5, 10)]
  const pad = (v, n) => String(v).padEnd(n)
  const jira = Array.isArray(issues) ? issues : undefined
  if (!jira) lines.push('Jira  unreadable (twg logged in?)')
  else if (jira.length === 0) lines.push('Jira  none')
  else {
    const kw = Math.max(...jira.map((i) => String(i.key).length)) + 1
    const sw = Math.max(...jira.map((i) => String(i.status?.name ?? '?').length)) + 1
    for (const i of jira) lines.push('Jira  ' + pad(i.key, kw) + pad(i.status?.name ?? '?', sw) + shorten(i.summary, 45))
  }
  const all = Array.isArray(prs) ? (repoId ? prs.filter((p) => p.repo?.id === repoId) : prs) : undefined
  if (!all) lines.push('PR    unreadable (twg logged in?)')
  else if (all.length === 0) lines.push('PR    none')
  else for (const p of all) lines.push('PR    ' + pad(String(p.state ?? '?').toLowerCase(), 7) + shorten(p.title, 45) + (p.commentCount ? ' (' + p.commentCount + 'c)' : ''))
  if (!commits) lines.push('Git   unreadable')
  else if (commits.length === 0) lines.push('Git   no commits')
  else lines.push('Git   ' + commits.length + ' commit' + (commits.length === 1 ? '' : 's') + ', last: ' + shorten(commits[0].replace(/^\S+\s+/, ''), 45))
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

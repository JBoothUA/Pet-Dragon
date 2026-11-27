import {
  COLORS,
  MOODS,
  IDLE,
  FLAP,
  SLEEP,
  FLAP_MS,
  SPRITE_WIDTH,
  spriteRows,
  rotateHue,
  machineLight,
  artifactsFolderName,
  pickMood,
  isAsleep,
  parseJson,
  parseJsonAny,
  ago,
  coreApiLight,
  serviceLight,
  jiraLight,
  prLight,
  outlookLight,
  teamsLight,
  meetLight,
  shouldRemindMeeting,
  parseGitStatus,
  gitLight,
  pipelineLight,
  aiHealthLight,
  depsLight,
  bugsLight,
  bugsJql,
  gradient,
  SPRINT_FIELDS,
  POINTS_DONE_STATUSES,
  sprintJql,
  sprintNumber,
  slimIssue,
  pointsStats,
  pointsLights,
  blockedPrs,
  costLight,
  cacheLight,
  CACHE_TTL_MS,
  parseMonthly,
  monthLight,
  teamCiLight,
  hangfireLight,
  seqLight,
  runTestPart,
  partialRunColor,
  failureExcerpt,
  startupTestRecord,
  TEST_PROBLEM_VALUES,
  radarLight,
  releaseForecast,
  ctxLight,
  dayStats,
  dayLight,
  parseWorktrees,
  prNumber,
  dirtySummary,
  approvedByMe,
  worktreeLight,
  liveSessions,
  sessionsLight,
  headline,
  PULSE_STEP_MS,
  pulsing,
  pulseBright,
  tokenAdvice,
  reviewLight,
  mergedLight,
  shipLight,
  ticketsIn,
  driftLight,
  newestRelease,
  isTestCommand,
  parseTestRun,
  testLight,
  testKind,
  formatStandup,
  standupSince,
  localDay,
  indexSkills,
  suggestSkills,
  pathSignals,
  pathsInText,
  recordAffinity,
  shorten,
  wrapLines,
} from './lib.js'

const PANE = 'dragon'

const DEFAULTS = {
  coreapi_port: 5236,
  bff_port: 7102,
  movedocs_port: 7201,
  coreapi_poll_seconds: 60,
  messages_poll_seconds: 120,
  jira_poll_minutes: 5,
  bitbucket_poll_minutes: 10,
  jira_jql: 'assignee = currentUser() AND statusCategory != Done AND status NOT IN ("Dev Done", "Ready for Release")',
  context_warn_percent: 80,
  sleepy_after_minutes: 20,
  git_poll_seconds: 60,
  pipeline_poll_minutes: 3,
  bitbucket_repo: 'keyhealthtech/phoenix',
  seq_url: 'http://localhost:5341',
  seq_api_key: '',
  seq_poll_seconds: 60,
  seq_window_minutes: 15,
  ui_port: 5173,
  radar_poll_minutes: 10,
  ai_poll_minutes: 5,
  // The Bugs light watches this pod's label only (pods are labels named C3Pod<N>); empty = every pod
  bug_pod_label: 'C3Pod2',
  // The Pts and Pod lights: which Jira statuses count as done, and how many closed sprints make the average
  points_done_statuses: POINTS_DONE_STATUSES,
  points_history_sprints: 6,
  db_scripts_dir: '',
  auto_test_command: '',
  auto_fe_test_command: '',
  token_coach: 'advise',
  auto_compact_percent: 90,
  skill_suggestions: 'ask',
  skill_min_score: 2,
  // twg returns PRs from every repo you authored in; only this one (phoenix) is counted
  // Whose approvals clear a PR from the Review light (the same Atlassian account as the Jira board link below)
  my_account_id: '712020:d474c235-c75d-4715-a77f-8c84fae88106',
  pr_repo_id: '7b33633431633438372d666438652d346565362d396133392d3461376330663439316230367d',
  pr_list_url: 'https://bitbucket.org/keyhealthtech/phoenix/pull-requests/?state=ALL&user_filter=ALL&author=712020%3Ad474c235-c75d-4715-a77f-8c84fae88106',
  jira_board_url: 'https://keyjira.atlassian.net/jira/software/c/projects/C3/boards/880?assignee=712020%3Ad474c235-c75d-4715-a77f-8c84fae88106',
}

// row 0 = local services, row 1 = work. A companion light is checked by its parent's probe.
const SOURCES = [
  { id: 'coreapi', label: 'Core', title: 'CoreAPI', row: 0, col: 0 },
  { id: 'bff', label: 'BFF', title: 'BFF', row: 0, col: 1, parent: 'coreapi' },
  { id: 'movedocs', label: 'MD', title: 'MoveDocs API', row: 0, col: 2, parent: 'coreapi' },
  { id: 'ui', label: 'UI', title: 'phoenix-ui dev server', row: 0, col: 3, parent: 'coreapi' },
  { id: 'jira', label: 'Jira', title: 'Jira', row: 1, col: 0 },
  { id: 'bitbucket', label: 'PRs', title: 'PRs', row: 1, col: 1 },
  { id: 'reviews', label: 'Review', title: 'PRs to review', row: 1, col: 2, parent: 'bitbucket' },
  { id: 'points', label: 'Pts', title: 'Your story points this sprint, beside your average', row: 1, col: 3 },
  { id: 'pod', label: 'Pod', title: 'Lowest and highest story points in the pod this sprint', row: 1, col: 4, parent: 'points' },
  { id: 'outlook', label: 'Mail', title: 'Outlook', row: 6, col: 0 },
  { id: 'meet', label: 'Mtgs', title: 'Meetings today', row: 6, col: 1, parent: 'outlook' },
  { id: 'teams', label: 'Teams', title: 'Teams', row: 6, col: 2, parent: 'outlook' },
  { id: 'git', label: 'Git', title: 'Git', row: 2, col: 0 },
  { id: 'pipeline', label: 'CI', title: 'Pipeline for your branch', row: 2, col: 1 },
  { id: 'cidev', label: 'Team', title: 'Pipelines across every open and recent PR', hl: 'Team CI', row: 2, col: 2 },
  { id: 'tests', label: 'BE Tests', title: 'Backend tests (C#)', row: 2, col: 3 },
  { id: 'fe-tests', label: 'FE Tests', title: 'Frontend tests (Jest)', row: 2, col: 4 },
  { id: 'tree', label: 'Tree', title: 'Worktrees', row: 2, col: 5, parent: 'git' },
  { id: 'radar', label: 'Prod', title: 'Release radar', row: 3, col: 0 },
  { id: 'drift', label: 'Drift', title: 'Branch drift', row: 3, col: 1, parent: 'radar' },
  { id: 'merged', label: 'Merged', title: 'Merged into development today', row: 3, col: 2, parent: 'radar' },
  { id: 'ship', label: 'Ship', title: 'Next release in Jira', row: 3, col: 3, parent: 'radar' },
  { id: 'cache', label: 'Cache', title: 'Prompt cache', row: 4, col: 0 },
  { id: 'ctx', label: 'Ctx', title: 'Context window', row: 4, col: 1 },
  { id: 'sessions', label: 'Sess', title: 'Open Claude sessions', row: 4, col: 2 },
  { id: 'cost', label: 'Cost', title: 'Spend today and this month', row: 4, col: 3 },
  { id: 'pc', label: 'PC', title: 'This computer (RAM, CPU, disk)', row: 0, col: 4 },
  { id: 'seq', label: 'Logs', title: 'Seq errors (local)', row: 5, col: 0 },
  { id: 'aiprod', label: 'Prod', title: 'Production errors (App Insights)', hl: 'Prod errors', row: 5, col: 1 },
  { id: 'aiqa', label: 'QA', title: 'QA errors (App Insights)', hl: 'QA errors', row: 5, col: 2, parent: 'aiprod' },
  { id: 'hangfire', label: 'Jobs', title: 'Hangfire job errors', row: 5, col: 3, parent: 'aiprod' },
  { id: 'deps', label: 'Deps', title: 'Dependencies failing in prod, QA or UAT (App Insights)', row: 5, col: 4, parent: 'aiprod' },
  { id: 'bugs', label: 'Bugs', title: 'New Jira bugs for the pod in the last 24 hours', row: 5, col: 5 },
]
const companions = (key) => SOURCES.filter((s) => s.parent === key).map((s) => s.id)
// These describe this session's repo and branch, so they are never shared through $.store
const LOCAL_ONLY = new Set(['git', 'pipeline', 'tests', 'fe-tests', 'radar', 'ctx', 'cost', 'cache', 'pc'])
const ERROR_LIMIT = 50
// The account usage the app's usage card shows (not a documented API: a failed reply keeps the last reading)
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const MONTHLY_REFRESH_MS = 10 * 60_000
const MONTHLY_BACKOFF_MS = 15 * 60_000
// MoveDocs Application Insights AppIds (movedocs plugin: references/environment-map.md). Stage and QA2 share QA's.
const AI_APPS = { prod: 'bfc858e3-8503-4424-8f0c-c7ec004eaadc', qa: '4717a896-3727-4609-84b2-84206a64f966', uat: '18206e65-6006-472f-95d3-2045521a5bec' }
const SESSION_BEAT_MAX_AGE_MS = 3 * 60_000

let opts = { ...DEFAULTS }
let repoRoot = ''
let isWindows = true
const session = { state: 'idle', tool: '', contextPct: undefined, typing: false }
const TYPING_HOLD_MS = 1500
let typingTimer = null
const lights = {}
const busy = {}
let frame = 0
let flapTimer = null
let skills = []
const declined = new Set()
let suggestionsOff = false
let lastSuggestion = ''
// Sleepy: any prompt keystroke, turn or tool call counts as activity
let lastActivity = Date.now()
let wasSleepy = false
// Files this session has edited, newest last: a hint for which skills fit the work in hand
const touched = []
const TOUCHED_MAX = 50
let affinity = {}
let standupText = ''
let standupBusy = false
// The prompt cache clock: when the main agent last finished a reply, and how often the light is re-read (0 = not ticking)
let lastReplyAt
let cacheTimer = null
let cacheEvery = 0
let monthlyBusy = false
let monthlyReading
let monthlyError = ''
let lastRateLimits
let dayPart
let monthPart

function intervalMs(id) {
  if (id === 'coreapi') return Number(opts.coreapi_poll_seconds) * 1000
  if (id === 'outlook' || id === 'teams') return Number(opts.messages_poll_seconds) * 1000
  if (id === 'jira') return Number(opts.jira_poll_minutes) * 60_000
  if (id === 'git') return Number(opts.git_poll_seconds) * 1000
  if (id === 'pipeline') return Number(opts.pipeline_poll_minutes) * 60_000
  if (id === 'seq') return Number(opts.seq_poll_seconds) * 1000
  if (id === 'radar') return Number(opts.radar_poll_minutes) * 60_000
  if (id === 'aiprod') return Number(opts.ai_poll_minutes) * 60_000
  if (id === 'bugs' || id === 'points') return Number(opts.radar_poll_minutes) * 60_000
  if (id === 'pc') return 15_000
  if (id === 'cidev') return Math.max(Number(opts.pipeline_poll_minutes), 5) * 60_000
  return Number(opts.bitbucket_poll_minutes) * 60_000
}

function unreadCount() {
  const n = Number(lights.outlook?.value)
  return Number.isFinite(n) ? n : 0
}

// A value or color that differs from the last one stamps changedAt, which the render flashes for PULSE_MS.
// The first reading of a light is not a change.
function setLight(id, light, checkedAt) {
  const prev = lights[id]
  const changed = prev && (prev.value !== light.value || prev.color !== light.color)
  lights[id] = { ...light, checkedAt, changedAt: changed ? Date.now() : prev?.changedAt }
}

// A light with `alarm` (the computer running out of RAM) blinks for as long as it stays red, not just when it changes
const flashing = (l, nowMs) => pulsing(l, nowMs) || l?.alarm === true
const blinkBright = (l, nowMs) => pulseBright(l, nowMs) || (l?.alarm === true && Math.floor(nowMs / PULSE_STEP_MS) % 2 === 0)

// Redraws every PULSE_STEP_MS while any light is mid-flash or alarming, then stops
let pulseTimer = null
function syncPulse($) {
  const now = Date.now()
  const any = Object.values(lights).some((l) => flashing(l, now))
  if (any && !pulseTimer) {
    pulseTimer = $.clock.every(PULSE_STEP_MS, () => {
      $.ui.invalidate('ui.render')
      if (!Object.values(lights).some((l) => flashing(l, Date.now()))) {
        pulseTimer?.cancel()
        pulseTimer = null
      }
    })
  }
}

// A test light that has no complete result: a cause word (timeout, build, ...) or a count with parts missing
const testNeedsRun = (l) => TEST_PROBLEM_VALUES.includes(l?.value) || l?.partial === true

// What a click on a light does, for its hover line. Mirrors the `open` handler in the band: every light answers a click.
function clickHint(id, l) {
  if (id === 'git' && (l?.value ?? '').includes('~')) return 'Click to review the uncommitted changes (asks before anything is reset)'
  if (id === 'git' && (l?.value ?? '').includes('↓')) return 'Click to merge origin into this branch (asks first)'
  if (id === 'drift' && l?.value?.startsWith('↓')) return 'Click to correct the drift (merges origin/development into ' + (lights.git?.branch ?? 'your branch') + ', asks first)'
  if ((id === 'tests' || id === 'fe-tests') && testNeedsRun(l)) return 'Click to run the tests again'
  if ((id === 'tests' || id === 'fe-tests') && !testBusy[id === 'tests' ? 'be' : 'fe'] && l?.value !== 'queued') return 'Click to run the tests again (asks first)'
  if (id === 'cache' || id === 'ctx') return 'Click to run /compact (asks what the summary should keep)'
  if (id === 'teams' && l?.value === 'off') return 'Click to start Teams'
  if (lightUrl(id)) return 'Click to open'
  return 'Click for details in /dragon'
}

// Where clicking a light goes (opened in Chrome); undefined = open the /dragon pane instead
function lightUrl(id) {
  if (lights[id]?.url) return lights[id].url
  if (id === 'coreapi') return 'http://localhost:' + opts.coreapi_port + '/swagger'
  if (id === 'bff') return 'https://localhost:' + opts.bff_port + '/swagger'
  if (id === 'movedocs') return 'https://localhost:' + opts.movedocs_port + '/swagger'
  if (id === 'jira') return opts.jira_board_url
  if (id === 'bitbucket') return opts.pr_list_url
  if (id === 'pipeline') return 'https://bitbucket.org/' + opts.bitbucket_repo + '/pipelines'
  if (id === 'seq') return opts.seq_url
  if (id === 'ui') return 'http://localhost:' + opts.ui_port
  if (id === 'radar') return 'https://bitbucket.org/' + opts.bitbucket_repo + '/branches/'
  if (id === 'aiprod' || id === 'aiqa' || id === 'hangfire' || id === 'deps') return 'https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/microsoft.insights%2Fcomponents'
  if (id === 'cidev') return 'https://bitbucket.org/' + opts.bitbucket_repo + '/pipelines'
  if (id === 'reviews') return 'https://bitbucket.org/' + opts.bitbucket_repo + '/pull-requests/?state=OPEN&reviewer=me'
  if (id === 'merged') return 'https://bitbucket.org/' + opts.bitbucket_repo + '/commits/branch/development'
  return undefined
}

async function openUrl($, url) {
  try {
    await $.process.run(
      ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $.plugin.root + '\\scripts\\open-url.ps1', '-Url', url],
      { timeoutMs: 15_000 },
    )
  } catch (err) {
    $.ui.toast('Dragon could not open ' + url + ': ' + shorten(err?.message ?? err, 80))
  }
}

async function runPowerShell($, script, args) {
  const file = $.plugin.root + '\\scripts\\' + script
  const r = await $.process.run(
    ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, ...args],
    { timeoutMs: 60_000 },
  )
  return parseJson(r.stdout)
}

// One twg query for a sprint, trimmed to what the points lights read (twg returns at most 100 issues, so a sprint is one query)
async function sprintIssues($, jql) {
  const r = await $.process.run(['twg', 'jira', 'workitem', 'query', '--jql', jql, '--limit', '100', '-o', 'json', '--output-summary', 'none', '--fields', SPRINT_FIELDS], { timeoutMs: 90_000 })
  const issues = r.exitCode === 0 ? parseJsonAny(r.stdout)?.data?.issues : undefined
  return Array.isArray(issues) ? issues.map(slimIssue) : undefined
}

// The active sprint is fetched every poll; the closed ones behind the average change rarely, so each is cached for six hours
async function pointsFromJira($, now) {
  const label = opts.bug_pod_label
  const history = Number(opts.points_history_sprints) || 6
  const open = await sprintIssues($, sprintJql(label, 'open'))
  if (!open) return undefined
  const active = open.flatMap((i) => i.sprints).filter((s) => s.state === 'active').sort((a, b) => String(b.start).localeCompare(String(a.start)))[0]
  const num = sprintNumber(active?.name)
  let all = open
  for (let k = 1; num && k <= history; k++) {
    const name = num.prefix + ' ' + (num.n - k)
    const cacheKey = 'points:' + (label || 'all') + ':' + name
    let got = await $.store.get(cacheKey)
    if (!got || now - got.at > 6 * 3_600_000) {
      const issues = await sprintIssues($, sprintJql(label, name))
      if (!issues) return undefined
      got = { at: now, issues }
      await $.store.set(cacheKey, got)
    }
    all = all.concat(got.issues)
  }
  return pointsStats(all, opts.my_account_id, opts.points_done_statuses, history)
}

function setPointsLights(stats, now) {
  const l = pointsLights(stats, opts.bug_pod_label, now)
  setLight('points', l.points, now)
  setLight('pod', l.pod, now)
}

// Results are shared through $.store so several open sessions don't all hit Jira/Bitbucket.
async function poll($, id, force) {
  const key = SOURCES.find((s) => s.id === id)?.parent ?? id
  if (busy[key]) return
  busy[key] = true
  try {
    const now = await $.clock.now()
    const shared = !LOCAL_ONLY.has(key)
    const cached = shared ? await $.store.get('light:' + key) : undefined
    if (!force && cached && now - cached.checkedAt < intervalMs(key) * 0.9) {
      lights[key] = cached
      for (const c of companions(key)) {
        const t = await $.store.get('light:' + c)
        if (t) lights[c] = t
      }
      return
    }
    if (key === 'coreapi') {
      if (!isWindows) {
        for (const s of ['coreapi', ...companions(key)]) setLight(s, { color: COLORS.grey, value: 'n/a', short: 'Port checks need Windows', detail: [] }, now)
      } else {
        const ports = [opts.bff_port, opts.movedocs_port, opts.ui_port].map(String)
        const [core, svc] = await Promise.all([
          runPowerShell($, 'coreapi-probe.ps1', ['-Port', String(opts.coreapi_port), '-RepoRoot', repoRoot]),
          runPowerShell($, 'ports-probe.ps1', ['-Ports', ports.join(',')]),
        ])
        setLight('coreapi', coreApiLight(core, opts.coreapi_port), now)
        setLight('bff', serviceLight('BFF', svc ? svc[ports[0]] ?? { up: false } : null, ports[0]), now)
        setLight('movedocs', serviceLight('MoveDocs API', svc ? svc[ports[1]] ?? { up: false } : null, ports[1]), now)
        setLight('ui', serviceLight('phoenix-ui dev server', svc ? svc[ports[2]] ?? { up: false } : null, ports[2], 'http://localhost:' + ports[2]), now)
      }
    } else if (key === 'pc') {
      const was = lights.pc?.color
      setLight('pc', isWindows ? machineLight(await runPowerShell($, 'machine-probe.ps1', [])) : { color: COLORS.grey, value: 'n/a', short: 'The computer check needs Windows', detail: [] }, now)
      alertOnRed($, 'pc', was, 'This computer is running out of resources')
    } else if (key === 'outlook') {
      const m = isWindows ? await runPowerShell($, 'messages-probe.ps1', []) : { outlook: 'off', teams: 'off' }
      setLight('outlook', outlookLight(m), now)
      setLight('meet', meetLight(m, now), now)
      setLight('teams', teamsLight(m), now)
    } else if (key === 'jira') {
      const r = await $.process.run(
        ['twg', 'jira', 'workitem', 'query', '--jql', opts.jira_jql, '--limit', '50', '-o', 'json', '--output-summary', 'none'],
        { timeoutMs: 90_000 },
      )
      setLight(key, jiraLight(parseJson(r.stdout)), now)
    } else if (key === 'bitbucket') {
      const prQuery = (role) =>
        $.process.run(['twg', 'prs', 'query', '--scope', 'me', '--role', role, '--state', 'open', '-o', 'json', '--output-summary', 'none'], { timeoutMs: 180_000 })
      const [workspace, repo] = String(opts.bitbucket_repo).split('/')
      // Recent pipeline runs say which of your PRs are failing; if they cannot be read the PRs are still listed
      const pipelineRuns = () =>
        $.process.run(['twg', 'bb', 'pipeline', 'query', '-w', workspace, '-r', repo, '-n', '40', '-o', 'json', '--output-summary', 'none'], { timeoutMs: 120_000 }).then(
          (x) => (x.exitCode === 0 ? parseJsonAny(x.stdout) : undefined),
          () => undefined,
        )
      const wasPrs = lights.bitbucket?.color
      const [r, rv, runs] = await Promise.all([prQuery('author'), prQuery('reviewer'), pipelineRuns()])
      const mine = parseJson(r.stdout)
      setLight(key, prLight(mine, opts.pr_repo_id, blockedPrs(mine, opts.pr_repo_id, runs, now)), now)
      alertOnRed($, 'bitbucket', wasPrs, 'A PR of yours has a failing pipeline')
      setLight('reviews', reviewLight(await withoutMyApprovals($, parseJson(rv.stdout)), opts.pr_repo_id), now)
    } else if (key === 'git') {
      if (!repoRoot) {
        setLight(key, gitLight(undefined), now)
        setLight('tree', worktreeLight(undefined), now)
      } else {
        const [r, wt] = await Promise.all([
          $.process.run(['git', '-C', repoRoot, 'status', '--porcelain=v2', '--branch'], { timeoutMs: 20_000 }),
          $.process.run(['git', '-C', repoRoot, 'worktree', 'list', '--porcelain'], { timeoutMs: 20_000 }),
        ])
        setLight(key, gitLight(r.exitCode === 0 ? parseGitStatus(r.stdout) : undefined, opts.bitbucket_repo), now)
        setLight('tree', worktreeLight(wt.exitCode === 0 ? parseWorktrees(wt.stdout) : undefined, repoRoot), now)
      }
    } else if (key === 'pipeline') {
      if (!lights.git?.branch) await poll($, 'git', true)
      const branch = lights.git?.branch
      const [workspace, repo] = String(opts.bitbucket_repo).split('/')
      const args = ['twg', 'bb', 'pipeline', 'query', '-w', workspace, '-r', repo, '-n', '5', '-o', 'json', '--output-summary', 'none']
      if (branch && !branch.startsWith('(')) args.push('--branch', branch)
      const r = await $.process.run(args, { timeoutMs: 120_000 })
      let runs = r.exitCode === 0 ? parseJsonAny(r.stdout) : undefined
      let anyBranch = false
      // A branch with no runs of its own (development, a fresh branch) falls back to the latest run on any branch
      if (Array.isArray(runs) && runs.length === 0 && args.includes('--branch')) {
        const r2 = await $.process.run(args.slice(0, args.indexOf('--branch')), { timeoutMs: 120_000 })
        const any = r2.exitCode === 0 ? parseJsonAny(r2.stdout) : undefined
        if (Array.isArray(any) && any.length) {
          runs = any
          anyBranch = true
        }
      }
      setLight(key, pipelineLight(runs, branch, opts.bitbucket_repo, anyBranch), now)
    } else if (key === 'radar') {
      if (!repoRoot) {
        setLight('radar', radarLight(undefined), now)
        setLight('drift', driftLight(undefined), now)
        setLight('merged', mergedLight(undefined), now)
        setLight('ship', shipLight(undefined), now)
      } else {
        const git = async (args, timeoutMs = 30_000) => {
          const r = await $.process.run(['git', '-C', repoRoot, ...args], { timeoutMs })
          return r.exitCode === 0 ? r.stdout : undefined
        }
        const lines = (t) => (t ?? '').split(/\r?\n/).filter(Boolean)
        // Refs only: no working-tree change. Keeps origin/* current so the radar and drift are not stale.
        await git(['fetch', 'origin', '--quiet', '--prune'], 120_000)
        const prod = newestRelease(lines(await git(['branch', '-r', '--list', 'origin/release/prod/*', '--format=%(refname:short)'])))
        const next = newestRelease(lines(await git(['branch', '-r', '--list', 'origin/release/next/*', '--format=%(refname:short)'])))
        const subjects = async (range) => (range ? lines(await git(['log', range, '--pretty=%s'])) : [])
        const nextCommits = prod && next ? await subjects(prod + '..' + next) : []
        const devCommits = await subjects((next ?? prod) ? (next ?? prod) + '..origin/development' : undefined)
        const prodAt = prod ? (await git(['log', '-1', '--format=%cI', prod]))?.trim() : undefined
        const devAt = (await git(['log', '-1', '--format=%cI', 'origin/development']))?.trim()
        const refs = async (...patterns) => lines(await git(['for-each-ref', '--format=%(refname:short) %(committerdate:short)', ...patterns]))
        const forecast = releaseForecast(
          await refs('refs/remotes/origin/release/prod'),
          await refs('refs/remotes/origin/release/next'),
          await refs('refs/remotes/origin/hotfix'),
          localDay(new Date(now)),
        )
        setLight('radar', radarLight(prod ? { prod, next, nextCommits, devCommits, prodAt, devAt, forecast } : undefined), now)
        await trackDeploys($, { prod, next, git, subjects, now })

        const mergedOut = await git(['log', 'origin/development', '--first-parent', '--since=midnight', '--pretty=%an|%s'])
        setLight('merged', mergedLight(mergedOut === undefined ? undefined : lines(mergedOut)), now)

        // Which tickets in the next release are not Done in Jira yet. Fails alone: only this light goes grey.
        const keys = ticketsIn(nextCommits)
        let open
        if (keys.length) {
          try {
            const jr = await $.process.run(
              ['twg', 'jira', 'workitem', 'query', '--jql', 'key in (' + keys.join(',') + ') AND statusCategory != Done', '--limit', '100', '-o', 'json', '--output-summary', 'none'],
              { timeoutMs: 120_000 },
            )
            const issues = jr.exitCode === 0 ? parseJsonAny(jr.stdout)?.data?.issues : undefined
            open = Array.isArray(issues) ? issues : undefined
          } catch {
            open = undefined
          }
        } else open = []
        setLight('ship', shipLight(open, next ? next.replace(/^origin\/release\/next\//, '') : undefined, keys.length), now)

        const base = (await git(['merge-base', 'HEAD', 'origin/development']))?.trim()
        const behind = base ? Number((await git(['rev-list', '--count', 'HEAD..origin/development']))?.trim()) : NaN
        if (!base || !Number.isFinite(behind)) setLight('drift', driftLight(undefined), now)
        else if (lights.git?.branch === 'development') {
          // On development itself "behind origin/development" is exactly what the Git light already shows
          setLight('drift', { color: COLORS.green, value: 'on dev', short: 'You are on development itself, so the Git light already shows how far behind you are', detail: [] }, now)
        } else {
          const theirs = new Set(lines(await git(['diff', '--name-only', base, 'origin/development'])))
          const mine = lines(await git(['diff', '--name-only', base]))
          setLight('drift', driftLight({ branch: lights.git?.branch ?? 'HEAD', behind, overlap: mine.filter((f) => theirs.has(f)) }), now)
        }
      }
    } else if (key === 'aiprod') {
      const was = lights.aiprod?.color
      const envs = isWindows ? await runPowerShell($, 'ai-probe.ps1', ['-Apps', Object.entries(AI_APPS).map(([k, v]) => k + '=' + v).join(';')]) : null
      const bad = !envs || envs._error
      const off = { color: COLORS.grey, value: '?', short: !isWindows ? 'App Insights checks need Windows' : envs?._error ?? 'App Insights could not be read', detail: [] }
      setLight('aiprod', bad ? off : aiHealthLight('prod', envs.prod), now)
      setLight('aiqa', bad ? off : aiHealthLight('qa', envs.qa), now)
      setLight('hangfire', bad ? off : hangfireLight(envs), now)
      setLight('deps', bad ? off : depsLight(envs), now)
      alertOnRed($, 'aiprod', was, 'PRODUCTION')
    } else if (key === 'cidev') {
      // This repo runs pipelines on pull requests only (nothing on a push to development or main), so team CI health is read off recent PR runs
      const [workspace, repo] = String(opts.bitbucket_repo).split('/')
      const was = lights.cidev?.color
      const r = await $.process.run(['twg', 'bb', 'pipeline', 'query', '-w', workspace, '-r', repo, '-n', '20', '-o', 'json', '--output-summary', 'none'], { timeoutMs: 120_000 })
      setLight('cidev', teamCiLight(r.exitCode === 0 ? parseJsonAny(r.stdout) : undefined, opts.bitbucket_repo), now)
      alertOnRed($, 'cidev', was, 'CI is failing across PRs')
    } else if (key === 'bugs') {
      const was = lights.bugs?.color
      const r = await $.process.run(['twg', 'jira', 'workitem', 'query', '--jql', bugsJql(opts.bug_pod_label), '--limit', '30', '-o', 'json', '--output-summary', 'none'], { timeoutMs: 90_000 })
      setLight('bugs', bugsLight(r.exitCode === 0 ? parseJsonAny(r.stdout) : undefined, opts.bug_pod_label), now)
      alertOnRed($, 'bugs', was, 'New urgent bug')
    } else if (key === 'points') {
      setPointsLights(await pointsFromJira($, now), now)
    } else if (key === 'seq') {
      const windowMin = Number(opts.seq_window_minutes)
      const from = new Date(now - windowMin * 60_000).toISOString()
      const filter = encodeURIComponent("@Level in ['Error', 'Fatal']")
      const url = String(opts.seq_url).replace(/\/+$/, '') + '/api/events?count=' + ERROR_LIMIT + '&render=true&filter=' + filter + '&fromDateUtc=' + encodeURIComponent(from)
      let events
      try {
        const res = await $.http.fetch(url, opts.seq_api_key ? { headers: { 'X-Seq-ApiKey': String(opts.seq_api_key) } } : undefined)
        events = res.ok ? parseJsonAny(res.text) : undefined
      } catch {
        events = undefined
      }
      setLight(key, seqLight(events, windowMin, ERROR_LIMIT, opts.seq_url), now)
    }
    if (shared) {
      if (lights[key]) await $.store.set('light:' + key, lights[key])
      for (const c of companions(key)) if (lights[c]) await $.store.set('light:' + c, lights[c])
    }
  } catch (err) {
    const now = await $.clock.now()
    setLight(key, { color: COLORS.grey, value: '?', short: 'Check failed: ' + shorten(err?.message ?? err, 60), detail: [] }, now)
  } finally {
    busy[key] = false
    syncPulse($)
    $.ui.invalidate('ui.render')
  }
}

// Toast once when a light turns red, not on the first reading or while it stays red
function alertOnRed($, id, was, label) {
  const l = lights[id]
  if (was && was !== COLORS.red && l?.color === COLORS.red) $.ui.toast('Dragon: ' + label + '. ' + l.short)
}

// Release branches are the nearest thing to a deploy marker git has. The commit each poll saw last time is kept
// in $.store, so a move of release/prod is toasted once with the tickets it brought (the Prod light shows the current version).
async function trackDeploys($, { prod, next, git, subjects, now }) {
  const sha = async (ref) => (ref ? (await git(['rev-parse', ref]))?.trim() : undefined)
  const [prodSha, nextSha] = [await sha(prod), await sha(next)]
  const prev = (await $.store.get('deploy:seen')) ?? {}
  const seen = { ...prev, prodRef: prod, nextRef: next }
  if (prodSha && prev.prodSha && prev.prodSha !== prodSha) {
    seen.prodAt = now
    seen.prodTickets = ticketsIn(await subjects(prev.prodSha + '..' + prodSha))
    $.ui.toast('Dragon: release/prod moved to ' + String(prod).replace(/^origin\/release\/prod\//, '') + (seen.prodTickets.length ? ' with ' + seen.prodTickets.join(', ') : ''))
  }
  if (nextSha && prev.nextSha && prev.nextSha !== nextSha) {
    const added = Number((await git(['rev-list', '--count', prev.nextSha + '..' + nextSha]))?.trim())
    const stillFresh = typeof prev.nextAt === 'number' && now - prev.nextAt < 24 * 3_600_000
    seen.nextNew = (stillFresh ? prev.nextNew ?? 0 : 0) + (Number.isFinite(added) ? added : 0)
    seen.nextAt = now
  }
  seen.prodSha = prodSha
  seen.nextSha = nextSha
  await $.store.set('deploy:seen', seen)
}

// twg lists every open PR you are a reviewer on, approved or not, so drop the ones you already approved.
// If the approvals cannot be read, the list stays as it was rather than hiding a PR that still needs you.
async function withoutMyApprovals($, json) {
  const all = json?.data?.pullRequests
  if (!Array.isArray(all) || !opts.my_account_id) return json
  const [workspace, repo] = String(opts.bitbucket_repo).split('/')
  const numbers = all.filter((p) => !opts.pr_repo_id || p.repo?.id === opts.pr_repo_id).map((p) => prNumber(p.url)).filter(Boolean).slice(0, 30)
  if (numbers.length === 0) return json
  try {
    const r = await $.process.run(['twg', 'bb', 'prs', 'get', ...numbers.map(String), '-w', workspace, '-r', repo, '-o', 'json', '--output-summary', 'none'], { timeoutMs: 180_000 })
    const done = approvedByMe(parseJson(r.stdout), opts.my_account_id)
    return done?.size ? { ...json, data: { ...json.data, pullRequests: all.filter((p) => !done.has(prNumber(p.url))) } } : json
  } catch {
    return json
  }
}

// Clicking the Git light with uncommitted changes lists them and offers a reset to the remote state.
// Returns true when it handled the click (there were changes), false to fall through to the normal click.
let resettingGit = false
async function reviewChanges($) {
  if (resettingGit || !repoRoot) return false
  const git = (...args) => $.process.run(['git', '-C', repoRoot, ...args], { timeoutMs: 120_000 })
  const st = await git('status', '--porcelain')
  const lines = String(st.stdout ?? '').split('\n').map((l) => l.trimEnd()).filter(Boolean)
  if (st.exitCode !== 0 || lines.length === 0) return false
  const reset = 'Reset: discard changes, then pull'
  let answer = ''
  try {
    answer = await $.ui.ask(dirtySummary(lines, lights.git?.branch), { header: 'Dragon', options: [reset, 'Keep my changes'] })
  } catch {
    return true
  }
  if (answer !== reset) return true
  resettingGit = true
  try {
    // A dangling commit holding the tracked changes, so "reset" can still be undone with git stash apply <id>
    const snap = String((await git('stash', 'create')).stdout ?? '').trim()
    const hard = await git('reset', '--hard')
    if (hard.exitCode !== 0) throw new Error(shorten(hard.stderr || hard.stdout || 'git reset failed', 140))
    const pull = await git('pull', '--ff-only')
    const recover = snap ? ' To get the discarded changes back: git stash apply ' + snap.slice(0, 10) : ''
    if (pull.exitCode === 0) $.ui.toast('Reset to the last commit and pulled.' + recover)
    else $.ui.toast('Reset done, but git pull failed: ' + shorten(pull.stderr || pull.stdout || 'unknown error', 120) + recover)
  } catch (err) {
    $.ui.toast('Reset failed: ' + shorten(err?.message ?? err, 140))
  } finally {
    resettingGit = false
    await poll($, 'git', true)
  }
  return true
}

// Clicking Git or Drift while behind offers to catch up: Git pulls the branch's own upstream, Drift merges origin/development
// into a feature branch (on development itself both lights mean the same pull). Returns true when it asked, false to fall through.
let syncingGit = false
async function syncBehind($, id) {
  if (syncingGit || !repoRoot) return false
  const git = (...args) => $.process.run(['git', '-C', repoRoot, ...args], { timeoutMs: 120_000 })
  const branch = lights.git?.branch
  const merge = id === 'drift' && branch && branch !== 'development'
  const target = merge ? 'origin/development' : '@{u}'
  const n = Number(String((await git('rev-list', '--count', 'HEAD..' + target)).stdout ?? '').trim())
  if (!Number.isFinite(n) || n === 0) return false
  const doIt = merge ? 'Merge origin/development into ' + branch : 'Pull (git pull --ff-only)'
  let answer = ''
  try {
    answer = await $.ui.ask(branch + ' is ' + n + ' commit(s) behind ' + (merge ? 'origin/development' : 'its upstream') + '.' + (lights[id]?.value?.includes('clash') ? ' Some files you changed also changed there, so expect conflicts.' : '') + ' Catch up now?', { header: 'Dragon', options: [doIt, 'Not now'] })
  } catch {
    return true
  }
  if (answer !== doIt) return true
  syncingGit = true
  try {
    if (merge) await git('fetch', 'origin', 'development')
    const r = merge ? await git('merge', '--no-edit', 'origin/development') : await git('pull', '--ff-only')
    if (r.exitCode === 0) $.ui.toast('Caught up: ' + n + ' commit(s) brought in.')
    else {
      if (merge) await git('merge', '--abort')
      $.ui.toast((merge ? 'The merge had conflicts and was undone, nothing changed. ' : 'Pull failed: ') + shorten(r.stderr || r.stdout || 'unknown error', 120))
    }
  } catch (err) {
    $.ui.toast('Sync failed: ' + shorten(err?.message ?? err, 140))
  } finally {
    syncingGit = false
    await poll($, 'git', true)
  }
  return true
}

// CoreAPI's database toggle: "local db" offers Docker, "docker db" offers local; "down" offers to start it on either; any other state offers nothing
const dbSwitchTarget = (l) => (l?.value === 'local db' ? 'docker' : l?.value === 'docker db' ? 'local' : undefined)
const coreIsDown = (l) => l?.value === 'down'
let switchingDb = false

// Why CoreAPI cannot be pointed at this database right now, or '' when it can
function dbNotReady(cur, to) {
  if (to === 'docker' && cur?.dockerReady === false) return 'No Docker SQL container is publishing :1433. Start Docker and its SQL container, then try again.'
  if (to === 'local' && cur?.localReady === false) return 'The local SQL Server service (MSSQLSERVER) is not running. Start it, then try again.'
  return ''
}

// Runs use-<to>-db.ps1 (it stops CoreAPI if it is running, then starts it on that database) and refreshes the light
async function restartCoreOn($, to, starting) {
  const cur = lights.coreapi
  switchingDb = true
  setLight('coreapi', { ...cur, color: COLORS.working, value: 'switching', short: (starting ? 'Starting' : 'Restarting') + ' CoreAPI on the ' + to + ' DB (use-' + to + '-db.ps1)…' }, await $.clock.now())
  $.ui.invalidate('ui.render')
  try {
    const r = await $.process.run(
      ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $.plugin.root + '\\scripts\\switch-db.ps1', '-Target', to, '-Dir', String(opts.db_scripts_dir ?? ''), '-Port', String(opts.coreapi_port)],
      { timeoutMs: 240_000 },
    )
    const res = parseJson(r.stdout)
    const name = (starting ? 'Start on ' : 'Switch to ') + to + ' DB'
    if (res?.ok) $.ui.toast('CoreAPI is ' + (starting ? 'up' : 'back up') + ' on your ' + to + ' DB.')
    else $.ui.toast(name + ' did not finish: ' + shorten(res?.error ?? res?.tail ?? 'no answer from the script', 140))
  } catch (err) {
    $.ui.toast((starting ? 'Start on ' : 'Switch to ') + to + ' DB failed: ' + shorten(err?.message ?? err, 120))
  } finally {
    switchingDb = false
    await poll($, 'coreapi', true)
  }
}

// Pressing "down" on the Core light: ask which database, then start CoreAPI on it the same way a switch does
async function startCore($) {
  if (switchingDb) return
  let answer = ''
  try {
    answer = await $.ui.ask(
      'CoreAPI is not running. Start it on which database? This starts CoreAPI on :' + opts.coreapi_port + ' (runs use-local-db.ps1 or use-docker-db.ps1).',
      { header: 'Dragon', options: ['Start on local db', 'Start on docker db'] },
    )
  } catch {
    return
  }
  const to = answer === 'Start on local db' ? 'local' : answer === 'Start on docker db' ? 'docker' : undefined
  if (!to) return
  const refusal = dbNotReady(lights.coreapi, to)
  if (refusal) return $.ui.toast(refusal)
  await restartCoreOn($, to, true)
}

async function switchDb($, to) {
  if (switchingDb) return
  const from = to === 'docker' ? 'local' : 'docker'
  const refusal = dbNotReady(lights.coreapi, to)
  if (refusal) return $.ui.toast(refusal)
  let answer = ''
  try {
    answer = await $.ui.ask(
      'CoreAPI is using your ' + from + ' DB. Switch to your ' + to + ' DB? This restarts CoreAPI on :' + opts.coreapi_port + ' (runs use-' + to + '-db.ps1).',
      { header: 'Dragon', options: ['Switch to ' + to + ' db', 'Stay on ' + from + ' db'] },
    )
  } catch {
    return
  }
  if (answer !== 'Switch to ' + to + ' db') return
  await restartCoreOn($, to, false)
}

// Advice Dragon has already announced this session; an item is re-armed once its condition clears
const announced = new Set()
let startBranch = ''
let compacting = false

// The two test lights: backend (C#) keeps the original store key so an older record still loads
const TEST_KINDS = {
  be: { light: 'tests', store: 'last-test-all:' },
  fe: { light: 'fe-tests', store: 'last-test-fe:' },
}

// Shows a finished run on its light and remembers it for the next session
// full: Dragon ran the whole suite itself, so a restart keeps the record whatever the command looks like (a custom auto_test_command)
async function recordTestRun($, run, command, at, full = false) {
  const kind = testKind(run)
  if (!kind) return
  // A run that found no tests (a -t filter or -o with nothing related) says nothing about the suite: keep the last real result
  if (run.passed + run.failed === 0 && /^\d+ (pass|fail)/.test(lights[TEST_KINDS[kind].light]?.value ?? '')) return
  setLight(TEST_KINDS[kind].light, testLight(run, command, at, at, kind), at)
  await $.store.set(TEST_KINDS[kind].store + repoRoot, { run, command, at, ...(full ? { full: true } : {}) })
}

// npm and npx are .cmd shims on Windows, which cannot be started without a shell
const shellWrap = (argv) => (isWindows && (argv[0] === 'npm' || argv[0] === 'npx') ? ['cmd', '/c', ...argv] : argv)

// Automatic runs are background work: BelowNormal priority (children inherit it) keeps the terminal and editor responsive while they run
const lowPriority = ($, argv) => (isWindows ? ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $.plugin.root + '\\scripts\\low-priority.ps1', ...argv] : argv)

// What to run when a kind has no recorded run: { cwd, shown, parts: [{ argv, label }] } or undefined when this repo has nothing to run.
// A kind is the TOTAL for the repo, so it is several runs added up: one $.process.run lasts ten minutes at most, which a whole
// suite never fits in. Backend = every C# test project; front end = the whole Jest suite as FE_SHARDS --shard parts.
const FE_SHARDS = 24
async function autoTestPlan($, kind) {
  const custom = String((kind === 'be' ? opts.auto_test_command : opts.auto_fe_test_command) ?? '').split(' ').filter(Boolean)
  if (custom.length) return { cwd: repoRoot, shown: custom.join(' '), parts: [{ argv: lowPriority($, shellWrap(custom)), label: '' }] }
  const list = async (glob) => String((await $.process.run(['git', '-C', repoRoot, 'ls-files', glob], { timeoutMs: 15_000 })).stdout ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
  if (kind === 'be') {
    const projects = (await list('*Tests*.csproj')).filter((p) => !/TestHelpers/i.test(p))
    // Build into a folder of our own: with CoreAPI/BFF running (the APIs button starts them) their bin\Debug DLLs are locked, so every
    // test project spent ~3 minutes in MSB3026 copy retries and then failed with no summary, which is what made the light "unclear".
    // One folder per checkout, because obj/<project> names would otherwise collide between worktrees.
    const tmp = ((await $.env.get('TEMP')) ?? 'C:\\Windows\\Temp').replace(/[\\/]+$/, '')
    const artifacts = isWindows ? tmp + '\\pet-dragon-artifacts\\' + artifactsFolderName(repoRoot) : undefined
    const parts = projects.map((p) => ({ argv: lowPriority($, ['dotnet', 'test', p, '--nologo', '-m:2', ...(artifacts ? ['--artifacts-path', artifacts] : [])]), label: p.split('/').pop().replace(/\.csproj$/, '') }))
    return parts.length ? { cwd: repoRoot, shown: 'dotnet test, all ' + parts.length + ' test projects', parts } : undefined
  }
  if (!(await list('phoenix-ui/package.json')).length) return undefined
  // --maxWorkers: uncapped, Jest starts one ~700 MB worker per core (phoenix-ui/AGENTS.md says always pass it)
  const npm = ['npm', 'run', 'test', '--', '--silent', '--maxWorkers=4']
  const parts = Array.from({ length: FE_SHARDS }, (_, i) => ({ argv: lowPriority($, shellWrap([...npm, '--shard=' + (i + 1) + '/' + FE_SHARDS])), label: 'part ' + (i + 1) + ' of ' + FE_SHARDS }))
  return { cwd: repoRoot + '/phoenix-ui', shown: 'npm run test, full suite in ' + FE_SHARDS + ' parts', parts }
}

// Tests never sit at "not run": when nothing is recorded for a kind in this repo, run it and record the result.
// The two suites run one after the other (each light still tracks its own parts): side by side they doubled the load on the machine.
const testBusy = {}
async function autoRunTests($) {
  if (!repoRoot) return
  for (const kind of ['be', 'fe']) await runTestKind($, kind, false)
}

// Runs one part to its end and returns { code, output, elapsedMs }. It is streamed with $.process.spawn, which has no ten-minute limit
// (a single C# test project here takes up to twenty), and onProgress hears the newest output line while it runs.
// Only the tail of the output is kept: the runner's summary line is the last thing it prints.
const PART_CEILING_MS = 45 * 60_000
async function runPart($, argv, cwd, onProgress) {
  const startedAt = await $.clock.now()
  let output = ''
  let lastTick = 0
  const stream = $.process.spawn({ argv, cwd })
  for await (const piece of stream) {
    output = (output + piece.text).slice(-200_000)
    const now = await $.clock.now()
    if (now - startedAt > PART_CEILING_MS) {
      // Leaving the loop kills the child
      return { code: null, output, elapsedMs: now - startedAt }
    }
    if (now - lastTick > 10_000) {
      lastTick = now
      const line = output.split('\n').map((l) => l.trim()).filter(Boolean).pop()
      onProgress(now - startedAt, line ?? '')
    }
  }
  const ended = await stream.result.catch(() => undefined)
  return { code: ended?.code ?? null, output, elapsedMs: (await $.clock.now()) - startedAt }
}

// A part that finishes without a pass/fail summary is recorded with its cause and the run goes on to the next part, so one slow or
// broken project no longer hides the result of the rest. force: re-run although the light shows a problem (a click on it).
// A click on a test light that is not in trouble: running the whole suite is slow, so ask first
async function confirmTestRun($, kind) {
  const what = kind === 'fe' ? 'the full front-end Jest suite (24 parts, about 100 minutes)' : 'every C# test project'
  try {
    return (await $.ui.ask('Run ' + what + ' now?', { header: 'Dragon', options: ['Run the tests', 'Not now'] })) === 'Run the tests'
  } catch {
    return false
  }
}

// again: a click on a light that shows a passing result, after confirmTestRun
async function runTestKind($, kind, force, again) {
  const light = TEST_KINDS[kind].light
  const value = lights[light]?.value
  if (testBusy[kind] || !(again || value === 'not run' || value === 'queued' || (force && testNeedsRun(lights[light])))) return
  testBusy[kind] = true
  try {
    const plan = await autoTestPlan($, kind)
    if (!plan) {
      // Nothing to run in this repo: put the light back to "not run" rather than leave it queued
      if (value === 'queued') setLight(light, testLight(undefined, undefined, undefined, undefined, kind), await $.clock.now())
      return
    }
    const count = plan.parts.length
    const total = { passed: 0, failed: 0 }
    const problems = []
    const failures = []
    for (let i = 0; i < count; i++) {
      const part = plan.parts[i]
      // The value is the running TOTAL, like the finished light; which part is running goes in the hover
      const sofar = total.failed > 0 ? total.failed + ' fail…' : total.passed > 0 ? total.passed + ' pass…' : 'running'
      const show = (elapsedMs, line) => {
        const where = count > 1 ? 'Part ' + (i + 1) + ' of ' + count + ' (' + part.label + ') running' + (elapsedMs ? ' for ' + Math.round(elapsedMs / 60_000) + ' min' : '') + '; so far ' + total.passed + ' passed, ' + total.failed + ' failed' + (problems.length ? ', ' + problems.length + ' with no result' : '') + '. ' : ''
        setLight(light, { color: total.failed > 0 ? COLORS.red : COLORS.working, value: sofar, short: where + 'No test run was recorded for this repo, so Dragon is running ' + plan.shown + '.', detail: line ? ['Latest output:', shorten(line, 110)] : [] }, Date.now())
        $.ui.invalidate('ui.render')
      }
      show(0, '')
      let last
      const got = await runTestPart({ kind, command: part.argv.join(' '), runOnce: async () => (last = await runPart($, part.argv, plan.cwd, show)), ceilingMs: PART_CEILING_MS, onRetry: (why) => show(0, 'Retrying once (' + why.value + '): ' + shorten(why.line ?? why.why, 80)) })
      if (got.counted) {
        total.passed += got.counted.passed
        total.failed += got.counted.failed
      } else if (got.problem) {
        problems.push({ label: part.label || 'run', value: got.problem.value, why: got.problem.why, line: got.problem.line })
      }
      // Keep what failed so it can be read afterwards: the light only shows a count, and the output is gone once the part ends
      if (got.problem || got.counted?.failed > 0) failures.push({ part: part.label || 'run', cause: got.problem?.value ?? 'test failures', failed: got.counted?.failed, excerpt: failureExcerpt(last?.output) })
    }
    await $.store.set('test-failures:' + kind + ':' + repoRoot, { at: await $.clock.now(), command: plan.shown, failures })
    if (problems.length === 0) {
      await recordTestRun($, { runner: kind === 'be' ? 'dotnet' : 'jest', passed: total.passed, failed: total.failed }, plan.shown, await $.clock.now(), true)
      return
    }
    // Some parts gave no result. Anything that did fail is still the headline; otherwise show the count that is known, marked partial.
    const names = problems.slice(0, 6).map((p) => p.label + ' (' + p.value + ')')
    const detail = [total.passed + ' passed, ' + total.failed + ' failed in the ' + (count - problems.length) + ' parts that finished', ...problems.slice(0, 6).map((p) => p.label + ': ' + p.why + (p.line ? ' [' + shorten(p.line, 80) + ']' : ''))]
    const say = problems.length + ' of ' + count + ' parts gave no result: ' + names.join(', ') + (problems.length > 6 ? ', …' : '') + '. Click this light to run again'
    const headline = total.failed > 0 ? total.failed + ' fail' : total.passed > 0 ? total.passed + ' pass' : problems[0].value
    setLight(light, { color: partialRunColor(total), value: headline, partial: true, short: (total.failed > 0 ? total.failed + ' failed, ' : '') + total.passed + ' passed; ' + say, detail }, await $.clock.now())
  } finally {
    testBusy[kind] = false
  }
}

// Late afternoon: remind about tomorrow's first meeting, once a day
async function checkMeetReminder($) {
  try {
    const now = await $.clock.now()
    const reminded = await $.store.get('meet-reminded')
    if (!shouldRemindMeeting(now, Date.now() - lastActivity, reminded)) return
    const first = lights.meet?.tomorrowFirst
    if (!first) return
    await $.store.set('meet-reminded', localDay(new Date(now)))
    $.ui.toast('Dragon: Your first meeting tomorrow is at ' + first + '.')
  } catch {}
}

// Context, spend and limits: refresh the three Use lights, announce new advice, and compact when asked to
async function refreshContext($, { turnEnded } = {}) {
  let u
  try {
    u = await $.session.usage()
    session.contextPct = u?.context?.percent
  } catch {
    session.contextPct = undefined
    return
  }
  try {
    const now = await $.clock.now()
    // Spend: add what this session cost since the last look to today's total, kept across sessions in the store
    const cost = u?.cost?.usd
    const today = localDay(new Date(now))
    let days = (await $.store.get('token-days')) ?? {}
    if (typeof cost === 'number' && typeof u?.startedAt === 'number') {
      // What each session has already been counted for, so a reload never double counts. A session that began today
      // spent all of it today; one from an earlier day starts counting from now (its split by day is unknown).
      const seen = (await $.store.get('token-sessions')) ?? {}
      const key = String(u.startedAt)
      const recorded = seen[key] ?? (localDay(new Date(u.startedAt)) === today ? 0 : cost)
      const delta = Math.max(0, cost - recorded)
      if (delta > 0 || seen[key] === undefined) {
        const keepKeys = Object.keys({ ...seen, [key]: cost }).sort().slice(-40)
        const next = { ...seen, [key]: cost }
        await $.store.set('token-sessions', Object.fromEntries(keepKeys.map((k) => [k, next[k]])))
      }
      if (delta > 0) {
        days = { ...days, [today]: Number(days[today] ?? 0) + delta }
        const keep = Object.keys(days).sort().slice(-30)
        days = Object.fromEntries(keep.map((k) => [k, days[k]]))
        await $.store.set('token-days', days)
      }
    }
    const day = dayStats(days, today)
    // Open sessions: each one stamps itself in the shared store every tick; a stamp older than three ticks is a closed session
    const beats = liveSessions((await $.store.get('session-beats')) ?? {}, now, SESSION_BEAT_MAX_AGE_MS)
    beats[String(u?.startedAt ?? now)] = now
    await $.store.set('session-beats', beats)
    setLight('sessions', sessionsLight(Object.keys(beats).length), now)
    setLight('ctx', ctxLight(session.contextPct), now)
    dayPart = dayLight(day)
    setLight('cost', costLight(dayPart, monthPart), now)
    lastRateLimits = u?.rateLimits
    // Which reply the cache clock counts from is kept per session in the store, so a reload does not turn it cold
    const replies = (await $.store.get('cache-replies')) ?? {}
    const replyKey = String(u?.startedAt ?? 'unknown')
    if (turnEnded) {
      const next = { ...replies, [replyKey]: now }
      await $.store.set('cache-replies', Object.fromEntries(Object.keys(next).sort().slice(-40).map((k) => [k, next[k]])))
      lastReplyAt = now
    } else if (lastReplyAt === undefined) lastReplyAt = replies[replyKey]
    syncCache($)
    refreshMonth($)

    if (!startBranch && lights.git?.branch) startBranch = lights.git.branch
    const advice = tokenAdvice({
      contextPct: session.contextPct,
      startBranch,
      branch: lights.git?.branch,
      sessionMinutes: typeof u?.startedAt === 'number' ? (now - u.startedAt) / 60_000 : 0,
      day,
      limits: u?.rateLimits,
    })
    const ids = new Set(advice.map((a) => a.id))
    for (const id of [...announced]) if (!ids.has(id)) announced.delete(id)
    const fresh = advice.filter((a) => !announced.has(a.id))
    for (const a of fresh) announced.add(a.id)
    const auto = String(opts.token_coach) === 'auto' && turnEnded && !compacting && advice.some((a) => a.action === 'compact') && session.contextPct >= Number(opts.auto_compact_percent)
    if (auto) {
      compacting = true
      const was = Math.round(session.contextPct)
      // Wait for the turn to settle: a compact is refused while one runs
      $.clock.after(2_000, async () => {
        try {
          const r = await $.session.compact({ instructions: 'Keep the current task, decisions made, file paths, and open TODOs.' })
          if (!r?.skip) $.ui.toast('Dragon compacted your context (was ' + was + '% full).')
        } catch {
          // a turn started again or compaction was refused: the advice stays on the light
        } finally {
          compacting = false
          await refreshContext($)
        }
      })
    } else if (fresh.length) {
      $.ui.toast('Dragon: ' + fresh[0].text)
    }
  } catch {
    // The Use lights are advisory; a failed reading leaves the previous ones
  } finally {
    syncPulse($)
    $.ui.invalidate('ui.render')
  }
}

// The cache light is a countdown: re-read every 30s, every second in the last two minutes, and not at all while the dragon sleeps
function syncCache($) {
  const now = Date.now()
  const running = session.state !== 'idle' && session.state !== 'error'
  setLight('cache', cacheLight(lastReplyAt, now, running), now)
  const left = typeof lastReplyAt === 'number' ? CACHE_TTL_MS - (now - lastReplyAt) : 0
  const want = left > 0 && !running && !moodNow().asleep ? (left <= 120_000 ? 1000 : 30_000) : 0
  if (want !== cacheEvery) {
    cacheTimer?.cancel()
    cacheTimer = want ? $.clock.every(want, () => syncCache($)) : null
    cacheEvery = want
  }
  $.ui.invalidate('ui.render')
}

// Account spend this month, shared across sessions through the store; a 429 backs every session off together
async function refreshMonth($, force) {
  if (monthlyBusy) return
  monthlyBusy = true
  try {
    const now = await $.clock.now()
    const cached = (await $.store.get('monthly-cache')) ?? undefined
    if (cached?.reading) monthlyReading = cached.reading
    const fresh = cached && (now < (cached.backoffUntil ?? 0) || (cached.reading && now - cached.fetchedAt < MONTHLY_REFRESH_MS))
    if (!force && fresh) {
      monthlyError = cached.reading ? '' : 'rate limited, retrying later'
    } else {
      const auth = await $.session.authorize()
      if (!auth) monthlyError = 'not signed in'
      else {
        const r = await $.http.fetch(USAGE_URL, { auth: auth.handle, headers: { 'anthropic-beta': 'oauth-2025-04-20' } })
        if (r.ok) {
          const reading = parseMonthly(r.text)
          monthlyReading = reading
          monthlyError = reading ? '' : 'no monthly spend limit on this account'
          await $.store.set('monthly-cache', { reading: reading ?? null, fetchedAt: now, backoffUntil: 0 })
        } else {
          monthlyError = 'HTTP ' + r.status
          if (r.status === 429) await $.store.set('monthly-cache', { reading: cached?.reading ?? null, fetchedAt: cached?.fetchedAt ?? 0, backoffUntil: now + MONTHLY_BACKOFF_MS })
        }
      }
    }
    monthPart = monthLight(monthlyReading, lastRateLimits, monthlyError, now)
    setLight('cost', costLight(dayPart, monthPart), now)
  } catch (err) {
    monthlyError = shorten(err?.message ?? err, 50)
    monthPart = monthLight(monthlyReading, lastRateLimits, monthlyError, Date.now())
    setLight('cost', costLight(dayPart, monthPart), Date.now())
  } finally {
    monthlyBusy = false
    $.ui.invalidate('ui.render')
  }
}

// Clicking the dragon toggles /speak (voice replies), the same switch the /speak command flips
let voiceBusy = false
// A cute hello through the same Windows speech engine the /speak replies use (claude-speak.exe is a copy of powershell.exe the stop script can kill).
// Fire and forget: the speech lasts a few seconds and the toggle should not wait for it.
const HELLO = 'Hello! My name is Yoshi, your pet dragon. How can I help you?'
function sayHello($, home) {
  const script = "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.Speak('" + HELLO + "')"
  $.process.run([home + '\\.claude\\hooks\\claude-speak.exe', '-NoProfile', '-Command', script], { timeoutMs: 30_000 }).catch(() => {})
}
async function dragonPressed($) {
  if (voiceBusy) return
  voiceBusy = true
  try {
    // What the /speak command runs, called directly: no model turn, and the script itself knows whether replies are on
    const home = await $.env.get('USERPROFILE')
    if (!isWindows || !home) return $.ui.toast('Dragon: /speak is only wired up on Windows')
    const r = await $.process.run(['powershell', '-NoProfile', '-File', home + '\\.claude\\hooks\\speak-toggle.ps1', 'toggle'], { timeoutMs: 15_000 })
    const said = String(r.stdout ?? '').trim()
    if (r.exitCode !== 0 || !said) return $.ui.toast('Dragon could not toggle /speak: ' + shorten(String(r.stderr ?? '').trim() || 'no answer (exit ' + r.exitCode + ')', 100))
    $.ui.toast('Dragon: ' + said)
    if (/\bON\b/.test(said)) sayHello($, home)
  } catch (err) {
    $.ui.toast('Dragon could not toggle /speak: ' + shorten(err?.message ?? err, 100))
  } finally {
    voiceBusy = false
  }
}

// Clicking the Cache light: /compact, asking first what the summary should keep. The cache is warm at the cheapest moment to do it.
const COMPACT_KEEP = 'Keep the current task, decisions made, file paths, and open TODOs.'
async function compactNow($) {
  if (compacting) return
  if (session.state !== 'idle' && session.state !== 'error') return $.ui.toast('Dragon: a turn is running. Click Cache again when it finishes to compact.')
  let answer
  try {
    answer = await $.ui.ask('Compact the conversation? To redirect what the summary keeps, type it under "Other".', ['Keep the task, decisions and open TODOs', 'Compact with no redirection', 'Cancel'])
  } catch {
    return
  }
  if (answer === 'Cancel') return
  const instructions = answer === 'Compact with no redirection' ? '' : answer === 'Keep the task, decisions and open TODOs' ? COMPACT_KEEP : String(answer ?? '').trim()
  compacting = true
  try {
    const r = await $.session.compact(instructions ? { instructions } : {})
    $.ui.toast(r?.skip ? 'Dragon: something vetoed the compact.' : 'Dragon compacted the conversation.')
  } catch (err) {
    $.ui.toast('Dragon could not compact: ' + shorten(err?.message ?? err, 80))
  } finally {
    compacting = false
    await refreshContext($)
  }
}

async function loadSkills($) {
  try {
    skills = indexSkills(await $.command.list(), $.plugin.name)
  } catch {
    skills = []
  }
}

function syncFlap($) {
  const flapping = session.state === 'working' || session.state === 'tool' || session.typing
  if (flapping) {
    if (!flapTimer) {
      flapTimer = $.clock.every(FLAP_MS, () => {
        frame = (frame + 1) % FLAP.length
        $.ui.invalidate('ui.render')
      })
    }
  } else if (flapTimer) {
    flapTimer.cancel()
    flapTimer = null
    frame = 0
  }
  $.ui.invalidate('ui.render')
}

function setState($, state, tool) {
  session.state = state
  session.tool = tool ?? ''
  syncFlap($)
  syncCache($)
}

// Any change to the prompt box (a keystroke, or dictated text landing) counts as typing for a moment
function noteTyping($, typing) {
  if (typing) noteActivity($)
  const was = session.typing
  typingTimer?.cancel()
  typingTimer = null
  session.typing = typing
  if (typing) {
    typingTimer = $.clock.after(TYPING_HOLD_MS, () => {
      typingTimer = null
      session.typing = false
      syncFlap($)
    })
  }
  // Every keystroke lands here: redraw only when typing starts or stops, not on each key while it is already on
  if (typing !== was) syncFlap($)
}

// Anything the person or Claude does wakes the dragon
const POLL_IDS = ['pc', 'git', 'coreapi', 'seq', 'radar', 'outlook', 'jira', 'pipeline', 'bitbucket', 'aiprod', 'cidev', 'bugs', 'points']
function noteActivity($) {
  lastActivity = Date.now()
  if (wasSleepy) {
    wasSleepy = false
    syncCache($)
    $.ui.invalidate('ui.render')
    // Polls were skipped while asleep: refresh anything past its interval (poll() skips lights that are still fresh)
    for (const id of POLL_IDS) poll($, id)
  }
}

function sleepyAfterMs() {
  return Number(opts.sleepy_after_minutes) * 60_000
}

// Called once a minute: redraw only when the dragon has just dozed off
function checkSleepy($) {
  const asleep = moodNow().asleep
  if (asleep !== wasSleepy) {
    wasSleepy = asleep
    syncCache($)
    $.ui.invalidate('ui.render')
  }
}

// Lights the headline never counts: the next release's open tickets and the daily spend are not something you can act on right now
// bitbucket (PRs): your own PRs wait on your peers to review them, so they are not yours to act on. The Review light is.
const NOT_FOR_HEADLINE = new Set(['ship', 'cost', 'cache', 'aiqa', 'bugs', 'bitbucket', 'points', 'pod', 'pc'])
const currentHeadline = () => headline(SOURCES.filter((s) => !NOT_FOR_HEADLINE.has(s.id)).map((s) => ({ label: s.hl ?? s.label, light: lights[s.id] })))

function moodNow() {
  const key = pickMood({
    session: session.state,
    typing: session.typing,
    unread: unreadCount(),
    needs: currentHeadline().count,
    contextPct: session.contextPct,
    contextWarn: Number(opts.context_warn_percent),
    idleMs: Date.now() - lastActivity,
    sleepyAfterMs: sleepyAfterMs(),
  })
  const mood = MOODS[key]
  const short = key === 'tool' && session.tool ? 'Claude is running ' + session.tool : mood.short
  // Asleep is the sprite's pose; a mood with its own color (mail, context, error) keeps that color while it dozes
  const asleep = isAsleep({ session: session.state, typing: session.typing, idleMs: Date.now() - lastActivity, sleepyAfterMs: sleepyAfterMs() })
  return { key, ...mood, label: asleep && key !== 'sleepy' ? mood.label + ' · Asleep' : mood.label, short, asleep }
}

// Jira, PRs and commits changed since the previous working day, gathered in parallel.
// Each source fails alone: a missing twg login leaves that section saying so.
async function runStandup($) {
  const since = standupSince(new Date())
  const day = localDay(since)
  const query = async (argv) => {
    try {
      const r = await $.process.run(argv, { timeoutMs: 120_000 })
      return r.exitCode === 0 ? parseJsonAny(r.stdout) : undefined
    } catch {
      return undefined
    }
  }
  const gitLog = async () => {
    if (!repoRoot) return undefined
    try {
      const who = await $.process.run(['git', '-C', repoRoot, 'config', 'user.email'], { timeoutMs: 10_000 })
      const args = ['git', '-C', repoRoot, 'log', '--all', '--no-merges', '--since=' + day, '--pretty=format:%h %s']
      if (who.exitCode === 0 && who.stdout.trim()) args.push('--author=' + who.stdout.trim())
      const r = await $.process.run(args, { timeoutMs: 20_000 })
      return r.exitCode === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : undefined
    } catch {
      return undefined
    }
  }
  const [jira, prs, commits] = await Promise.all([
    query(['twg', 'jira', 'workitem', 'query', '--jql', 'assignee = currentUser() AND updated >= "' + day + '" ORDER BY updated DESC', '--limit', '50', '-o', 'json', '--output-summary', 'none']),
    query(['twg', 'prs', 'query', '--scope', 'me', '--role', 'any', '--state', 'all', '--updated-since', day, '-o', 'json', '--output-summary', 'none']),
    gitLog(),
  ])
  return formatStandup({ since, issues: jira?.data?.issues, prs: prs?.data?.pullRequests, commits, repoId: opts.pr_repo_id })
}

// The Standup buttons (band and pane): gather it, then show it in the /dragon pane
async function pressStandup($) {
  if (standupBusy) return
  standupBusy = true
  $.ui.invalidate('ui.render')
  try {
    standupText = await runStandup($)
  } catch (err) {
    standupText = 'Standup failed: ' + shorten(err?.message ?? err, 100)
  }
  standupBusy = false
  $.ui.invalidate('ui.render')
}

// The band's Standup button: gather it, then print it into the chat (a dim transcript line, not sent to the model)
async function printStandup($) {
  if (standupBusy) return
  standupBusy = true
  $.ui.toast('Dragon is gathering your standup…')
  try {
    // One log call is one row, so a multi-line table is printed a line at a time to keep its columns
    for (const line of (await runStandup($)).split('\n')) $.ui.log(line)
  } catch (err) {
    $.ui.log('Standup failed: ' + shorten(err?.message ?? err, 100))
  }
  standupBusy = false
}

// /dragon sleep: doze off now instead of waiting for sleepy_after_minutes. Any activity wakes it.
function sleepNow($) {
  lastActivity = -Infinity
  checkSleepy($)
}

// A bug in pet-dragon must never block a tool or a prompt: pass the event through unchanged.
async function failOpen($, e, next) {
  return next(e)
}

// What "APIs" starts: each local service in row 0 that is not listening, in its own console window (close it to stop it).
// Same commands as the start-*.cmd scripts in the repo root, minus the database migrations start-core-api.cmd runs first.
const API_STARTS = [
  { id: 'coreapi', title: 'Phoenix CoreAPI', dir: 'core-api\\CoreAPI', cmd: 'dotnet run --project Phoenix.CoreAPI.csproj' },
  { id: 'bff', title: 'Phoenix BFF', dir: 'bff\\Phoenix.BFF', cmd: 'dotnet run --project Phoenix.BFF.csproj' },
  { id: 'movedocs', title: 'Phoenix MoveDocs API', dir: 'movedocs\\Phoenix.MoveDocs', cmd: 'dotnet run --project Phoenix.MoveDocs.csproj' },
  // The title needs a space: `start` only reads its first argument as a window title when it arrives quoted, and arguments are quoted only if they contain a space
  { id: 'ui', title: 'Phoenix UI', dir: 'phoenix-ui', cmd: 'npm run dev' },
]

// Clicking the Teams light while Teams is off starts it, then looks again so the light turns green
async function startTeams($) {
  if (!isWindows) return $.ui.toast('Dragon can only start Teams on Windows.')
  try {
    const r = await $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $.plugin.root + '\\scripts\\start-teams.ps1'], { timeoutMs: 30_000 })
    const said = String(r.stdout ?? '').trim()
    $.ui.toast(r.exitCode === 0 ? 'Dragon: ' + said + '. Its light updates in a moment.' : 'Dragon could not start Teams: ' + (said || 'unknown error'))
  } catch (err) {
    $.ui.toast('Dragon could not start Teams: ' + shorten(err?.message ?? err, 80))
  }
  for (const secs of [8, 25]) $.clock.after(secs * 1000, () => poll($, 'outlook', true))
}

async function startApis($) {
  if (!isWindows || !repoRoot) return $.ui.toast('Dragon can only start the APIs from a repo on Windows.')
  // Look at the ports now rather than trusting a light that may be minutes old (or "?"): the UI was skipped that way
  const portOf = { bff: opts.bff_port, movedocs: opts.movedocs_port, ui: opts.ui_port }
  const probe = await runPowerShell($, 'ports-probe.ps1', ['-Ports', Object.values(portOf).join(',')]).catch(() => null)
  const down = API_STARTS.filter((a) => (a.id in portOf && probe ? !probe[String(portOf[a.id])]?.up : ['down', 'off', '?'].includes(lights[a.id]?.value)))
  if (down.length === 0) return $.ui.toast('Everything in the APIs row is already running.')
  const root = repoRoot.replace(/\//g, '\\')
  for (const a of down) {
    try {
      await $.process.run(['cmd', '/c', 'start', a.title, 'cmd', '/k', 'cd /d ' + root + '\\' + a.dir + ' && ' + a.cmd], { timeoutMs: 15_000 })
    } catch (err) {
      $.ui.toast('Dragon could not start ' + a.title + ': ' + shorten(err?.message ?? err, 80))
    }
  }
  $.ui.toast('Starting ' + down.map((a) => a.title.replace(/^Phoenix /, '')).join(', ') + '. Their lights update as each one comes up.')
  // Builds take a while: look again shortly, then at the normal interval
  for (const secs of [20, 60, 120]) $.clock.after(secs * 1000, () => poll($, 'coreapi', true))
}

export function register(on, options) {
  opts = { ...DEFAULTS, ...(options ?? {}) }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'dragon', description: 'Pet Dragon: status lights, color legend, skill suggestions', immediate: true })
    repoRoot = (await $.session.root()) ?? ''
    isWindows = (await $.env.get('OS')) === 'Windows_NT'
    for (const s of SOURCES) {
      const cached = await $.store.get('light:' + s.id)
      if (cached) lights[s.id] = cached
    }
    // The last test run Claude saw in this repo, from any earlier session
    const startNow = await $.clock.now()
    const beRecord = await $.store.get(TEST_KINDS.be.store + repoRoot)
    const feRecord = await $.store.get(TEST_KINDS.fe.store + repoRoot)
    // Before the split the one record held whichever runner ran last, so a Jest run may still sit in the backend slot
    const records = { be: testKind(beRecord?.run) === 'be' ? beRecord : undefined, fe: feRecord ?? (testKind(beRecord?.run) === 'fe' ? beRecord : undefined) }
    for (const kind of ['be', 'fe']) {
      // A run of zero tests, or a scoped run that is no suite total (one file, -t, --filter), says nothing: it counts as not run and the full suite starts
      const rec = startupTestRecord(records[kind])
      setLight(TEST_KINDS[kind].light, rec?.run ? testLight(rec.run, rec.command, rec.at, startNow, kind) : testLight(undefined, undefined, undefined, undefined, kind), startNow)
    }
    suggestionsOff = opts.skill_suggestions === 'off' || (await $.store.get('suggestions-off')) === true
    affinity = (await $.store.get('skill-affinity')) ?? {}
    lastActivity = Date.now()
    await loadSkills($)
    await refreshContext($)
    // Stagger the first checks so startup isn't one burst of processes
    $.clock.after(4_000, () => autoRunTests($))
    $.clock.after(500, () => poll($, 'git'))
    $.clock.after(1_000, () => poll($, 'coreapi'))
    $.clock.after(2_000, () => poll($, 'seq'))
    $.clock.after(3_000, () => poll($, 'outlook'))
    $.clock.after(7_000, () => poll($, 'radar'))
    $.clock.after(5_000, () => poll($, 'jira'))
    $.clock.after(6_000, () => poll($, 'pipeline'))
    $.clock.after(8_000, () => poll($, 'bitbucket'))
    $.clock.after(9_000, () => poll($, 'aiprod'))
    $.clock.after(10_000, () => poll($, 'cidev'))
    $.clock.after(11_000, () => poll($, 'bugs'))
    $.clock.after(12_000, () => poll($, 'points'))
    // Nobody is here (the dragon is asleep): no point spawning git, twg and PowerShell every few seconds in every open session. Activity wakes it and noteActivity catches the lights up.
    for (const id of POLL_IDS) $.clock.every(intervalMs(id), () => (moodNow().asleep ? undefined : poll($, id)))
    $.clock.every(10 * 60_000, () => loadSkills($))
    $.clock.every(60_000, () => checkSleepy($))
    $.clock.every(60_000, () => checkMeetReminder($))
    $.clock.every(60_000, () => refreshContext($))
    return result
  })

  on('prompt.change', async ($, e, next) => {
    // A submit or clear empties the box: that is the end of typing, not more of it
    noteTyping($, e.origin?.kind !== 'clear')
    return next(e)
  }).catch(failOpen)

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      noteActivity($)
      setState($, 'working')
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) return next(e)
    noteActivity($)
    const before = session.state
    // $.ui.ask and Claude's own questions arrive as AskUserQuestion: that means "waiting on you"
    if (e.tool === 'AskUserQuestion') setState($, 'waiting')
    else setState($, 'tool', e.tool)
    // Remember edited files: they hint at which skills fit the work in hand
    const file = e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'MultiEdit' ? e.file_path : e.tool === 'NotebookEdit' ? e.notebook_path : undefined
    if (typeof file === 'string' && file) {
      const at = touched.indexOf(file)
      if (at >= 0) touched.splice(at, 1)
      touched.push(file)
      if (touched.length > TOUCHED_MAX) touched.shift()
    }
    const testCommand = e.tool === 'Bash' && isTestCommand(e.command) ? String(e.command) : ''
    try {
      const result = await next(e)
      if (testCommand) {
        const out = result?.result
        const run = parseTestRun(testCommand, typeof out === 'string' ? out : [out?.stdout, out?.stderr].filter(Boolean).join('\n'))
        if (run) await recordTestRun($, run, testCommand, await $.clock.now())
      }
      return result
    } finally {
      if (session.state === 'tool' || session.state === 'waiting') setState($, before === 'idle' || before === 'error' ? before : 'working')
    }
  }).catch(failOpen)

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (!e.agentId && verdict?.decision === 'ask') setState($, 'waiting')
    return verdict
  }).catch(failOpen)

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    await refreshContext($, { turnEnded: true })
    setState($, e.reason === 'error' ? 'error' : 'idle')
    return next(e)
  })

  // Skill suggestions: before a prompt goes out, offer related skills and let the user opt in.
  on('prompt.submit', async ($, e, next) => {
    if (suggestionsOff || e.command || e.isMeta || e.turnId || e.origin?.kind !== 'composer') return next(e)
    if (String(e.text ?? '').trim().length < 12) return next(e)
    if (skills.length === 0) await loadSkills($)
    // Fresh git state: its changed files, with the ones Claude edited this session, point at the skills that fit
    if (!lights.git || (await $.clock.now()) - lights.git.checkedAt > 15_000) await poll($, 'git', true)
    const picks = suggestSkills(e.text, skills, {
      max: 2,
      minScore: Number(opts.skill_min_score),
      exclude: declined,
      pathHits: pathSignals([...touched, ...(lights.git?.paths ?? [])]),
      promptPathHits: pathSignals(pathsInText(e.text)),
      affinity,
    })
    $.ui.log('pet-dragon: ' + skills.length + ' skills indexed, suggesting [' + picks.map((p) => p.name + ':' + p.score + '(' + p.hits.join(',') + ')').join(', ') + ']', { to: 'debug' })
    if (picks.length === 0) return next(e)
    lastSuggestion = picks.map((p) => '/' + p.name).join(', ')
    $.ui.invalidate('ui.render')

    const choices = picks.map((p) => 'Use /' + p.name)
    if (picks.length > 1) choices.push('Use both')
    choices.push('No thanks')
    if (picks.length === 1) choices.push('Stop suggesting')
    const lines = picks.map((p) => '/' + p.name + ' \u2014 ' + shorten(p.description, 70)).join('  \u00b7  ')

    let answer = ''
    try {
      answer = await $.ui.ask('Dragon thinks these skills may help: ' + lines + '. Use one?', {
        header: 'Dragon',
        options: choices,
      })
    } catch {
      answer = ''
    }
    lastSuggestion = ''
    $.ui.invalidate('ui.render')

    let chosen = []
    if (answer === 'Use both') chosen = picks.map((p) => p.name)
    else {
      const hit = picks.find((p) => answer === 'Use /' + p.name)
      if (hit) chosen = [hit.name]
    }
    if (answer === 'Stop suggesting') {
      suggestionsOff = true
      $.ui.toast('Skill suggestions off for this session. Turn them back on from /dragon.')
    }
    // Learn from the answer, except when the person just turned suggestions off
    if (answer !== 'Stop suggesting' && answer !== '') {
      const rejected = picks.map((p) => p.name).filter((n) => !chosen.includes(n))
      affinity = recordAffinity(affinity, chosen, rejected)
      await $.store.set('skill-affinity', affinity)
    }
    if (chosen.length === 0) {
      for (const p of picks) declined.add(p.name)
      return next(e)
    }
    const note =
      'The user opted in to these skills for this request: ' +
      chosen.join(', ') +
      '. Load each with the Skill tool before doing anything else, then follow it.'
    return next({ ...e, context: [...(e.context ?? []), note] })
  }).catch(failOpen)

  on('command.run', { command: 'dragon' }, async ($, e) => {
    const arg = String(e.args ?? '').trim().toLowerCase()
    if (arg === 'standup') return { text: await runStandup($) }
    if (arg === 'sleep') {
      if (sleepyAfterMs() <= 0) return { text: 'Dragon has sleep turned off (sleepy_after_minutes is 0).' }
      sleepNow($)
      return { text: 'Dragon curls up and falls asleep. Type anything to wake it.' }
    }
    await $.ui.open({ id: PANE, title: 'Pet Dragon', focus: true, closeOnEscape: true })
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props?.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(20, (e.props?.bodyColumns ?? 80) - SPRITE_WIDTH - 2)
    const mood = moodNow()
    const f = flapTimer ? FLAP[frame] : mood.asleep ? SLEEP : IDLE

    const dragon = Box({
      key: 'drg-dragon',
      flexDirection: 'column',
      // The light rows make the band taller than the sprite: sit it in the middle of them instead of at the top.
      // alignSelf: 'center' rounds the odd leftover row down onto the bottom, one row too low, so the offset is explicit.
      alignSelf: 'flex-start',
      marginTop: 2,
      width: SPRITE_WIDTH + 1,
      hover: { scope: 'drg-mood' },
      children: spriteRows(f, mood.color).map((runs, r) =>
        // Each sprite row is a plain Button (a Box takes no press): one click anywhere on the dragon toggles /speak.
        // A Button inverts under the pointer, so the hovered row flashes white; the hover scope still recolors the whole dragon.
        Button({
          key: 'drg-dragon-' + r,
          plain: true,
          onPress: () => dragonPressed($),
          children: runs.map((s) =>
            Text({
              color: s.color,
              backgroundColor: s.backgroundColor,
              hover: {
                scope: 'drg-mood',
                ...(s.color && { color: rotateHue(s.color) }),
                ...(s.backgroundColor && { backgroundColor: rotateHue(s.backgroundColor) }),
              },
              children: [s.text],
            }),
          ),
        }),
      ),
    })

    const caption = Box({
      key: 'drg-caption',
      flexDirection: 'row',
      children: [
        Text({
          wrap: 'truncate-end',
          children: [
            Text({ color: mood.color, bold: true, hover: { scope: 'drg-mood' }, children: ['● ' + mood.label] }),
            Text({ dimColor: true, children: [' — ' + mood.short] }),
          ],
        }),
      ],
    })
    // The Standup button sits at the end of the Comm row (the first row of lights); pressing it prints the standup into the chat
    const standupButton = Button({
      key: 'drg-standup-band',
      plain: true,
      hover: { scope: 'drg-standup', underline: true },
      // A plugin cannot run its own command or submit a leading-slash prompt, so print into the chat directly
      onPress: () => printStandup($),
      // A fuchsia-to-periwinkle gradient: a color no status light uses
      children: gradient('[ Standup ]', '#ff4fd8', '#5b8cff').map((g, i) => Text({ key: 'drg-standup-ch-' + i, color: g.color, bold: true, children: [g.text] })),
    })

    const ROW_LABELS = ['APIs', 'Work', 'Repo', 'Rel', 'AI', 'Errs', 'Comm']
    const nowMs = Date.now()
    const head = currentHeadline()
    const headlineRow = Box({
      key: 'drg-headline',
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({
          wrap: 'truncate-end',
          children: [Text({ color: head.color, bold: true, children: ['\u25cf '] }), Text({ color: head.level === 'green' ? head.color : undefined, bold: head.level !== 'green', children: [head.text] })],
        }),
      ],
    })
    // Columns line up down the band when they fit beside the dragon; otherwise each row is as long as it needs to be
    // The Cost light's two figures sit in two columns, today in its own and the month in the next, with the dot between
    const spans = (src) => src.id === 'cost' && (lights.cost?.parts?.length ?? 0) > 1
    const cellLen = (src) => 2 + src.label.length + 1 + String(lights[src.id]?.value ?? '\u2026').length
    const COL_GAP = 2
    const LABEL_W = 6
    const colW = []
    const widen = (c, n) => (colW[c] = Math.max(colW[c] ?? 0, n))
    for (const src of SOURCES) {
      if (spans(src)) {
        widen(src.col, 2 + src.label.length + 1 + String(lights.cost.parts[0]).length)
        widen(src.col + 1, 2 + String(lights.cost.parts[1]).length)
      } else widen(src.col, cellLen(src))
    }
    const aligned = LABEL_W + colW.reduce((sum, w) => sum + (w ?? 0) + COL_GAP, 0) - COL_GAP <= width
    const cellsFor = (row, build) => {
      const mine = SOURCES.filter((src) => src.row === row)
      if (!aligned || mine.length === 0) return mine.map((src) => build(src))
      const last = Math.max(...mine.map((src) => src.col + (spans(src) ? 1 : 0)))
      const cells = []
      for (let c = 0; c <= last; c++) {
        const src = mine.find((m) => m.col === c)
        const head = src ? build(src, spans(src) ? 'head' : undefined) : undefined
        const tailOf = mine.find((m) => spans(m) && m.col + 1 === c)
        cells.push(Box({ key: 'drg-cell-' + row + '-' + c, width: (colW[c] ?? 0) + COL_GAP, children: [head ?? (tailOf ? build(tailOf, 'tail') : Text({ children: [' '] }))] }))
      }
      return cells
    }
    // tail: an extra item after the row's lights (the Standup button)
    const lightRow = (row, tail) =>
      Box({
        key: 'drg-row-' + row,
        flexDirection: 'row',
        columnGap: aligned ? 0 : 2,
        children: [
          row === 0
            ? Button({ key: 'drg-row-label-0', plain: true, hover: { scope: 'drg-apis', underline: true }, onPress: () => startApis($), children: [Text({ dimColor: true, children: [ROW_LABELS[0].padEnd(aligned ? LABEL_W : 4)] })] })
            : Text({ key: 'drg-row-label-' + row, dimColor: true, children: [ROW_LABELS[row].padEnd(aligned ? LABEL_W : 4)] }),
          ...cellsFor(row, (s, part) => {
            const l = lights[s.id]
            const color = l?.color ?? COLORS.grey
            const open = async () => {
              if (s.id === 'git' && (await reviewChanges($))) return
              if ((s.id === 'git' || s.id === 'drift') && (await syncBehind($, s.id))) return
              // A test light that could not get a result has nothing worth opening: a click runs it again
              const kind = s.id === 'tests' ? 'be' : s.id === 'fe-tests' ? 'fe' : undefined
              if (kind && testNeedsRun(l)) return runTestKind($, kind, true)
              // Any other test light that is not running: ask, then run the suite again
              if (kind && !testBusy[kind] && l?.value !== 'queued') {
                if (await confirmTestRun($, kind)) runTestKind($, kind, true, true)
                return
              }
              if (s.id === 'cache' || s.id === 'ctx') return compactNow($)
              if (s.id === 'teams' && l?.value === 'off') return startTeams($)
              const url = lightUrl(s.id)
              if (url) openUrl($, url)
              else $.ui.open({ id: PANE, title: 'Pet Dragon', focus: true, closeOnEscape: true })
            }
            // CoreAPI: the name still opens Swagger; the database text is its own target and offers the other database, or a start when it is down
            const dbTarget = s.id === 'coreapi' ? dbSwitchTarget(l) : undefined
            if (dbTarget || (s.id === 'coreapi' && coreIsDown(l))) {
              return Box({
                key: 'drg-light-coreapi',
                flexDirection: 'row',
                children: [
                  Button({
                    key: 'drg-light-coreapi-open',
                    plain: true,
                    hover: { scope: 'drg-coreapi', underline: true },
                    onPress: open,
                    children: [Text({ color, children: ['\u25cf '] }), Text({ children: [s.label + ' '] })],
                  }),
                  Button({
                    key: 'drg-light-coreapi-db',
                    plain: true,
                    hover: { scope: 'drg-coreapi-db', underline: true },
                    onPress: () => (dbTarget ? switchDb($, dbTarget) : startCore($)),
                    children: [Text({ color, bold: true, children: [l.value] })],
                  }),
                ],
              })
            }
            // A light whose value just changed flashes: a filled dot and a highlighted value on every other step
            const flash = blinkBright(l, nowMs)
            if (part) {
              const figures = lights.cost.parts
              return Button({
                key: 'drg-light-' + s.id + '-' + part,
                plain: true,
                hover: { scope: 'drg-' + s.id, underline: true },
                onPress: open,
                children:
                  part === 'head'
                    ? [Text({ color, children: [flash ? '\u25c9 ' : '\u25cf '] }), Text({ children: [s.label + ' '] }), Text({ color: flash ? '#111111' : color, backgroundColor: flash ? color : undefined, bold: true, children: [figures[0]] })]
                    : [Text({ dimColor: true, children: ['\u00b7 '] }), Text({ color: flash ? '#111111' : color, backgroundColor: flash ? color : undefined, bold: true, children: [figures[1]] })],
              })
            }
            return Button({
              key: 'drg-light-' + s.id,
              plain: true,
              hover: { scope: 'drg-' + s.id, underline: true },
              onPress: open,
              children: [
                Text({ color, children: [flash ? '\u25c9 ' : '\u25cf '] }),
                Text({ children: [s.label + ' '] }),
                Text({ color: flash ? '#111111' : color, backgroundColor: flash ? color : undefined, bold: true, children: [l ? l.value : '\u2026'] }),
              ],
            })
          }),
          ...(tail ? [Text({ key: 'drg-row-tail-gap-' + row, children: ['  '] }), tail] : []),
        ],
      })

    // Hover line: a hint by default; the hovered item's explanation is drawn over it
    const now = Date.now()
    const reveals = [
      { scope: 'drg-mood', text: mood.label + ': ' + mood.short, more: 'Click the dragon to turn /speak voice replies on or off' },
      { scope: 'drg-coreapi-db', text: 'CoreAPI database: ' + (lights.coreapi?.value ?? '?'), more: dbSwitchTarget(lights.coreapi) ? 'Click to switch CoreAPI to your ' + dbSwitchTarget(lights.coreapi) + ' DB (asks first)' : coreIsDown(lights.coreapi) ? 'Click to start CoreAPI on your local or Docker DB (asks first)' : '' },
      { scope: 'drg-apis', text: 'APIs: CoreAPI, BFF, MoveDocs and the UI dev server', more: 'Click to start whichever are not running' },
      { scope: 'drg-standup', text: 'Standup: what changed in Jira, PRs and your commits since the previous working day', more: 'Click to print it in the chat' },
      ...SOURCES.map((s) => {
        const l = lights[s.id]
        // Jira and PRs list just the ticket and its status; the count is already on the light
        if (l?.brief?.length) return { scope: 'drg-' + s.id, text: s.title + ': ' + l.brief.join('  ·  '), more: clickHint(s.id, l) }
        return {
          scope: 'drg-' + s.id,
          text: s.title + ': ' + (l?.short ?? 'checking…') + (l ? '  (' + ago(l.checkedAt, now) + ')' : ''),
          more: clickHint(s.id, l),
        }
      }),
    ]
    const hint = lastSuggestion
      ? 'Dragon suggests ' + lastSuggestion + ' for this prompt'
      : 'Hover over Dragon or a light for details \u00b7 /dragon for more'
    const infoLine = Box({
      key: 'drg-info',
      position: 'relative',
      flexDirection: 'column',
      height: 2,
      children: [
        ...wrapLines(hint, width, 2).map((l, i) =>
          Text({ key: 'drg-hint-' + i, color: lastSuggestion ? COLORS.ember : undefined, dimColor: !lastSuggestion, children: [l] }),
        ),
        ...reveals.map((r) =>
          Box({
            key: 'drg-reveal-' + r.scope,
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'none',
            flexDirection: 'column',
            hover: { display: 'flex', scope: r.scope },
            children: wrapLines(r.text + (r.more ? '  ·  ' + r.more : ''), width, 2).map((l, i) =>
              Text({ key: 'drg-reveal-' + r.scope + '-' + i, color: COLORS.ember, children: [l] }),
            ),
          }),
        ),
      ],
    })

    const mine = Box({
      key: 'drg-band',
      flexDirection: 'row',
      children: [dragon, Box({ flexDirection: 'column', children: [caption, headlineRow, lightRow(6, standupButton), lightRow(2), lightRow(5), lightRow(1), lightRow(4), lightRow(0), lightRow(3), infoLine] })],
    })
    // Another mod's band draws beneath Dragon. Claude Code's own placeholder
    // ({ type: 'engine' }) is never nested, and a failing band never hides Dragon.
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const theirs = drawn && typeof drawn === 'object' && drawn.type !== 'engine' ? drawn : null
    return theirs ? Box({ flexDirection: 'column', children: [mine, theirs] }) : mine
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const mood = moodNow()
    const rows = []

    rows.push(
      Text({
        children: [
          Text({ color: mood.color, bold: true, children: ['\u25cf Dragon: ' + mood.label] }),
          Text({ dimColor: true, children: [' \u2014 ' + mood.short] }),
        ],
      }),
    )
    rows.push(Text({ children: [' '] }))

    for (const s of SOURCES) {
      const l = lights[s.id]
      rows.push(
        Text({
          children: [
            Text({ color: l?.color ?? COLORS.grey, children: ['\u25cf '] }),
            Text({ bold: true, children: [s.title + ' '] }),
            Text({ children: [l?.short ?? 'checking\u2026'] }),
            Text({ dimColor: true, children: [l ? '  (' + ago(l.checkedAt, now) + ')' : ''] }),
          ],
        }),
      )
      const detail = l?.detail ?? []
      for (const [i, d] of detail.slice(0, 8).entries()) {
        if (typeof d === 'string') rows.push(Text({ dimColor: true, wrap: 'truncate-end', children: ['    ' + d] }))
        else {
          rows.push(
            Button({
              key: 'drg-link-' + s.id + '-' + i,
              plain: true,
              onPress: () => openUrl($, d.url),
              children: [Text({ color: COLORS.ember, underline: true, wrap: 'truncate-end', children: ['    ' + d.text + ' ↗'] })],
            }),
          )
        }
      }
      if (detail.length > 8) rows.push(Text({ dimColor: true, children: ['    \u2026and ' + (detail.length - 8) + ' more'] }))
    }

    rows.push(Text({ children: [' '] }))
    rows.push(Text({ bold: true, children: ["What Dragon's colors mean"] }))
    for (const key of Object.keys(MOODS)) {
      const m = MOODS[key]
      rows.push(Text({ children: [Text({ color: m.color, children: ['  \u25cf ' + m.label.padEnd(20)] }), Text({ dimColor: true, children: [m.short] })] }))
    }
    rows.push(Text({ bold: true, children: ['What the light colors mean'] }))
    for (const [color, text] of [
      [COLORS.green, 'all clear / running / CoreAPI on local SQL Server'],
      [COLORS.teal, 'CoreAPI on the Docker SQL container, or you have open PRs'],
      [COLORS.unread, 'something is waiting for you (count shown)'],
      [COLORS.amber, 'up, but something is unclear'],
      [COLORS.red, 'down'],
      [COLORS.grey, 'off, not set up, or not checked yet'],
    ]) {
      rows.push(Text({ children: [Text({ color, children: ['  \u25cf '] }), Text({ dimColor: true, children: [text] })] }))
    }

    rows.push(Text({ children: [' '] }))
    rows.push(
      Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Button({
            key: 'drg-refresh',
            label: 'r: Refresh all',
            hotkey: 'r',
            plain: true,
            onPress: () => {
              for (const id of ['git', 'coreapi', 'seq', 'outlook', 'jira', 'pipeline', 'bitbucket', 'aiprod', 'cidev', 'bugs', 'points']) poll($, id, true)
            },
          }),
          Button({
            key: 'drg-standup',
            label: 'u: ' + (standupBusy ? 'Gathering standup…' : 'Standup'),
            hotkey: 'u',
            plain: true,
            onPress: () => pressStandup($),
          }),
          Button({
            key: 'drg-suggest',
            label: 's: Skill suggestions ' + (suggestionsOff ? 'OFF' : 'ON'),
            hotkey: 's',
            plain: true,
            onPress: async () => {
              suggestionsOff = !suggestionsOff
              declined.clear()
              await $.store.set('suggestions-off', suggestionsOff)
              $.ui.invalidate('ui.render')
            },
          }),
        ],
      }),
    )
    if (standupText) {
      rows.push(Text({ children: [' '] }))
      for (const [i, line] of standupText.split('\n').entries()) {
        rows.push(Text({ key: 'drg-standup-' + i, bold: i === 0, dimColor: i > 0 && line.startsWith('  '), wrap: 'truncate-end', children: [line || ' '] }))
      }
    }
    return Box({ flexDirection: 'column', children: rows })
  })
}

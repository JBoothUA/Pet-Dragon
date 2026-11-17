import {
  COLORS,
  MOODS,
  IDLE,
  FLAP,
  SLEEP,
  FLAP_MS,
  SPRITE_WIDTH,
  spriteRows,
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
  seqLight,
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
  coreapi_poll_seconds: 30,
  messages_poll_seconds: 60,
  jira_poll_minutes: 5,
  bitbucket_poll_minutes: 10,
  jira_jql: 'assignee = currentUser() AND statusCategory != Done',
  context_warn_percent: 80,
  sleepy_after_minutes: 20,
  git_poll_seconds: 30,
  pipeline_poll_minutes: 3,
  bitbucket_repo: 'keyhealthtech/phoenix',
  seq_url: 'http://localhost:5341',
  seq_api_key: '',
  seq_poll_seconds: 60,
  seq_window_minutes: 15,
  ui_port: 5173,
  radar_poll_minutes: 10,
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
  { id: 'coreapi', label: 'Core', title: 'CoreAPI', row: 0 },
  { id: 'bff', label: 'BFF', title: 'BFF', row: 0, parent: 'coreapi' },
  { id: 'movedocs', label: 'MD', title: 'MoveDocs API', row: 0, parent: 'coreapi' },
  { id: 'ui', label: 'UI', title: 'phoenix-ui dev server', row: 0, parent: 'coreapi' },
  { id: 'jira', label: 'Jira', title: 'Jira', row: 1 },
  { id: 'bitbucket', label: 'PRs', title: 'PRs', row: 1 },
  { id: 'reviews', label: 'Review', title: 'PRs to review', row: 1, parent: 'bitbucket' },
  { id: 'outlook', label: 'Mail', title: 'Outlook', row: 1 },
  { id: 'meet', label: 'Mtgs', title: 'Meetings today', row: 1, parent: 'outlook' },
  { id: 'teams', label: 'Teams', title: 'Teams', row: 1, parent: 'outlook' },
  { id: 'git', label: 'Git', title: 'Git', row: 2 },
  { id: 'pipeline', label: 'CI', title: 'Pipelines', row: 2 },
  { id: 'tests', label: 'BE Tests', title: 'Backend tests (C#)', row: 2 },
  { id: 'fe-tests', label: 'FE Tests', title: 'Frontend tests (Jest)', row: 2 },
  { id: 'seq', label: 'Logs', title: 'Seq errors', row: 2 },
  { id: 'radar', label: 'Prod', title: 'Release radar', row: 3 },
  { id: 'drift', label: 'Drift', title: 'Branch drift', row: 3, parent: 'radar' },
  { id: 'merged', label: 'Merged', title: 'Merged into development today', row: 3, parent: 'radar' },
  { id: 'ship', label: 'Ship', title: 'Next release in Jira', row: 3, parent: 'radar' },
  { id: 'ctx', label: 'Ctx', title: 'Context window', row: 4 },
  { id: 'day', label: 'Today', title: 'Spend today', row: 4 },
  { id: 'tree', label: 'Tree', title: 'Worktrees', row: 4, parent: 'git' },
]
const companions = (key) => SOURCES.filter((s) => s.parent === key).map((s) => s.id)
// These describe this session's repo and branch, so they are never shared through $.store
const LOCAL_ONLY = new Set(['git', 'pipeline', 'tests', 'fe-tests', 'radar', 'ctx', 'day'])
const ERROR_LIMIT = 50

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

function intervalMs(id) {
  if (id === 'coreapi') return Number(opts.coreapi_poll_seconds) * 1000
  if (id === 'outlook' || id === 'teams') return Number(opts.messages_poll_seconds) * 1000
  if (id === 'jira') return Number(opts.jira_poll_minutes) * 60_000
  if (id === 'git') return Number(opts.git_poll_seconds) * 1000
  if (id === 'pipeline') return Number(opts.pipeline_poll_minutes) * 60_000
  if (id === 'seq') return Number(opts.seq_poll_seconds) * 1000
  if (id === 'radar') return Number(opts.radar_poll_minutes) * 60_000
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

// Redraws every PULSE_STEP_MS while any light is mid-flash, then stops
let pulseTimer = null
function syncPulse($) {
  const now = Date.now()
  const any = Object.values(lights).some((l) => pulsing(l, now))
  if (any && !pulseTimer) {
    pulseTimer = $.clock.every(PULSE_STEP_MS, () => {
      $.ui.invalidate('ui.render')
      if (!Object.values(lights).some((l) => pulsing(l, Date.now()))) {
        pulseTimer?.cancel()
        pulseTimer = null
      }
    })
  }
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
      const [r, rv] = await Promise.all([prQuery('author'), prQuery('reviewer')])
      setLight(key, prLight(parseJson(r.stdout), opts.pr_repo_id), now)
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
        else {
          const theirs = new Set(lines(await git(['diff', '--name-only', base, 'origin/development'])))
          const mine = lines(await git(['diff', '--name-only', base]))
          setLight('drift', driftLight({ branch: lights.git?.branch ?? 'HEAD', behind, overlap: mine.filter((f) => theirs.has(f)) }), now)
        }
      }
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

// CoreAPI's database toggle: "local db" offers Docker, "docker db" offers local; any other state offers nothing
const dbSwitchTarget = (l) => (l?.value === 'local db' ? 'docker' : l?.value === 'docker db' ? 'local' : undefined)
let switchingDb = false

async function switchDb($, to) {
  if (switchingDb) return
  const from = to === 'docker' ? 'local' : 'docker'
  const cur = lights.coreapi
  if (to === 'docker' && cur?.dockerReady === false) {
    $.ui.toast('No Docker SQL container is publishing :1433. Start Docker and its SQL container, then try again.')
    return
  }
  if (to === 'local' && cur?.localReady === false) {
    $.ui.toast('The local SQL Server service (MSSQLSERVER) is not running. Start it, then try again.')
    return
  }
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
  switchingDb = true
  setLight('coreapi', { ...cur, color: COLORS.working, value: 'switching', short: 'Restarting CoreAPI on the ' + to + ' DB (use-' + to + '-db.ps1)\u2026' }, await $.clock.now())
  $.ui.invalidate('ui.render')
  try {
    const r = await $.process.run(
      ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $.plugin.root + '\\scripts\\switch-db.ps1', '-Target', to, '-Dir', String(opts.db_scripts_dir ?? ''), '-Port', String(opts.coreapi_port)],
      { timeoutMs: 240_000 },
    )
    const res = parseJson(r.stdout)
    if (res?.ok) $.ui.toast('CoreAPI is back up on your ' + to + ' DB.')
    else $.ui.toast('Switch to ' + to + ' DB did not finish: ' + shorten(res?.error ?? res?.tail ?? 'no answer from the script', 140))
  } catch (err) {
    $.ui.toast('Switch to ' + to + ' DB failed: ' + shorten(err?.message ?? err, 120))
  } finally {
    switchingDb = false
    await poll($, 'coreapi', true)
  }
}

// Advice Dragon has already announced this session; an item is re-armed once its condition clears
const announced = new Set()
let startBranch = ''
let compacting = false

// The two test lights: backend (C#) keeps the original store key so an older record still loads
const TEST_KINDS = {
  be: { light: 'tests', store: 'last-test:' },
  fe: { light: 'fe-tests', store: 'last-test-fe:' },
}

// Shows a finished run on its light and remembers it for the next session
async function recordTestRun($, run, command, at) {
  const kind = testKind(run)
  if (!kind) return
  setLight(TEST_KINDS[kind].light, testLight(run, command, at, at, kind), at)
  await $.store.set(TEST_KINDS[kind].store + repoRoot, { run, command, at })
}

// npm and npx are .cmd shims on Windows, which cannot be started without a shell
const shellWrap = (argv) => (isWindows && (argv[0] === 'npm' || argv[0] === 'npx') ? ['cmd', '/c', ...argv] : argv)

// What to run when a kind has no recorded run: { argv, cwd, shown } or undefined when this repo has nothing to run
async function autoTestPlan($, kind) {
  const custom = String((kind === 'be' ? opts.auto_test_command : opts.auto_fe_test_command) ?? '').split(' ').filter(Boolean)
  if (custom.length) return { argv: shellWrap(custom), cwd: repoRoot, shown: custom.join(' ') }
  const find = async (glob) => String((await $.process.run(['git', '-C', repoRoot, 'ls-files', glob], { timeoutMs: 15_000 })).stdout ?? '').split('\n').map((x) => x.trim()).find(Boolean)
  if (kind === 'be') {
    const proj = await find('bff/Tests/*UnitTests*.csproj')
    return proj ? { argv: ['dotnet', 'test', proj, '--nologo'], cwd: repoRoot, shown: 'dotnet test ' + proj + ' --nologo' } : undefined
  }
  if (!(await find('phoenix-ui/package.json'))) return undefined
  // The whole Jest suite is 1,200+ files and runs for 40+ minutes, but one $.process.run lasts ten minutes at most,
  // so the full suite runs as FE_SHARDS Jest shards one after another and the results are added up
  const npm = ['npm', 'run', 'test', '--', '--silent']
  return { argv: shellWrap(npm), cwd: repoRoot + '/phoenix-ui', shown: npm.join(' ') + ' (full suite)', shards: FE_SHARDS }
}

const FE_SHARDS = 12
const shardTotals = {}

// Tests never sit at "not run": when nothing is recorded for a kind in this repo, run it and record the result.
// Backend first, then front end, so the two suites do not compete for the CPU.
const testBusy = {}
async function autoRunTests($) {
  if (!repoRoot) return
  for (const kind of ['be', 'fe']) await runTestKind($, kind, false)
}

// force: re-run even though the light says "unclear" (a click on it), not only when nothing is recorded.
// A run that ends without a pass/fail summary is tried once more before the light gives up on it.
async function runTestKind($, kind, force) {
  const light = TEST_KINDS[kind].light
  const value = lights[light]?.value
  if (testBusy[kind] || !(value === 'not run' || (force && value === 'unclear'))) return
  testBusy[kind] = true
  try {
    const plan = await autoTestPlan($, kind)
    if (!plan) return
    const shards = plan.shards ?? 1
    for (const attempt of [1, 2]) {
      let unclear
      let tail = []
      // Shards that already finished are kept on the second attempt, so only the one that failed runs again
      const total = attempt === 2 && shardTotals[kind] ? shardTotals[kind] : { passed: 0, failed: 0, next: 1 }
      shardTotals[kind] = total
      try {
        for (; total.next <= shards; total.next++) {
          const label = shards > 1 ? ' (part ' + total.next + ' of ' + shards + ')' : ''
          setLight(light, { color: COLORS.working, value: shards > 1 ? total.next + '/' + shards : 'running', short: (attempt === 2 ? 'The first run gave no result, so Dragon is running it again: ' : 'No test run was recorded for this repo, so Dragon is running: ') + shorten(plan.shown, 90) + label, detail: [] }, await $.clock.now())
          $.ui.invalidate('ui.render')
          const argv = shards > 1 ? [...plan.argv, '--shard=' + total.next + '/' + shards] : plan.argv
          const r = await $.process.run(argv, { cwd: plan.cwd, timeoutMs: 600_000 })
          const output = [r.stdout, r.stderr].filter(Boolean).join('\n')
          const run = parseTestRun(plan.shown, output)
          if (!run || testKind(run) !== kind) {
            // What the run actually said, so an unclear light explains itself on hover
            tail = output.split('\n').map((l) => l.trim()).filter(Boolean).slice(-4).map((l) => shorten(l, 110))
            throw new Error('Ran ' + shorten(plan.shown, 80) + label + ' (exit ' + r.exitCode + ') but found no pass/fail summary in its output')
          }
          total.passed += run.passed
          total.failed += run.failed
        }
        delete shardTotals[kind]
        await recordTestRun($, { runner: kind === 'be' ? 'dotnet' : 'jest', passed: total.passed, failed: total.failed }, plan.shown, await $.clock.now())
        return
      } catch (err) {
        unclear = shorten(err?.message ?? err, 160)
      }
      setLight(light, { color: COLORS.amber, value: 'unclear', short: unclear + '. Click this light to run it again', detail: tail.length ? ['Last output:', ...tail] : [] }, await $.clock.now())
    }
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
    setLight('ctx', ctxLight(session.contextPct), now)
    setLight('day', dayLight(day), now)

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
}

// Any change to the prompt box (a keystroke, or dictated text landing) counts as typing for a moment
function noteTyping($, typing) {
  if (typing) noteActivity($)
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
  syncFlap($)
}

// Anything the person or Claude does wakes the dragon
function noteActivity($) {
  lastActivity = Date.now()
  if (wasSleepy) {
    wasSleepy = false
    $.ui.invalidate('ui.render')
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
    $.ui.invalidate('ui.render')
  }
}

// Lights the headline never counts: the next release's open tickets and the daily spend are not something you can act on right now
const NOT_FOR_HEADLINE = new Set(['ship', 'day'])
const currentHeadline = () => headline(SOURCES.filter((s) => !NOT_FOR_HEADLINE.has(s.id)).map((s) => ({ label: s.label, light: lights[s.id] })))

function moodNow() {
  const key = pickMood({
    session: session.state,
    typing: session.typing,
    unread: unreadCount(),
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
      // A run of zero tests (an old changed-files-only run) says nothing, so it counts as not run and the full suite starts
      const rec = records[kind]?.run && records[kind].run.passed + records[kind].run.failed === 0 ? undefined : records[kind]
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
    for (const id of ['git', 'coreapi', 'seq', 'radar', 'outlook', 'jira', 'pipeline', 'bitbucket']) $.clock.every(intervalMs(id), () => poll($, id))
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
      marginTop: 1,
      width: SPRITE_WIDTH + 1,
      hover: { scope: 'drg-mood' },
      children: spriteRows(f, mood.color).map((runs, r) =>
        Text({
          key: 'drg-dragon-' + r,
          children: runs.map((s) =>
            Text({ color: s.color, backgroundColor: s.backgroundColor, hover: { scope: 'drg-mood' }, children: [s.text] }),
          ),
        }),
      ),
    })

    const ctx = typeof session.contextPct === 'number' ? '  ctx ' + Math.round(session.contextPct) + '%' : ''
    const captionText = Text({
      wrap: 'truncate-end',
      children: [
        Text({ color: mood.color, bold: true, hover: { scope: 'drg-mood' }, children: ['\u25cf ' + mood.label] }),
        Text({ dimColor: true, children: [' \u2014 ' + mood.short + ctx] }),
      ],
    })
    // The Standup button sits at the end of the caption row; pressing it opens /dragon with the standup in it
    const caption = Box({
      key: 'drg-caption',
      flexDirection: 'row',
      columnGap: 2,
      children: [
        captionText,
        Button({
          key: 'drg-standup-band',
          plain: true,
          hover: { scope: 'drg-standup', underline: true },
          // A plugin cannot run its own command or submit a leading-slash prompt, so print into the chat directly
          onPress: () => printStandup($),
          children: [Text({ color: COLORS.ember, bold: true, children: ['[ Standup ]'] })],
        }),
      ],
    })

    const ROW_LABELS = ['APIs', 'Work', 'Repo', 'Prod', 'Me']
    const nowMs = Date.now()
    const head = currentHeadline()
    const headlineRow = Text({
      key: 'drg-headline',
      wrap: 'truncate-end',
      children: [Text({ color: head.color, bold: true, children: ['\u25cf '] }), Text({ color: head.level === 'green' ? head.color : undefined, bold: head.level !== 'green', children: [head.text] })],
    })
    const lightRow = (row) =>
      Box({
        key: 'drg-row-' + row,
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Text({ key: 'drg-row-label-' + row, dimColor: true, children: [ROW_LABELS[row].padEnd(4)] }),
          ...SOURCES.filter((s) => s.row === row && !(s.id === 'seq' && lights.seq?.value === 'off')).map((s) => {
            const l = lights[s.id]
            const color = l?.color ?? COLORS.grey
            const open = async () => {
              if (s.id === 'git' && (await reviewChanges($))) return
              // An "unclear" test light has nothing worth opening: a click runs it again
              const kind = s.id === 'tests' ? 'be' : s.id === 'fe-tests' ? 'fe' : undefined
              if (kind && l?.value === 'unclear') return runTestKind($, kind, true)
              const url = lightUrl(s.id)
              if (url) openUrl($, url)
              else $.ui.open({ id: PANE, title: 'Pet Dragon', focus: true, closeOnEscape: true })
            }
            // CoreAPI: the name still opens Swagger; the database text is its own target and offers the other database
            const dbTarget = s.id === 'coreapi' ? dbSwitchTarget(l) : undefined
            if (dbTarget) {
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
                    onPress: () => switchDb($, dbTarget),
                    children: [Text({ color, bold: true, children: [l.value] })],
                  }),
                ],
              })
            }
            // A light whose value just changed flashes: a filled dot and a highlighted value on every other step
            const flash = pulseBright(l, nowMs)
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
        ],
      })

    // Hover line: a hint by default; the hovered item's explanation is drawn over it
    const now = Date.now()
    const reveals = [
      { scope: 'drg-mood', text: mood.label + ': ' + mood.short, more: '' },
      { scope: 'drg-coreapi-db', text: 'CoreAPI database: ' + (lights.coreapi?.value ?? '?'), more: dbSwitchTarget(lights.coreapi) ? 'Click to switch CoreAPI to your ' + dbSwitchTarget(lights.coreapi) + ' DB (asks first)' : '' },
      { scope: 'drg-standup', text: 'Standup: what changed in Jira, PRs and your commits since the previous working day', more: 'Click to print it in the chat' },
      ...SOURCES.map((s) => {
        const l = lights[s.id]
        // Jira and PRs list just the ticket and its status; the count is already on the light
        if (l?.brief?.length) return { scope: 'drg-' + s.id, text: s.title + ': ' + l.brief.join('  ·  '), more: '' }
        return {
          scope: 'drg-' + s.id,
          text: s.title + ': ' + (l?.short ?? 'checking…') + (l ? '  (' + ago(l.checkedAt, now) + ')' : ''),
          more: lightUrl(s.id) ? 'Click to open' : 'Click for /dragon report',
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
      children: [dragon, Box({ flexDirection: 'column', children: [caption, headlineRow, lightRow(0), lightRow(1), lightRow(2), lightRow(3), lightRow(4), infoLine] })],
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
              for (const id of ['git', 'coreapi', 'seq', 'outlook', 'jira', 'pipeline', 'bitbucket']) poll($, id, true)
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

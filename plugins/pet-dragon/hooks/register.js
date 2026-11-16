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
  parseJson,
  parseJsonAny,
  ago,
  coreApiLight,
  serviceLight,
  jiraLight,
  prLight,
  outlookLight,
  teamsLight,
  parseGitStatus,
  gitLight,
  pipelineLight,
  seqLight,
  isTestCommand,
  parseTestRun,
  testLight,
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
  skill_suggestions: 'ask',
  skill_min_score: 2,
  // twg returns PRs from every repo you authored in; only this one (phoenix) is counted
  pr_repo_id: '7b33633431633438372d666438652d346565362d396133392d3461376330663439316230367d',
  pr_list_url: 'https://bitbucket.org/keyhealthtech/phoenix/pull-requests/?state=ALL&user_filter=ALL&author=712020%3Ad474c235-c75d-4715-a77f-8c84fae88106',
  jira_board_url: 'https://keyjira.atlassian.net/jira/software/c/projects/C3/boards/880?assignee=712020%3Ad474c235-c75d-4715-a77f-8c84fae88106',
}

// row 0 = local services, row 1 = work. A companion light is checked by its parent's probe.
const SOURCES = [
  { id: 'coreapi', label: 'Core', title: 'CoreAPI', row: 0 },
  { id: 'bff', label: 'BFF', title: 'BFF', row: 0, parent: 'coreapi' },
  { id: 'movedocs', label: 'MD', title: 'MoveDocs API', row: 0, parent: 'coreapi' },
  { id: 'jira', label: 'Jira', title: 'Jira', row: 1 },
  { id: 'bitbucket', label: 'PRs', title: 'PRs', row: 1 },
  { id: 'outlook', label: 'Mail', title: 'Outlook', row: 1 },
  { id: 'teams', label: 'Teams', title: 'Teams', row: 1, parent: 'outlook' },
  { id: 'git', label: 'Git', title: 'Git', row: 2 },
  { id: 'pipeline', label: 'CI', title: 'Pipelines', row: 2 },
  { id: 'tests', label: 'Tests', title: 'Tests', row: 2 },
  { id: 'seq', label: 'Seq', title: 'Seq errors', row: 2 },
]
const companions = (key) => SOURCES.filter((s) => s.parent === key).map((s) => s.id)
// These describe this session's repo and branch, so they are never shared through $.store
const LOCAL_ONLY = new Set(['git', 'pipeline', 'tests'])
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
  return Number(opts.bitbucket_poll_minutes) * 60_000
}

function unreadCount() {
  const n = Number(lights.outlook?.value)
  return Number.isFinite(n) ? n : 0
}

function setLight(id, light, checkedAt) {
  lights[id] = { ...light, checkedAt }
}

// Where clicking a light goes (opened in Chrome); undefined = open the /dragon pane instead
function lightUrl(id) {
  if (id === 'coreapi') return 'http://localhost:' + opts.coreapi_port + '/swagger'
  if (id === 'bff') return 'https://localhost:' + opts.bff_port + '/swagger'
  if (id === 'movedocs') return 'https://localhost:' + opts.movedocs_port + '/swagger'
  if (id === 'jira') return opts.jira_board_url
  if (id === 'bitbucket') return opts.pr_list_url
  if (id === 'pipeline') return 'https://bitbucket.org/' + opts.bitbucket_repo + '/pipelines'
  if (id === 'seq') return opts.seq_url
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
        const ports = [opts.bff_port, opts.movedocs_port].map(String)
        const [core, svc] = await Promise.all([
          runPowerShell($, 'coreapi-probe.ps1', ['-Port', String(opts.coreapi_port), '-RepoRoot', repoRoot]),
          runPowerShell($, 'ports-probe.ps1', ['-Ports', ports.join(',')]),
        ])
        setLight('coreapi', coreApiLight(core, opts.coreapi_port), now)
        setLight('bff', serviceLight('BFF', svc ? svc[ports[0]] ?? { up: false } : null, ports[0]), now)
        setLight('movedocs', serviceLight('MoveDocs API', svc ? svc[ports[1]] ?? { up: false } : null, ports[1]), now)
      }
    } else if (key === 'outlook') {
      const m = isWindows ? await runPowerShell($, 'messages-probe.ps1', []) : { outlook: 'off', teams: 'off' }
      setLight('outlook', outlookLight(m), now)
      setLight('teams', teamsLight(m), now)
    } else if (key === 'jira') {
      const r = await $.process.run(
        ['twg', 'jira', 'workitem', 'query', '--jql', opts.jira_jql, '--limit', '50', '-o', 'json', '--output-summary', 'none'],
        { timeoutMs: 90_000 },
      )
      setLight(key, jiraLight(parseJson(r.stdout)), now)
    } else if (key === 'bitbucket') {
      const r = await $.process.run(
        ['twg', 'prs', 'query', '--scope', 'me', '--role', 'author', '--state', 'open', '-o', 'json', '--output-summary', 'none'],
        { timeoutMs: 180_000 },
      )
      setLight(key, prLight(parseJson(r.stdout), opts.pr_repo_id), now)
    } else if (key === 'git') {
      if (!repoRoot) setLight(key, gitLight(undefined), now)
      else {
        const r = await $.process.run(['git', '-C', repoRoot, 'status', '--porcelain=v2', '--branch'], { timeoutMs: 20_000 })
        setLight(key, gitLight(r.exitCode === 0 ? parseGitStatus(r.stdout) : undefined), now)
      }
    } else if (key === 'pipeline') {
      if (!lights.git?.branch) await poll($, 'git', true)
      const branch = lights.git?.branch
      const [workspace, repo] = String(opts.bitbucket_repo).split('/')
      const args = ['twg', 'bb', 'pipeline', 'query', '-w', workspace, '-r', repo, '-n', '5', '-o', 'json', '--output-summary', 'none']
      if (branch && !branch.startsWith('(')) args.push('--branch', branch)
      const r = await $.process.run(args, { timeoutMs: 120_000 })
      setLight(key, pipelineLight(r.exitCode === 0 ? parseJsonAny(r.stdout) : undefined, branch), now)
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
      setLight(key, seqLight(events, windowMin, ERROR_LIMIT), now)
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
    $.ui.invalidate('ui.render')
  }
}

async function refreshContext($) {
  try {
    const u = await $.session.usage()
    session.contextPct = u?.context?.percent
  } catch {
    session.contextPct = undefined
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
  const asleep = moodNow().key === 'sleepy'
  if (asleep !== wasSleepy) {
    wasSleepy = asleep
    $.ui.invalidate('ui.render')
  }
}

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
  return { key, ...mood, short }
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
    setLight('tests', testLight(undefined), await $.clock.now())
    suggestionsOff = opts.skill_suggestions === 'off' || (await $.store.get('suggestions-off')) === true
    affinity = (await $.store.get('skill-affinity')) ?? {}
    lastActivity = Date.now()
    await loadSkills($)
    await refreshContext($)
    // Stagger the first checks so startup isn't one burst of processes
    $.clock.after(500, () => poll($, 'git'))
    $.clock.after(1_000, () => poll($, 'coreapi'))
    $.clock.after(2_000, () => poll($, 'seq'))
    $.clock.after(3_000, () => poll($, 'outlook'))
    $.clock.after(5_000, () => poll($, 'jira'))
    $.clock.after(6_000, () => poll($, 'pipeline'))
    $.clock.after(8_000, () => poll($, 'bitbucket'))
    for (const id of ['git', 'coreapi', 'seq', 'outlook', 'jira', 'pipeline', 'bitbucket']) $.clock.every(intervalMs(id), () => poll($, id))
    $.clock.every(10 * 60_000, () => loadSkills($))
    $.clock.every(60_000, () => checkSleepy($))
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
        if (run) setLight('tests', testLight(run, testCommand), await $.clock.now())
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
    await refreshContext($)
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
    const f = flapTimer ? FLAP[frame] : mood.key === 'sleepy' ? SLEEP : IDLE

    const dragon = Box({
      key: 'drg-dragon',
      flexDirection: 'column',
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
          onPress: () => {
            $.ui.open({ id: PANE, title: 'Pet Dragon', focus: true, closeOnEscape: true })
            pressStandup($)
          },
          children: [Text({ color: COLORS.ember, bold: true, children: [standupBusy ? '[ gathering\u2026 ]' : '[ Standup ]'] })],
        }),
      ],
    })

    const ROW_LABELS = ['APIs', 'Work', 'Repo']
    const lightRow = (row) =>
      Box({
        key: 'drg-row-' + row,
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Text({ key: 'drg-row-label-' + row, dimColor: true, children: [ROW_LABELS[row].padEnd(4)] }),
          ...SOURCES.filter((s) => s.row === row).map((s) => {
            const l = lights[s.id]
            const color = l?.color ?? COLORS.grey
            return Button({
              key: 'drg-light-' + s.id,
              plain: true,
              hover: { scope: 'drg-' + s.id, underline: true },
              onPress: () => {
                const url = lightUrl(s.id)
                if (url) openUrl($, url)
                else $.ui.open({ id: PANE, title: 'Pet Dragon', focus: true, closeOnEscape: true })
              },
              children: [
                Text({ color, children: ['\u25cf '] }),
                Text({ children: [s.label + ' '] }),
                Text({ color, bold: true, children: [l ? l.value : '\u2026'] }),
              ],
            })
          }),
        ],
      })

    // Hover line: a hint by default; the hovered item's explanation is drawn over it
    const now = Date.now()
    const reveals = [
      { scope: 'drg-mood', text: mood.label + ': ' + mood.short, more: '' },
      { scope: 'drg-standup', text: 'Standup: what changed in Jira, PRs and your commits since the previous working day', more: 'Click to gather it in /dragon' },
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
      children: [dragon, Box({ flexDirection: 'column', children: [caption, lightRow(0), lightRow(1), lightRow(2), infoLine] })],
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
      for (const d of detail.slice(0, 8)) rows.push(Text({ dimColor: true, wrap: 'truncate-end', children: ['    ' + d] }))
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

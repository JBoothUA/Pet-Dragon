import { expect, mock, test } from 'claude-code/testing'
import {
  COLORS,
  MOODS,
  SLEEP,
  IDLE,
  pickMood,
  isAsleep,
  parseGitStatus,
  gitLight,
  pipelineLight,
  jiraLight,
  prLight,
  seqLight,
  aiHealthLight,
  depsLight,
  bugsLight,
  gradient,
  sprintJql,
  sprintNumber,
  slimIssue,
  pointsStats,
  pointsLights,
  bugsJql,
  diagnoseTestPart,
  blockedPrs,
  costLight,
  cacheLight,
  parseMonthly,
  monthLight,
  teamCiLight,
  hangfireLight,
  radarLight,
  meetLight,
  shouldRemindMeeting,
  coreApiLight,
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
  teamsLight,
  pulseBright,
  pulsing,
  tokenAdvice,
  reviewLight,
  mergedLight,
  shipLight,
  driftLight,
  newestRelease,
  ticketsIn,
  parseTestRun,
  isTestCommand,
  testLight,
  isFullSuiteCommand,
  runTestPart,
  startupTestRecord,
  failureExcerpt,
  partialRunColor,
  TEST_PROBLEM_VALUES,
  testKind,
  indexSkills,
  suggestSkills,
  pathSignals,
  pathsInText,
  recordAffinity,
  formatStandup,
  standupSince,
  localDay,
  parseJsonAny,
  rotateHue,
  machineLight,
  artifactsFolderName,
} from '../hooks/lib.js'

const BAND = {
  plugin: 'pet-dragon',
  component: 'AbovePrompt',
  surface: 'terminal',
  viewport: { columns: 120, rows: 30 },
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 110 },
} as const

const COMMANDS = [
  { name: 'c3-pr-workflow', description: 'Use when preparing a pull request, reviewing code, or running pre-PR checks', source: 'user' },
  { name: 'c3-testing-frontend', description: 'Use when writing React frontend tests in the React UI: Jest, React Testing Library, MSW', source: 'user' },
  { name: 'help', description: 'Show help', source: 'builtin' },
]

const CORE_UP_LOCAL = JSON.stringify({ up: true, pid: 4242, process: 'CoreAPI', db: 'local', dbEvidence: ['Data Source=.,1433'], dataSource: '.,1433', dataSourceFrom: 'user-secrets', sqlService: 'Running', dockerSql: 'daemon-off' })
const MAIL = JSON.stringify({ outlook: 'on', outlookUnread: 3, teams: 'off' })
const PORTS = JSON.stringify({ '7102': { up: true, pid: 77, process: 'BFF' }, '7201': { up: false } })
const JIRA = JSON.stringify({ data: { issues: [{ key: 'C3-1', summary: 'Do a thing', status: { name: 'In Progress' } }] } })
const PRS = JSON.stringify({ data: { pullRequests: [{ title: 'Fix it', author: { displayName: 'Sam' }, ageDays: 2, repo: { id: '7b33633431633438372d666438652d346565362d396133392d3461376330663439316230367d' } }, { title: 'Other repo', ageDays: 1, repo: { id: 'other' } }] } })

const GIT_STATUS = [
  '# branch.oid 324a680',
  '# branch.head feat/C3-1-thing',
  '# branch.upstream origin/feat/C3-1-thing',
  '# branch.ab +2 -0',
  '1 .M N... 100644 100644 100644 aaa bbb phoenix-ui/src/App.tsx',
  '? notes.txt',
].join('\n')
const PIPELINES = JSON.stringify([{ build_number: 3115, created_on: '2026-11-16T19:41:08Z', state: { name: 'COMPLETED', result: { name: 'SUCCESSFUL' } } }])
const SEQ_EVENTS = JSON.stringify([{ Timestamp: '2026-11-16T19:41:08Z', RenderedMessage: 'Boom in CoreAPI' }])

// What a Bash tool call prints, for tests that run a test command
let bashStdout = ''
// Transcript lines the plugin printed with $.ui.log
const logged: string[] = []
const toasted: string[] = []

// Everything session.start and the pollers need, answered in Claude Code's place
const speakRuns: string[] = []
const speakSaid: string[] = []
const teamsStarts: string[] = []
// What the CoreAPI probe prints, and every switch-db.ps1 run (a start or a switch)
let coreProbe = CORE_UP_LOCAL
const dbSwitches: string[] = []
let speakAnswer = 'Voice replies: ON'
function stubSession(on, asked: string[], answer: string, opened: string[] = []) {
  const clock = mock.clock(on)
  mock.store(on, {})
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:\Users\me' })
  on('session.start', () => ({ cwd: 'C:\\repo' }))
  on('command.register', () => ({ value: undefined }))
  on('command.list', () => ({ value: COMMANDS }))
  on('session.root', () => ({ value: 'C:\\repo' }))
  on('session.usage', () => ({ value: { context: { tokens: 1000, window: 200000, percent: 12 } } }))
  on('ui.toast', ($, e) => {
    toasted.push(String(e.text))
    return { value: undefined }
  })
  on('ui.log', ($, e) => {
    if (e.to !== 'debug') logged.push(e.text)
    return { value: undefined }
  })
  on('ui.render', () => ({ type: 'Text', props: {}, children: [''] }))
  on('prompt.submit', ($, e) => {
    return { text: e.text, context: e.context }
  })
  on('process.run', ($, e) => {
    const argv = e.argv.join(' ')
    let stdout = ''
    if (argv.includes('claude-speak.exe')) {
      speakSaid.push(argv)
    } else if (argv.includes('speak-toggle')) {
      speakRuns.push(argv)
      stdout = speakAnswer
      if (speakAnswer === 'FAIL') return { value: { exitCode: 1, stdout: '', stderr: 'boom' } }
    } else if (argv.includes('start-teams')) {
      teamsStarts.push(argv)
      stdout = 'started new Teams'
    } else if (argv.includes('open-url')) opened.push(argv)
    else if (argv.includes('switch-db')) {
      dbSwitches.push(argv)
      stdout = JSON.stringify({ ok: true })
    } else if (argv.includes('coreapi-probe')) stdout = coreProbe
    else if (argv.includes('ports-probe')) stdout = PORTS
    else if (argv.includes('messages-probe')) stdout = MAIL
    else if (argv.includes('twg jira')) stdout = JIRA
    else if (argv.includes('twg prs')) stdout = PRS
    else if (argv.includes('pipeline query')) stdout = PIPELINES
    else if (argv.includes('--porcelain=v2')) stdout = GIT_STATUS
    else if (argv.includes('user.email')) stdout = 'me@example.com'
    else if (argv.includes(' log ')) stdout = 'abc1234 C3-1 Fix the thing\ndef5678 C3-2 Add another'
    return { value: { exitCode: 0, stdout, stderr: '' } }
  })
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: SEQ_EVENTS } }))
  on('tool.call', ($, e) => {
    if (e.tool === 'AskUserQuestion') {
      asked.push(e.questions[0].question)
      return { result: { answers: { [e.questions[0].question]: answer } } }
    }
    if (e.tool === 'Bash') return { result: { stdout: bashStdout, stderr: '' } }
    return { result: 'ok' }
  })
  return clock
}

test('the band shows Dragon and every light after the first polls', async ($, on) => {
  const clock = stubSession(on, [], 'No thanks')
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })
  await clock.advance(9_000)

  const ui = await $.ui.mount(BAND)
  // Three unread emails turn Dragon blue
  expect(await ui.find({ type: 'Text', text: /Unread messages/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'local db' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /CoreAPI: CoreAPI up .* local SQL Server/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /BFF: BFF is running on :7102/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /MoveDocs API: MoveDocs API is not running/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Outlook: 3 unread/ })).toBeDefined()
  // PR and Jira hovers list just the ticket and its status
  expect(await ui.find({ type: 'Text', text: /PRs: Fix it 0c/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Jira: C3-1 In Progress/ })).toBeDefined()
  await ui.unmount()
})

test('pressing a light opens its URL through the open-url script', async ($, on) => {
  const opened: string[] = []
  const clock = stubSession(on, [], 'No thanks', opened)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })
  await clock.advance(9_000)

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'drg-light-coreapi-open' })
  expect(opened.length).toBe(1)
  expect(opened[0]).toMatch(/[\\/]scripts[\\/]open-url\.ps1/)
  expect(opened[0]).toContain('http://localhost:5236/swagger')
  await ui.unmount()
})

test('pressing the Core database text offers a switch, and refuses when the other database is not up', async ($, on) => {
  const opened: string[] = []
  const clock = stubSession(on, [], 'No thanks', opened)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\repo' })
  await clock.advance(9_000)

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'drg-light-coreapi-db' })
  // Docker is off in the stub, so Dragon declines to restart CoreAPI against it and says why
  expect(toasted.join(' ')).toContain('No Docker SQL container')
  expect(opened.length).toBe(0)
  await ui.unmount()
})

test('pressing "down" on the Core light asks which database, then starts CoreAPI on it', async ($, on) => {
  coreProbe = JSON.stringify({ up: false, sqlService: 'Running', dockerSql: 'daemon-off' })
  dbSwitches.length = 0
  try {
    const asked: string[] = []
    const clock = stubSession(on, asked, 'Start on local db')
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })
    await clock.advance(9_000)

    const ui = await $.ui.mount(BAND)
    expect(await ui.find({ type: 'Text', text: 'down' })).toBeDefined()
    await ui.press({ key: 'drg-light-coreapi-db' })
    expect(asked.join(' ')).toContain('Start it on which database')
    expect(dbSwitches.length).toBe(1)
    expect(dbSwitches[0]).toMatch(/switch-db\.ps1/)
    expect(dbSwitches[0]).toContain('local')
    await ui.unmount()
  } finally {
    coreProbe = CORE_UP_LOCAL
  }
})

test('starting a down CoreAPI refuses a database that is not up', async ($, on) => {
  coreProbe = JSON.stringify({ up: false, sqlService: 'Running', dockerSql: 'daemon-off' })
  dbSwitches.length = 0
  try {
    const clock = stubSession(on, [], 'Start on docker db')
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })
    await clock.advance(9_000)

    const ui = await $.ui.mount(BAND)
    await ui.press({ key: 'drg-light-coreapi-db' })
    expect(toasted.join(' ')).toContain('No Docker SQL container')
    expect(dbSwitches.length).toBe(0)
    await ui.unmount()
  } finally {
    coreProbe = CORE_UP_LOCAL
  }
})

test('accepting a suggested skill adds it to the prompt context', async ($, on) => {
  const asked: string[] = []
  stubSession(on, asked, 'Use /c3-pr-workflow')
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })

  const out = await $.prompt.submit({ text: 'prepare a pull request for my branch', origin: { kind: 'composer' } })
  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('/c3-pr-workflow')
  expect(JSON.stringify(out.context)).toContain('opted in to these skills for this request: c3-pr-workflow')
})

test('declining leaves the prompt alone and does not ask again for that skill', async ($, on) => {
  const asked: string[] = []
  stubSession(on, asked, 'No thanks')
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })

  const first = await $.prompt.submit({ text: 'prepare a pull request for my branch', origin: { kind: 'composer' } })
  expect(JSON.stringify(first.context ?? [])).not.toContain('opted in')
  await $.prompt.submit({ text: 'prepare a pull request for the other branch', origin: { kind: 'composer' } })
  expect(asked.length).toBe(1)
})

test('slash commands and unrelated prompts are never interrupted', async ($, on) => {
  const asked: string[] = []
  stubSession(on, asked, 'No thanks')
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })

  await $.prompt.submit({ text: '/c3-pr-workflow', command: 'c3-pr-workflow', origin: { kind: 'composer' } })
  await $.prompt.submit({ text: 'what time is it in Denver right now', origin: { kind: 'composer' } })
  expect(asked.length).toBe(0)
})

test('typing turns Dragon orange unless Claude is busy or needs you', () => {
  const base = { unread: 3, contextPct: 95, contextWarn: 80 }
  // Typing beats the quieter moods (unread, context, idle)
  expect(pickMood({ ...base, session: 'idle', typing: true })).toBe('typing')
  expect(pickMood({ ...base, session: 'idle', typing: false })).toBe('unread')
  // Claude working, using a tool, waiting on you, or erroring still wins
  for (const session of ['working', 'tool', 'waiting', 'error']) {
    expect(pickMood({ ...base, session, typing: true })).toBe(session)
  }
  // A caller that never passes typing keeps the old behavior
  expect(pickMood({ session: 'idle', unread: 0, contextPct: 10, contextWarn: 80 })).toBe('idle')
  // Ready is green only when nothing needs you; a needs-you light turns it coral, but mail and errors still win
  expect(pickMood({ session: 'idle', unread: 0, contextPct: 10, contextWarn: 80, needs: 1 })).toBe('attention')
  expect(pickMood({ session: 'idle', unread: 2, contextPct: 10, contextWarn: 80, needs: 1 })).toBe('unread')
  expect(pickMood({ session: 'error', unread: 0, contextPct: 10, contextWarn: 80, needs: 1 })).toBe('error')
  expect(MOODS.typing.label).toBe('Listening to you')
})

test('the repo row shows git, pipeline and Seq lights after the first polls', async ($, on) => {
  const clock = stubSession(on, [], 'No thanks')
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })
  await clock.advance(9_000)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /Git: feat\/C3-1-thing: 2 uncommitted, 2 to push/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Pipeline for your branch: Latest pipeline #3115 on feat\/C3-1-thing passed/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Seq errors \(local\): 1 error\(s\) in Seq/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Backend tests .*: No backend test run recorded yet/ })).toBeDefined()
  await ui.unmount()
})

test('a test run Claude starts lights the Tests light', async ($, on) => {
  const clock = stubSession(on, [], 'No thanks')
  bashStdout = 'Failed!  - Failed:     2, Passed:    10, Skipped:     0, Total:    12'
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })
  await $.tool.call({ tool: 'Bash', command: 'dotnet test Phoenix.sln' })
  await clock.advance(1_000)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /Backend tests .*: dotnet run: 2 failed, 10 passed/ })).toBeDefined()
  await ui.unmount()
})

test('/dragon standup gathers Jira, PRs and commits', async ($, on) => {
  stubSession(on, [], 'No thanks')
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })

  const out = await $.command.run({ command: 'dragon', args: 'standup' })
  expect(out.text).toContain('Standup since')
  expect(out.text).toContain('Jira  C3-1 In Progress Do a thing')
  expect(out.text).toContain('Fix it')
  expect(out.text).not.toContain('Other repo')
  expect(out.text).toContain('last: C3-1 Fix the thing')
})

test('pressing the band Standup button prints the standup into the chat', async ($, on) => {
  const clock = stubSession(on, [], 'No thanks')
  logged.length = 0
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\repo' })
  await clock.advance(9_000)

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'drg-standup-band' })
  await clock.advance(100)
  const printed = logged.join(' | ')
  expect(printed).toContain('Standup since')
  expect(printed).toContain('Jira  C3-1 In Progress Do a thing')
  await ui.unmount()
})

test('lines with somewhere to go carry a link; a failed build links to its run', () => {
  const runs = [
    { build_number: 2905, created_on: '2026-11-11T04:32:10Z', state: { name: 'COMPLETED', result: { name: 'FAILED' } } },
    { build_number: 2904, created_on: '2026-11-10T20:00:00Z', state: { name: 'COMPLETED', result: { name: 'SUCCESSFUL' } } },
  ]
  const ci = pipelineLight(runs, 'feat/x', 'keyhealthtech/phoenix')
  expect(ci.value).toBe('failed')
  // Pressing the light itself opens the failing run, and each run in the list links to its own page
  expect(ci.url).toBe('https://bitbucket.org/keyhealthtech/phoenix/pipelines/results/2905')
  expect(ci.detail[0]).toEqual({ text: '#2905  FAILED  2026-11-11 04:32', url: 'https://bitbucket.org/keyhealthtech/phoenix/pipelines/results/2905' })
  expect(ci.detail[1].url).toContain('/results/2904')
  // No repo known: plain text rather than a dead link
  expect(pipelineLight(runs, 'feat/x').detail[0]).toBe('#2905  FAILED  2026-11-11 04:32')

  const seq = seqLight([{ Id: 'event-1', Timestamp: '2026-11-16T19:41:08Z', RenderedMessage: 'Boom' }], 15, 50, 'http://localhost:5341/')
  expect(seq.detail[0].url).toBe('http://localhost:5341/#/events?filter=' + encodeURIComponent("@Id = 'event-1'"))
  expect(seq.url).toContain('http://localhost:5341/#/events?filter=')

  const g = gitLight(parseGitStatus(GIT_STATUS)!, 'keyhealthtech/phoenix')
  expect(g.detail[0].url).toBe('https://bitbucket.org/keyhealthtech/phoenix/branch/feat%2FC3-1-thing')
  // A branch with no upstream is not on Bitbucket yet
  expect(typeof gitLight(parseGitStatus('# branch.head x\n# branch.ab +0 -0')!, 'a/b').detail[0]).toBe('string')

  expect(jiraLight({ data: { issues: [{ key: 'C3-1', summary: 'S', status: { name: 'Open' }, url: 'https://x/browse/C3-1' }] } }).detail[0].url).toBe('https://x/browse/C3-1')
  expect(prLight({ data: { pullRequests: [{ title: 'T', url: 'https://bb/pr/1', repo: { id: 'r' } }] } }, 'r').detail[0].url).toBe('https://bb/pr/1')
})

test('/dragon sleep puts Dragon to sleep at once, and any activity wakes it', async ($, on) => {
  const clock = stubSession(on, [], 'No thanks')
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })
  await clock.advance(9_000)

  const out = await $.command.run({ command: 'dragon', args: 'sleep' })
  expect(out.text).toContain('falls asleep')
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /Asleep/ })).toBeDefined()
  await ui.unmount()
})

test('Dragon falls asleep after a long idle gap, and typing or work wakes it', () => {
  const base = { session: 'idle', typing: false, unread: 0, contextPct: 10, contextWarn: 80, sleepyAfterMs: 20 * 60_000 }
  expect(pickMood({ ...base, idleMs: 19 * 60_000 })).toBe('idle')
  expect(pickMood({ ...base, idleMs: 20 * 60_000 })).toBe('sleepy')
  // Typing and active work beat sleep
  expect(pickMood({ ...base, idleMs: 99 * 60_000, typing: true })).toBe('typing')
  // Mail and context keep their color while the dragon dozes: only the green default turns sleepy grey
  expect(pickMood({ ...base, idleMs: 99 * 60_000, unread: 2 })).toBe('unread')
  expect(isAsleep({ ...base, idleMs: 99 * 60_000, unread: 2 })).toBe(true)
  expect(isAsleep({ ...base, idleMs: 99 * 60_000, session: 'working' })).toBe(false)
  expect(isAsleep({ ...base, idleMs: 99 * 60_000, typing: true })).toBe(false)
  expect(isAsleep({ ...base, idleMs: 1_000 })).toBe(false)
  expect(pickMood({ ...base, idleMs: 99 * 60_000, contextPct: 95 })).toBe('context')
  expect(pickMood({ ...base, idleMs: 99 * 60_000, session: 'error' })).toBe('error')
  expect(pickMood({ ...base, idleMs: 1_000, unread: 2 })).toBe('unread')
  expect(pickMood({ ...base, idleMs: 99 * 60_000, session: 'working' })).toBe('working')
  // 0 turns sleep off; a caller that passes no timings never sleeps
  expect(pickMood({ ...base, idleMs: 99 * 60_000, sleepyAfterMs: 0 })).toBe('idle')
  expect(pickMood({ session: 'idle', unread: 0, contextWarn: 80 })).toBe('idle')
  // Closed eyes: the sleeping sprite differs from the resting one, in the same size
  expect(SLEEP.length).toBe(IDLE.length)
  expect(SLEEP.join('\n')).not.toBe(IDLE.join('\n'))
})

test('git status parses branch, ahead/behind, changes and paths', () => {
  const g = parseGitStatus(GIT_STATUS)!
  expect(g).toMatchObject({ branch: 'feat/C3-1-thing', ahead: 2, behind: 0, changed: 1, untracked: 1 })
  expect(g.paths).toEqual(['phoenix-ui/src/App.tsx', 'notes.txt'])
  expect(gitLight(g).value).toBe('2~ \u21912')
  expect(gitLight(parseGitStatus('# branch.head main\n# branch.ab +0 -0')!).value).toBe('clean')
  expect(gitLight(parseGitStatus('# branch.head main\n# branch.ab +0 -3')!).color).toBe('#ffc107')
  expect(gitLight(undefined).value).toBe('?')
})

test('pipeline light reads the newest run', () => {
  const run = (state: string, result?: string) => [{ build_number: 7, state: { name: state, result: result ? { name: result } : undefined } }]
  expect(pipelineLight(run('COMPLETED', 'SUCCESSFUL'), 'b').value).toBe('passed')
  expect(pipelineLight(run('COMPLETED', 'FAILED'), 'b').value).toBe('failed')
  expect(pipelineLight(run('IN_PROGRESS'), 'b').value).toBe('running')
  expect(pipelineLight([], 'b').value).toBe('none')
  expect(pipelineLight(run('COMPLETED', 'SUCCESSFUL'), 'development', undefined, true).short).toContain('none on development')
  expect(pipelineLight(undefined, 'b').value).toBe('?')
  expect(parseJsonAny('noise\n[{"a":1}]\n')).toEqual([{ a: 1 }])
  expect(parseJsonAny('{"data":1}')).toEqual({ data: 1 })
})

test('test runs are read off the runner summary', () => {
  expect(isTestCommand('cd bff && dotnet test --filter X')).toBe(true)
  expect(isTestCommand('npm run test -- -t foo')).toBe(true)
  expect(isTestCommand('git status')).toBe(false)
  expect(parseTestRun('dotnet test', 'Passed!  - Failed:     0, Passed:    41, Skipped:     0, Total:    41')).toEqual({ runner: 'dotnet', passed: 41, failed: 0 })
  expect(parseTestRun('npm run test', 'Tests:       2 failed, 1 skipped, 30 passed, 33 total')).toEqual({ runner: 'jest', passed: 30, failed: 2 })
  expect(parseTestRun('npm run test', 'Tests:       30 passed, 30 total')).toEqual({ runner: 'jest', passed: 30, failed: 0 })
  expect(parseTestRun('k6 run x.js', 'ERRO[0030] some thresholds have failed')).toEqual({ runner: 'k6', passed: 0, failed: 1 })
  expect(parseTestRun('dotnet test', 'Build FAILED.')).toBeUndefined()
  expect(testLight({ runner: 'jest', passed: 3, failed: 0 }).color).toBe('#3ddc84')
  expect(testLight({ runner: 'jest', passed: 3, failed: 1 }).color).toBe('#ff5252')
})

test('Seq light counts recent errors and caps the label', () => {
  expect(seqLight([], 15, 50).value).toBe('0')
  expect(seqLight([{ RenderedMessage: 'x' }], 15, 50).value).toBe('1')
  expect(seqLight(new Array(50).fill({ RenderedMessage: 'x' }), 15, 50).value).toBe('50+')
  expect(seqLight(undefined, 15, 50).value).toBe('off')
  expect(seqLight(undefined, 15, 50).short).toContain('log viewer')
})

test('skill suggestions: file paths corroborate words, a path in the prompt stands alone', () => {
  const skills = indexSkills(
    [
      { name: 'c3-backend', description: 'Use when writing .NET backend code: controllers, services, repositories', source: 'user' },
      { name: 'c3-frontend', description: 'Use when writing React frontend code in phoenix-ui: components, hooks', source: 'user' },
    ],
    'pet-dragon',
  )
  const touchedBackend = pathSignals(['core-api/Orders/OrderService.cs', 'core-api/Orders/OrderRepo.cs'])
  expect(touchedBackend.get('c3-backend')).toBe(2)
  // Touched files alone never suggest a skill on an unrelated prompt
  expect(suggestSkills('what time is it in Denver right now', skills, { pathHits: touchedBackend })).toEqual([])
  // One description word (+1) plus touched files (+2) reaches the threshold; the word alone does not
  expect(suggestSkills('please refactor this service method', skills, {}).length).toBe(0)
  expect(suggestSkills('please refactor this service method', skills, { pathHits: touchedBackend })[0]?.name).toBe('c3-backend')
  // A path written in the prompt is enough by itself
  const written = pathSignals(pathsInText('tidy up phoenix-ui/src/pages/Dashboard/Tabs.tsx please'))
  expect(suggestSkills('tidy up phoenix-ui/src/pages/Dashboard/Tabs.tsx please', skills, { promptPathHits: written })[0]?.name).toBe('c3-frontend')
  expect(pathSignals(['phoenix-ui/src/Foo.test.tsx']).get('c3-testing-frontend')).toBe(1)
})

test('skill suggestions learn from accepted and declined answers', () => {
  const skills = indexSkills([{ name: 'c3-backend', description: 'Use when writing backend services', source: 'user' }], 'pet-dragon')
  const prompt = 'refactor the backend please'
  const base = suggestSkills(prompt, skills, {})
  expect(base[0].score).toBe(3)
  let aff = recordAffinity({}, ['c3-backend'], [])
  aff = recordAffinity(aff, ['c3-backend'], [])
  expect(suggestSkills(prompt, skills, { affinity: aff })[0].score).toBe(5)
  // Three declines take a point back; learning never invents a suggestion from nothing
  const sour = recordAffinity(recordAffinity(recordAffinity({}, [], ['c3-backend']), [], ['c3-backend']), [], ['c3-backend'])
  expect(suggestSkills(prompt, skills, { affinity: sour })[0].score).toBe(2)
  expect(suggestSkills('what time is it in Denver', skills, { affinity: aff })).toEqual([])
})

test('standup picks the previous working day and formats every section', () => {
  // Monday 2026-11-16 looks back to Friday the 13th; midweek looks back one day
  expect(localDay(standupSince(new Date(2026, 10, 16, 9, 0)))).toBe('2026-11-13')
  expect(localDay(standupSince(new Date(2026, 10, 18, 9, 0)))).toBe('2026-11-17')
  const text = formatStandup({
    since: new Date(Date.UTC(2026, 10, 13)),
    issues: [{ key: 'C3-1', summary: 'Do a thing', status: { name: 'Done' } }],
    prs: [{ title: 'Fix it', state: 'MERGED', commentCount: 3, repo: { id: 'r' } }, { title: 'Elsewhere', repo: { id: 'x' } }],
    commits: ['abc Fix'],
    repoId: 'r',
  })
  expect(text.split('\n')).toEqual(['Standup since Fri 11-13', 'Jira  C3-1 Done Do a thing', 'PR    merged Fix it (3c)', 'Git   1 commit, last: Fix'])
  expect(text).not.toContain('Elsewhere')
  expect(formatStandup({ since: new Date(), issues: undefined, prs: undefined, commits: undefined })).toContain('Jira  unreadable')
})

test('release radar names prod, next and development', () => {
  expect(newestRelease(['origin/release/next/1.9.0', 'origin/release/next/1.35.0', 'origin/release/next/1.8.0'])).toBe('origin/release/next/1.35.0')
  expect(ticketsIn(['C3-1 a', 'Merged C3-1 and PHX-2', 'C3-0000 sync'])).toEqual(['C3-1', 'PHX-2'])
  const r = radarLight({ prod: 'origin/release/prod/1.34.0', next: 'origin/release/next/1.35.0', nextCommits: ['C3-1 a', 'C3-2 b'], devCommits: ['C3-2 b', 'C3-3 c'] })
  expect(r.value).toBe('1.34.0')
  expect(r.short).toContain('1.35.0 is next: 2 ticket(s)')
  expect(r.short).toContain('development has 1 more ticket(s)')
  expect(r.detail[1]).toEqual({ text: 'in 1.35.0: C3-1', url: 'https://keyjira.atlassian.net/browse/C3-1' })
  expect(radarLight(undefined).value).toBe('?')
})

test('branch drift warns on overlapping files', () => {
  expect(driftLight({ branch: 'b', behind: 0, overlap: [] }).value).toBe('synced')
  expect(driftLight({ branch: 'b', behind: 4, overlap: [] }).color).toBe('#ffc107')
  const d = driftLight({ branch: 'b', behind: 4, overlap: ['a.cs', 'b.cs'] })
  expect(d.color).toBe('#ff5252')
  expect(d.value).toBe('↓4 2 clash')
  expect(driftLight(undefined).value).toBe('?')
})

test('team awareness lights: reviews, merged today, ship check', () => {
  const pr = (age: number) => ({ title: 'C3-1 x', ageDays: age, commentCount: 0, url: 'https://bb/pr/1', repo: { id: 'r' } })
  expect(reviewLight({ data: { pullRequests: [] } }, 'r').value).toBe('0')
  expect(reviewLight({ data: { pullRequests: [pr(1)] } }, 'r').color).toBe('#ffc107')
  expect(reviewLight({ data: { pullRequests: [pr(5)] } }, 'r').color).toBe('#ff5252')
  expect(reviewLight(undefined, 'r').value).toBe('?')
  const m = mergedLight(['Ann|Merged in bug/C3-9-x (pull request #12)', 'Bo|Merged in feat/C3-8-y (pull request #11)'])
  expect(m.value).toBe('2')
  expect(m.detail[0]).toBe('Ann  C3-9  #12')
  expect(mergedLight([]).short).toContain('Nothing has merged')
  expect(shipLight([], '1.35.0', 72).value).toBe('clear')
  const sl = shipLight([{ key: 'C3-5', status: { name: 'In QA' }, summary: 'S', url: 'https://x/C3-5' }], '1.35.0', 72)
  expect(sl.value).toBe('1 open')
  expect(sl.detail[0]).toBe('1 In QA')
  expect(sl.detail[1]).toEqual({ text: 'C3-5  In QA  S', url: 'https://x/C3-5' })
  expect(shipLight(undefined, '1.35.0', 0).value).toBe('?')
})

test('token coach lights and advice', () => {
  expect(ctxLight(40).color).toBe('#3ddc84')
  expect(ctxLight(70).color).toBe('#ffc107')
  expect(ctxLight(91).value).toBe('91%')
  expect(ctxLight(91).short).toContain('/compact now')
  expect(ctxLight(undefined).value).toBe('?')
  const days = { '2026-11-10': 10, '2026-11-11': 12, '2026-11-12': 8, '2026-11-16': 30 }
  const st = dayStats(days, '2026-11-16')
  expect(st).toEqual({ today: 30, avg: 10, n: 3 })
  expect(dayLight(st).color).toBe('#ff5252')
  expect(dayLight(st).value).toBe('$30.00/$15.00')
  const early = dayLight(dayStats({ '2026-11-16': 3.4 }, '2026-11-16'))
  expect(early.value).toBe('$3.40/$15.00')
  expect(early.color).toBe('#3ddc84')
  expect(dayLight(dayStats({ '2026-11-16': 8.6 }, '2026-11-16')).value).toBe('$8.60/$15.00')
  expect(dayLight(dayStats({ '2026-11-16': 11 }, '2026-11-16')).color).toBe('#ffc107')
  expect(early.short).toContain('Spent $3.40 of $15.00 today')
  expect(early.short).toContain('No typical day yet')
  const ids = (s: object) => tokenAdvice(s as never).map((a) => a.id)
  expect(ids({ contextPct: 50 })).toEqual([])
  expect(ids({ contextPct: 70 })).toEqual(['compact-soon'])
  expect(tokenAdvice({ contextPct: 92 } as never)[0].action).toBe('compact')
  expect(ids({ contextPct: 40, startBranch: 'a', branch: 'b' })).toEqual(['clear-branch'])
  expect(ids({ contextPct: 55, sessionMinutes: 200 })).toEqual(['clear-old'])
  expect(ids({ day: { today: 30, avg: 10, n: 3 } })).toEqual(['day-high'])
  expect(ids({ limits: [{ kind: 'seven_day', percentUsed: 85 }] })).toEqual(['limit-high'])
})

test('release forecast estimates the next release and lists hotfixes', () => {
  const prod = ['origin/release/prod/1.30.0 2026-09-10', 'origin/release/prod/1.31.0 2026-10-15', 'origin/release/prod/1.32.0 2026-10-26', 'origin/release/prod/1.32.1 2026-10-28', 'origin/release/prod/1.33.0 2026-11-06', 'origin/release/prod/1.33.1 2026-11-10', 'origin/release/prod/1.34.0 2026-11-13']
  const next = ['origin/release/next/1.34.0 2026-11-06', 'origin/release/next/1.31.1 2026-10-08', 'origin/release/next/1.34.1 2026-11-15', 'origin/release/next/1.35.0 2026-11-16']
  const f = releaseForecast(prod, next, ['origin/hotfix/C3-1-x 2026-11-14', 'origin/hotfix/C3-2-old 2026-08-19'], '2026-11-16')
  expect(f.gaps).toEqual([35, 11, 11, 7])
  expect(f.median).toBe(11)
  expect(f.estDate).toBe('Nov 24')
  expect(f.daysAway).toBe(8)
  expect(f.hotfixes.map((h) => h.v)).toEqual(['1.32.1', '1.33.1'])
  expect(f.hotfixesInFlight).toEqual(['1.34.1'])
  expect(f.hotfixBranches).toEqual(['hotfix/C3-1-x'])
  expect(releaseForecast(prod, next, [], '2026-12-01').overdueDays).toBe(7)
  expect(releaseForecast([], [], [], '2026-11-16').estDate).toBeUndefined()
  const r = radarLight({ prod: 'origin/release/prod/1.34.0', next: 'origin/release/next/1.35.0', nextCommits: ['C3-1 a'], devCommits: [], forecast: f })
  expect(r.brief).toContain('next 1.35.0 ~Nov 24 (est.)')
  expect(r.brief).toContain('hotfixes 2 in 30d, 1 in flight')
  expect(r.short).toContain('Hotfixes: 2 in 30 days, 1.34.1 in flight')
})

test('Core light says which database it uses and whether the other is ready to switch to', () => {
  const up = { up: true, pid: 1, process: 'dotnet', repoRoot: 'C:/r', dataSource: '.', sqlService: 'Running', dockerSql: 'daemon-off' }
  const local = coreApiLight({ ...up, db: 'local' }, 5236)
  expect(local.value).toBe('local db')
  expect(local.dockerReady).toBe(false)
  expect(local.short).toContain('switch to Docker')
  const docker = coreApiLight({ ...up, db: 'docker', sqlService: 'Stopped', dockerSql: 'sql1' }, 5236)
  expect(docker.value).toBe('docker db')
  expect(docker.dockerReady).toBe(true)
  expect(docker.localReady).toBe(false)
  // Down still says what a start could use, so the start can refuse an unavailable database
  const down = coreApiLight({ up: false, sqlService: 'Running', dockerSql: 'sql1' }, 5236)
  expect(down.value).toBe('down')
  expect(down.localReady).toBe(true)
  expect(down.dockerReady).toBe(true)
  expect(down.short).toContain('start it')
})

test('A remembered scoped run is not a suite total, so a restart re-runs the full suite', () => {
  expect(isFullSuiteCommand('npm run test, full suite in 24 parts')).toBe(true)
  expect(isFullSuiteCommand('dotnet test, all 12 test projects')).toBe(true)
  expect(isFullSuiteCommand('npm test')).toBe(true)
  expect(isFullSuiteCommand('npm run test -- --silent --maxWorkers=4')).toBe(true)
  expect(isFullSuiteCommand('dotnet test --nologo')).toBe(true)
  expect(isFullSuiteCommand('npx jest --maxWorkers=4 src/common/contexts/ColumnsVisibilityContext')).toBe(false)
  expect(isFullSuiteCommand('npm test -- -t "name"')).toBe(false)
  expect(isFullSuiteCommand('dotnet test bff/Tests/Phoenix.BFF.UnitTests/Phoenix.BFF.UnitTests.csproj --nologo')).toBe(false)
  expect(isFullSuiteCommand(undefined)).toBe(false)
})

const DOTNET = 'dotnet test X.csproj --nologo'
const GOOD = 'Passed!  - Failed:     0, Passed:    12, Skipped:     0, Total:    12'
const BAD = 'error MSB3026: Could not copy, the file is locked'
const fakeRuns = (...results: Array<{ output: string; elapsedMs?: number }>) => {
  let calls = 0
  const runOnce = async () => ({ code: 0, elapsedMs: 1000, ...results[Math.min(calls++, results.length - 1)] })
  return { runOnce, calls: () => calls }
}

test('A test part with no summary is retried once, and counted when the retry reports', async () => {
  const f = fakeRuns({ output: BAD }, { output: GOOD })
  const got = await runTestPart({ kind: 'be', command: DOTNET, runOnce: f.runOnce, ceilingMs: 60_000 })
  expect(got).toEqual({ counted: { passed: 12, failed: 0 }, attempts: 2 })
  expect(f.calls()).toBe(2)
})

test('A test part that gives no summary twice is a problem, not a count', async () => {
  const f = fakeRuns({ output: BAD })
  const got = await runTestPart({ kind: 'be', command: DOTNET, runOnce: f.runOnce, ceilingMs: 60_000 })
  expect(got.attempts).toBe(2)
  expect(got.counted).toBeUndefined()
  expect(TEST_PROBLEM_VALUES).toContain(got.problem?.value)
})

test('A passing part is run once; a timed-out part and a helper with no tests are not retried', async () => {
  const pass = fakeRuns({ output: GOOD })
  expect((await runTestPart({ kind: 'be', command: DOTNET, runOnce: pass.runOnce, ceilingMs: 60_000 })).attempts).toBe(1)
  const slow = fakeRuns({ output: BAD, elapsedMs: 60_000 })
  const timedOut = await runTestPart({ kind: 'be', command: DOTNET, runOnce: slow.runOnce, ceilingMs: 60_000 })
  expect(timedOut.attempts).toBe(1)
  expect(timedOut.problem).toBeDefined()
  const helper = fakeRuns({ output: 'No test is available in Helpers.dll' })
  expect(await runTestPart({ kind: 'be', command: DOTNET, runOnce: helper.runOnce, ceilingMs: 60_000 })).toEqual({ empty: true, attempts: 1 })
})

test('Only a locked file or a runner with no verdict is retried; a compile error is not', async () => {
  const build = fakeRuns({ output: 'src/A.cs(1,1): error CS1002: ; expected' })
  const got = await runTestPart({ kind: 'be', command: DOTNET, runOnce: build.runOnce, ceilingMs: 60_000 })
  expect(got.attempts).toBe(1)
  expect(got.problem?.value).toBe('build')
  const seen: string[] = []
  const locked = fakeRuns({ output: BAD }, { output: GOOD })
  await runTestPart({ kind: 'be', command: DOTNET, runOnce: locked.runOnce, ceilingMs: 60_000, onRetry: (p: { value: string }) => seen.push(p.value) })
  expect(seen).toEqual(['locked'])
})

test('A full run is recognized through cd, pipes and a solution file, and a custom auto command is trusted', () => {
  expect(isFullSuiteCommand('cd phoenix-ui && npm test 2>&1 | tail -20')).toBe(true)
  expect(isFullSuiteCommand('dotnet test Phoenix.sln --no-build')).toBe(true)
  expect(isFullSuiteCommand('npx jest')).toBe(true)
  expect(isFullSuiteCommand('cd phoenix-ui && npx jest src/foo')).toBe(false)
  const custom = { run: { runner: 'dotnet', passed: 900, failed: 0 }, command: 'my-test-script --all', at: 1 }
  expect(startupTestRecord(custom)).toBeUndefined()
  expect(startupTestRecord({ ...custom, full: true })).toBeDefined()
})

test('A run with passing tests and no failures is green even when some parts gave no result', () => {
  expect(partialRunColor({ passed: 1880, failed: 0 })).toBe('#3ddc84')
  expect(partialRunColor({ passed: 1880, failed: 2 })).toBe('#ff5252')
  expect(partialRunColor({ passed: 0, failed: 0 })).toBe('#ffc107')
})

test('A failing part keeps its failure lines and its verdict, and nothing else', () => {
  const noise = Array.from({ length: 200 }, (_, i) => 'PASS src/ok' + i + '.test.ts')
  const out = [...noise, 'FAIL src/bad.test.ts', '  ● Thing › does it', '    expected 1 received 2', 'Tests:       1 failed, 199 passed, 200 total'].join('\n')
  const ex = failureExcerpt(out).split('\n')
  expect(ex).toContain('FAIL src/bad.test.ts')
  expect(ex).toContain('  ● Thing › does it')
  expect(ex[ex.length - 1]).toContain('Tests:       1 failed')
  expect(ex.length).toBeLessThan(25)
  expect(failureExcerpt(undefined)).toBe('')
})

test('After a restart only a full-suite run with tests is remembered', () => {
  const rec = (passed: number, command: string) => ({ run: { runner: 'jest', passed, failed: 0 }, command, at: 1 })
  expect(startupTestRecord(rec(5120, 'npm run test, full suite in 24 parts'))).toBeDefined()
  expect(startupTestRecord(rec(4, 'npx jest --maxWorkers=4 src/common/contexts/ColumnsVisibilityContext'))).toBeUndefined()
  expect(startupTestRecord(rec(0, 'npm run test, full suite in 24 parts'))).toBeUndefined()
  expect(startupTestRecord(undefined)).toBeUndefined()
  expect(startupTestRecord({ run: undefined, command: 'npm test', at: 1 })).toBeUndefined()
})

test('Tests light remembers the last run and shows how old it is', () => {
  const now = Date.parse('2026-11-16T12:00:00Z')
  const run = { runner: 'dotnet', passed: 1191, failed: 0 }
  const fresh = testLight(run, 'dotnet test', now - 2 * 3_600_000, now)
  expect(fresh.value).toBe('1191 pass')
  expect(fresh.short).toBe('dotnet run: 1191 passed, 2h ago')
  expect(fresh.color).toBe('#3ddc84')
  const old = testLight(run, 'dotnet test', now - 30 * 3_600_000, now)
  expect(old.color).toBe('#ffc107')
  expect(old.short).toContain('over a day old')
  expect(testLight({ ...run, failed: 2 }, 'dotnet test', now, now).color).toBe('#ff5252')
  expect(testLight(undefined).short).toContain('remembers the last one between sessions')
})

test('meetings light counts what is still to come and names tomorrow\'s first meeting', () => {
  const now = new Date(2026, 10, 16, 13, 20).getTime()
  const m = {
    outlook: 'on',
    meetings: [
      { start: '2026-11-16T09:00', end: '2026-11-16T09:30', subject: 'Standup', location: '', allDay: false },
      { start: '2026-11-16T13:30', end: '2026-11-16T14:00', subject: 'Design review', location: 'Teams', allDay: false },
      { start: '2026-11-16T15:00', end: '2026-11-16T16:00', subject: 'Planning', location: '', allDay: false },
      { start: '2026-11-17T08:00', end: '2026-11-17T08:30', subject: 'Early sync', location: '', allDay: false },
      { start: '2026-11-17T10:00', end: '2026-11-17T11:00', subject: 'Later', location: '', allDay: false },
      { start: '2026-11-16T00:00', end: '2026-11-17T00:00', subject: 'Birthday', location: '', allDay: true },
    ],
  }
  const l = meetLight(m, now)
  expect(l.value).toBe('2')
  expect(l.detail.join('|')).not.toContain('Standup')
  expect(l.detail.join('|')).toContain('1:30pm-2:00pm  Design review (Teams)')
  expect(l.detail.join('|')).toContain('first at 8:00am  Early sync')
  expect(l.tomorrowFirst).toBe('8:00am')
  expect(l.color).toBe('#ffc107')
  expect(meetLight({ outlook: 'off' }, now).value).toBe('off')
  expect(meetLight({ outlook: 'on', meetings: [] }, now).short).toBe('No more meetings today')
  const at = (h: number, mi: number) => new Date(2026, 10, 16, h, mi).getTime()
  expect(shouldRemindMeeting(at(15, 0), 999999, undefined)).toBe(false)
  expect(shouldRemindMeeting(at(15, 40), 300_000, undefined)).toBe(true)
  expect(shouldRemindMeeting(at(15, 40), 10_000, undefined)).toBe(false)
  expect(shouldRemindMeeting(at(16, 5), 10_000, undefined)).toBe(true)
  expect(shouldRemindMeeting(at(16, 5), 10_000, '2026-11-16')).toBe(false)
})

test('headline names what needs you, and Ready is green', () => {
  const g = { color: '#3ddc84', value: 'ok' }
  expect(headline([{ label: 'Git', light: g }])).toMatchObject({ level: 'green', text: 'All clear', color: '#3ddc84' })
  const h = headline([
    { label: 'Git', light: g },
    { label: 'Tests', light: { color: '#ffc107', value: 'unclear' } },
    { label: 'Core', light: { color: '#ff5252', value: 'off' } },
  ])
  expect(h.level).toBe('red')
  expect(h.text).toBe('2 need you: Core off · Tests unclear')
  expect(headline([{ label: 'Ctx', light: { color: '#ffc107', value: '75%' } }]).text).toBe('1 needs you: Ctx 75%')
  expect(MOODS.idle.color).toBe('#3ddc84')
  expect(MOODS.error.color).toBe('#ff5252')
})

test('a changed light flashes for a moment, then settles', () => {
  const l = { changedAt: 10_000 }
  expect(pulseBright(l, 10_100)).toBe(true)
  expect(pulseBright(l, 10_400)).toBe(false)
  expect(pulsing(l, 13_000)).toBe(false)
  expect(pulsing({}, 10_000)).toBe(false)
})

test('worktree light names the current worktree and lists the rest', () => {
  const text = 'worktree C:/Dev/C3\nHEAD abc\nbranch refs/heads/development\n\nworktree C:/Dev/C3-wt-10162\nHEAD def\nbranch refs/heads/feat/C3-10162-adjust\n\nworktree C:/Dev/old\nHEAD 123\ndetached\nprunable gitdir file points to non-existent location\n'
  const list = parseWorktrees(text)
  expect(list?.length).toBe(3)
  const linked = worktreeLight(list, 'C:\\Dev\\C3-wt-10162')
  expect(linked.value).toBe('C3-wt-10162')
  expect(linked.color).toBe('#1de9b6')
  expect(linked.short).toContain('a linked worktree')
  expect(linked.brief).toEqual(['C3 (development)', '\u25cf C3-wt-10162 (feat/C3-10162-adjust)', 'old (detached)'])
  expect(linked.detail[2]).toContain('missing folder')
  const main = worktreeLight(list, 'c:/dev/c3/')
  expect(main.value).toBe('C3')
  expect(main.color).toBe('#3ddc84')
  // A session started in a subfolder still finds its worktree, and a lone worktree says so
  expect(worktreeLight(list, 'C:/Dev/C3-wt-10162/phoenix-ui').value).toBe('C3-wt-10162')
  const only = worktreeLight(parseWorktrees('worktree C:/Dev/C3\nHEAD a\nbranch refs/heads/development\n'), 'C:/Dev/C3')
  expect(only.brief).toEqual(['\u25cf C3 (development)', 'your only worktree'])
  expect(worktreeLight(undefined, 'x').value).toBe('?')
})

test('PRs you already approved drop out of the review list', () => {
  expect(prNumber('https://bitbucket.org/keyhealthtech/phoenix/pull-requests/14780')).toBe(14780)
  const me = '712020:me'
  const pr = (id, who, approved) => ({ ok: true, data: { id, participants: [{ user: { account_id: who }, approved }, { user: { account_id: 'other' }, approved: true }] } })
  const done = approvedByMe({ items: [pr(1, me, true), pr(2, me, false), pr(3, 'someone', true), { ok: false }] }, me)
  expect([...(done ?? [])]).toEqual([1])
  expect(approvedByMe({}, me)).toBeUndefined()
  expect(approvedByMe({ items: [] }, '')).toBeUndefined()
})

test('backend and front-end test runs each get their own light', () => {
  expect(testKind({ runner: 'dotnet', passed: 1, failed: 0 })).toBe('be')
  expect(testKind({ runner: 'jest', passed: 1, failed: 0 })).toBe('fe')
  expect(testKind({ runner: 'k6', passed: 1, failed: 0 })).toBeUndefined()
  expect(testKind(undefined)).toBeUndefined()
  expect(testLight(undefined, undefined, undefined, undefined, 'be').short).toContain('C# test run')
  expect(testLight(undefined, undefined, undefined, undefined, 'fe').short).toContain('Jest run')
  expect(testLight(undefined, undefined, undefined, undefined, 'fe').short).toContain('remembers the last one between sessions')
})

test('clicking a dirty Git light lists the files and says what reset does', () => {
  const q = dirtySummary([' M src/a.ts', '?? notes.txt'], 'feat/x')
  expect(q).toContain('2 uncommitted change(s) on feat/x:')
  expect(q).toContain('   M src/a.ts')
  expect(q).toContain('the 1 untracked ?? file(s) stay')
  expect(q).toContain('Reset them, or keep them?')
  const many = dirtySummary(Array.from({ length: 20 }, (_, i) => ' M f' + i + '.ts'), 'b', 15)
  expect(many).toContain('and 5 more')
})

test('a jest run with nothing related to the change is a clean zero, not a missing summary', () => {
  const none = parseTestRun('npm run test -- --silent --changedSince=origin/development --passWithNoTests', 'No tests found related to files changed since "origin/development".')
  expect(none).toEqual({ runner: 'jest', passed: 0, failed: 0 })
  const light = testLight(none, 'npm run test', 1, 1, 'fe')
  expect(light.value).toBe('0 pass')
  expect(light.short).toContain('no tests relate to your changes')
  expect(parseTestRun('dotnet test', 'Build FAILED.')).toBeUndefined()
})

test('aiHealthLight judges a spike against the environment\'s own normal', () => {
  const normal = { n: 61, f: 1, p95: 1698, bn: 14511, bf: 293, bp95: 1884, top: [] }
  expect(aiHealthLight('prod', normal).color).toBe('#3ddc84')
  const spike = { n: 100, f: 12, p95: 1700, bn: 14511, bf: 293, bp95: 1884, top: [{ name: 'GET /api/v1.0/cases', count: 9 }] }
  const red = aiHealthLight('prod', spike)
  expect(red.color).toBe('#ff5252')
  expect(red.short).toContain('spiking')
  expect(red.detail.join(' ')).toContain('GET /api/v1.0/cases')
  // QA normally fails 83% of requests, so 85% and 99% are both just QA being QA
  const qaBase = { bn: 6357, bf: 5294, bp95: 300, top: [] }
  expect(aiHealthLight('qa', { ...qaBase, n: 100, f: 85, p95: 300 }).color).toBe('#3ddc84')
  expect(aiHealthLight('qa', { ...qaBase, n: 100, f: 99, p95: 300 }).color).toBe('#3ddc84')
})

test('aiHealthLight is quiet with no traffic and grey when unreadable', () => {
  expect(aiHealthLight('uat', { n: 0, f: 0, bn: 0, bf: 0 }).value).toBe('quiet')
  expect(aiHealthLight('prod', { error: 'The remote server returned an error: (401)' }).short).toContain('401')
  expect(aiHealthLight('prod', undefined).value).toBe('?')
})

test('aiHealthLight: a slow p95 is amber only while requests fail, and 0.0% is always green', () => {
  const clean = aiHealthLight('prod', { n: 80, f: 0, p95: 6000, bn: 10000, bf: 10, bp95: 1500, top: [] })
  expect(clean.value).toBe('0.0%')
  expect(clean.color).toBe('#3ddc84')
  expect(clean.short).toContain('p95')
  const slow = aiHealthLight('prod', { n: 80, f: 1, p95: 6000, bn: 10000, bf: 10, bp95: 1500, top: [] })
  expect(slow.color).toBe('#ffc107')
  expect(slow.short).toContain('p95')
})

test('hangfireLight sums job errors across environments', () => {
  expect(hangfireLight({ prod: { hangfire: { count: 0 } }, qa: { hangfire: { count: 0 } } }).value).toBe('ok')
  const l = hangfireLight({ prod: { hangfire: { count: 2, last: '2026-11-18T03:00:00Z', msg: 'Job failed' } }, qa: { hangfire: { count: 0 } } })
  expect(l.color).toBe('#ff5252')
  expect(l.value).toBe('2 err')
  expect(hangfireLight({ qa: { hangfire: { count: 1, last: '2026-11-18T03:00:00Z', msg: 'x' } } }).color).toBe('#ffc107')
  expect(hangfireLight({ prod: { error: 'x' } }).value).toBe('?')
})

test('teamCiLight judges pipelines as a team, not one PR', () => {
  const run = (n, result) => ({ build_number: n, state: { name: 'COMPLETED', result: { name: result } }, target: { source: 'feat/C3-' + n, destination: 'development' } })
  const ok = Array.from({ length: 8 }, (_, i) => run(100 - i, 'SUCCESSFUL'))
  expect(teamCiLight(ok, 'a/b').color).toBe('#3ddc84')
  expect(teamCiLight([run(101, 'FAILED'), ...ok.slice(1)], 'a/b').color).toBe('#ffc107')
  const bad = teamCiLight([run(105, 'FAILED'), run(104, 'FAILED'), run(103, 'FAILED'), run(102, 'FAILED'), ...ok], 'a/b')
  expect(bad.color).toBe('#ff5252')
  expect(bad.value).toBe('4/8')
  expect(bad.detail.length).toBe(4)
  expect(teamCiLight([run(1, 'FAILED')], 'a/b').value).toBe('quiet')
  expect(teamCiLight(undefined, 'a/b').value).toBe('?')
})

test('cacheLight counts down an hour from the last reply', () => {
  const now = 10_000_000
  expect(cacheLight(undefined, now, false).value).toBe('cold')
  expect(cacheLight(now - 61 * 60_000, now, false).value).toBe('cold')
  const warm = cacheLight(now - 18 * 60_000, now, false)
  expect(warm.value).toBe('42m')
  expect(warm.color).toBe('#3ddc84')
  const expiring = cacheLight(now - (60 * 60_000 - 105_000), now, false)
  expect(expiring.value).toBe('1:45')
  expect(expiring.color).toBe('#ff5252')
  expect(cacheLight(now - 18 * 60_000, now, true).value).toBe('busy')
})

test('monthLight shows account spend, or plan windows when there is no monthly limit', () => {
  const m = parseMonthly(JSON.stringify({ spend: { used: { amount_minor: 12800, currency: 'USD', exponent: 2 }, limit: { amount_minor: 150000 } } }))
  expect(m.usedMinor).toBe(12800)
  const l = monthLight(m, [], '', 0)
  expect(l.value).toBe('$128/$1,500')
  expect(l.color).toBe('#3ddc84')
  expect(l.short).toContain('$1,372 left')
  expect(monthLight({ ...m, usedMinor: 140000 }, [], '', 0).color).toBe('#ff5252')
  expect(parseMonthly('{"spend":{}}')).toBeUndefined()
  expect(parseMonthly('not json')).toBeUndefined()
  const plan = monthLight(undefined, [{ kind: 'five_hour', percentUsed: 23 }, { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-11-21T00:00:00Z' }], '', Date.parse('2026-11-18T00:00:00Z'))
  expect(plan.value).toBe('Week 41%')
  expect(plan.short).toContain('resets in 3d 0h')
  expect(monthLight(undefined, [], 'HTTP 429', 0).short).toContain('HTTP 429')
})

test('costLight puts today and the month in one light, colored by the worse', () => {
  const day = { color: '#3ddc84', value: '$4.20/$15.00', short: 'Spent $4.20 of $15.00 today', detail: ['d'] }
  const month = { color: '#ffc107', value: '$1,100/$1,500', short: 'Account spend this month', detail: ['m'] }
  const both = costLight(day, month)
  expect(both.value).toBe('$4.20/$15.00 \u00b7 $1,100/$1,500')
  expect(both.color).toBe('#ffc107')
  expect(both.short).toContain('Today:')
  expect(both.short).toContain('Month:')
  expect(both.detail).toEqual(['d', 'm'])
  // a month that is not known yet does not turn the light grey
  expect(costLight(day, { color: '#8a8a8a', value: '?', short: 'x', detail: [] }).color).toBe('#3ddc84')
  expect(costLight(day, undefined).value).toBe('$4.20/$15.00')
  expect(costLight(undefined, undefined).value).toBe('?')
})

test('depsLight names the dependency that is failing more than usual', () => {
  const dep = (target, f, n, bf, bn) => ({ target, type: 'SQL', f, n, bf, bn })
  expect(depsLight({ prod: { deps: [] }, qa: { deps: [] } }).value).toBe('ok')
  // a dependency that always fails (QA's vendor API) is not news
  expect(depsLight({ qa: { deps: [dep('cimi.api', 90, 100, 5000, 6000)] } }).value).toBe('ok')
  const l = depsLight({ prod: { deps: [dep('medprdsql01', 12, 100, 20, 20000)] }, qa: { deps: [] } })
  expect(l.color).toBe('#ff5252')
  expect(l.short).toContain('medprdsql01')
  expect(l.detail[0]).toContain('PROD')
  expect(depsLight({ prod: { error: 'x' } }).value).toBe('?')
})

test('bugsLight counts new bugs and flags the urgent ones', () => {
  const bug = (key, priority) => ({ key, priority: { name: priority }, status: { name: 'Backlog' }, summary: 'Thing broke', url: 'https://keyjira.atlassian.net/browse/' + key })
  expect(bugsLight({ data: { issues: [] } }).value).toBe('0')
  const calm = bugsLight({ data: { issues: [bug('C3-1', 'New'), bug('C3-2', 'Medium')] } })
  expect(calm.color).toBe('#1de9b6')
  expect(calm.value).toBe('2')
  const hot = bugsLight({ data: { issues: [bug('C3-3', 'Highest'), bug('C3-1', 'New')] } })
  expect(hot.color).toBe('#ff5252')
  expect(hot.value).toBe('2!')
  expect(hot.short).toContain('C3-3')
  expect(bugsLight(undefined).value).toBe('?')
  expect(bugsLight({ data: { issues: [] } }, 'C3Pod2').short).toContain('C3Pod2')
})

test('the Bugs query is limited to the pod label, or open to every pod when it is empty', () => {
  expect(bugsJql('C3Pod2')).toContain('labels = "C3Pod2"')
  expect(bugsJql('')).not.toContain('labels')
  expect(bugsJql('C3Pod2')).toContain('created >= -1d')
})

test('gradient colors each character along a line between two colors', () => {
  const g = gradient('abc', '#000000', '#ff8000')
  expect(g.map((x: any) => x.text).join('')).toBe('abc')
  expect(g.map((x: any) => x.color)).toEqual(['#000000', '#804000', '#ff8000'])
  expect(gradient('a', '#102030', '#ffffff')[0].color).toBe('#102030')
  expect(gradient('', '#000000', '#ffffff')).toEqual([])
})

const S = (id: number, state: string, start: string) => ({ id, name: 'C3 Sprint ' + id, state, startDate: start, endDate: start })
const sprintIssue = (key: string, status: string, pts: number | null, dev: string | null, sprints: any[]) =>
  slimIssue({ key, status: { name: status }, customfield_10004: pts, customfield_11232: dev ? { accountId: dev, displayName: dev.toUpperCase() } : null, customfield_10006: sprints })
const s36 = { ...S(36, 'closed', '2026-11-04T00:00:00Z'), endDate: '2026-11-18T00:00:00Z' }
const s37 = { ...S(37, 'active', '2026-11-18T00:00:00Z'), endDate: '2026-12-02T00:00:00Z' }
const s38 = S(38, 'future', '2026-12-02T00:00:00Z')

test('sprint queries are one sprint at a time, scoped to the pod, and skip DISREGARD', () => {
  expect(sprintJql('C3Pod2', 'open')).toContain('sprint in openSprints()')
  expect(sprintJql('C3Pod2', 'C3 Sprint 36')).toContain('sprint = "C3 Sprint 36"')
  expect(sprintJql('', 'open')).not.toContain('labels')
  expect(sprintJql('C3Pod2', 'open')).toContain('status != DISREGARD')
  expect(sprintNumber('C3 Sprint 37')).toEqual({ prefix: 'C3 Sprint', n: 37 })
  expect(sprintNumber('Backlog')).toBeUndefined()
})

test('pointsStats counts each ticket once, in the sprint it finished in, and only at Dev Done or beyond', () => {
  const issues = [
    sprintIssue('C3-1', 'Dev Done', 5, 'me', [s37]),
    sprintIssue('C3-2', 'COMPLETED', 3, 'me', [s36, s37]),
    sprintIssue('C3-2', 'COMPLETED', 3, 'me', [s37, s36]),
    sprintIssue('C3-3', 'In Progress', 8, 'me', [s37]),
    sprintIssue('C3-4', 'Ready for UAT', 2, 'me', [s36]),
    sprintIssue('C3-5', 'Dev Done', 13, 'sam', [s37]),
    sprintIssue('C3-6', 'Code Review', 1, 'zed', [s37]),
    sprintIssue('C3-7', 'Dev Done', 4, null, [s37]),
    sprintIssue('C3-8', 'Dev Done', 9, 'me', [s37, s38]),
  ]
  const st = pointsStats(issues, 'me')!
  expect(st.current.name).toBe('C3 Sprint 37')
  expect(st.me).toBe(5 + 3 + 9)
  expect(st.tickets.map((t: any) => t.key)).toEqual(['C3-1', 'C3-2', 'C3-8'])
  expect(st.members.map((m: any) => m.name + m.points)).toEqual(['ME17', 'SAM13', 'ZED0'])
  expect(st.unowned).toBe(4)
  expect(st.history).toEqual([{ name: 'C3 Sprint 36', points: 2 }])
  expect(st.avg).toBe(2)
  // A sprint where I had nothing is not averaged in
  const s35 = { ...S(35, 'closed', '2026-10-21T00:00:00Z'), endDate: '2026-11-04T00:00:00Z' }
  const s34 = { ...S(34, 'closed', '2026-10-07T00:00:00Z'), endDate: '2026-10-21T00:00:00Z' }
  const gaps = pointsStats([sprintIssue('C3-1', 'Dev Done', 5, 'me', [s37]), sprintIssue('C3-4', 'COMPLETED', 17, 'me', [s36]), sprintIssue('C3-9', 'COMPLETED', 3, 'me', [s35]), sprintIssue('C3-10', 'COMPLETED', 8, 'sam', [s34])], 'me')!
  expect(gaps.history.map((h: any) => h.points)).toEqual([3, 17])
  expect(gaps.avg).toBe(10)
  expect(pointsStats(undefined, 'me')).toBeUndefined()
})

test('the Pts and Pod lights show my points beside my average, the pod low and high, and the tickets counted', () => {
  const now = Date.parse('2026-11-25T00:00:00Z')
  const issues = [
    sprintIssue('C3-1', 'Dev Done', 5, 'me', [s37]),
    sprintIssue('C3-4', 'Ready for UAT', 10, 'me', [s36]),
    sprintIssue('C3-5', 'Dev Done', 13, 'sam', [s37]),
    sprintIssue('C3-6', 'Code Review', 1, 'zed', [s37]),
  ]
  const { points, pod } = pointsLights(pointsStats(issues, 'me'), 'C3Pod2', now)
  expect(points.value).toBe('5 avg 10')
  expect(points.short).toContain('Counting: C3-1 (5)')
  expect(points.color).toBe('#1de9b6')
  expect(pod.value).toBe('0-13')
  expect(pod.short).toContain('Low: ZED 0')
  expect(pod.short).toContain('High: SAM 13')
  expect(pod.short).toContain('You: 5 (2nd of 3)')
  expect(pod.detail.join('|')).toContain('ME  < you')
  const ahead = pointsLights(pointsStats([sprintIssue('C3-1', 'Dev Done', 20, 'me', [s37]), sprintIssue('C3-4', 'Dev Done', 10, 'me', [s36])], 'me'), 'C3Pod2', now)
  expect(ahead.points.color).toBe('#3ddc84')
  expect(ahead.pod.color).toBe('#3ddc84')
  const bad = pointsLights(undefined, 'C3Pod2', now)
  expect(bad.points.value).toBe('?')
  expect(bad.pod.value).toBe('?')
})

test('one person with two Jira accounts is one name in the pod, and still me when either account is mine', () => {
  const st = pointsStats([sprintIssue('C3-1', 'Dev Done', 5, 'old', [s37]), sprintIssue('C3-2', 'Dev Done', 3, 'new', [s37])].map((i) => ({ ...i, dev: { id: i.dev!.id, name: 'Ruben' } })), 'new')!
  expect(st.members.map((m: any) => m.name + m.points)).toEqual(['Ruben8'])
  expect(st.me).toBe(8)
})

test('the Mtgs light says when the next meeting is once nothing is left today', () => {
  const now = Date.parse('2026-11-16T18:00:00')
  const m = { outlook: 'on', meetings: [{ start: '2026-11-17T08:00', end: '2026-11-17T08:30', subject: 'Early sync', allDay: false }] }
  expect(meetLight(m, now).value).toBe('8:00am')
  expect(meetLight({ outlook: 'on', meetings: [] }, now).value).toBe('0')
})

test('a PR with a failing pipeline or no activity needs attention on the PRs light', () => {
  const now = Date.parse('2026-11-19T12:00:00Z')
  const pr = (n, updatedAt) => ({ title: 'C3-' + n + ' thing', url: 'https://bitbucket.org/k/p/pull-requests/' + n, repo: { id: 'r' }, updatedAt, commentCount: 1, reviewers: [] })
  const json = { data: { pullRequests: [pr(10, '2026-11-19T10:00:00Z'), pr(11, '2026-11-19T10:00:00Z'), pr(12, '2026-11-15T10:00:00Z')] } }
  const runs = [
    { target: { pullrequest: { id: 10 } }, state: { name: 'COMPLETED', result: { name: 'FAILED' } } },
    { target: { pullrequest: { id: 10 } }, state: { name: 'COMPLETED', result: { name: 'SUCCESSFUL' } } },
    { target: { pullrequest: { id: 11 } }, state: { name: 'COMPLETED', result: { name: 'SUCCESSFUL' } } },
  ]
  const blocked = blockedPrs(json, 'r', runs, now)
  expect(blocked[10].level).toBe('fail')
  expect(blocked[11]).toBeUndefined()
  expect(blocked[12].why).toContain('no activity')
  const light = prLight(json, 'r', blocked)
  expect(light.value).toBe('3!2')
  expect(light.color).toBe('#ff5252')
  expect(light.brief[0]).toContain('pipeline failed')
  expect(prLight(json, 'r').value).toBe('3')
})

test('a test part with no summary names its cause instead of "unclear"', () => {
  const limit = 600_000
  expect(diagnoseTestPart('building...', 1, limit, limit).value).toBe('timeout')
  expect(diagnoseTestPart('error MSB3027: Could not copy "a.dll". Exceeded retry count', 1, 5000, limit).value).toBe('locked')
  expect(diagnoseTestPart('Foo.cs(3,1): error CS0103: The name x does not exist', 1, 5000, limit)).toMatchObject({ value: 'build', line: expect.stringContaining('CS0103') })
  expect(diagnoseTestPart('FATAL ERROR: JavaScript heap out of memory', 134, 5000, limit).value).toBe('memory')
  expect(diagnoseTestPart("Cannot find module 'react' from 'src/a.tsx'", 1, 5000, limit).value).toBe('deps')
  expect(diagnoseTestPart('The active test run was aborted. Reason: Test host process crashed', 1, 5000, limit).value).toBe('crash')
  const none = diagnoseTestPart('something odd', 3, 5000, limit)
  expect(none.value).toBe('no result')
  expect(none.why).toContain('exit 3')
})

test('a "no result" part quotes the last meaningful output line, not the banner or a warning', () => {
  const out = 'Test run for a.dll (.NETCoreApp,Version=v8.0)\nSome message\nx.cs(1,1): warning CS8602: null\n'
  expect(diagnoseTestPart(out, 0, 5000, 600_000)).toMatchObject({ value: 'no result', line: 'Some message' })
})

// Hovering the dragon turns it a new color: every sprite cell's hover recolors it by a hue turn
test('rotateHue turns the hue and keeps lightness', () => {
  expect(rotateHue('#ff0000')).toBe('#00ff00')
  expect(rotateHue('#ff0000', 240)).toBe('#0000ff')
  expect(rotateHue('#808080')).toBe('#808080')
  expect(rotateHue('#ff0000', 360)).toBe('#ff0000')
})

test('rotateHue always answers a valid hex color that differs from the original', () => {
  for (const c of ['#ff6a2b', '#2ecc71', '#123456', '#fafafa', '#000000']) {
    expect(rotateHue(c)).toMatch(/^#[0-9a-f]{6}$/)
  }
  expect(rotateHue('#ff6a2b')).not.toBe('#ff6a2b')
})

// Clicking the dragon's dragon toggles /speak voice replies by running its toggle script
async function mountDragon($, on, answer = 'Voice replies: ON') {
  const clock = stubSession(on, [], 'No thanks')
  speakRuns.length = 0
  speakSaid.length = 0
  speakAnswer = answer
  toasted.length = 0
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\repo' })
  await clock.advance(9_000)
  const ui = await $.ui.mount(BAND)
  return { clock, ui }
}

test('one click on the dragon runs the /speak toggle script and toasts its answer', async ($, on) => {
  const { clock, ui } = await mountDragon($, on)
  await ui.press({ key: 'drg-dragon-2' })
  await clock.advance(100)
  expect(speakRuns).toHaveLength(1)
  expect(speakRuns[0]).toContain('speak-toggle.ps1 toggle')
  expect(speakRuns[0]).toContain('C:\Users\me')
  expect(toasted.join(' | ')).toContain('Voice replies: ON')
  await ui.unmount()
})

test('turning /speak on makes the dragon say a hello out loud', async ($, on) => {
  const { clock, ui } = await mountDragon($, on, 'Voice replies: ON')
  await ui.press({ key: 'drg-dragon-2' })
  await clock.advance(100)
  expect(speakSaid).toHaveLength(1)
  expect(speakSaid[0]).toContain('claude-speak.exe')
  expect(speakSaid[0]).toContain('My name is Yoshi')
  await ui.unmount()
})

test('turning /speak off stays quiet', async ($, on) => {
  const { clock, ui } = await mountDragon($, on, 'Voice replies: OFF')
  await ui.press({ key: 'drg-dragon-2' })
  await clock.advance(100)
  expect(speakSaid).toEqual([])
  await ui.unmount()
})

test('each click toggles again and shows the script answer', async ($, on) => {
  const { clock, ui } = await mountDragon($, on, 'Voice replies: OFF')
  await ui.press({ key: 'drg-dragon-2' })
  await clock.advance(100)
  await ui.press({ key: 'drg-dragon-2' })
  await clock.advance(100)
  expect(speakRuns).toHaveLength(2)
  expect(toasted.join(' | ')).toContain('Voice replies: OFF')
  await ui.unmount()
})

test('a failing /speak script is reported in a toast', async ($, on) => {
  const { clock, ui } = await mountDragon($, on, 'FAIL')
  await ui.press({ key: 'drg-dragon-2' })
  await clock.advance(100)
  expect(toasted.join(' | ')).toContain('could not toggle /speak: boom')
  await ui.unmount()
})

// The PC light: red (and blinking) when RAM, CPU or the disk will slow the machine down
const PC_OK = { ramTotalMb: 32000, ramFreeMb: 16000, cpuPct: 20, diskTotalGb: 500, diskFreeGb: 200, drive: 'C:', top: [{ name: 'chrome', mb: 2048 }] }

test('a healthy computer is a green PC light that does not blink', () => {
  const l = machineLight(PC_OK)
  expect(l.color).toBe(COLORS.green)
  expect(l.value).toBe('RAM 50%')
  expect(l.alarm).toBe(false)
})

test('RAM at 80% is amber and at 90% is red and blinking, naming the biggest user', () => {
  const amber = machineLight({ ...PC_OK, ramFreeMb: 6000 })
  expect(amber).toMatchObject({ color: COLORS.amber, value: 'RAM 81%', alarm: false })
  const red = machineLight({ ...PC_OK, ramFreeMb: 2000 })
  expect(red).toMatchObject({ color: COLORS.red, value: 'RAM 94%', alarm: true })
  expect(red.short).toContain('chrome')
})

test('a saturated CPU or a nearly full disk turns the PC light red', () => {
  expect(machineLight({ ...PC_OK, cpuPct: 97 })).toMatchObject({ color: COLORS.red, value: 'CPU 97%', alarm: true })
  expect(machineLight({ ...PC_OK, diskFreeGb: 6 })).toMatchObject({ color: COLORS.red, alarm: true })
  expect(machineLight({ ...PC_OK, diskFreeGb: 6 }).short).toContain('6 GB free')
})

test('an unreadable machine probe is a grey PC light, never red', () => {
  expect(machineLight(undefined)).toMatchObject({ color: COLORS.grey, value: '?' })
  expect(machineLight({})).toMatchObject({ color: COLORS.grey })
})

test('Teams not running is a red light, so it is listed under "needs you"', () => {
  const off = teamsLight({ teams: 'off' })
  expect(off).toMatchObject({ color: COLORS.red, value: 'off' })
  expect(teamsLight({ teams: 'on' }).color).toBe(COLORS.green)
  const h = headline([{ label: 'Teams', light: off }])
  expect(h.level).toBe('red')
  expect(h.text).toContain('Teams off')
})

test('the PC light sits at the end of the APIs row', () => {
  const pc = machineLight(PC_OK)
  expect(pc.value).toBe('RAM 50%')
})

test('clicking Teams while it is off starts Teams', async ($, on) => {
  const clock = stubSession(on, [], 'No thanks')
  teamsStarts.length = 0
  toasted.length = 0
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\repo' })
  await clock.advance(9_000)
  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'drg-light-teams' })
  await clock.advance(100)
  expect(teamsStarts).toHaveLength(1)
  expect(toasted.join(' | ')).toContain('started new Teams')
  await ui.unmount()
})

test('the test build folder is one safe name, whichever slashes the repo root uses', () => {
  expect(artifactsFolderName('C:\\Dev\\C3')).toBe('C3')
  expect(artifactsFolderName('C:/Dev/C3/')).toBe('C3')
  expect(artifactsFolderName('C:\\Dev\\C3-10195\\')).toBe('C3-10195')
  expect(artifactsFolderName('C:\\Dev\\my repo')).toBe('my_repo')
  expect(artifactsFolderName('')).toBe('repo')
  // Never a colon or a separator: that was what made every backend part report "no result"
  expect(artifactsFolderName('C:\\Dev\\C3')).not.toMatch(/[:\\/]/)
})

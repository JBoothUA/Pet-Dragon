import { expect, mock, test } from 'claude-code/testing'
import {
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
function stubSession(on, asked: string[], answer: string, opened: string[] = []) {
  const clock = mock.clock(on)
  mock.store(on, {})
  mock.env(on, { OS: 'Windows_NT' })
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
    if (argv.includes('open-url')) opened.push(argv)
    else if (argv.includes('coreapi-probe')) stdout = CORE_UP_LOCAL
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
  expect(await ui.find({ type: 'Text', text: /Pipelines: Latest pipeline #3115 on feat\/C3-1-thing passed/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Seq errors: 1 error\(s\) in Seq/ })).toBeDefined()
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

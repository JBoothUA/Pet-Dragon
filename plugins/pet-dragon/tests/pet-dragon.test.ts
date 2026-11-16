import { expect, mock, test } from 'claude-code/testing'
import {
  MOODS,
  SLEEP,
  IDLE,
  pickMood,
  parseGitStatus,
  gitLight,
  pipelineLight,
  jiraLight,
  prLight,
  seqLight,
  parseTestRun,
  isTestCommand,
  testLight,
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
  on('ui.toast', () => ({ value: undefined }))
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
  await ui.press({ key: 'drg-light-coreapi' })
  expect(opened.length).toBe(1)
  expect(opened[0]).toMatch(/[\\/]scripts[\\/]open-url\.ps1/)
  expect(opened[0]).toContain('http://localhost:5236/swagger')
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
  expect(await ui.find({ type: 'Text', text: /Tests: No test run seen yet/ })).toBeDefined()
  await ui.unmount()
})

test('a test run Claude starts lights the Tests light', async ($, on) => {
  const clock = stubSession(on, [], 'No thanks')
  bashStdout = 'Failed!  - Failed:     2, Passed:    10, Skipped:     0, Total:    12'
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })
  await $.tool.call({ tool: 'Bash', command: 'dotnet test Phoenix.sln' })
  await clock.advance(1_000)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /Tests: dotnet run: 2 failed, 10 passed/ })).toBeDefined()
  await ui.unmount()
})

test('/dragon standup gathers Jira, PRs and commits', async ($, on) => {
  stubSession(on, [], 'No thanks')
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: 'C:\\repo' })

  const out = await $.command.run({ command: 'dragon', args: 'standup' })
  expect(out.text).toContain('Standup since')
  expect(out.text).toContain('C3-1  [In Progress]  Do a thing')
  expect(out.text).toContain('Fix it')
  expect(out.text).not.toContain('Other repo')
  expect(out.text).toContain('abc1234 C3-1 Fix the thing')
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
  expect(printed).toContain('C3-1  [In Progress]  Do a thing')
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
  // ...except the quiet moods: unread mail and a full context window do not keep it awake
  expect(pickMood({ ...base, idleMs: 99 * 60_000, unread: 2 })).toBe('sleepy')
  expect(pickMood({ ...base, idleMs: 99 * 60_000, contextPct: 95 })).toBe('sleepy')
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
  expect(text).toContain('C3-1  Done  Do a thing')
  expect(text).toContain('merged   Fix it  (3 comments)')
  expect(text).not.toContain('Elsewhere')
  expect(formatStandup({ since: new Date(), issues: undefined, prs: undefined, commits: undefined })).toContain('Jira: could not read')
})

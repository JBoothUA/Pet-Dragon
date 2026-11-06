import { expect, mock, test } from 'claude-code/testing'

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
  on('ui.render', () => ({ type: 'Text', props: {}, children: [''] }))
  on('prompt.submit', ($, e) => ({ text: e.text, context: e.context }))
  on('process.run', ($, e) => {
    const argv = e.argv.join(' ')
    let stdout = ''
    if (argv.includes('open-url')) opened.push(argv)
    else if (argv.includes('coreapi-probe')) stdout = CORE_UP_LOCAL
    else if (argv.includes('ports-probe')) stdout = PORTS
    else if (argv.includes('messages-probe')) stdout = MAIL
    else if (argv.includes('jira')) stdout = JIRA
    else if (argv.includes('prs')) stdout = PRS
    return { value: { exitCode: 0, stdout, stderr: '' } }
  })
  on('tool.call', ($, e) => {
    if (e.tool === 'AskUserQuestion') {
      asked.push(e.questions[0].question)
      return { result: { answers: { [e.questions[0].question]: answer } } }
    }
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
  expect(await ui.find({ type: 'Text', text: /Your Bitbucket PRs: 1 open PR\(s\) you authored/ })).toBeDefined()
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

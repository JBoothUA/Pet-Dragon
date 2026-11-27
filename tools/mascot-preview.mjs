// Draws Dragon in every mood color, in real terminal colors, from the plugin's own frames.
//   node tools/mascot-preview.mjs            every mood (working moods show the downstroke)
//   node tools/mascot-preview.mjs --animate  the working animation for a few seconds
import { IDLE, FLAP, SLEEP, FLAP_MS, MOODS, COLORS, PAL, SPRITE_WIDTH, spriteRows, rotateHue, shade, partialRunColor, testLight, machineLight, cacheLight, ctxLight, headline, meetLight, pointsStats, pointsLights, slimIssue } from '../plugins/pet-dragon/hooks/lib.js'

const RESET = '\x1b[0m'
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(';')

// hovered: how the dragon looks under the pointer, every color of every pixel rotated by rotateHue (register.js does the same per run)
const draw = (frame, body, hovered = false) =>
  spriteRows(frame, body).map(
    (runs) =>
      runs
        .map((s) => {
          const fg = s.color && (hovered ? rotateHue(s.color) : s.color)
          const bg = s.backgroundColor && (hovered ? rotateHue(s.backgroundColor) : s.backgroundColor)
          return (fg ? '\x1b[38;2;' + rgb(fg) + 'm' : '') + (bg ? '\x1b[48;2;' + rgb(bg) + 'm' : '') + s.text + RESET
        })
        .join(''),
  )

const COL = 24
const head = (t) => console.log('\n\x1b[1m  ' + t + RESET)
const swatch = (hex, label, note = '') => '  \x1b[38;2;' + rgb(hex) + 'm████' + RESET + ' ' + label.padEnd(24) +'\x1b[2m' + hex + '  ' + note + RESET

// Sprite blocks side by side, each with a caption line above
function row(blocks) {
  console.log('')
  console.log('  ' + blocks.map((b) => b.caption + ' '.repeat(Math.max(0, COL - b.plain.length))).join(''))
  for (let r = 0; r < blocks[0].lines.length; r++) console.log('  ' + blocks.map((b) => b.lines[r] + ' '.repeat(COL - SPRITE_WIDTH)).join(''))
}

function printAll() {
  head('Moods: the body takes the mood color, and each mood is shown again as it looks under the pointer')
  const entries = Object.entries(MOODS)
  for (let start = 0; start < entries.length; start += 2) {
    const blocks = []
    for (const [key, m] of entries.slice(start, start + 2)) {
      const frame = key === 'working' || key === 'tool' ? FLAP[2] : key === 'sleepy' ? SLEEP : IDLE
      const bold = '\x1b[1m\x1b[38;2;' + rgb(m.color) + 'm'
      blocks.push({ caption: bold + m.label + RESET, plain: m.label, lines: draw(frame, m.color) })
      const hov = rotateHue(m.color)
      blocks.push({ caption: '\x1b[1m\x1b[38;2;' + rgb(hov) + 'm' + 'hover ' + RESET + '\x1b[2m' + m.color + '→' + hov + RESET, plain: 'hover ' + m.color + '→' + hov, lines: draw(frame, m.color, true) })
    }
    row(blocks)
  }
  head('Wing flap: the four frames of the working animation')
  row(FLAP.map((f, i) => ({ caption: '\x1b[2mframe ' + (i + 1) + RESET, plain: 'frame ' + (i + 1), lines: draw(f, MOODS.working.color) })))
  head('Every color on the dragon')
  const body = MOODS.working.color
  console.log(swatch(body, 'body', 'R: the mood color'))
  console.log(swatch(shade(body), 'wings', 'S: a darker shade of the body (70%)'))
  const parts = { C: 'belly', W: 'eye white', k: 'pupil', d: 'feet', m: 'mouth', h: 'horns, crest', s: 'spark', p: 'pink', n: 'nostril', o: 'outline' }
  for (const [ch, name] of Object.entries(parts)) if (PAL[ch]) console.log(swatch(PAL[ch], name, ch + ': fixed, the same in every mood'))
  head('Mood colors in priority order (the first state that applies wins)')
  for (const [, m] of entries) console.log(swatch(m.color, m.label, m.short))
  printLights()
}

// A light as the status row draws it: a dot, its name and value in the light's color, then what the hover says
const chip = (name, light) => '  \x1b[38;2;' + rgb(light.color) + 'm● ' + (name + ' ' + light.value).padEnd(22) + RESET + '\x1b[2m' + light.short.slice(0, 80) + RESET

// The lights, from the plugin's own light functions with sample readings, so this cannot drift from what Dragon shows.
// The two marked "(sample)" are built in register.js, which cannot be imported here, so they are copies: update them with it.
function printLights() {
  const now = Date.parse('2026-11-26T12:00:00Z')
  const hours = (h) => now - h * 3_600_000
  const be = { runner: 'dotnet', passed: 1880, failed: 0 }
  const fe = { runner: 'jest', passed: 4, failed: 0 }
  const head = (t) => console.log('\n\x1b[1m  ' + t + RESET)
  head('Light colors')
  const legend = [
    ['green', 'all clear, or CoreAPI on local SQL'],
    ['teal', 'CoreAPI on Docker SQL, or you have open PRs'],
    ['unread', 'blue: something is waiting for you'],
    ['working', 'a run or turn is in progress'],
    ['amber', 'up, but something is unclear'],
    ['red', 'down, or failing'],
    ['grey', 'off, not set up, or not checked yet'],
  ]
  for (const [key, text] of legend) console.log('  \x1b[38;2;' + rgb(COLORS[key]) + 'm██ ' + key.padEnd(8) + RESET + '\x1b[2m' + COLORS[key] + '  ' + text + RESET)
  head('A light that just changed flashes for about three seconds: the dot fills and the value inverts, every other step')
  const flashPair = (name, light) => '  \x1b[38;2;' + rgb(light.color) + 'm● ' + name + ' ' + light.value + RESET + '   \x1b[38;2;' + rgb(light.color) + 'm◉ ' + name + RESET + ' \x1b[38;2;17;17;17m\x1b[48;2;' + rgb(light.color) + 'm ' + light.value + ' ' + RESET
  console.log(flashPair('PC', machineLight({ ramTotalMb: 65536, ramFreeMb: 30000, cpuPct: 20, diskTotalGb: 476, diskFreeGb: 20, drive: 'C:' })))
  console.log(flashPair('PRs', { color: COLORS.amber, value: '4!2' }))
  console.log(flashPair('CI', { color: COLORS.red, value: 'failed' }))
  console.log(flashPair('Core', { color: COLORS.teal, value: 'docker db' }))
  head('Test lights')
  console.log(chip('BE Tests', testLight(be, 'dotnet test, all 12 test projects', hours(2), now)))
  console.log(chip('BE Tests', testLight(be, 'dotnet test, all 12 test projects', hours(30), now)))
  console.log(chip('BE Tests', { color: partialRunColor({ passed: 1880, failed: 0 }), value: '1880 pass', short: '(sample) 2 of 12 parts gave no result: Core.Tests (build), Bff.Tests (locked). Click this light to run again' }))
  console.log(chip('FE Tests', testLight(fe, 'npx jest ColumnsVisibilityContext', hours(170), now, 'fe')))
  console.log(chip('FE Tests', testLight({ ...fe, passed: 5120, failed: 3 }, 'npm run test, full suite in 24 parts', hours(1), now, 'fe')))
  console.log(chip('FE Tests', { color: COLORS.working, value: '3/24', short: '(sample) Part 3 of 24 running' }))
  console.log(chip('FE Tests', testLight(undefined, undefined, undefined, undefined, 'fe')))
  head('This computer, prompt cache, context')
  const pc = (disk) => machineLight({ ramTotalMb: 65536, ramFreeMb: 30000, cpuPct: 20, diskTotalGb: 476, diskFreeGb: disk, drive: 'C:' })
  console.log(chip('PC', pc(200)))
  console.log(chip('PC', pc(40)))
  console.log(chip('PC', pc(20)))
  console.log(chip('PC', pc(8)))
  console.log(chip('Cache', cacheLight(now - 10 * 60_000, now, false)))
  console.log(chip('Cache', cacheLight(now - 59 * 60_000, now, false)))
  console.log(chip('Cache', cacheLight(now - 90 * 60_000, now, false)))
  for (const pct of [40, 70, 90]) console.log(chip('Ctx', ctxLight(pct)))
  head('Story points (Pts) and the pod low-high (Pod), sample sprint')
  const sp = (id, state, start, end) => ({ id, name: 'C3 Sprint ' + id, state, startDate: start, endDate: end })
  const s36 = sp(36, 'closed', '2026-11-04T00:00:00Z', '2026-11-18T00:00:00Z')
  const s37 = sp(37, 'active', '2026-11-18T00:00:00Z', '2026-12-02T00:00:00Z')
  const tk = (key, status, pts, dev, sprints) => slimIssue({ key, status: { name: status }, customfield_10004: pts, customfield_11232: { accountId: dev, displayName: dev }, customfield_10006: sprints })
  const sprintNow = Date.parse('2026-11-25T00:00:00Z')
  const show = (me) => {
    const l = pointsLights(pointsStats([tk('C3-1', 'Dev Done', me, 'me', [s37]), tk('C3-2', 'COMPLETED', 10, 'me', [s36]), tk('C3-3', 'Dev Done', 13, 'Sam', [s37]), tk('C3-4', 'Code Review', 2, 'Zed', [s37])], 'me'), 'C3Pod2', sprintNow)
    console.log(chip('Pts', l.points))
    console.log(chip('Pod', l.pod))
  }
  show(20)
  show(8)
  show(1)
  console.log(chip('Pts', pointsLights(undefined, 'C3Pod2', sprintNow).points))
  head('Mtgs: meetings left today, the next one on its way, and none at all')
  const at = Date.parse('2026-11-26T12:00:00')
  const mtg = (start, end) => ({ start, end, subject: 'Standup', location: 'Teams', allDay: false })
  console.log(chip('Mtgs', meetLight({ outlook: 'on', meetings: [mtg('2026-11-26T15:00', '2026-11-26T15:30'), mtg('2026-11-27T08:00', '2026-11-27T08:30')] }, at)))
  console.log(chip('Mtgs', meetLight({ outlook: 'on', meetings: [mtg('2026-11-26T12:10', '2026-11-26T12:40')] }, at)))
  console.log(chip('Mtgs', meetLight({ outlook: 'on', meetings: [mtg('2026-11-27T08:00', '2026-11-27T08:30')] }, at)))
  console.log(chip('Mtgs', meetLight({ outlook: 'on', meetings: [] }, at)))
  head('Headline under the dragon (your own PRs are not counted: peers review those)')
  const items = [
    { label: 'PC', light: pc(20) },
    { label: 'Review', light: { color: COLORS.amber, value: '2' } },
    { label: 'FE Tests', light: testLight(fe, 'jest', hours(170), now, 'fe') },
    { label: 'Drift', light: { color: COLORS.amber, value: '↓46' } },
    { label: 'BE Tests', light: testLight(be, 'dotnet test', hours(2), now) },
  ]
  for (const list of [items, items.slice(4), items.filter((i) => i.label === 'PC')]) {
    const h = headline(list)
    console.log('  \x1b[38;2;' + rgb(h.color) + 'm' + h.text + RESET)
  }
  console.log('')
}

async function animate() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const h = IDLE.length / 2
  process.stdout.write('\n'.repeat(h))
  for (let t = 0; t < 40; t++) {
    process.stdout.write(`\x1b[${h}A`)
    for (const line of draw(FLAP[t % FLAP.length], MOODS.working.color)) process.stdout.write('\x1b[2K  ' + line + '\n')
    await sleep(FLAP_MS)
  }
}

if (process.argv.includes('--animate')) await animate()
else printAll()

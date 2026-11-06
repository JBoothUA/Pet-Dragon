// Draws Dragon in every mood color, in real terminal colors, from the plugin's own frames.
//   node tools/mascot-preview.mjs            every mood (working moods show the downstroke)
//   node tools/mascot-preview.mjs --animate  the working animation for a few seconds
import { IDLE, FLAP, FLAP_MS, MOODS, SPRITE_WIDTH, spriteRows } from '../plugins/pet-dragon/hooks/lib.js'

const RESET = '\x1b[0m'
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(';')

const draw = (frame, body) =>
  spriteRows(frame, body).map(
    (runs) =>
      runs
        .map((s) => (s.color ? '\x1b[38;2;' + rgb(s.color) + 'm' : '') + (s.backgroundColor ? '\x1b[48;2;' + rgb(s.backgroundColor) + 'm' : '') + s.text + RESET)
        .join(''),
  )

const COL = 24

function printAll() {
  const entries = Object.entries(MOODS)
  for (let start = 0; start < entries.length; start += 4) {
    const group = entries.slice(start, start + 4)
    console.log('')
    console.log('  ' + group.map(([, m]) => '\x1b[1m\x1b[38;2;' + rgb(m.color) + 'm' + m.label.padEnd(COL) + RESET).join(''))
    const blocks = group.map(([key, m]) => draw(key === 'working' || key === 'tool' ? FLAP[2] : IDLE, m.color))
    for (let r = 0; r < blocks[0].length; r++) {
      console.log('  ' + blocks.map((b) => b[r] + ' '.repeat(COL - SPRITE_WIDTH)).join(''))
    }
  }
  console.log('\n\x1b[2m  Body = mood color. Belly, eye, mouth and feet stay the same.\x1b[0m\n')
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

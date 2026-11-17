// Everything worth checking before a push, in one command: npm run check (add --fast to skip the plugin tests).
// Built on Node alone, so a fresh clone needs no npm install. Wired to git's pre-push by npm run setup.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginDir = path.join(root, 'plugins', 'pet-dragon')
const fast = process.argv.includes('--fast')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')

const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.endsWith('.png'))
const problems = []
const fail = (file, text) => problems.push(file + ': ' + text)

// 1. Syntax of every script
for (const f of files.filter((x) => /\.(m?js)$/.test(x))) {
  const r = spawnSync(process.execPath, ['--check', path.join(root, f)], { encoding: 'utf8' })
  if (r.status !== 0) fail(f, 'does not parse\n' + String(r.stderr).split('\n').slice(0, 4).join('\n'))
}

// 2. Imports nothing uses (a dead import is usually a half-finished refactor)
const importedNames = (text) => {
  const names = []
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']+'/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()
      if (name) names.push(name)
    }
  }
  return names
}
const usedOutsideImports = (text, name) => {
  const body = text.replace(/import\s*\{[^}]*\}\s*from\s*'[^']+'/g, '')
  return new RegExp('\\b' + name + '\\b').test(body)
}
for (const f of ['plugins/pet-dragon/hooks/register.js', 'plugins/pet-dragon/tests/pet-dragon.test.ts']) {
  const text = read(f)
  for (const name of importedNames(text)) if (!usedOutsideImports(text, name)) fail(f, 'imports ' + name + ' but never uses it')
}

// 3. Exports from lib.js that nothing uses: not in register.js, not in the tests, not inside lib.js itself
const lib = read('plugins/pet-dragon/hooks/lib.js')
const others = read('plugins/pet-dragon/hooks/register.js') + read('plugins/pet-dragon/tests/pet-dragon.test.ts')
for (const m of lib.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+([A-Za-z0-9_]+)/gm)) {
  const name = m[1]
  const inLib = (lib.match(new RegExp('\\b' + name + '\\b', 'g')) ?? []).length
  if (inLib < 2 && !new RegExp('\\b' + name + '\\b').test(others)) fail('plugins/pet-dragon/hooks/lib.js', 'exports ' + name + ' but nothing uses it')
}

// 4. Credentials. Names, URLs and ids are fine in this repo; keys, passwords and tokens are not.
const SECRETS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\b(?:password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{3,}['"]/i, 'password literal'],
  [/\bBearer\s+[A-Za-z0-9._-]{20,}/, 'bearer token'],
  [/\b(?:ghp|gho|ghs|xox[abp])[_-][A-Za-z0-9-]{20,}/, 'GitHub or Slack token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\b(?:api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9+/_-]{16,}['"]/i, 'key or secret literal'],
]
for (const f of files.filter((x) => x !== 'tools/check.mjs')) {
  const text = read(f)
  for (const [re, what] of SECRETS) if (re.test(text)) fail(f, 'looks like a ' + what)
}

// 5. Line endings: .gitattributes keeps text files LF, so a CR means that rule was bypassed (the Edit tool needs LF)
for (const f of files) if (read(f).includes('\r')) fail(f, 'has CRLF line endings (expected LF)')

// 6. The plugin's own tests
if (!fast) {
  const r = spawnSync('claude', ['plugin', 'test'], { cwd: pluginDir, encoding: 'utf8', shell: true })
  const out = String(r.stdout) + String(r.stderr)
  const summary = out.split('\n').filter((l) => /^\s*\d+ (pass|fail)|^\(fail\)|^Ran /.test(l)).join('\n')
  if (r.status !== 0 || /\b[1-9]\d* fail\b/.test(out)) fail('plugin tests', 'failed\n' + (summary || out.slice(-600)))
  else console.log(summary)
}

if (problems.length) {
  console.error('\ncheck failed:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('check passed' + (fast ? ' (tests skipped)' : ''))

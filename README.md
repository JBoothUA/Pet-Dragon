# Pet Dragon

<img width="1198" height="133" alt="image" src="https://github.com/user-attachments/assets/018ac248-9ee8-4753-a065-20e43baa0c45" />

<img width="989" height="179" alt="image" src="https://github.com/user-attachments/assets/9975347b-469f-4252-bf41-d2d97304fe89" />

Dragon is a little winged dragon who lives above your Claude Code prompt. Its color shows what the session is doing. Next to it, status lights show Jira, Bitbucket, Outlook, Teams, your local CoreAPI, and your repo (git, pipelines, tests, Seq errors). Before you send a prompt, it can offer C3 skills that fit the task, and `/dragon standup` writes your standup.

Dragon is a 16x12 pixel front-facing dragon sprite, drawn with half-block characters, so it needs a terminal with 24-bit color (Windows Terminal, VS Code, iTerm2). Its body takes the mood color below; the wings are a darker shade, and the horns and crest, cream belly, eyes, nostrils, and brown feet stay the same. Run `npm run preview` in this repo to see every mood in real terminal colors, followed by the light colors, sample test, PC, cache and context lights, and the headline (built from the plugin's own light functions, so it matches what Dragon shows), or `npm run preview:animate` for the working animation.

![Every mood](docs/screenshots/moods.png)

Tested with Claude Code 2.1.312. Mods are new and their API can change between releases.

## What the colors mean

**Dragon.** If several states apply, the first one in this table wins:

| Color | Meaning |
|---|---|
| Pink | Needs you: Claude is waiting for a permission or an answer |
| Red | The last turn ended with an error |
| Cyan | Claude is running a tool (wings flap) |
| Yellow | Claude is thinking (wings flap) |
| Orange | Listening: you are typing or dictating a prompt |
| Blue | You have unread Outlook mail |
| Purple | The context window is past `context_warn_percent`. Consider `/compact` |
| Coral | Something needs you: a light is amber or red (the headline under the dragon says which). Green Ready means nothing does |
| Slate | Asleep and nothing else to say: nothing has happened for `sleepy_after_minutes`, or you ran `/dragon sleep` (eyes closed; typing or any turn wakes it). Dozing only replaces the green Ready color: with unread mail the dragon sleeps but stays blue, and a context warning stays purple |
| Green | Ready and idle. Lights that need you show in the one-line headline under the caption, not in the dragon's color |

**The lights:**

| Light | Shows | Source |
|---|---|---|
| UI | Whether the phoenix-ui dev server is listening on `ui_port` (5173). Click to open it | Port probe |
| Core | Whether CoreAPI is up, and whether it points at **local db**, **docker db**, or a remote db | `scripts/coreapi-probe.ps1` checks the listener on the port, the process's environment, user secrets, and appsettings, then the MSSQLSERVER service and the Docker SQL container |
| BFF | Whether the BFF is running (green **up**) or not (grey **off**) | `scripts/ports-probe.ps1`: is anything listening on `bff_port` |
| MD | Whether the MoveDocs API is running (green **up**) or not (grey **off**) | `scripts/ports-probe.ps1`: is anything listening on `movedocs_port` |
| Jira | Your open issues, not counting **Dev Done** or **Ready for Release** (change it with `jira_jql`) | `twg jira workitem query` |
| Tree | The git worktree this session is in (green for the main checkout, teal for a linked one). Hover lists every worktree with its branch; click opens the `/dragon` pane with their folders | `git worktree list --porcelain` |
| PRs | Your PRs that are still open (drafts included; merged and declined PRs are not counted), with age and comment count in `/dragon` | `twg prs query --role author --state open` |
| Mail | Unread Inbox count | Classic Outlook, through COM. It never launches Outlook |
| Teams | Whether Teams is running (green) or not (grey). It does not count unread chats: Teams has no local API for that | `Get-Process ms-teams` |
| Git | Your branch in the session's repo: uncommitted files (`2~`), commits to push (`↑1`), commits behind upstream (`↓3`, amber), or **clean**. Click it while there are uncommitted changes to see the files and choose **Reset** (`git reset --hard`, then `git pull --ff-only`; untracked files are kept, and a `git stash apply` id is shown so the discarded changes can be restored) or **Keep** (does nothing) | `git status --porcelain=v2 --branch`. Its changed files also feed skill suggestions |
| CI | The newest Bitbucket Pipelines run for your current branch: **passed**, **failed**, **running**, **stopped** or **none**. Click to open the pipelines page | `twg bb pipeline query` for `bitbucket_repo` |
| BE Tests | The last backend (C#) test run Claude started: `dotnet test`. It reads the runner's own summary line, so it cannot see runs you start in another terminal. The last run is remembered between sessions, and the count is that run only, so a scoped run (one file, `-t`, `--changedSince`) replaces a whole-suite total with its own smaller one; hover the light to see which command it recorded. The light is **green** for a passing run, **red** for any failure, and **amber** when the run is over a day old or when it is partial: some test projects gave no pass/fail summary (timeout, locked DLL, build failure, crash), so the count is only what finished. Hover names those projects and click re-runs them. A scoped run left over from an earlier session is ignored at startup, since it is no suite total. With none recorded, Dragon runs every C# test project in the repo (`*Tests*.csproj`, one after another, each build limited to two MSBuild nodes with `-m:2` to keep the CPU down, and a project with no summary retried once) and shows the combined total (or runs `auto_test_command`). While it runs the light counts up (`1208 pass…`) and the hover names the project running | The Bash tool's output |
| FE Tests | The same for the front end: the last Jest run (`npm test`, `jest`), counted and colored the same way, so a scoped run in the current session shows only its own tests (for example 4 pass, amber once it is a day old). Only a full-suite run (Dragon's own, or a plain `npm test`) is remembered as the total after a restart; a leftover scoped run counts as none recorded. With none recorded, Dragon runs the full Jest suite in `phoenix-ui` (or `auto_fe_test_command`), after the backend run finishes. The suite is 1,200+ files and takes about 100 minutes, and one run can last ten minutes at most, so Dragon runs it as 24 `--shard` parts (the light counts `3/24`) and adds the results up. Each run saves what failed (the part, its cause, and the failure lines of its output) in the plugin store under `test-failures:<be|fe>:<repo>`, so a failing shard can be read and re-run on its own (`--shard=N/24`) without repeating the whole suite. A part with no summary is retried once if the cause is a locked file or a runner with no verdict; if it is still **unclear**, click the light to run it again | The Bash tool's output |
| Logs (Seq) | Error and Fatal events in the last `seq_window_minutes`, capped at **50+**. Seq is the local log viewer the APIs write to (port 5341); grey **off** just means it is not running. Click to open Seq | Seq's HTTP API at `seq_url` |
| Prod | The release pipeline from git: **production** version (newest `origin/release/prod/*`), the **next** release branch (`release/next/*`) with its ticket count, and how many more tickets `development` holds beyond that cut. The light shows the production version; hover for the rest. Fetches origin every `radar_poll_minutes` | git (refs only, no checkout) |
| Drift | How far your branch is behind `origin/development`, and **red** when files you changed were also changed there (a merge conflict in waiting). On `development` itself it reads `on dev`, since Git already shows that. Click it while behind to merge `origin/development` into your branch (a conflicting merge is undone). Clicking Git while behind offers `git pull --ff-only` | git |
| Ship | Of the tickets in the next release branch (prod..next), how many are **not Done in Jira** yet. Amber lists them with their status | Jira via `twg`, tickets read from git |
| Merged | PRs merged into `development` since local midnight, and by whom (hover for author, ticket and PR number) | git |
| Review | Open PRs waiting on **your** review; red when any is older than 3 days | `twg prs query --role reviewer` |
| Ctx | How full the context window is. Green under 60%, amber to 85%, red above. The hover says when to `/compact` or `/clear` | `$.session.usage()` |
| Today | What you have spent today across sessions against a fixed $15 daily limit, e.g. `$8.60/$15.00`. Green, amber from 70% of the limit, red at or over it. The hover also compares it with a typical day | `$.session.usage()` cost, kept in the plugin store |
| Mtgs | Meetings still to come today (the one in progress counts, finished ones do not). Hover for the list with times and rooms, and when tomorrow's first meeting starts. Around 3:30pm, once you are idle (or from 4:00pm regardless), Dragon reminds you once: "Your first meeting tomorrow is at 8:00am." | Classic Outlook calendar (needs Outlook running) |

Light colors:

- Green: all clear, or CoreAPI on local SQL.
- Teal: CoreAPI on the Docker SQL container, or you have open PRs.
- Blue: something is waiting for you.
- Yellow: a run or turn is in progress (a test run counting up, a busy prompt cache).
- Amber: up, but something is unclear: a partial or day-old test run, a disk over 90% full, stuck PRs, or a branch behind `development`.
- Red: down or failing (a failed test, a disk at 95% or under 10 GB free).
- Grey: off, not set up, or not checked yet.

**Links.** In the `/dragon` pane, any detail line that has a page behind it is a clickable, underlined link (marked ↗) that opens in your browser: each Jira issue, each PR, each pipeline run (`#2905 FAILED …` opens that run on Bitbucket), each Seq error, the Swagger pages, and your branch. Pressing the **CI** light itself opens the newest run, so a red CI light goes straight to the failing build; the **Seq** light opens Seq filtered to errors.

**Explanations.** Hover over Dragon or a light to see a short explanation on the third line. Hover needs mouse support in your terminal; it works best in fullscreen mode. `/dragon` always works. It opens a pane with every light's details, issue and PR lists, the color legend, and three buttons: **r** refreshes everything, **u** gathers your standup into the pane, and **s** turns skill suggestions on or off.

**Headline and flashes.** A one-line headline under the caption says `All clear`, or `2 need you: Tests unclear · Core off` (amber and red lights, worst first; Ship and Today are never counted, since neither is something you can act on right now). When a light's value or color changes it flashes for about three seconds (filled dot, highlighted value) so you notice without watching.

## Skill suggestions

When you type a normal prompt, Dragon compares it with the names and descriptions of your installed skills. If one fits, it asks first:

> Dragon thinks these skills may help: /c3-pr-workflow — Use when preparing a pull request… Use one?
> `Use /c3-pr-workflow` · `No thanks` · `Stop suggesting`

- **Use**: Claude is told to load that skill before starting.
- **No thanks**: your prompt goes through unchanged, and Dragon won't offer that skill again this session.
- **Stop suggesting**: turns suggestions off. Press **s** in `/dragon` to turn them back on.

Dragon gets better at this as you use it:

- **It learns.** Each skill you accept earns up to +3 points on later prompts, and every third decline takes one back. This lives in the plugin store, so it carries across sessions. Learning only nudges a skill that already matched your words; it never creates a suggestion on its own.
- **It reads files.** Files Claude has edited this session and the files in your git diff point at skills (`core-api/` → `c3-backend`, `phoenix-ui/` → `c3-frontend`, `bff/` → `c3-bff`, `MainDBMigrations` → `c3-database`, `open-api/` → `c3-codegen`, test files → the testing skills). Each such file adds 1 point, up to 2, and only when your prompt's words already matched, so it cannot suggest a skill out of the blue. The rules are `PATH_RULES` in `hooks/lib.js`.
- **Paths you type count more.** Writing a path such as `phoenix-ui/src/...` in your prompt adds 3 points, enough to suggest the skill on its own.

Slash commands, short prompts, and prompts typed while Claude is working are never interrupted. Set `skill_suggestions` to `off` to disable suggestions entirely.

## Speak toggle

Click the dragon once (any row of the sprite) to turn `/speak` voice replies on or off. Dragon runs `~/.claude/hooks/speak-toggle.ps1 toggle`, the script behind the `/speak` command, so it needs no model turn and always agrees with `/speak status`. A toast shows the answer (`Voice replies: ON` or `OFF`). Windows only.

Hovering the dragon turns it a new color. The sprite rows are buttons, so the row under the pointer also flashes white (buttons invert on hover in this API). Voice *input* (hold space) is separate: `/voice hold`.

## PC light

The **PC** light reads this computer every 15 seconds: RAM, CPU and the system drive. It is amber from 80% RAM, 85% CPU or 90% full disk, and **red and blinking** at 90% RAM, 95% CPU, 95% full disk or under 10 GB free, with a toast when it first turns red. Hover for the three biggest memory users. Limits are `MACHINE_LIMITS` in `hooks/lib.js`. Windows only.

## Standup

`/dragon standup` prints what changed since the previous working day (yesterday, or Friday on a Monday): your Jira issues updated, your Bitbucket PRs updated (open, merged or declined, in `pr_repo_id`'s repo), and your own commits across all local branches. The three sources run in parallel, and one that fails (say `twg` is logged out) says so without hiding the others. The **[ Standup ]** button at the end of the band's top line prints the same text into the chat (a dim line, not sent to Claude). The pane's **u** button shows it inside `/dragon` instead.

`/dragon sleep` puts Dragon to sleep at once instead of waiting for `sleepy_after_minutes`; typing anything wakes it.

## Install

This repo is a Claude Code marketplace named `pet-dragon`. In Claude Code:

```
/plugin marketplace add https://bitbucket.org/keyhealthtech/pet-dragon.git
/plugin install pet-dragon@pet-dragon
```

Or from a terminal, at user scope so it starts in every session:

```
claude plugin marketplace add https://bitbucket.org/keyhealthtech/pet-dragon.git
claude plugin install pet-dragon@pet-dragon --scope user
```

If you've cloned the repo, add your clone's path instead of the URL. A local marketplace is read straight from disk, so your edits show up in the next session without reinstalling. Then restart Claude Code. Claude Code asks you to enable mods the first time; say yes.

**Requirements:**

- Windows PowerShell, for the CoreAPI, Outlook, and Teams probes. On other platforms those lights stay grey.
- `twg` on your PATH and logged in, for Jira, PRs, pipelines and the standup.
- `git` on your PATH, for the Git light and the standup's commits.
- Seq reachable at `seq_url` (default `http://localhost:5341`) for the Seq light. It stays grey **off** if Seq isn't running.
- Classic Outlook for the Mail light. The new Outlook has no local API.

## Settings

Change these from `/plugin`, under pet-dragon's options:

| Option | Default | |
|---|---|---|
| `coreapi_port` | 5236 | Port CoreAPI listens on |
| `bff_port` | 7102 | Port the BFF listens on |
| `movedocs_port` | 7201 | Port the MoveDocs API listens on |
| `coreapi_poll_seconds` | 30 | CoreAPI, BFF, and MoveDocs are checked together |
| `messages_poll_seconds` | 60 | Outlook and Teams |
| `jira_poll_minutes` | 5 | |
| `bitbucket_poll_minutes` | 10 | The Bitbucket query takes about 15 seconds, so keep this one slow |
| `jira_jql` | your open issues, excluding Dev Done and Ready for Release | Which issues the Jira light counts |
| `context_warn_percent` | 80 | |
| `sleepy_after_minutes` | 20 | Dragon falls asleep after this long with no typing, turns or tool calls. 0 = never |
| `git_poll_seconds` | 30 | |
| `pipeline_poll_minutes` | 3 | |
| `bitbucket_repo` | `keyhealthtech/phoenix` | `workspace/repo` whose pipelines the CI light reads |
| `seq_url` | `http://localhost:5341` | |
| `seq_api_key` | empty | Only if your Seq needs a key to read events |
| `seq_poll_seconds` | 60 | |
| `seq_window_minutes` | 15 | How far back the Seq light counts errors |
| `skill_suggestions` | `ask` | `ask` or `off` |
| `skill_min_score` | 2 | Lower suggests more often. A skill-name word scores 3, a description word 1 |

Results are cached in the plugin store, so several open sessions share one Jira, Bitbucket or Seq check rather than each running its own. Git, CI and Tests describe one session's repo and branch, so they are never shared.

## Develop

Repo layout:

- `.claude-plugin/marketplace.json`: the marketplace, with one plugin.
- `plugins/pet-dragon/`: the plugin.
- `tools/mascot-preview.mjs`: draws Dragon, the light colors, sample lights and the headline outside Claude Code (`npm run preview`).
- `docs/screenshots/`: images used here and in PRs.

```
claude --plugin-dir plugins\pet-dragon   # run your working copy
claude plugin validate plugins\pet-dragon
cd plugins\pet-dragon; claude plugin test   # headless tests, no sign-in
```

Code layout:

- `hooks/lib.js`: plain helpers. Colors, moods, the ASCII frames, turning probe results into lights, and skill matching.
- `hooks/register.js`: the mod itself. Hooks, pollers, the band, and the `/dragon` pane.
- `scripts/*.ps1`: the Windows probes. Each prints one JSON object, and you can run them by hand to debug.

An installed copy is cached by version, so bump `version` in `.claude-plugin/plugin.json` when you ship a change.

## Token coach

The Use row watches your token spend. Dragon pops a toast once per situation, and re-arms it when the situation clears:

- context 60% full: a good moment to `/compact` at the next task boundary; 85%: `/compact` now
- you switched git branch since the session began, and the context holds real work: `/clear` for the new ticket
- the session is over 3 hours old and half full: `/clear` or `/compact`
- today is 1.5x your typical day (and over $5), or a usage window is 80% used

Set `token_coach` to `auto` and Dragon also runs `/compact` for you between turns once the context passes `auto_compact_percent` (default 90). There is no `/clear` call in the mod API, so that one is always advice. Spend counts only what Dragon saw while it was running.

## Switching CoreAPI between your local and Docker database

On the **Core** light, the name still opens Swagger. The database text beside it (`local db` or `docker db`) is its own button: click it and Dragon asks whether to switch to the other one. On yes it runs `use-docker-db.ps1` or `use-local-db.ps1` (from your Desktop, or `db_scripts_dir`), which stop CoreAPI and restart it on :5236 pointed at that database, then refreshes the light. It refuses, with a toast, when the target is not available: no Docker SQL container publishing :1433, or the local `MSSQLSERVER` service stopped.

## Development

- `npm run setup` once per clone: git then runs `npm run check` before every push (skip one push with `git push --no-verify`).
- `npm run check` (or `check:fast` to skip the plugin tests) catches syntax errors, imports and `lib.js` exports nothing uses, credential-looking strings, CRLF line endings, and failing plugin tests. It needs only Node.
- `.gitattributes` keeps every text file LF, on Windows too, so editors and scripts see the same bytes git stores.

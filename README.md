# Pet Dragon

Dragon is a little winged dragon who lives above your Claude Code prompt. Its color shows what the session is doing. Next to it, status lights show Jira, Bitbucket, Outlook, Teams, and your local CoreAPI. Before you send a prompt, it can offer C3 skills that fit the task.

```
   ▄▀▄▀▄  ▄▀▄▄▀▄       ● Thinking — Claude is working on your request  ctx 12%
  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▄▄     APIs  ● Core local db  ● BFF up  ● MD off
   ▄▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀    Work  ● Jira 4  ● PRs 8  ● Mail 1  ● Teams running
  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀     hover Dragon or a light for details · /dragon for more
   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀
```

Dragon is a 18x10 pixel sprite with a black outline, drawn with half-block characters, so it needs a terminal with 24-bit color (Windows Terminal, VS Code, iTerm2). Its body takes the mood color below; the wings are a darker shade, and the horns, cream belly, eye, and brown feet stay the same. Run `npm run preview` in this repo to see every mood in real terminal colors, or `npm run preview:animate` for the working animation.

![Every mood](docs/screenshots/moods.png)

Tested with Claude Code 2.1.312. Mods are new and their API can change between releases.

## What the colors mean

**Dragon.** If several states apply, the first one in this table wins:

| Color | Meaning |
|---|---|
| Pink | Needs you: Claude is waiting for a permission or an answer |
| Grey | The last turn ended with an error |
| Cyan | Claude is running a tool (wings flap) |
| Yellow | Claude is thinking (wings flap) |
| Blue | You have unread Outlook mail |
| Purple | The context window is past `context_warn_percent`. Consider `/compact` |
| Red | Ready and idle |

**The lights:**

| Light | Shows | Source |
|---|---|---|
| Core | Whether CoreAPI is up, and whether it points at **local db**, **docker db**, or a remote db | `scripts/coreapi-probe.ps1` checks the listener on the port, the process's environment, user secrets, and appsettings, then the MSSQLSERVER service and the Docker SQL container |
| BFF | Whether the BFF is running (green **up**) or not (grey **off**) | `scripts/ports-probe.ps1`: is anything listening on `bff_port` |
| MD | Whether the MoveDocs API is running (green **up**) or not (grey **off**) | `scripts/ports-probe.ps1`: is anything listening on `movedocs_port` |
| Jira | Your open issues | `twg jira workitem query` |
| PRs | Your PRs that are still open (drafts included; merged and declined PRs are not counted), with age and comment count in `/dragon` | `twg prs query --role author --state open` |
| Mail | Unread Inbox count | Classic Outlook, through COM. It never launches Outlook |
| Teams | Whether Teams is running (green) or not (grey). It does not count unread chats: Teams has no local API for that | `Get-Process ms-teams` |

Light colors:

- Green: all clear, or CoreAPI on local SQL.
- Teal: CoreAPI on the Docker SQL container, or you have open PRs.
- Blue: something is waiting for you.
- Amber: up, but something is unclear.
- Red: down.
- Grey: off, not set up, or not checked yet.

**Explanations.** Hover over Dragon or a light to see a short explanation on the third line. Hover needs mouse support in your terminal; it works best in fullscreen mode. `/dragon` always works. It opens a pane with every light's details, issue and PR lists, the color legend, and two buttons: **r** refreshes everything and **s** turns skill suggestions on or off.

## Skill suggestions

When you type a normal prompt, Dragon compares it with the names and descriptions of your installed skills. If one fits, it asks first:

> Dragon thinks these skills may help: /c3-pr-workflow — Use when preparing a pull request… Use one?
> `Use /c3-pr-workflow` · `No thanks` · `Stop suggesting`

- **Use**: Claude is told to load that skill before starting.
- **No thanks**: your prompt goes through unchanged, and Dragon won't offer that skill again this session.
- **Stop suggesting**: turns suggestions off. Press **s** in `/dragon` to turn them back on.

Slash commands, short prompts, and prompts typed while Claude is working are never interrupted. Set `skill_suggestions` to `off` to disable suggestions entirely.

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
- `twg` on your PATH and logged in, for Jira and PRs.
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
| `jira_jql` | your open issues | Which issues the Jira light counts |
| `context_warn_percent` | 80 | |
| `skill_suggestions` | `ask` | `ask` or `off` |
| `skill_min_score` | 2 | Lower suggests more often. A skill-name word scores 3, a description word 1 |

Results are cached in the plugin store, so several open sessions share one Jira or Bitbucket check rather than each running its own.

## Develop

Repo layout:

- `.claude-plugin/marketplace.json`: the marketplace, with one plugin.
- `plugins/pet-dragon/`: the plugin.
- `tools/mascot-preview.mjs`: draws Dragon outside Claude Code (`npm run preview`).
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

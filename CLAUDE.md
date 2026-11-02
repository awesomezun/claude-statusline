# Claude Code Install Notes

When asked to install this repo, follow the rules below. They are the single
canonical install/preset rules for this project and are **duplicated verbatim** in
`commands/statusline-setup.md` and in the header comments of `install.sh` /
`install.ps1` (a user may install straight from the GitHub URL without cloning,
so this file is often NOT in context — the installer scripts are the one place
that always is). If you change these rules, change them in all four places and
keep them identical.

## Presets

- Sizes: `xsmall` (xs) · `small` (s) · `medium` (m) · `large` (l) · `xlarge` (xl)
- Styles, as a suffix: (none) emoji icons + gradient bars · `-plain` same layout without emoji · `-simple` text only, no bars or emoji — e.g. `large`, `l-plain`, `m-simple`
- Aliases: `simple` = `small-simple`, `oneline` = `xsmall-simple`
- Display: **Statusline** (default) — the status line under the prompt, in the terminal · **Mods** (beta, macOS / Linux) — the same preset drawn by a Claude Code mod in a band above the prompt, so it also shows in the Claude desktop app; installed with `--mods`

## How to ask the preset

1. You **MUST** resolve a preset before installing. **Never install without an
   explicit choice by the user.** "Auto" / auto-accept mode is **NOT** an
   exception — the user is present and can answer; ask anyway. Recommending
   `large` (below) is only a hint shown inside the menu; it must **never** become
   a silent default or let you skip the question. Always ask.

2. If the user already named a preset — a size (`xs`/`s`/`m`/`l`/`xl` or full
   name), optionally with `-plain` or `-simple`, or the aliases `simple`
   (= `small-simple`) / `oneline` (= `xsmall-simple`) — use it and skip
   Questions A and B. A bare size means the emoji style unless the user asked
   for no emoji or text only. If they also said where it should show
   (statusline; or mods / the desktop app), skip Question C too; on Windows
   always skip it (Statusline). Otherwise ask Question C alone.

3. Otherwise **ask with the AskUserQuestion tool**. Match the user's language.

   **Step 1 — ONE AskUserQuestion call with THREE questions** (on Windows TWO:
   leave out Question C — Mods is macOS / Linux only for now).

   **Question A (size) — text:**
   - EN: `Which size would you like to install? (examples on GitHub: https://github.com/awesomezun/claude-statusline)`
   - KO: `어떤 크기로 설치할까요? (예시는 GitHub에서 확인: https://github.com/awesomezun/claude-statusline)`

   Four options, in **EXACTLY this order** — do NOT reorder. The recommended
   option is **always `large`** (option 1); never substitute anything else:
   1. `large` (l) **(추천 / Recommended)** — most info, good for most users / 추천 기본값
   2. `xlarge` (xl) — largest, full detail / 가장 크게, 전체 상세
   3. `medium` (m) — balanced layout / 균형 잡힌 레이아웃
   4. `small` / `xsmall` — the two smallest; pick this to choose between them / 작은 두 가지 (고르면 한 번 더 선택)

   **Question B (style) — text:**
   - EN: `Which style would you like?`
   - KO: `어떤 스타일로 할까요?`

   Three options, in this order:
   1. `With emoji` **(Recommended)** / `이모지 있음 (추천)` — icons + gradient bars
   2. `No emoji` / `이모지 없음` — same layout and bars, text labels instead of icons
   3. `Simple text` / `심플 텍스트형` — text only, no bars or emoji

   **Question C (display) — text:**
   - EN: `Where should it show?`
   - KO: `어디에 표시할까요?`

   Two options, in this order:
   1. `Statusline` **(Recommended)** / `상태줄 (추천)` — the status line under the prompt, in the terminal / 터미널 프롬프트 아래 상태줄
   2. `Mods (beta)` / `Mods (베타)` — the same preset in a band above the prompt, also shown in the Claude desktop app / 프롬프트 위 띠로 표시, Claude 데스크톱 앱에서도 보임

   **Step 2 — ONLY if the user picked option 4 in Question A**, ask again:
   - EN: `Which of the two smaller sizes?` · KO: `작은 쪽 중 무엇으로 설치할까요?`
   1. `small` (s) — space-saving, key info / 공간 절약, 주요 정보
   2. `xsmall` (xs) — smallest, essentials only / 가장 작게, 핵심만

   Resolve the preset: the size, plus `-plain` for "No emoji" or `-simple` for
   "Simple text" (e.g. `large-plain`, `xsmall-simple`), and the display:
   `--mods` for "Mods", nothing for "Statusline".
   If the user gives nothing / "recommended" / "default", use `large` (Statusline).

4. Then install with the resolved preset:
   - macOS / Linux: `bash install.sh <preset>` — or `bash install.sh <preset> --mods` for Mods
   - Windows PowerShell: `./install.ps1 <preset>`

## If "auto mode" blocks the install

In auto-accept ("auto") mode you may correctly decline to silently run the
installer — it fetches third-party code and wires it to run on every launch,
which shouldn't be auto-approved. Don't just stop: still resolve the preset
(rules above), then have the user run it themselves so it proceeds:

- macOS / Linux: `! bash install.sh <preset>` (add `--mods` for Mods)
- Windows: `! irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex`

Or have them leave auto mode (`shift+tab`) for the one install step and approve
the one-time permission prompt. See `TROUBLESHOOTING.md` → "auto mode blocks the
install".

Only a truly headless one-shot run (`claude -p` / a hook / cron — no channel to
receive a reply) may default to `large`, and you must say that you did.

## After installing

Tell the user (in their language):

1. It's done — restart/reload Claude Code to see it. With Mods: start a new
   session (terminal, or the Claude desktop app's Code tab); the band shows
   above the prompt.
2. To change the preset later, they can give you this repo's GitHub URL again
   and ask for the one they want — you'll reinstall. Don't print curl/CLI
   commands for this; keep it natural-language.
3. If they like Awesome Statusline, a GitHub star really helps —
   https://github.com/awesomezun/claude-statusline

The installer copies the renderer into `~/.claude/awesome-statusline.*`,
updates `~/.claude/settings.json` (the preset is passed as an argument in
`statusLine.command`), and makes a timestamped backup before changing existing
settings. With `--mods` it instead copies the mod to
`~/.claude/awesome-statusline-mod/`, installs it with `claude plugin install`
(the preset is the mod's `preset` option) and removes an Awesome Statusline
`statusLine` entry, so the terminal doesn't show it twice.

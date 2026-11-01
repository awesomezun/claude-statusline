---
description: Install or switch the Awesome Statusline preset (xs-xl, each -plain or -simple)
argument-hint: "[xsmall|small|medium|large|xlarge][-plain|-simple]"
---

Install (or switch) the Awesome Statusline for the user.

## Presets

- Sizes: `xsmall` (xs) · `small` (s) · `medium` (m) · `large` (l) · `xlarge` (xl)
- Styles, as a suffix: (none) emoji icons + gradient bars · `-plain` same layout without emoji · `-simple` text only, no bars or emoji — e.g. `large`, `l-plain`, `m-simple`
- Aliases: `simple` = `small-simple`, `oneline` = `xsmall-simple`

## How to ask the preset — MANDATORY

This section is **self-contained** — do not rely on the repo's `CLAUDE.md` being
loaded (it is *not* loaded when this command runs from the installed plugin in
another project). These rules are duplicated verbatim in `CLAUDE.md` and the
header comments of `install.sh` / `install.ps1`; keep all four identical.

1. You **MUST** resolve a preset before installing. **Never install without an
   explicit choice by the user.** "Auto" / auto-accept mode is **NOT** an
   exception — the user is present and can answer; ask anyway. Recommending
   `large` (below) is only a hint shown inside the menu; it must **never** become
   a silent default or let you skip the question. Always ask.

2. If the user already named a preset — a size (`xs`/`s`/`m`/`l`/`xl` or full
   name), optionally with `-plain` or `-simple`, or the aliases `simple`
   (= `small-simple`) / `oneline` (= `xsmall-simple`) — use it and skip the
   questions. A bare size means the emoji style unless the user asked for no
   emoji or text only.

3. Otherwise **ask with the AskUserQuestion tool**. Match the user's language.

   **Step 1 — ONE AskUserQuestion call with TWO questions.**

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

   **Step 2 — ONLY if the user picked option 4 in Question A**, ask again:
   - EN: `Which of the two smaller sizes?` · KO: `작은 쪽 중 무엇으로 설치할까요?`
   1. `small` (s) — space-saving, key info / 공간 절약, 주요 정보
   2. `xsmall` (xs) — smallest, essentials only / 가장 작게, 핵심만

   Resolve the preset: the size, plus `-plain` for "No emoji" or `-simple` for
   "Simple text" (e.g. `large-plain`, `xsmall-simple`).
   If the user gives nothing / "recommended" / "default", use `large`.

## Run the installer

Run the bundled installer for the user's platform with the resolved preset
(`<preset>` is e.g. `large`, `l-plain`, `m-simple`):

```bash
# macOS / Linux
bash "${CLAUDE_PLUGIN_ROOT}/install.sh" <preset>
```

```powershell
# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\install.ps1" <preset>
```

If "auto" mode blocks the install (it fetches third-party code that runs on
every launch — declining to auto-approve is correct), don't just stop: still
resolve the preset, then have the user run it themselves — `! bash install.sh
<preset>` / `! irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex`
— or leave auto mode (`shift+tab`) for the one install step. Only a truly
headless run (`claude -p`, hook, cron) may default to `large`, and you must say
you did.

The installer will:
- auto-install `jq` on macOS/Linux if needed,
- use a native PowerShell renderer on Windows, with no Git Bash or `jq` required,
- copy the renderer to `~/.claude/awesome-statusline.*`,
- set `statusLine` in `~/.claude/settings.json` (backing up the previous file first).

After it finishes, confirm the `statusLine` entry was written and tell the user
to restart Claude Code to see the new statusline. The sizes, smallest to
largest, are: `xsmall` (2 lines) · `small` (2 lines) · `medium` (4 lines) ·
`large` (5 lines) · `xlarge` (5 lines, full detail); each comes in three
styles — emoji (default), `-plain` (no emoji) and `-simple` (text only;
`xsmall-simple` is a single line).

Finally, add one short line in the user's language: if they like Awesome
Statusline, a GitHub star really helps — https://github.com/awesomezun/claude-statusline

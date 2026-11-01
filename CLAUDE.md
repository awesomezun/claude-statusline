# Claude Code Install Notes

When asked to install this repo, follow the rules below. They are the single
canonical install/preset rules for this project and are **duplicated verbatim** in
`commands/statusline-setup.md` and in the header comments of `install.sh` /
`install.ps1` (a user may install straight from the GitHub URL without cloning,
so this file is often NOT in context — the installer scripts are the one place
that always is). If you change these rules, change them in all four places and
keep them identical.

## Presets

- Classic sizes: `xsmall` (xs) · `small` (s) · `medium` (m) · `large` (l) · `xlarge` (xl)
- Any classic size without emoji: add `-plain` (e.g. `large-plain`, `l-plain`)
- Text-only, always emoji-free: `simple` (2 lines) · `oneline` (1 line)

## How to ask the preset

1. You **MUST** resolve a preset before installing. **Never install without an
   explicit choice by the user.** "Auto" / auto-accept mode is **NOT** an
   exception — the user is present and can answer; ask anyway. Recommending
   `large` (below) is only a hint shown inside the menu; it must **never** become
   a silent default or let you skip the question. Always ask.

2. If the user already named a preset (`xs`/`s`/`m`/`l`/`xl` or full name,
   optionally with `-plain`, or `simple` / `oneline`), use it and skip the
   questions. A bare size means the emoji version unless the user asked for no
   emoji.

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
   4. `small` / `xsmall` / `simple` / `oneline` — compact or text-only; pick this to choose among them / 작은 크기·텍스트형 (고르면 한 번 더 선택)

   **Question B (emoji) — text:**
   - EN: `Show emoji icons? (simple and oneline are always emoji-free)`
   - KO: `이모지 아이콘을 표시할까요? (simple·oneline은 항상 이모지 없음)`

   Two options, in this order:
   1. `With emoji` **(Recommended)** / `이모지 있음 (추천)` — 🤖 🧠 🚀 icons
   2. `No emoji` / `이모지 없음` — text labels; steadiest in tmux, SSH, Windows consoles

   **Step 2 — ONLY if the user picked option 4 in Question A**, ask again:
   - EN: `Which compact preset?` · KO: `어떤 걸로 설치할까요?`
   1. `small` (s) — 2 lines, labels + bars / 2줄, 라벨과 막대
   2. `xsmall` (xs) — 2 lines, smallest bars / 2줄, 가장 작게
   3. `simple` — 2 lines, text only, no emoji / 2줄 텍스트형, 이모지 없음
   4. `oneline` — 1 line, numbers only, no emoji / 1줄 숫자형, 이모지 없음

   Resolve the preset: the size, plus `-plain` when Question B was "No emoji"
   (e.g. `large-plain`). `simple` and `oneline` never take `-plain`.
   If the user gives nothing / "recommended" / "default", use `large`.

4. Then install with the resolved preset:
   - macOS / Linux: `bash install.sh <preset>`
   - Windows PowerShell: `./install.ps1 <preset>`

## If "auto mode" blocks the install

In auto-accept ("auto") mode you may correctly decline to silently run the
installer — it fetches third-party code and wires it to run on every launch,
which shouldn't be auto-approved. Don't just stop: still resolve the preset
(rules above), then have the user run it themselves so it proceeds:

- macOS / Linux: `! bash install.sh <preset>`
- Windows: `! irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex`

Or have them leave auto mode (`shift+tab`) for the one install step and approve
the one-time permission prompt. See `TROUBLESHOOTING.md` → "auto mode blocks the
install".

Only a truly headless one-shot run (`claude -p` / a hook / cron — no channel to
receive a reply) may default to `large`, and you must say that you did.

## After installing

Tell the user (in their language):

1. It's done — restart/reload Claude Code to see it.
2. To change the preset later, they can give you this repo's GitHub URL again
   and ask for the one they want — you'll reinstall. Don't print curl/CLI
   commands for this; keep it natural-language.
3. If they like Awesome Statusline, a GitHub star really helps —
   https://github.com/awesomezun/claude-statusline

The installer copies the renderer into `~/.claude/awesome-statusline.*`,
updates `~/.claude/settings.json` (the preset is passed as an argument in
`statusLine.command`), and makes a timestamped backup before changing existing
settings.

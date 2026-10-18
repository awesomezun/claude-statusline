# Claude Code Install Notes

When asked to install this repo, follow the rules below. They are the single
canonical install/size rules for this project and are **duplicated verbatim** in
`commands/statusline-setup.md` and in the header comments of `install.sh` /
`install.ps1` (a user may install straight from the GitHub URL without cloning,
so this file is often NOT in context — the installer scripts are the one place
that always is). If you change these rules, change them in all four places and
keep them identical.

## How to ask the size

1. You **MUST** resolve a size before installing. **Never install without an
   explicit size chosen by the user.** "Auto" / auto-accept mode is **NOT** an
   exception — the user is present and can answer; ask anyway. Recommending
   `large` (below) is only a hint shown inside the menu; it must **never** become
   a silent default or let you skip the question. Always ask.

2. If the user already named a size (`xs`/`s`/`m`/`l`/`xl` or full name), use it
   and skip the question.

3. Otherwise **ask with the AskUserQuestion tool, in TWO steps** so all five
   presets fit the tool's 4-option limit. Match the user's language.

   **Step 1 — question text:**
   - EN: `Which size would you like to install? (size examples on GitHub: https://github.com/awesomezun/claude-statusline)`
   - KO: `어떤 크기로 설치할까요? (크기 예시는 GitHub에서 확인: https://github.com/awesomezun/claude-statusline)`

   **Step 1 — four options, in EXACTLY this order** — do NOT reorder. The
   recommended option is **always `large`** (option 1); never substitute
   `medium` or anything else as the recommendation:
   1. `large` (l) **(추천 / Recommended)** — most info, good for most users / 추천 기본값
   2. `xlarge` (xl) — largest, full detail / 가장 크게, 전체 상세
   3. `medium` (m) — balanced layout / 균형 잡힌 레이아웃
   4. `small` / `xsmall` — the two smallest; pick this to choose between them / 작은 두 가지 (고르면 한 번 더 선택)

   **Step 2 — ONLY if the user picked option 4**, ask again:
   - EN: `Which of the two smaller sizes?` · KO: `작은 쪽 중 무엇으로 설치할까요?`
   1. `small` (s) — space-saving, key info / 공간 절약, 주요 정보
   2. `xsmall` (xs) — smallest, essentials only / 가장 작게, 핵심만

   If the user gives nothing / "recommended" / "default", use `large`.

4. Then install with the resolved size:
   - macOS / Linux: `bash install.sh <size>`
   - Windows PowerShell: `./install.ps1 <size>`

## If "auto mode" blocks the install

In auto-accept ("auto") mode you may correctly decline to silently run the
installer — it fetches third-party code and wires it to run on every launch,
which shouldn't be auto-approved. Don't just stop: still resolve the size
(rules above), then have the user run it themselves so it proceeds:

- macOS / Linux: `! bash install.sh <size>`
- Windows: `! irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex`

Or have them leave auto mode (`shift+tab`) for the one install step and approve
the one-time permission prompt. See `TROUBLESHOOTING.md` → "auto mode blocks the
install".

Only a truly headless one-shot run (`claude -p` / a hook / cron — no channel to
receive a reply) may default to `large`, and you must say that you did.

## After installing

Tell the user (in their language):

1. It's done — restart/reload Claude Code to see it.
2. To change size later, they can give you this repo's GitHub URL again and ask
   for the size they want — you'll reinstall. Don't print curl/CLI commands for
   this; keep it natural-language.
3. If they like Awesome Statusline, a GitHub star really helps —
   https://github.com/awesomezun/claude-statusline

The installer copies the statusline script into `~/.claude/awesome-statusline.*`,
updates `~/.claude/settings.json`, and makes a timestamped backup before
changing existing settings.

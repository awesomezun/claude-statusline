<div align="center">

<img src="assets/reel.gif" alt="Awesome Statusline — 30초 모션 릴" width="820"/>

# ⚡ Awesome Statusline

**[Claude Code](https://claude.com/claude-code) 아래쪽에 모델 · 추론 강도 · 컨텍스트 · 사용량 한도 · 비용을 한눈에 보여 주는 상태줄입니다.**<br/>
macOS · Linux · Windows에서 한 줄로 설치합니다.

[🇺🇸 English](README.md) · [한눈에 보기](#overview) · [설치](#install) · [크기](#sizes) · [스타일](#styles) · [요금제](#plans) · [표시 항목](#fields) · [FAQ](#faq)

<img src="https://img.shields.io/github/stars/awesomezun/claude-statusline?style=flat-square&color=cba6f7" alt="Stars"/>
<img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-89b4fa?style=flat-square" alt="Platforms"/>
<img src="https://img.shields.io/badge/presets-5%20sizes%20%C3%97%203%20styles-f5c2e7?style=flat-square" alt="5 sizes × 3 styles"/>
<img src="https://img.shields.io/badge/plans-Pro%20%7C%20Max%20%7C%20Ultra-a6e3a1?style=flat-square" alt="Pro, Max, Ultra"/>
<img src="https://img.shields.io/badge/license-MIT-fab387?style=flat-square" alt="MIT"/>

<br/><br/>

<img src="assets/presets/hero.png" alt="추천 프리셋 large — Opus 5.5 ⚡xhigh, 컨텍스트 32%, 5시간 한도 34%, 주간 한도 65%" width="820"/>

<sub>▶ <a href="https://awesomezun.github.io/claude-statusline/">라이브 데모</a> · 🆕 <b>v3.5.1</b> Ultra 요금제 지원 · 5가지 크기 × 3가지 스타일 → <a href="#changelog">변경 기록</a></sub>

</div>

---

<a id="overview"></a>

## 🧭 한눈에 보기

**설치할 때 고르는 것은 크기와 스타일, 두 가지뿐입니다. 요금제는 고르지 않습니다. 상태줄이 알아서 맞춥니다.**

| | 정하는 것 | 선택지 | 누가 정하나요 |
|---|---|---|---|
| **1. [크기](#sizes)** | 얼마나 많이 보여 줄지 | `xsmall` · `small` · `medium` · `large` · `xlarge` (5가지) | 설치할 때 직접 고릅니다 |
| **2. [스타일](#styles)** | 어떤 모양으로 보여 줄지 | 이모지 · 이모지 없음 · 심플 텍스트 (3가지) | 설치할 때 직접 고릅니다 |
| **3. [요금제](#plans)** | 어떤 사용량 한도를 보여 줄지 | Pro · Max → 5시간 + 주간<br/>Ultra → 주간 + 하루 예산 | **자동** (고르지 않습니다) |

크기와 스타일을 합친 이름을 **프리셋**이라고 부릅니다. 5 × 3 = **15개** 중 하나를 고르면 됩니다.

| 크기 ↓ · 스타일 → | 이모지 (기본) | 이모지 없음 | 심플 텍스트 |
|---|---|---|---|
| **xsmall** · 2줄 | `xsmall` | `xsmall-plain` | `xsmall-simple` (1줄) |
| **small** · 2줄 | `small` | `small-plain` | `small-simple` |
| **medium** · 4줄 | `medium` | `medium-plain` | `medium-simple` |
| **large** · 5줄 ⭐ 추천 | **`large`** | `large-plain` | `large-simple` |
| **xlarge** · 5줄 | `xlarge` | `xlarge-plain` | `xlarge-simple` |

- 크기만 쓰면 이모지 스타일입니다. `large`는 이모지가 있는 large입니다.
- 크기는 줄여 써도 됩니다(`xs` · `s` · `m` · `l` · `xl`). `l-plain` = `large-plain`, `m-simple` = `medium-simple`입니다.
- 예전 이름 `simple`은 `small-simple`, `oneline`은 `xsmall-simple`과 같습니다.
- 처음이라면 **`large`** 를 추천합니다. 나중에 언제든 바꿀 수 있습니다.

---

<a id="install"></a>

## 🚀 설치

### 방법 1. AI 에이전트에게 부탁하기 (가장 쉬움)

Claude Code에 이렇게 입력하세요.

```text
https://github.com/awesomezun/claude-statusline 설치해 줘
```

크기와 스타일을 물어본 뒤 설치합니다. 프리셋을 함께 말하면(`… large-plain으로 설치해 줘`) 묻지 않고 바로 설치합니다.

### 방법 2. 터미널에서 한 줄로

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex
```

설치 스크립트가 크기(1–5번)와 스타일(1–3번)을 차례로 묻습니다. 프리셋을 미리 정했다면 뒤에 붙이세요.

```bash
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh | bash -s -- large-plain
```

설치가 끝나면 **Claude Code를 다시 시작**하세요.

<details>
<summary>그 밖의 설치 방법: 클론해서 설치 · Windows 보안 프로그램이 막을 때 · 플러그인 마켓플레이스</summary>
<br/>

**클론해서 설치**
```bash
git clone https://github.com/awesomezun/claude-statusline.git && cd claude-statusline
./install.sh large-plain      # macOS / Linux (프리셋을 빼면 물어봅니다)
./install.ps1 large-plain     # Windows PowerShell
```

**Windows 보안 프로그램이 `irm | iex`를 막을 때**: 파일로 내려받아 내용을 확인한 뒤 실행하세요.
```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 -OutFile .\install.ps1
notepad .\install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

**플러그인 마켓플레이스**
```
/plugin marketplace add awesomezun/claude-statusline
/plugin install awesome-statusline
```
설치한 뒤 `/statusline-setup`을 실행하세요. `/statusline-setup large-plain`처럼 프리셋을 바로 넘길 수도 있습니다.

</details>

---

<a id="sizes"></a>

## 📐 1. 크기: 5가지 중 하나

얼마나 많은 정보를 몇 줄에 보여 줄지 정합니다. 위로 갈수록 작고, 아래로 갈수록 자세합니다.

| 크기 | 줄 | 보여 주는 것 |
|---|:-:|---|
| `xsmall` (`xs`) | 2 | 모델 · effort · 폴더 · 브랜치, 작은 막대 3개 |
| `small` (`s`) | 2 | + 전체 경로, git 변경 수, 출력 스타일, 리셋까지 남은 시간 |
| `medium` (`m`) | 4 | + 긴 컨텍스트 막대와 토큰 수, 앞선 커밋 수 |
| **`large` (`l`)** | 5 | + 비용, 세션 시간, 한도마다 한 줄씩 리셋 시각 (**추천**) |
| `xlarge` (`xl`) | 5 | + 모든 막대 40칸, 리셋 날짜까지 |

<div align="center">
<img src="assets/presets/sizes.png" alt="5가지 크기 — xsmall부터 xlarge까지 (이모지 스타일, Pro / Max)" width="820"/>
</div>

---

<a id="styles"></a>

## 🎨 2. 스타일: 3가지 중 하나

크기 이름 뒤에 붙여서 모양을 고릅니다. 다섯 크기 모두 세 가지 스타일이 있습니다.

| 스타일 | 붙이는 것 | 예 | 모양 |
|---|---|---|---|
| **이모지** (기본) | 없음 | `large` | 아이콘 + 그라데이션 막대 |
| **이모지 없음** | `-plain` | `large-plain` | 같은 배치와 막대, 아이콘만 빠짐 |
| **심플 텍스트** | `-simple` | `large-simple` | 글자와 숫자만 (막대·이모지 없음) |

<div align="center">
<img src="assets/presets/styles.png" alt="large의 3가지 스타일 — 이모지, -plain, -simple" width="820"/>
</div>

- `-plain`은 이모지만 빠지고 내용은 똑같습니다. tmux · SSH · Windows 콘솔처럼 이모지 폭이 어긋나기 쉬운 곳에서 가장 안정적입니다.
- `-simple`은 글자에 맞게 다시 배치해서 크기마다 항목이 조금 다릅니다. 예를 들어 `xsmall-simple`은 한 줄에 맞추느라 폴더 이름을 뺍니다.
- **심플 텍스트의 색**은 한도 기간 중 지나간 시간과 사용량을 비교한 결과입니다. 초록은 여유, 노랑은 시간과 비슷한 속도, 빨강은 시간보다 빨리 쓰는 중(또는 90% 이상)입니다. 예를 들어 5시간 중 56%가 지났는데 34%를 썼다면 초록입니다.

<details>
<summary>🖼️ 다섯 크기 모두 보기: 이모지 없음 (<code>-plain</code>)</summary>
<br/>
<div align="center">
<img src="assets/presets/plain.png" alt="5가지 크기의 -plain 스타일" width="820"/>
</div>
</details>

<details>
<summary>🖼️ 다섯 크기 모두 보기: 심플 텍스트 (<code>-simple</code>)</summary>
<br/>
<div align="center">
<img src="assets/presets/simple.png" alt="5가지 크기의 -simple 스타일" width="820"/>
</div>
</details>

---

<a id="plans"></a>

## 📊 3. 요금제: 자동

**고르지 않습니다.** 요금제마다 Claude Code가 상태줄에 넘겨주는 사용량 한도가 다르고, 상태줄은 넘어온 한도만 그립니다. 15개 프리셋 모두 이렇게 동작하며, 요금제를 바꿔도 다시 설치할 필요가 없습니다.

| 요금제 | Claude Code가 넘겨주는 한도 | 상태줄에 보이는 것 |
|---|---|---|
| **Pro · Max** | 5시간 한도 + 주간 한도 | `5H` 막대와 `7D` 막대, 각각의 리셋 시각 |
| **Ultra** | 주간 한도만 (5시간 한도 없음) | `Weekly` 막대 하나, 리셋 시각, **하루 예산** |

**하루 예산**(`≈22%/day`)은 남은 주간 한도를 리셋까지 남은 날수로 나눈 값입니다. 하루에 이만큼씩만 쓰면 리셋 전에 한도에 걸리지 않습니다. 리셋까지 하루도 남지 않으면 `9% left`처럼 남은 양을 보여 줍니다.

<div align="center">
<img src="assets/presets/plans.png" alt="같은 large 프리셋이 Pro / Max에서는 5H + 7D, Ultra에서는 Weekly 한 줄과 하루 예산으로 바뀝니다" width="820"/>
</div>

<details>
<summary>🖼️ 다섯 크기 모두 보기: Ultra</summary>
<br/>
<div align="center">
<img src="assets/presets/ultra.png" alt="Ultra 요금제에서 5가지 크기" width="820"/>
</div>
</details>

<details>
<summary>📋 텍스트로 보기 (복사·붙여넣기용)</summary>
<br/>

터미널에서는 색이 함께 표시됩니다.

```text
xsmall ─ 2줄
🤖 Opus ⚡xhigh 💡  📂 awesome-statusline 🌿main*
🧠 ██░░░░ 32%  5h ██░░░░ 34%  7d ████░░ 65%

small ─ 2줄
🤖 Opus 5.5 ⚡xhigh 💡 │ 📂 ~/cc/awesome-statusline 🌿(main) +2 !3 ?1 │ 🎨 explanatory
🧠 Context ███░░░░░░░  32% │ 5H ███░░░░░░░  34% 2h10m │ 7D ███████░░░  65% Wed

medium ─ 4줄
🤖 Opus 5.5 ⚡xhigh 💡 │ 📝 +2 !3 ?1 │ 🎨 explanatory
📂 ~/cc/awesome-statusline 🌿(main ↑1)
🧠 Context  █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  32%  320k/1M
🚀 Usage    5H █████░░░░░░░░░  34% 2h10m │ 7D █████████░░░░░  65% Wed

large ─ 5줄 (추천)
🤖 Opus 5.5 ⚡xhigh 💡 │ 📝 +2 !3 ?1 │ 🎨 explanatory
📂 ~/cc/awesome-statusline 🌿(main ↑1) │ 💰 $25.29 │ ⏰ 5h16m
🧠 Context   ██████░░░░░░░░░░░░░░  32%  320k/1M
🚀 Usage 5H  ███████░░░░░░░░░░░░░  34%  resets in 2h10m · 14:57
⭐ Usage 7D  █████████████░░░░░░░  65%  resets Wed 02:47 · 2d14h

xlarge ─ 5줄
🤖 Opus 5.5 ⚡xhigh 💡 │ 🎨 explanatory │ 📝 dirty +2 !3 ?1
📂 ~/cc/awesome-statusline 🌿(main ↑1) │ 💰 $25.29 │ ⏰ 5h16m
🧠 Context   █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  32%  used (320k / 1000k)
🚀 5H Limit  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  34%  resets in 2h10m (2:57pm)
🌟 7D Limit  ██████████████████████████░░░░░░░░░░░░░░  65%  resets Wed Nov 4, 2am (in 2d14h)

large-plain ─ 이모지 없음
Opus 5.5 · xhigh · thinking │ +2 !3 ?1 │ explanatory
~/cc/awesome-statusline (main ↑1) │ $25.29 │ 5h16m
Context   ██████░░░░░░░░░░░░░░  32%  320k/1M
Usage 5H  ███████░░░░░░░░░░░░░  34%  resets in 2h10m · 14:57
Usage 7D  █████████████░░░░░░░  65%  resets Wed 02:47 · 2d14h

large-simple ─ 심플 텍스트
Opus 5.5 · xhigh · thinking   git +2 !3 ?1   style explanatory
~/cc/awesome-statusline (main ↑1)   cost $25.29   time 5h16m
context   32%   320k / 1M
5h        34%   resets in 2h10m · 14:57
7d        65%   resets Wed 02:47 · 2d14h

xsmall-simple ─ 심플 텍스트, 1줄
Opus · xhigh · think │ ctx 32% │ 5h 34% │ 7d 65% │ main*

large ─ Ultra (주간 한도만)
🤖 Opus 5.5 ⚡xhigh 💡 │ 📝 +2 !3 ?1 │ 🎨 explanatory
📂 ~/cc/awesome-statusline 🌿(main ↑1) │ 💰 $25.29 │ ⏰ 5h16m
🧠 Context   ██████░░░░░░░░░░░░░░  32%  320k/1M
⭐ Weekly    ██████████░░░░░░░░░░  48%  resets Tue 22:47 · 2d10h · ≈22%/day

large-simple ─ Ultra (주간 한도만)
Opus 5.5 · xhigh · thinking   git +2 !3 ?1   style explanatory
~/cc/awesome-statusline (main ↑1)   cost $25.29   time 5h16m
context   32%   320k / 1M
week      48%   resets Tue 22:47 · 2d10h · 22%/day
```

</details>

---

<a id="fields"></a>

## 🔍 표시 항목

| 항목 | 의미 |
|------|------|
| 🤖 **모델** | 현재 모델 (`Opus 5.5` 등) |
| ⚡ **Effort** | 추론 강도: `low` · `medium` · `high` · `xhigh` · `max`. `/effort`로 바꾸면 바로 반영됩니다. effort를 지원하지 않는 모델에서는 숨깁니다 |
| 💡 **Thinking** | 확장 사고가 켜져 있음 |
| 🎨 **출력 스타일** | 현재 출력 스타일 (`default`이면 숨김) |
| 📂 🌿 **폴더 · Git** | 폴더, 브랜치, 앞선 ↑ / 뒤처진 ↓ 커밋 수, 스테이징 `+` · 수정 `!` · 추적 안 함 `?` 파일 수 |
| 🐍 **Env** | 켜져 있는 conda / virtualenv (있을 때만) |
| 🧠 **컨텍스트** | 컨텍스트 창 사용량 막대와 토큰 수 |
| 💰 **비용** · ⏰ **시간** | 세션 비용(USD)과 경과 시간 |
| 🚀 **5H** · ⭐ **7D** | 5시간 · 주간 한도 사용률과 리셋 시각 (Pro · Max) |
| ⭐ **Weekly** | 주간 한도 사용률, 리셋 시각, 하루 예산 (Ultra) |

이모지 없음 · 심플 텍스트 스타일에서는 아이콘 대신 `Context`, `Usage 5H`, `cost` 같은 글자 라벨로 표시합니다. 색은 [Catppuccin](https://catppuccin.com/) 팔레트를 따르고, 모든 글리프가 표준 이모지와 유니코드 블록이라 Nerd Font가 필요 없습니다.

---

<a id="change"></a>

## 🔧 프리셋 바꾸기 · 제거

**바꾸기**: AI 에이전트에게 이 저장소 주소와 원하는 프리셋을 말하면 다시 설치합니다(예: `https://github.com/awesomezun/claude-statusline medium-simple로 바꿔 줘`). 터미널에서는 설치 스크립트를 새 프리셋으로 다시 실행하면 됩니다.

```bash
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh | bash -s -- medium-simple
```

**제거**: `~/.claude/settings.json`에서 `statusLine` 항목을 지우고 `~/.claude/awesome-statusline.sh`(Windows는 `awesome-statusline.ps1`)를 삭제하세요. 설치할 때마다 `settings.json.backup-<시각>` 백업이 만들어지므로 이전 설정으로 되돌릴 수도 있습니다.

---

<a id="requirements"></a>

## ✅ 요구 사항

| | macOS · Linux | Windows |
|---|---|---|
| 실행 | Bash 3.2 이상 (기본 포함) | PowerShell 5.1 이상 (기본 포함) |
| JSON 처리 | `jq` (없으면 설치 스크립트가 brew / apt / dnf / pacman / zypper / apk로 설치) | 필요 없음 |
| 필요 없는 것 | Node, Nerd Font | Node, Nerd Font, Git Bash, `jq` |

Windows에서는 설치 스크립트가 네이티브 `awesome-statusline.ps1`을 설치하고 Claude Code가 `powershell -NoProfile …`로 실행하도록 설정합니다. 그래서 Git Bash, `.sh` 파일 연결, `jq` PATH 문제가 생기지 않습니다.

---

<a id="faq"></a>

## 🙋 FAQ

**요금제를 바꾸면 다시 설치해야 하나요?** 아니요. 상태줄은 Claude Code가 넘겨주는 한도를 그대로 따르므로 Pro · Max에서는 5H + 7D, Ultra에서는 Weekly로 저절로 바뀝니다.

**한도 줄에 `loading..`이 떠요.** 사용량 데이터는 세션에서 첫 메시지를 보낸 뒤에 오므로 그 전까지 `loading..`이 보입니다. 데이터는 claude.ai 구독(Pro · Max · Ultra)으로 로그인했을 때만 오기 때문에, API 키로 쓰면 계속 `loading..`으로 남습니다. Ultra에서 첫 메시지 뒤에도 `loading..`이면 예전 버전이니, AI 에이전트에게 다시 설치해 달라고 하세요.

**Ultra인데 Weekly 막대 하나만 보여요.** 정상입니다. Ultra에는 5시간 한도가 없습니다.

**`⚡effort`가 안 보여요.** 현재 모델이 effort를 지원하지 않아서 일부러 숨긴 것입니다. `/effort`를 지원하는 모델(예: Opus 5.5)로 바꾸세요.

**이모지를 끌 수 있나요?** 네. 크기 뒤에 `-plain`을 붙이면 같은 배치에서 이모지만 빠지고(`large-plain`), `-simple`을 붙이면 막대도 없는 텍스트형이 됩니다(`large-simple`).

**Claude Code가 느려지나요?** 아니요. 갱신할 때마다 약 0.1초 걸리는 작은 로컬 스크립트입니다.

**왜 Nerd Font 아이콘 대신 이모지인가요?** 폰트를 따로 설치하지 않아도 어느 터미널에서나 바로 제대로 보이게 하려고요. 내 폰트에서 어떻게 보이는지는 [12개 폰트 쇼케이스](demo.md)에서 확인하세요.

**기존 설정은 어디 갔나요?** 설치할 때마다 `settings.json`을 `settings.json.backup-<시각>`으로 백업한 뒤에 바꿉니다.

**tmux 안에서 막대가 띠처럼 끊기거나 노랑이 올리브색이 돼요.** Claude Code는 tmux 안에서 색을 256색으로 낮춰 그립니다. 상태줄이 이를 알아채고 256색용 그라데이션으로 그립니다. 완전한 그라데이션을 원하시면 `~/.claude/settings.json`에 `"env": {"CLAUDE_CODE_TMUX_TRUECOLOR": "1"}`를 넣으세요(tmux가 24비트 색을 지원하면 설치 스크립트가 자동으로 넣습니다). 자세히: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**tmux 안에서 글자가 세로로 한 줄씩 쪼개져요.** `~/.tmux.conf`에서 truecolor를 켜고(`set -ga terminal-overrides ",xterm-256color:RGB"`) tmux를 다시 불러오세요. 자세히: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**Windows에서 상태줄이 비어 있거나 빈 터미널 창이 계속 떠요.** `install.ps1`을 다시 실행하세요. 네이티브 PowerShell 렌더러로 바뀌면서 Git Bash와 `jq` 의존성이 사라집니다. 자세히: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

<a id="changelog"></a>

## 🆕 변경 기록

Claude Code의 변화에 맞춰 계속 업데이트합니다. 릴리스별 자세한 내용은 [Releases](https://github.com/awesomezun/claude-statusline/releases)에 있습니다.

| 날짜 | 업데이트 |
|------|----------|
| **2026‑11‑01** | **v3.5.1** · 다섯 크기 모두에 3가지 스타일(심플 텍스트 `m-simple`, `l-simple`, `xl-simple` 추가) · 설치할 때 크기와 스타일을 차례로 물어봄 · **tmux 안에서도 깨끗한 그라데이션**(Claude Code가 256색으로 낮추면 256색용 그라데이션으로 그리고, tmux가 24비트 색을 지원하면 설치 스크립트가 `CLAUDE_CODE_TMUX_TRUECOLOR`를 켬) · 최소 대비를 쓰는 밝은 테마(VS Code, Orca)에서 막대 첫 칸이 어두워지던 문제 수정 · README를 "고르는 것 2가지(크기·스타일) + 자동 1가지(요금제)" 구조로 새로 정리 |
| **2026‑10‑31** | **Ultra 요금제 지원 + 디자인 개편** · Ultra는 5시간 한도가 없어서 주간 막대와 하루 예산을 보여 줌(예전에는 `0% (loading..)`에서 멈춤) · 모든 크기 디자인 정돈(열 정렬, 퍼센트 칸 폭 고정, 리셋을 *2h10m 후 · 01:50*처럼 표시, 빈 정보 숨김) · 이모지 없음(`-plain`) 추가 · 텍스트형 `simple`, `oneline` 추가 · 모든 프리셋을 렌더러 하나로 통합해 갱신 속도 약 4배 향상 |
| **2026‑10‑17** | **한국어 등 비영어 Windows 환경** · 세션 이름에 한글 같은 비ASCII 문자가 있으면 `Unknown` / 0%로 표시되던 문제 수정 · 컨텍스트 창 크기가 잘못 보고될 때의 보정 추가 |
| **2026‑06‑03** | **설치 크기 선택** · Claude Code로 설치할 때 크기를 항상 물어봄(`large` 추천) |
| **2026‑06‑02** | **Windows 네이티브 렌더러** · PowerShell 상태줄, Windows에서 Git Bash나 `jq` 불필요 |
| **2026‑05‑31** | **Opus 4.8** 지원 · 추론 강도 **effort**(`high`/`xhigh`/`max`)와 **thinking** 표시 · 크로스플랫폼 한 줄 설치 · 5단계 크기(`xs`–`xl`) · JetBrains Mono |
| **2026‑04‑01** | **1M 토큰 컨텍스트 창** 지원(Opus) · 첫 대화 전에도 사용량 막대 표시 |
| **2026‑01‑19** | 멀티 모드 디스플레이 · 플러그인 마켓플레이스 |
| **2026‑01‑18** | Catppuccin 그라데이션 막대 · 실시간 **5시간 / 7일** 사용량 한도 표시 |

---

<div align="center">

Claude Code 커뮤니티를 위해 🩵 으로 만들었습니다 · [Catppuccin](https://catppuccin.com/) 테마 · MIT License

⭐ **터미널이 더 예뻐졌다면 별을 눌러 주세요.**

</div>

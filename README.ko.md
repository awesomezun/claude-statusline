<div align="center">

<img src="assets/reel.gif" alt="Awesome Statusline — 30초 모션 릴" width="820"/>

# ⚡ Awesome Statusline

**[Claude Code](https://claude.com/claude-code) 아래쪽에 모델 · 추론 강도 · 컨텍스트 · 사용량 한도를 한눈에 보여 주는 상태줄입니다.**<br/>
macOS · Linux · Windows에서 한 줄로 설치합니다.

[🇺🇸 English](README.md) · [한눈에 보기](#overview) · [설치](#install) · [프리셋](#presets) · [요금제](#plans) · [Mods](#mods) · [표시 항목](#fields) · [FAQ](#faq)

<img src="https://img.shields.io/github/stars/awesomezun/claude-statusline?style=flat-square&color=cba6f7" alt="Stars"/>
<img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-89b4fa?style=flat-square" alt="Platforms"/>
<img src="https://img.shields.io/badge/presets-5%20sizes%20%C3%97%203%20styles-f5c2e7?style=flat-square" alt="5 sizes × 3 styles"/>
<img src="https://img.shields.io/badge/plans-Pro%20%7C%20Max%20%7C%20Ultra-a6e3a1?style=flat-square" alt="Pro, Max, Ultra"/>
<img src="https://img.shields.io/badge/license-MIT-fab387?style=flat-square" alt="MIT"/>

<br/><br/>

<img src="assets/presets/hero.png" alt="추천 프리셋 large — Opus 5.5 ⚡xhigh, 컨텍스트 32%, 5시간 한도 34%, 주간 한도 65%" width="820"/>

<sub>▶ <a href="https://awesomezun.github.io/claude-statusline/">라이브 데모</a> · 프리셋 15개: 크기 5 × 스타일 3 · Pro · Max · Ultra 자동 · 🧩 <a href="#mods">Mods(베타)</a>: 데스크톱 앱에서도 표시 → <a href="#changelog">변경 기록</a></sub>

</div>

---

<a id="overview"></a>

## 🧭 한눈에 보기

**프리셋은 15개입니다. 크기 5가지 × 스타일 3가지.** 설치할 때 크기(얼마나 많이 보여 줄지)와 스타일(어떤 모양으로 보여 줄지)을 하나씩 고릅니다. 요금제는 고르지 않습니다. Ultra도 자동으로 맞춥니다.

| 크기 ↓ · 스타일 → | 이모지 (기본) | 이모지 없음 | 심플 텍스트 |
|---|---|---|---|
| **[xsmall](#xsmall)** · 2줄 | `xsmall` | `xsmall-plain` | `xsmall-simple` (1줄) |
| **[small](#small)** · 2줄 | `small` | `small-plain` | `small-simple` |
| **[medium](#medium)** · 4줄 | `medium` | `medium-plain` | `medium-simple` |
| **[large](#large)** · 5줄 ⭐ 추천 | **`large`** | `large-plain` | `large-simple` |
| **[xlarge](#xlarge)** · 5줄 | `xlarge` | `xlarge-plain` | `xlarge-simple` |

- **이모지**가 기본입니다. 아이콘과 그라데이션 막대로 보여 주며, 크기만 쓰면 이 스타일입니다(`large`).
- **이모지 없음**(`-plain`)은 배치와 막대는 그대로 두고 이모지만 뺍니다. tmux · SSH · Windows 콘솔처럼 이모지 폭이 어긋나기 쉬운 곳에서 가장 안정적입니다.
- **심플 텍스트**(`-simple`)는 글자와 숫자만 씁니다. 그래서 크기마다 항목이 조금 다릅니다. 색은 한도 기간 중 지나간 시간과 사용량을 비교한 결과입니다. 초록은 여유, 노랑은 시간과 비슷한 속도, 빨강은 시간보다 빨리 쓰는 중(또는 90% 이상)입니다.
- 크기는 줄여 써도 됩니다(`xs` · `s` · `m` · `l` · `xl`). `l-plain` = `large-plain`입니다. 예전 이름 `simple`은 `small-simple`, `oneline`은 `xsmall-simple`과 같습니다.
- 처음이라면 **`large`** 를 추천합니다. 나중에 언제든 바꿀 수 있습니다.

Claude 데스크톱 앱에서도 보고 싶다면 [Mods(베타)](#mods)로 설치하세요.

> [!NOTE]
> **Ultra 요금제는 자동으로 적용됩니다.** Ultra에는 5시간 한도가 없어서, Ultra에서는 모든 프리셋이 5H·7D 줄 대신 주간 한도 한 줄과 하루 예산을 보여 줍니다. 따로 고를 것이 없고, 요금제를 바꿔도 다시 설치할 필요가 없습니다. → [요금제](#plans)

---

<a id="install"></a>

## 🚀 설치

### 방법 1. AI 에이전트에게 부탁하기 (가장 쉬움)

Claude Code에 이렇게 입력하세요.

```text
https://github.com/awesomezun/claude-statusline 설치해 줘
```

크기와 스타일, 표시 위치를 물어본 뒤 설치합니다. 프리셋을 함께 말하면(`… large-plain으로 설치해 줘`) 묻지 않고 바로 설치합니다.

### 방법 2. 터미널에서 한 줄로

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.ps1 | iex
```

설치 스크립트가 크기(1–5번), 스타일(1–3번), 표시 위치(1번 상태줄, 2번 [Mods](#mods), macOS / Linux)를 차례로 묻습니다. 프리셋을 미리 정했다면 뒤에 붙이세요.

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

<a id="presets"></a>

## 🎨 프리셋 15개

크기마다 세 가지 스타일을 차례로 보여 드립니다. 이모지, 이모지 없음(`-plain`), 심플 텍스트(`-simple`) 순서입니다. Pro / Max 기준이며, Ultra에서 어떻게 바뀌는지는 [요금제](#plans)를 보세요.

<a id="xsmall"></a>

### xsmall (`xs`) · 2줄

모델 · effort · 폴더 · 브랜치와 작은 막대 3개를 보여 줍니다. 심플 텍스트는 한 줄에 들어갑니다.

<div align="center">
<img src="assets/presets/xsmall.png" alt="xsmall: 이모지 스타일" width="820"/>
<img src="assets/presets/xsmall-plain.png" alt="xsmall-plain: 이모지 없음" width="820"/>
<img src="assets/presets/xsmall-simple.png" alt="xsmall-simple: 심플 텍스트" width="820"/>
</div>

<a id="small"></a>

### small (`s`) · 2줄

전체 경로, git 변경 수, 출력 스타일, 리셋까지 남은 시간이 더해집니다.

<div align="center">
<img src="assets/presets/small.png" alt="small: 이모지 스타일" width="820"/>
<img src="assets/presets/small-plain.png" alt="small-plain: 이모지 없음" width="820"/>
<img src="assets/presets/small-simple.png" alt="small-simple: 심플 텍스트" width="820"/>
</div>

<a id="medium"></a>

### medium (`m`) · 4줄

긴 컨텍스트 막대와 토큰 수, 앞선 커밋 수가 더해집니다.

<div align="center">
<img src="assets/presets/medium.png" alt="medium: 이모지 스타일" width="820"/>
<img src="assets/presets/medium-plain.png" alt="medium-plain: 이모지 없음" width="820"/>
<img src="assets/presets/medium-simple.png" alt="medium-simple: 심플 텍스트" width="820"/>
</div>

<a id="large"></a>

### large (`l`) · 5줄 ⭐ 추천

세션 시간과, 한도마다 한 줄씩 리셋 시각이 더해집니다.

<div align="center">
<img src="assets/presets/large.png" alt="large: 이모지 스타일" width="820"/>
<img src="assets/presets/large-plain.png" alt="large-plain: 이모지 없음" width="820"/>
<img src="assets/presets/large-simple.png" alt="large-simple: 심플 텍스트" width="820"/>
</div>

<a id="xlarge"></a>

### xlarge (`xl`) · 5줄

모든 막대가 40칸이 되고, 리셋 날짜까지 보여 줍니다.

<div align="center">
<img src="assets/presets/xlarge.png" alt="xlarge: 이모지 스타일" width="820"/>
<img src="assets/presets/xlarge-plain.png" alt="xlarge-plain: 이모지 없음" width="820"/>
<img src="assets/presets/xlarge-simple.png" alt="xlarge-simple: 심플 텍스트" width="820"/>
</div>

---

<a id="plans"></a>

## 📊 요금제: 자동, Ultra 포함

**고르지 않습니다.** 요금제마다 Claude Code가 상태줄에 넘겨주는 사용량 한도가 다르고, 상태줄은 넘어온 한도만 그립니다. 15개 프리셋 모두 이렇게 동작하며, 요금제를 바꿔도 다시 설치할 필요가 없습니다.

| 요금제 | Claude Code가 넘겨주는 한도 | 상태줄에 보이는 것 |
|---|---|---|
| **Pro · Max** | 5시간 한도 + 주간 한도 | `5H` 막대와 `7D` 막대, 각각의 리셋 시각 |
| **Ultra** | 주간 한도만 (5시간 한도 없음) | `Weekly` 막대 하나, 리셋 시각, **하루 예산** |

**하루 예산**(`≈22%/day`)은 남은 주간 한도를 리셋까지 남은 날수로 나눈 값입니다. 하루에 이만큼씩만 쓰면 리셋 전에 한도에 걸리지 않습니다. 리셋까지 하루도 남지 않으면 `9% left`처럼 남은 양을 보여 줍니다.

<div align="center">
<img src="assets/presets/plans.png" alt="같은 large 프리셋이 Pro / Max에서는 5H + 7D, Ultra에서는 Weekly 한 줄과 하루 예산으로 바뀝니다" width="820"/>
</div>

---

<a id="mods"></a>

## 🧩 Mods(베타): Claude 데스크톱 앱에서도

상태줄은 `statusLine` 명령으로 동작하는데, Claude 데스크톱 앱의 Code 탭은 이 명령을 실행하지 않습니다. **Mods**는 같은 내용을 Claude Code mod(early access)로 프롬프트 위 띠에 그립니다. 이 띠는 데스크톱 앱에서도 보입니다.

<div align="center">
<img src="assets/presets/desktop.png" alt="Claude 데스크톱 앱에서 mod가 프롬프트 위에 그린 large 프리셋" width="820"/>
</div>

| | 상태줄(기본) | Mods(베타) |
|---|---|---|
| 표시 위치 | 터미널 프롬프트 아래 | 프롬프트 위 띠: 터미널과 Claude 데스크톱 앱 |
| 프리셋 | 15개 모두 | 15개 모두(같은 렌더러를 실행합니다) |
| 지원 OS | macOS · Linux · Windows | macOS · Linux |
| 필요한 것 | Claude Code | mods를 지원하는 Claude Code(early access, 2.1.316과 데스크톱 앱에 들어 있는 2.1.309에서 확인)와 `claude` 명령 |

**설치**: 설치 스크립트가 표시 위치를 물을 때 "Mods"를 고르거나, AI 에이전트에게 `https://github.com/awesomezun/claude-statusline mod로 설치해 줘`라고 하거나, 뒤에 `--mods`를 붙이세요.

```bash
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh | bash -s -- large --mods
```

그다음 터미널이나 데스크톱 앱의 Code 탭에서 새 세션을 시작하세요.

- 설치 스크립트는 mod를 `~/.claude/awesome-statusline-mod/`에 복사하고 `claude plugin install`로 `awesome-statusline-mod@awesome-statusline-local`을 설치합니다. 프리셋은 mod의 `preset` 옵션에 들어갑니다.
- 터미널에 같은 내용이 두 번 나오지 않도록 Awesome Statusline의 `statusLine` 항목은 지웁니다. 다른 statusLine은 그대로 둡니다. 다른 statusLine이 있으면 터미널은 그것을 쓰고, 띠는 데스크톱 앱에만 나옵니다. `/plugin configure awesome-statusline-mod@awesome-statusline-local`의 `terminal` 옵션(`auto` · `show` · `hide`)으로 바꿀 수 있습니다.
- 세션에서 첫 메시지를 보내기 전까지는 effort를 설정값에서 읽고, 사용량 줄은 `loading..`으로 보일 수 있습니다. 첫 답이 오면 세션의 실제 값을 보여 줍니다.
- VS Code 확장에는 프롬프트 위 띠가 없어서 mod가 보이지 않습니다.
- **상태줄로 돌아가기**: `--mods` 없이 다시 설치하세요. **mod 제거**: `claude plugin uninstall awesome-statusline-mod@awesome-statusline-local`을 실행한 뒤 `~/.claude/awesome-statusline-mod/` 폴더를 지우세요.

### 콕핏 패널(시제품)

mod를 설치하면 **`/cockpit`** 으로 채팅 옆에 [1top](https://1top.si) 메뉴바와 같은 모양의 패널이 열립니다. 다크와 라이트 두 테마가 있습니다.

- **계기판**: 속도계 2개(시간당 토큰, 시간당 주간 한도 사용량), 상태 표시줄(작업 중·응답 대기·완료됨·재로그인·한도 부족), 트립 카운터가 달린 주행거리계, 계정마다 남은 한도를 보여 주는 연료 게이지
- **대시보드**: 1시간을 한 바퀴로 그린 원형 토큰 차트, 모델별 비율, 시간당 사용량과 하루 추세가 있는 계정 카드
- **아래 섹션**: 세션(주간 한도 사용량 순), 토큰 흐름, 한도, 사용량 맵, 히트맵, 리소스, 이 세션(컨텍스트, 지금 속도로 간다면 한도가 어디까지 차는지, 실행 중인 도구). *지금 compact* 버튼도 있습니다.
- **사용 기간**은 10분부터 24시간까지 고릅니다. 보기·테마·기간·언어는 맨 위 버튼으로 바꾸고, 다음에 열어도 그대로 유지됩니다.

같은 컴퓨터에서 1top 앱이 실행 중이면 1top의 로컬 읽기 전용 API에서 읽어, 1top이 추적하는 모든 AI(Claude Code, Codex 등)를 보여 줍니다. 1top이 없으면 이 컴퓨터의 리소스와, mod가 설치된 Claude Code 세션들을 보여 줍니다. 콕핏이 열려 있는 동안 프롬프트 위 띠는 숨겨집니다. 세션을 시작할 때마다 자동으로 열려면 mod의 `cockpit` 옵션을 `auto`로 바꾸세요. 데스크톱 앱에서는 그래픽으로, 터미널에서는 글자로 그립니다.

<div align="center">
<img src="assets/presets/cockpit.png" alt="가상의 세션으로 그린 콕핏: 속도계 2개·상태 표시줄·주행거리계·연료 게이지가 있는 다크 계기판과, 원형 토큰 차트·모델별 비율·계정 카드가 있는 라이트 대시보드" width="760"/>
</div>

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
| ⏰ **시간** | 세션 경과 시간 |
| 🚀 **5H** · ⭐ **7D** | 5시간 · 주간 한도 사용률과 리셋 시각 (Pro · Max) |
| ⭐ **Weekly** | 주간 한도 사용률, 리셋 시각, 하루 예산 (Ultra) |

이모지 없음 · 심플 텍스트 스타일에서는 아이콘 대신 `Context`, `Usage 5H`, `time` 같은 글자 라벨로 표시합니다. 색은 [Catppuccin](https://catppuccin.com/) 팔레트를 따르고, 모든 글리프가 표준 이모지와 유니코드 블록이라 Nerd Font가 필요 없습니다.

---

<a id="change"></a>

## 🔧 프리셋 바꾸기 · 제거

**바꾸기**: AI 에이전트에게 이 저장소 주소와 원하는 프리셋을 말하면 다시 설치합니다(예: `https://github.com/awesomezun/claude-statusline medium-simple로 바꿔 줘`). 터미널에서는 설치 스크립트를 새 프리셋으로 다시 실행하면 됩니다.

```bash
curl -fsSL https://raw.githubusercontent.com/awesomezun/claude-statusline/main/install.sh | bash -s -- medium-simple
```

**제거**: `~/.claude/settings.json`에서 `statusLine` 항목을 지우고 `~/.claude/awesome-statusline.sh`(Windows는 `awesome-statusline.ps1`)를 삭제하세요. 설치할 때마다 `settings.json.backup-<시각>` 백업이 만들어지므로 이전 설정으로 되돌릴 수도 있습니다. mod로 설치했다면 [Mods(베타)](#mods)를 보세요.

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

**Claude 데스크톱 앱에서도 보이나요?** [Mods(베타)](#mods)로 설치하면 보입니다. 데스크톱 앱의 Code 탭은 `statusLine` 명령을 실행하지 않지만, mod가 그리는 프롬프트 위 띠는 보여 줍니다.

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
| **2026‑11‑01** | **Mods(베타)** · `--mods`로 Claude Code mod로 설치: 같은 15개 프리셋을 프롬프트 위 띠에 그려서 Claude 데스크톱 앱에서도 보임(macOS / Linux) · 설치할 때 표시 위치도 물어봄 · `/cockpit` 패널(시제품): 계정·토큰 흐름·사용량 맵·실행 중인 세션을 보여 주는 1top식 계기판과 대시보드(다크·라이트) |
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

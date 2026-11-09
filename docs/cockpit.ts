// Draws the cockpit for the README from a made-up session set (no one's real
// projects, titles or accounts), with the mod's own drawing code, in English:
// the cluster and the dashboard, each in the dark and the light theme, with a
// different section below each. Writes docs/cockpit.html; docs/shoot.py
// captures each pane to assets/presets/cockpit-<view>-<theme>.png.
// With --frames it instead prints, as JSON, the pane at a few paces (the
// dials and counters moving) for docs/reels.py.
//
//   npx -y esbuild@0.24.0 docs/cockpit.ts --bundle --platform=node --format=esm --outfile=/tmp/cockpit.mjs && node /tmp/cockpit.mjs [--frames]

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { clusterSvg, dashboardSvg, sectionSvg, THEMES } from '../mods/awesome-statusline-mod/hooks/cluster'
import { fromOneTop, PERIODS, SECTIONS, TEXT, trimOneTop } from '../mods/awesome-statusline-mod/hooks/dash'

// Run from the repository root (the bundle may live anywhere).
const ROOT = process.cwd()
const nowS = Math.floor(Date.now() / 1000)
const t = TEXT.en

// A day of one-minute token bins: a working afternoon, busier toward now.
const build = (k: number) => {
const events: { t: number; kind: string; fresh: number; cached: number; written: number; output: number }[] = []
for (let m = 1440; m >= 1; m--) {
  const at = Math.floor(nowS / 60) * 60 - m * 60
  const wave = Math.max(0, Math.sin(((1440 - m) / 1440) * Math.PI * 3) + 0.35 + (1440 - m) / 2600)
  const claude = Math.round(1_300_000 * wave * (0.6 + ((m * 7919) % 100) / 160) * (m <= 60 ? k : 1))
  events.push({ t: at, kind: 'Claude', fresh: 0, cached: claude, written: 0, output: 0 })
  if (m % 3 === 0) events.push({ t: at, kind: 'Codex', fresh: 0, cached: Math.round(claude * 0.35), written: 0, output: 0 })
  if (m % 17 === 0) events.push({ t: at, kind: 'GLM', fresh: 0, cached: Math.round(claude * 0.2), written: 0, output: 0 })
}

const session = (
  id: string, kind: string, project: string, title: string, account: string, status: string,
  model: string, effort: string | null, tokensH: number, pp: number, children = 0, waiting = false,
) => ({
  id, kind, project, title, status, model, effort, children_count: children,
  waiting_for: waiting ? 'permission' : null,
  location: { app: kind === 'Codex' ? 'ChatGPT' : 'Orca' },
  usage: {
    weekly_account: account,
    windows: Object.fromEntries(['10m', '30m', '1h', '5h', '12h', '24h'].map((w, i) => [w, [0, tokensH * k * [0.17, 0.5, 1, 4.2, 9, 15][i]!, 0, 0]])),
    weekly_estimate: Object.fromEntries(['10m', '30m', '1h', '5h', '12h', '24h'].map((w, i) => [w, { used_pp: pp * k * [0.17, 0.5, 1, 4.2, 9, 15][i]! }])),
  },
})

const raw = {
  account_quotas: [
    { id: 'claude:a', kind: 'Claude', plan: 'max', windows: [{ label: '5H', pct: 38 }, { label: '주간', pct: Math.round(61 + (k - 1) * 6) }] },
    { id: 'claude:b', kind: 'Claude', plan: 'pro', windows: [{ label: '5H', pct: 12 }, { label: '주간', pct: 34 }] },
    { id: 'codex:a', kind: 'Codex', plan: 'pro', windows: [{ label: '주간', pct: 71 }] },
    { id: 'codex:b', kind: 'Codex', plan: 'plus', windows: [{ label: '5H', pct: 9 }, { label: '주간', pct: 92 }] },
    { id: 'agy:a', kind: 'Antigravity', plan: 'gemini', windows: [{ label: '주간', pct: 24 }] },
    { id: 'glm:a', kind: 'GLM', plan: 'pro', windows: [{ label: '5H', pct: 42 }] },
  ],
  root_sessions: [
    session('s1', 'Claude', 'checkout-web', 'Checkout UI', 'claude:a', 'working', 'claude-fable-5-2', 'xhigh', 31_000_000, 0.5, 2),
    session('s2', 'Codex', 'billing-service', 'Billing API', 'codex:a', 'working', 'gpt-6-astra', 'high', 12_000_000, 0.2, 1),
    session('s3', 'Claude', 'docs-site', 'docs-site', 'claude:b', 'working', 'claude-opus-5-5', 'high', 6_000_000, 0.08),
    session('s4', 'Claude', 'design-tokens', 'design-tokens', 'claude:a', 'idle', 'claude-sonnet-5-5', 'medium', 2_500_000, 0.1, 0, true),
    session('s5', 'Claude', 'mobile-app', 'Mobile', 'claude:a', 'idle', 'claude-fable-5-2', 'xhigh', 1_800_000, 0.1),
    session('s6', 'GLM', 'data-sync', 'Nightly sync', 'glm:a', 'idle', 'glm-5', null, 900_000, 0),
    session('s7', 'Codex', 'data-pipeline', 'data-pipeline', 'codex:b', 'idle', 'gpt-6-astra', 'medium', 700_000, 0),
  ],
  events,
  system: { host: { cpu: 16.4, memory: { percent: 61.2 }, network: { rx: 23_600, tx: 4_100 }, disk: { free: 44.6e9 } } },
  weekly_usage: {
    accounts: ['claude:a', 'claude:b', 'codex:a', 'codex:b', 'agy:a', 'glm:a'].map((id, k) => ({
      id,
      history: Array.from({ length: 24 }, (_, i) => [nowS - (24 - i) * 3600, 20 + k * 6 + i * (1.2 + (k % 3) * 0.4)]),
    })),
  },
}

const st = trimOneTop(raw, nowS)
const d = fromOneTop(st, '1h', nowS, t)
const minutes = st.events.map(([at, , n]) => [at, n] as [number, number])
const extra = { session: null, activity: { running: [], counts: {}, calls: 0 }, minutes, nowMs: nowS * 1000 }
return { d, extra }
}

type Theme = 'dark' | 'light'
type View = 'cluster' | 'dashboard'

const tabs = (theme: Theme, items: string[], on: number) => {
  const th = THEMES[theme]
  return `<div class="tabs">${items
    .map((label, i) => `<span class="tab" style="background:${i === on ? th.ink : theme === 'dark' ? '#2a2f34' : '#e4e8eb'};color:${i === on ? th.bg : th.ink}">${label}</span>`)
    .join('')}</div>`
}

type Built = ReturnType<typeof build>
const trip = (k: number) => ({ since: nowS - 86_400 * 2, total: Math.round(434_000_000 + (k - 1) * 30_000_000), lastT: nowS })
const top = ({ d }: Built, k: number, view: View, theme: Theme) =>
  view === 'cluster' ? clusterSvg(d, t, theme, '1h', trip(k), nowS).source : dashboardSvg(d, t, theme, '1h').source

const pane = (view: View, theme: Theme, section: (typeof SECTIONS)[number] | null, k = 1) => {
  const b = build(k)
  const { d, extra } = b
  const th = THEMES[theme]
  const other: View = view === 'cluster' ? 'dashboard' : 'cluster'
  return `<div class="pane" id="cockpit-${view}-${theme}" style="background:${th.bg};color:${th.ink}">
  <div class="head"><b>${t.title}</b><span style="color:${th.accent}">● ${t.live1top}</span><span class="sp"></span>${tabs(theme, [t.views[other], theme === 'dark' ? '☀' : '☾', '한'], -1)}</div>
  ${tabs(theme, PERIODS.map(p => t.periods[p]), PERIODS.indexOf('1h'))}
  ${top(b, k, view, theme)}
  ${section === null ? '' : `${tabs(theme, SECTIONS.map(x => t.sections[x]), SECTIONS.indexOf(section))}
  ${sectionSvg(section, d, t, theme, '1h', extra).source}`}
</div>`
}

const CSS = `.pane{width:400px;padding:14px 12px;border-radius:14px;display:flex;flex-direction:column;gap:10px}
.head{display:flex;align-items:center;gap:8px;font-size:15px}.head span{font-size:11.5px}.head .sp{flex:1}
.tabs{display:flex;flex-wrap:wrap;gap:6px}.tab{font-size:12px;padding:5px 10px;border-radius:7px}`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#2b2f33;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif}
#cockpit{display:grid;grid-template-columns:repeat(2,max-content);gap:20px;padding:20px;align-items:start}
${CSS}
</style></head><body><div id="cockpit">
${pane('cluster', 'dark', 'sessions')}
${pane('dashboard', 'dark', 'limits')}
${pane('cluster', 'light', 'flow')}
${pane('dashboard', 'light', 'heat')}
</div></body></html>`

if (process.argv.includes('--frames')) {
  // The reels: each view at a few paces, in both themes, without a section below
  // (desktop: the dark one with its sessions, the pane as the desktop app shows it).
  // All above 80M tokens an hour, so the dial keeps one scale (to 200M) throughout.
  const paces = [0.96, 1.08, 1.2, 1.32]
  const frames = Object.fromEntries(
    (['cluster', 'dashboard'] as const).flatMap(view =>
      (['dark', 'light'] as const).map(theme => [`${view}-${theme}`, paces.map(k => pane(view, theme, null, k))]),
    ),
  )
  const desktop = Object.fromEntries(
    (['cluster', 'dashboard'] as const).map(view => [view, paces.map(k => pane(view, 'dark', view === 'cluster' ? 'sessions' : 'limits', k))]),
  )
  process.stdout.write(JSON.stringify({ frames, desktop, css: CSS }))
} else {
  writeFileSync(join(ROOT, 'docs', 'cockpit.html'), html)
  console.log('wrote docs/cockpit.html')
}

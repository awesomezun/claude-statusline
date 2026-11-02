// The cockpit's figures and drawings, as pure functions of what the session
// reported: a view model (buildView), the desktop's SVG (hudSvg) and the
// terminal's text bars and sparklines. No `$` here, so tests call them directly.

import type { Activity, Sample, StatusJson } from '../types'

// Catppuccin Mocha, the statusline's palette.
export const C = {
  crust: '#11111b',
  mantle: '#181825',
  base: '#1e1e2e',
  s0: '#313244',
  s1: '#45475a',
  s2: '#585b70',
  over: '#6c7086',
  sub: '#a6adc8',
  text: '#cdd6f4',
  teal: '#94e2d5',
  pink: '#f5c2e7',
  blue: '#89b4fa',
  lav: '#b4befe',
  peach: '#fab387',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  red: '#f38ba8',
} as const

export const WINDOW_S: Record<string, number> = { five_hour: 5 * 3600, seven_day: 7 * 86400 }

export type Pace = 'under' | 'on' | 'ahead'

export type GaugeView = {
  key: 'context' | 'five_hour' | 'seven_day'
  label: string
  /** % used, or null while Claude Code hasn't reported it yet. */
  pct: number | null
  /** Tokens, or when it resets, in words (the terminal, the alt text). */
  sub: string
  /** The same, short enough for the line under a dial. */
  short: string
  /** Share of the window already gone (0..1), for the limits. */
  elapsed: number | null
  pace: Pace | null
  color: string
}

export type CockpitView = {
  model: string
  effort: string | null
  isThinking: boolean
  duration: string
  clock: string
  gauges: GaugeView[]
  /** A limit's outlook at the current pace, one line each. */
  forecast: { label: string; color: string; text: string }[]
  /** The context gauge's figure, for the alert and the Compact button. */
  contextPct: number | null
  alert: string | null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad2 = (n: number) => String(n).padStart(2, '0')

/** 12_600 s -> "3h30m"; 590_000 s -> "6d19h"; 2_880 s -> "48m". */
export const countdown = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds))
  if (s >= 86_400) return `${Math.floor(s / 86_400)}d${Math.floor((s % 86_400) / 3_600)}h`
  if (s >= 3_600) return `${Math.floor(s / 3_600)}h${pad2(Math.floor((s % 3_600) / 60))}m`
  if (s >= 60) return `${Math.floor(s / 60)}m`
  return `${s}s`
}

/** Local "HH:MM", with the weekday when it isn't within the next day. */
export const clockAt = (epochS: number, nowS: number): string => {
  const d = new Date(epochS * 1000)
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return epochS - nowS < 86_400 ? hm : `${DAYS[d.getDay()]} ${hm}`
}

/**
 * Where the pace so far ends up by the reset, the same sum the forecast does:
 * under 85% is under pace, 85-105% on pace, past 105% (or 90% used already)
 * ahead. Early in a window (under 10% gone) the level alone decides.
 */
export const paceOf = (pct: number, elapsed: number | null): Pace => {
  if (pct >= 90) return 'ahead'
  if (elapsed === null || elapsed < 0.1) return pct >= 85 ? 'ahead' : pct >= 60 ? 'on' : 'under'
  const byReset = pct / elapsed
  return byReset > 105 ? 'ahead' : byReset >= 85 ? 'on' : 'under'
}

export const PACE_COLOR: Record<Pace, string> = { under: C.green, on: C.yellow, ahead: C.red }
export const PACE_WORD: Record<Pace, string> = { under: 'UNDER PACE', on: 'ON PACE', ahead: 'AHEAD OF PACE' }

/**
 * Where a limit ends up at the pace so far: the time it would reach 100%, or
 * about how much is used by the reset. Null while too early to tell.
 */
export const forecastOf = (pct: number, resetsAtS: number, windowS: number, nowS: number): string | null => {
  const elapsedS = windowS - (resetsAtS - nowS)
  if (elapsedS < 300 || pct <= 0) return null
  const fullAtS = resetsAtS - windowS + (100 * elapsedS) / pct
  if (fullAtS < resetsAtS) return `100% at ${clockAt(fullAtS, nowS)}, in ${countdown(fullAtS - nowS)}: before it resets`
  const byReset = Math.min(100, Math.round((pct * windowS) / elapsedS))
  return `about ${byReset}% by the reset at ${clockAt(resetsAtS, nowS)}`
}

const tokens = (n: number) => (n >= 1_000_000 && n % 1_000_000 === 0 ? `${n / 1_000_000}M` : `${Math.round(n / 1000)}k`)

export const buildView = (s: StatusJson, nowMs: number): CockpitView => {
  const nowS = Math.floor(nowMs / 1000)
  const ctx = s.context_window
  // Before the first request there is no figure yet; the statusline reads that as 0%, and so does this.
  const ctxPct = ctx.used_percentage ?? Math.round(((ctx.current_usage ?? 0) * 100) / ctx.context_window_size)
  const gauges: GaugeView[] = [
    {
      key: 'context',
      label: 'CONTEXT',
      pct: ctxPct,
      sub: `${tokens(ctx.current_usage ?? 0)} / ${tokens(ctx.context_window_size)}`,
      short: `${tokens(ctx.current_usage ?? 0)} / ${tokens(ctx.context_window_size)}`,
      elapsed: null,
      pace: null,
      color: ctxPct !== null && ctxPct >= 80 ? C.red : ctxPct !== null && ctxPct >= 60 ? C.peach : C.pink,
    },
  ]
  const forecast: CockpitView['forecast'] = []
  const limits = s.rate_limits
  const isUltra = limits !== undefined && limits.seven_day !== undefined && limits.five_hour === undefined
  for (const kind of ['five_hour', 'seven_day'] as const) {
    const w = limits?.[kind]
    if (limits !== undefined && w === undefined) continue // a plan without it (Ultra: no 5-hour limit)
    const label = kind === 'five_hour' ? '5-HOUR' : isUltra ? 'WEEKLY' : '7-DAY'
    const base = kind === 'five_hour' ? C.blue : C.peach
    if (w === undefined) {
      gauges.push({ key: kind, label, pct: null, sub: 'loading..', short: 'loading..', elapsed: null, pace: null, color: base })
      continue
    }
    const left = w.resets_at === undefined ? null : w.resets_at - nowS
    const elapsed = left === null ? null : Math.min(1, Math.max(0, 1 - left / (WINDOW_S[kind] ?? 1)))
    const pace = paceOf(w.used_percentage, elapsed)
    let sub = 'fresh window'
    let short = 'fresh window'
    if (left !== null && w.resets_at !== undefined) {
      short = `${countdown(left)} · ${clockAt(w.resets_at, nowS)}`
      sub = `resets in ${short}`
    }
    gauges.push({ key: kind, label, pct: w.used_percentage, sub, short, elapsed, pace, color: w.used_percentage >= 90 ? C.red : base })
    if (w.resets_at !== undefined) {
      let text = forecastOf(w.used_percentage, w.resets_at, WINDOW_S[kind] ?? 1, nowS) ?? 'too early to tell'
      if (isUltra && kind === 'seven_day' && left !== null && left > 0) {
        const budget = left >= 86_400 ? `≈${Math.round(((100 - w.used_percentage) * 86_400) / left)}%/day` : `${100 - w.used_percentage}% left`
        text += ` · budget ${budget}`
      }
      forecast.push({ label, color: base, text })
    }
  }
  const d = new Date(nowMs)
  return {
    model: s.model.display_name,
    effort: s.effort?.level ?? null,
    isThinking: s.thinking.enabled,
    duration: countdown(s.cost.total_duration_ms / 1000),
    clock: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    gauges,
    forecast,
    contextPct: ctxPct,
    alert: ctxPct !== null && ctxPct >= 80 ? `Context ${ctxPct}%: compact soon, or start a new session` : null,
  }
}

/** "mcp__github__create_issue" -> "mcp:github"; built-in names as they are. */
export const shortTool = (tool: string): string => {
  const m = tool.match(/^mcp__([^_]+(?:_[^_]+)*?)__/)
  return m ? `mcp:${m[1]}` : tool
}

/** The most-called tools, most first. */
export const topTools = (a: Activity, n: number): [string, number][] =>
  Object.entries(a.counts)
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, n)

// ---------------------------------------------------------------- terminal

const SPARK = '▁▂▃▄▅▆▇█'

/** A text sparkline of 0..100 values; gaps as spaces. */
export const sparkline = (values: (number | null)[], width: number): string =>
  values
    .slice(-width)
    .map(v => (v === null ? ' ' : SPARK[Math.min(7, Math.max(0, Math.round((v / 100) * 7)))]))
    .join('')

/** "██████░░░░" for a % over `width` cells. */
export const textBar = (pct: number | null, width: number): [string, string] => {
  const full = pct === null ? 0 : Math.round((Math.min(100, Math.max(0, pct)) / 100) * width)
  return ['█'.repeat(full), '░'.repeat(width - full)]
}

// ---------------------------------------------------------------- desktop SVG

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif"

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from)
  const [x2, y2] = polar(cx, cy, r, to)
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

// A 240° dial, open at the bottom: 0% at lower left, 100% at lower right.
const START = 150
const SWEEP = 240

const dial = (g: GaugeView, cx: number, cy: number, r: number, i: number) => {
  const out: string[] = []
  out.push(`<path d="${arc(cx, cy, r, START, START + SWEEP)}" stroke="${C.s0}" stroke-width="10" fill="none" stroke-linecap="round"/>`)
  for (let k = 0; k <= 10; k++) {
    const deg = START + (SWEEP * k) / 10
    const [x1, y1] = polar(cx, cy, r + 9, deg)
    const [x2, y2] = polar(cx, cy, r + (k % 5 === 0 ? 16 : 13), deg)
    out.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${k % 5 === 0 ? C.s2 : C.s1}" stroke-width="${k % 5 === 0 ? 1.6 : 1}"/>`)
  }
  if (g.pct !== null && g.pct > 0) {
    const to = START + (SWEEP * Math.min(100, g.pct)) / 100
    const d = arc(cx, cy, r, START, Math.max(START + 1.5, to))
    out.push(`<path d="${d}" stroke="${g.color}" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.22" filter="url(#glow)"/>`)
    out.push(`<path d="${d}" stroke="url(#grad${i})" stroke-width="10" fill="none" stroke-linecap="round"/>`)
  }
  if (g.elapsed !== null) {
    const deg = START + SWEEP * g.elapsed
    const [x1, y1] = polar(cx, cy, r - 9, deg)
    const [x2, y2] = polar(cx, cy, r + 9, deg)
    out.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${C.text}" stroke-width="2.2" stroke-linecap="round"/>`)
  }
  const value = g.pct === null ? '--' : String(Math.round(g.pct))
  out.push(`<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${MONO}" font-size="32" font-weight="700" fill="${C.text}">${value}<tspan font-size="15" fill="${C.sub}" dx="2">${g.pct === null ? '' : '%'}</tspan></text>`)
  out.push(`<text x="${cx}" y="${cy + 28}" text-anchor="middle" font-family="${SANS}" font-size="10.5" font-weight="700" letter-spacing="2.4" fill="${g.color}">${esc(g.label)}</text>`)
  out.push(`<text x="${cx}" y="${cy + r * 0.5 + 30}" text-anchor="middle" font-family="${MONO}" font-size="11.5" fill="${C.sub}">${esc(g.short)}</text>`)
  if (g.pace !== null) {
    out.push(`<text x="${cx}" y="${cy + r * 0.5 + 47}" text-anchor="middle" font-family="${SANS}" font-size="9.5" font-weight="700" letter-spacing="1.6" fill="${PACE_COLOR[g.pace]}">${PACE_WORD[g.pace]}</text>`)
  }
  return out.join('')
}

const flow = (samples: Sample[], x0: number, y0: number, w: number, h: number, nowMs: number) => {
  const out: string[] = []
  for (const v of [0, 50, 100]) {
    const y = y0 + h - (h * v) / 100
    out.push(`<line x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}" stroke="${C.s0}" stroke-width="1" ${v === 0 ? '' : 'stroke-dasharray="3 4"'}/>`)
    out.push(`<text x="${x0 - 8}" y="${y + 3.5}" text-anchor="end" font-family="${MONO}" font-size="9" fill="${C.s2}">${v}</text>`)
  }
  const pts = samples.filter(p => p.t <= nowMs)
  if (pts.length < 2) {
    out.push(`<text x="${x0 + w / 2}" y="${y0 + h / 2 + 4}" text-anchor="middle" font-family="${SANS}" font-size="11.5" fill="${C.over}">collecting… the chart fills in as the session runs</text>`)
    return out.join('')
  }
  const t0 = pts[0]?.t ?? nowMs
  const span = Math.max(60_000, nowMs - t0)
  const xOf = (t: number) => x0 + ((t - t0) / span) * w
  const yOf = (v: number) => y0 + h - (h * Math.min(100, Math.max(0, v))) / 100
  const series: [keyof Sample, string][] = [['d7', C.peach], ['h5', C.blue], ['ctx', C.pink]]
  for (const [key, color] of series) {
    const line = pts.filter(p => p[key] !== null).map(p => [xOf(p.t), yOf(p[key] as number)] as const)
    if (line.length < 2) continue
    const d = line.map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
    if (key === 'ctx') {
      const first = line[0]
      const last = line[line.length - 1]
      if (first && last) out.push(`<path d="${d}L${last[0].toFixed(1)} ${y0 + h}L${first[0].toFixed(1)} ${y0 + h}Z" fill="url(#area)"/>`)
    }
    out.push(`<path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`)
    const end = line[line.length - 1]
    if (end) out.push(`<circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="6" fill="${color}" opacity="0.45" filter="url(#glow)"/><circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="3.2" fill="${color}"/>`)
  }
  const d0 = new Date(t0)
  const d1 = new Date(nowMs)
  out.push(`<text x="${x0}" y="${y0 + h + 15}" font-family="${MONO}" font-size="9" fill="${C.s2}">${pad2(d0.getHours())}:${pad2(d0.getMinutes())}</text>`)
  out.push(`<text x="${x0 + w}" y="${y0 + h + 15}" text-anchor="end" font-family="${MONO}" font-size="9" fill="${C.s2}">now ${pad2(d1.getHours())}:${pad2(d1.getMinutes())}</text>`)
  return out.join('')
}

const section = (y: number, title: string, right = '') =>
  `<text x="24" y="${y}" font-family="${SANS}" font-size="10" font-weight="700" letter-spacing="2.6" fill="${C.over}">${esc(title)}</text>` +
  (right === '' ? '' : `<text x="536" y="${y}" text-anchor="end" font-family="${SANS}" font-size="10" fill="${C.over}">${right}</text>`) +
  `<line x1="24" y1="${y + 8}" x2="536" y2="${y + 8}" stroke="${C.s0}" stroke-width="1"/>`

/** The whole cockpit, for a surface that draws SVG: 560 wide, as tall as it needs. */
export const hudSvg = (v: CockpitView, samples: Sample[], a: Activity, nowMs: number): { source: string; alt: string } => {
  const W = 560
  const body: string[] = []
  let y = 0

  // Header: name, then model and session time on the right.
  const bolt = 'M30 13 L21 30 L28.5 30 L25.5 43 L38 24 L30.5 24 L34 13 Z'
  body.push(`<path d="${bolt}" fill="${C.peach}" opacity="0.6" filter="url(#glow)"/><path d="${bolt}" fill="${C.peach}"/>`)
  body.push(`<text x="46" y="33" font-family="${SANS}" font-size="16" font-weight="800" letter-spacing="4" fill="${C.text}">COCKPIT</text>`)
  const modelLine = [v.model, v.effort, v.isThinking ? 'thinking' : null].filter(Boolean).join(' · ')
  body.push(`<text x="536" y="25" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.teal}">${esc(modelLine)}</text>`)
  body.push(`<text x="536" y="42" text-anchor="end" font-family="${MONO}" font-size="10.5" fill="${C.over}">session ${esc(v.duration)} · ${esc(v.clock)}</text>`)
  y = 58

  if (v.alert !== null) {
    body.push(`<rect x="24" y="${y}" width="512" height="28" rx="8" fill="${C.red}" fill-opacity="0.14" stroke="${C.red}" stroke-opacity="0.55"/>`)
    body.push(`<text x="38" y="${y + 18.5}" font-family="${SANS}" font-size="12" font-weight="600" fill="${C.red}">▲ ${esc(v.alert)}</text>`)
    y += 40
  }

  // Dials.
  const n = v.gauges.length
  const cell = 512 / n
  const r = n >= 3 ? 52 : 58
  const cy = y + r + 22
  v.gauges.forEach((g, i) => body.push(dial(g, 24 + cell * i + cell / 2, cy, r, i)))
  y = cy + r * 0.5 + 72
  if (v.gauges.some(g => g.elapsed !== null)) {
    body.push(`<line x1="${W / 2 - 66}" y1="${y - 4}" x2="${W / 2 - 66}" y2="${y + 6}" stroke="${C.text}" stroke-width="2.2" stroke-linecap="round"/>`)
    body.push(`<text x="${W / 2 - 58}" y="${y + 4.5}" font-family="${SANS}" font-size="10" fill="${C.over}">time gone in the window</text>`)
    y += 26
  }

  // Session flow.
  const legend = [['context', C.pink], ['5h', C.blue], ['7d', C.peach]]
    .map(([name, color]) => `<tspan fill="${color}">●</tspan> ${name}`)
    .join('   ')
  body.push(section(y + 10, 'SESSION FLOW', legend))
  y += 30
  body.push(flow(samples, 52, y, 484, 110, nowMs))
  y += 136

  // Forecast.
  if (v.forecast.length > 0) {
    body.push(section(y + 10, 'FORECAST', 'at the pace so far'))
    y += 32
    for (const f of v.forecast) {
      body.push(`<text x="24" y="${y}" font-family="${SANS}" font-size="10" font-weight="700" letter-spacing="1.8" fill="${f.color}">${esc(f.label)}</text>`)
      body.push(`<text x="96" y="${y}" font-family="${MONO}" font-size="11.5" fill="${C.text}">${esc(f.text)}</text>`)
      y += 20
    }
    y += 6
  }

  // Live tools.
  body.push(section(y + 10, 'LIVE', `${a.calls} tool call${a.calls === 1 ? '' : 's'} this session`))
  y += 32
  if (a.running.length === 0) {
    body.push(`<text x="24" y="${y}" font-family="${MONO}" font-size="11.5" fill="${C.over}">idle: no tool running</text>`)
    y += 22
  } else {
    let x = 24
    for (const run of a.running.slice(-4)) {
      const label = `${run.isAgent ? 'agent · ' : ''}${run.tool} ${countdown((nowMs - run.since) / 1000)}`
      const w = 26 + label.length * 7.2
      if (x + w > 536) break
      body.push(`<rect x="${x}" y="${y - 14}" width="${w.toFixed(1)}" height="21" rx="10.5" fill="${C.teal}" fill-opacity="0.12" stroke="${C.teal}" stroke-opacity="0.5"/>`)
      body.push(`<circle cx="${x + 11}" cy="${y - 3.5}" r="4.5" fill="${C.teal}" opacity="0.5" filter="url(#glow)"/><circle cx="${x + 11}" cy="${y - 3.5}" r="3" fill="${C.teal}"/>`)
      body.push(`<text x="${x + 20}" y="${y}" font-family="${MONO}" font-size="11" fill="${C.teal}">${esc(label)}</text>`)
      x += w + 8
    }
    y += 22
  }
  const top = topTools(a, 6)
  const most = top[0]?.[1] ?? 1
  for (const [name, count] of top) {
    const bw = Math.max(3, (330 * count) / most)
    body.push(`<text x="24" y="${y + 9}" font-family="${MONO}" font-size="11" fill="${C.sub}">${esc(name.length > 16 ? `${name.slice(0, 15)}…` : name)}</text>`)
    body.push(`<rect x="150" y="${y}" width="${bw.toFixed(1)}" height="11" rx="3" fill="url(#bar)"/>`)
    body.push(`<text x="536" y="${y + 9.5}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.text}">${count}</text>`)
    y += 19
  }
  y += 14

  const defs =
    `<defs>` +
    `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>` +
    v.gauges
      .map((g, i) => `<linearGradient id="grad${i}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${g.color}" stop-opacity="0.55"/><stop offset="1" stop-color="${g.color}"/></linearGradient>`)
      .join('') +
    `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.pink}" stop-opacity="0.28"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.teal}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.teal}"/></linearGradient>` +
    `<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="${C.text}" stroke-opacity="0.035"/></pattern>` +
    `</defs>`
  const frame =
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${y - 1}" rx="14" fill="${C.crust}" stroke="${C.s0}"/>` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${y - 1}" rx="14" fill="url(#grid)"/>`
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}">${defs}${frame}${body.join('')}</svg>`

  const alt = [
    `Cockpit: ${modelLine}, session ${v.duration}.`,
    ...v.gauges.map(g => `${g.label} ${g.pct === null ? 'loading' : `${Math.round(g.pct)}%`}, ${g.sub}${g.pace ? `, ${PACE_WORD[g.pace].toLowerCase()}` : ''}.`),
    ...v.forecast.map(f => `${f.label}: ${f.text}.`),
    `${a.calls} tool calls; ${a.running.length === 0 ? 'none running' : `running ${a.running.map(r => r.tool).join(', ')}`}.`,
  ].join(' ')
  return { source, alt }
}

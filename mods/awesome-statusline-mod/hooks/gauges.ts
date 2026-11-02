// The cockpit's figures and drawings, as pure functions of what the session
// reported: a view model (buildView, also the cockpit's "this session" card) and the
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
const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
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
export const clockAt = (epochS: number, nowS: number, lang: 'en' | 'ko' = 'en'): string => {
  const d = new Date(epochS * 1000)
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  if (epochS - nowS < 86_400) return hm
  return lang === 'ko' ? `${DAYS_KO[d.getDay()]}요일 ${hm}` : `${DAYS[d.getDay()]} ${hm}`
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
export const forecastOf = (pct: number, resetsAtS: number, windowS: number, nowS: number, lang: 'en' | 'ko' = 'en'): string | null => {
  const elapsedS = windowS - (resetsAtS - nowS)
  if (elapsedS < 300 || pct <= 0) return null
  const fullAtS = resetsAtS - windowS + (100 * elapsedS) / pct
  if (fullAtS < resetsAtS) {
    return lang === 'ko'
      ? `${clockAt(fullAtS, nowS, lang)}에 100% (${countdown(fullAtS - nowS)} 뒤, 리셋 전)`
      : `100% at ${clockAt(fullAtS, nowS)}, in ${countdown(fullAtS - nowS)}: before it resets`
  }
  const byReset = Math.min(100, Math.round((pct * windowS) / elapsedS))
  return lang === 'ko' ? `${clockAt(resetsAtS, nowS, lang)} 리셋 때 약 ${byReset}%` : `about ${byReset}% by the reset at ${clockAt(resetsAtS, nowS)}`
}

const tokens = (n: number) => (n >= 1_000_000 && n % 1_000_000 === 0 ? `${n / 1_000_000}M` : `${Math.round(n / 1000)}k`)

export const buildView = (s: StatusJson, nowMs: number, lang: 'en' | 'ko' = 'en'): CockpitView => {
  const ko = lang === 'ko'
  const nowS = Math.floor(nowMs / 1000)
  const ctx = s.context_window
  // Before the first request there is no figure yet; the statusline reads that as 0%, and so does this.
  const ctxPct = ctx.used_percentage ?? Math.round(((ctx.current_usage ?? 0) * 100) / ctx.context_window_size)
  const gauges: GaugeView[] = [
    {
      key: 'context',
      label: ko ? '컨텍스트' : 'CONTEXT',
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
    const label = ko ? (kind === 'five_hour' ? '5시간' : '주간') : kind === 'five_hour' ? '5-HOUR' : isUltra ? 'WEEKLY' : '7-DAY'
    const base = kind === 'five_hour' ? C.blue : C.peach
    if (w === undefined) {
      gauges.push({ key: kind, label, pct: null, sub: ko ? '불러오는 중' : 'loading..', short: ko ? '불러오는 중' : 'loading..', elapsed: null, pace: null, color: base })
      continue
    }
    const left = w.resets_at === undefined ? null : w.resets_at - nowS
    const elapsed = left === null ? null : Math.min(1, Math.max(0, 1 - left / (WINDOW_S[kind] ?? 1)))
    const pace = paceOf(w.used_percentage, elapsed)
    let sub = ko ? '새로 시작한 창' : 'fresh window'
    let short = sub
    if (left !== null && w.resets_at !== undefined) {
      short = `${countdown(left)} · ${clockAt(w.resets_at, nowS, lang)}`
      sub = ko ? `${short} 리셋` : `resets in ${short}`
    }
    gauges.push({ key: kind, label, pct: w.used_percentage, sub, short, elapsed, pace, color: w.used_percentage >= 90 ? C.red : base })
    if (w.resets_at !== undefined) {
      let text = forecastOf(w.used_percentage, w.resets_at, WINDOW_S[kind] ?? 1, nowS, lang) ?? (ko ? '아직 판단하기 이릅니다' : 'too early to tell')
      if (isUltra && kind === 'seven_day' && left !== null && left > 0) {
        const budget = left >= 86_400 ? `≈${Math.round(((100 - w.used_percentage) * 86_400) / left)}%/day` : `${100 - w.used_percentage}% left`
        text += ko ? ` · 하루 예산 ${budget}` : ` · budget ${budget}`
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
    alert:
      ctxPct !== null && ctxPct >= 80
        ? ko
          ? `컨텍스트 ${ctxPct}%: 곧 compact하거나 새 세션을 시작하세요`
          : `Context ${ctxPct}%: compact soon, or start a new session`
        : null,
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

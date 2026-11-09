// The cockpit's figures, laid out as 1top's menu bar: two dials (tokens and
// weekly limit per hour), the status strip, the totals, what is left of each
// limit, the model mix, and the sessions. Built from the 1top app's local API
// when it runs on this computer (every AI it tracks), or else from this mod's
// own records (the Claude Code sessions running it). Pure: no `$` here.

import type { FleetRecord, LangChoice, OneTopState, Period, Resources, Section, StatusJson, Theme, View } from '../types'

export type { FleetRecord, LangChoice, OneTopState, Period, Resources, Section, Theme, View }

export const PERIODS: readonly Period[] = ['10m', '30m', '1h', '5h', '12h', '24h']
export const PERIOD_S: Record<Period, number> = { '10m': 600, '30m': 1800, '1h': 3600, '5h': 18_000, '12h': 43_200, '24h': 86_400 }
const BIN_S: Record<Period, number> = { '10m': 20, '30m': 60, '1h': 120, '5h': 600, '12h': 1440, '24h': 2880 }

export const VIEWS: readonly View[] = ['cluster', 'dashboard']
export const SECTIONS: readonly Section[] = ['sessions', 'flow', 'limits', 'map', 'heat', 'resources', 'session']

export type Lang = 'ko' | 'en'

export const TEXT = {
  ko: {
    title: '콕핏',
    live1top: '실시간 · 이 Mac',
    liveLocal: '이 컴퓨터',
    periods: { '10m': '10분', '30m': '30분', '1h': '1시간', '5h': '5시간', '12h': '12시간', '24h': '24시간' },
    recent: { '10m': '최근 10분', '30m': '최근 30분', '1h': '최근 1시간', '5h': '최근 5시간', '12h': '최근 12시간', '24h': '최근 24시간' },
    views: { cluster: '계기판', dashboard: '대시보드' },
    sections: { sessions: '세션', flow: '토큰 흐름', limits: '한도', map: '사용량 맵', heat: '히트맵', resources: '리소스', session: '이 세션' },
    tokensPerHour: 'tokens/시간',
    pctPerHour: '%/시간',
    perHour: '/시간',
    strip: { live: '실시간', working: '작업 중', waiting: '응답 대기', done: '완료됨', relogin: '재로그인', low: '한도 부족' },
    total: '합계',
    trip: '트립',
    since: '부터',
    reset: '리셋',
    left: '남은 한도',
    tokenUse: '토큰 사용',
    average: '평균',
    byModel: '모델별',
    otherModels: (n: number) => `기타 모델 ${n}개`,
    limits: '계정 한도',
    perAccount: '계정별 100%',
    cpu: 'CPU',
    memory: '메모리',
    network: '네트워크',
    disk: '디스크 여유',
    sessionsTitle: '세션',
    working: '작업 중',
    weeklyUse: '주간 한도 사용량',
    children: (n: number) => `하위 ${n}`,
    weekly: '주간',
    fiveHour: '5시간',
    idle: '대기',
    tokens: 'tokens',
    others: '기타',
    noSessions: '선택 기간에 사용한 세션이 없습니다',
    noFlow: '선택 기간에 기록된 토큰이 없습니다',
    compact: '지금 compact',
    compactHint: '대화를 요약해 컨텍스트를 비웁니다',
    toolCalls: (n: number) => `도구 ${n}회`,
    resets: '리셋',
    hours: '시',
  },
  en: {
    title: 'Cockpit',
    live1top: 'Live · this Mac',
    liveLocal: 'This computer',
    periods: { '10m': '10m', '30m': '30m', '1h': '1h', '5h': '5h', '12h': '12h', '24h': '24h' },
    recent: { '10m': 'last 10 min', '30m': 'last 30 min', '1h': 'last hour', '5h': 'last 5 hours', '12h': 'last 12 hours', '24h': 'last 24 hours' },
    views: { cluster: 'Cluster', dashboard: 'Dashboard' },
    sections: { sessions: 'Sessions', flow: 'Token flow', limits: 'Limits', map: 'Usage map', heat: 'Heatmap', resources: 'Resources', session: 'This session' },
    tokensPerHour: 'tokens/h',
    pctPerHour: '%/h',
    perHour: '/h',
    strip: { live: 'Live', working: 'Working', waiting: 'Waiting', done: 'Done', relogin: 'Sign in', low: 'Low limit' },
    total: 'Total',
    trip: 'Trip',
    since: 'since',
    reset: 'Reset',
    left: 'Limit left',
    tokenUse: 'Token use',
    average: 'avg',
    byModel: 'By model',
    otherModels: (n: number) => `${n} other model${n === 1 ? '' : 's'}`,
    limits: 'Account limits',
    perAccount: '100% each',
    cpu: 'CPU',
    memory: 'Memory',
    network: 'Network',
    disk: 'Disk free',
    sessionsTitle: 'Sessions',
    working: 'working',
    weeklyUse: 'weekly limit used',
    children: (n: number) => `${n} sub`,
    weekly: 'Weekly',
    fiveHour: '5h',
    idle: 'idle',
    tokens: 'tokens',
    others: 'Other',
    noSessions: 'No session used tokens in this period',
    noFlow: 'No tokens recorded in this period',
    compact: 'Compact now',
    compactHint: 'summarizes the conversation to free context',
    toolCalls: (n: number) => `${n} tool call${n === 1 ? '' : 's'}`,
    resets: 'resets',
    hours: 'h',
  },
} as const

export type Texts = (typeof TEXT)[Lang]

/** The person's pick, else 'Korean' in Claude Code's `language` setting or a ko locale. */
export const langOf = (choice: LangChoice, settingsLanguage: unknown, locale: string | null): Lang => {
  if (choice !== 'auto') return choice
  return (typeof settingsLanguage === 'string' && /ko|korean|한국/i.test(settingsLanguage)) || /^ko/i.test(locale ?? '') ? 'ko' : 'en'
}

// ---------------------------------------------------------------- the model

/** One account: its main window's % (weekly where it has one), the other in `sub`. */
export type Meter = {
  id: string
  title: string
  /** 1, 2… among the accounts of its kind. */
  index: number
  kind: string
  plan: string
  window: string
  sub: string
  pct: number | null
  /** Weekly percentage points per hour over the period, where 1top calibrates them. */
  rate: number | null
  spark: number[]
}

export type FlowBin = { t: number; byKind: Record<string, number> }

export type Tile = { label: string; tokens: number; kind: string }

export type ModelShare = { name: string; kind: string; tokens: number }

export type SessionRow = {
  id: string
  title: string
  project: string
  children: number
  app: string
  status: 'working' | 'idle' | 'waiting' | 'other'
  kind: string
  /** Its account's number among those of its kind, where known. */
  account: number | null
  model: string
  effort: string | null
  tokens: number
  /** Weekly percentage points used in the period, where 1top calibrates it. */
  share: number | null
  sharePerHour: number | null
  tokensPerHour: number
}

export type Counts = { working: number; waiting: number; done: number; relogin: number; low: number }

export type Dash = {
  source: '1top' | 'local'
  resources: Resources | null
  accounts: Meter[]
  flow: FlowBin[]
  kinds: string[]
  flowTotal: number
  /** The dials: tokens per hour over the period, and weekly limit points per hour. */
  tokensPerHour: number
  pctPerHour: number | null
  counts: Counts
  models: ModelShare[]
  tiles: Tile[]
  sessions: SessionRow[]
  /** Every session in the period, for the list's header. */
  sessionCount: number
}

export const KIND_NAME: Record<string, string> = {
  Claude: 'Claude Code',
  Codex: 'Codex',
  GLM: 'GLM',
  Antigravity: 'Agy CLI',
  Aside: 'Aside',
}
export const KIND_SHORT: Record<string, string> = { Claude: 'Claude', Codex: 'Codex', GLM: 'GLM', Antigravity: 'Agy' }
const KIND_ORDER = ['Claude', 'Codex', 'GLM', 'Antigravity']
const kindRank = (k: string) => (KIND_ORDER.includes(k) ? KIND_ORDER.indexOf(k) : KIND_ORDER.length)

/** "claude-opus-5-5[1m]" -> "Opus 5.5"; "gpt-6-astra" as given. */
export const modelName = (id: string): string => {
  const bare = id.replace(/\[[^\]]*\]$/, '')
  const m = bare.match(/(opus|sonnet|haiku|fable|mythos)(?:-(\d{1,2})(?:-(\d{1,2}))?)?(?![\d])/i)
  if (m === null) return bare
  const family = (m[1] ?? '').charAt(0).toUpperCase() + (m[1] ?? '').slice(1).toLowerCase()
  if (m[2] === undefined) return family
  return m[3] === undefined ? `${family} ${m[2]}` : `${family} ${m[2]}.${m[3]}`
}

export const planName = (plan: string | undefined) => (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : '')
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)

/** Bins of the period ending now, oldest first. */
const emptyBins = (nowS: number, period: Period): FlowBin[] => {
  const binS = BIN_S[period]
  const end = Math.floor(nowS / binS) * binS
  const n = Math.ceil(PERIOD_S[period] / binS)
  return Array.from({ length: n }, (_, i) => ({ t: end - (n - 1 - i) * binS, byKind: {} }))
}

const addToBins = (bins: FlowBin[], period: Period, t: number, kind: string, tokens: number) => {
  const first = bins[0]
  if (first === undefined || tokens <= 0) return
  const bin = bins[Math.floor((t - first.t) / BIN_S[period])]
  if (bin !== undefined) bin.byKind[kind] = (bin.byKind[kind] ?? 0) + tokens
}

const kindsOf = (bins: FlowBin[]) => {
  const totals: Record<string, number> = {}
  for (const b of bins) for (const [k, v] of Object.entries(b.byKind)) totals[k] = (totals[k] ?? 0) + v
  return Object.keys(totals).sort((a, b) => kindRank(a) - kindRank(b) || (totals[b] ?? 0) - (totals[a] ?? 0))
}

/** The largest few, the rest as one "other" tile. */
const tilesOf = (byLabel: Map<string, { tokens: number; kind: string }>, others: string): Tile[] => {
  const all = [...byLabel.entries()].map(([label, v]) => ({ label, ...v })).filter(t => t.tokens > 0)
  all.sort((a, b) => b.tokens - a.tokens)
  const head = all.slice(0, 4)
  const rest = all.slice(4)
  if (rest.length > 0) head.push({ label: others, tokens: sum(rest.map(t => t.tokens)), kind: '' })
  return head
}

const modelsOf = (rows: { model: string; kind: string; tokens: number }[]): ModelShare[] => {
  const by = new Map<string, ModelShare>()
  for (const r of rows) {
    if (r.tokens <= 0 || r.model === '') continue
    const m = by.get(r.model) ?? { name: r.model, kind: r.kind, tokens: 0 }
    m.tokens += r.tokens
    by.set(r.model, m)
  }
  return [...by.values()].sort((a, b) => b.tokens - a.tokens)
}

const countsOf = (sessions: SessionRow[], accounts: Meter[], relogin: number): Counts => ({
  working: sessions.filter(s => s.status === 'working').length,
  waiting: sessions.filter(s => s.status === 'waiting').length,
  done: sessions.filter(s => s.status === 'idle' && s.tokens > 0).length,
  relogin,
  low: accounts.filter(m => (m.pct ?? 0) >= 90).length,
})

// ---------------------------------------------------------------- from 1top

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const obj = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/**
 * Keeps what the cockpit reads of 1top's `GET /api/state`, in a small shape:
 * never its `action_token` (the key for 1top's write routes), no paths or
 * account labels.
 */
export const trimOneTop = (raw: unknown, nowS = Date.now() / 1000): OneTopState => {
  const d = obj(raw)
  const host = obj(obj(d.system).host)
  const spark: Record<string, number[]> = {}
  for (const acc of arr(obj(d.weekly_usage).accounts)) {
    const o = obj(acc)
    const points = arr(o.history)
      .map(p => arr(p))
      .filter(p => (num(p[0]) ?? 0) > nowS - 86_400)
      .map(p => num(p[1]) ?? 0)
    const step = Math.max(1, Math.floor(points.length / 24))
    spark[str(o.id)] = points.filter((_, i) => i % step === 0).slice(-24)
  }
  return {
    account_quotas: arr(d.account_quotas).map(a => {
      const o = obj(a)
      return {
        id: str(o.id),
        kind: str(o.kind),
        plan: str(o.plan),
        status: str(o.status),
        stale: o.stale === true,
        windows: arr(o.windows).map(w => {
          const x = obj(w)
          return { label: str(x.label), pct: num(x.pct), ...(typeof x.period === 'string' ? { period: x.period } : {}) }
        }),
      }
    }),
    root_sessions: arr(d.root_sessions).map(r => {
      const o = obj(r)
      const usage = obj(o.usage)
      const tokens: Record<string, number> = {}
      for (const [k, v] of Object.entries(obj(usage.windows))) tokens[k] = sum(arr(v).map(x => num(x) ?? 0))
      const used: Record<string, number> = {}
      for (const [k, v] of Object.entries(obj(usage.weekly_estimate))) {
        const pp = num(obj(v).used_pp)
        if (pp !== null) used[k] = pp
      }
      return {
        id: str(o.id),
        kind: str(o.kind),
        project: str(o.project),
        title: str(o.title),
        account: str(usage.weekly_account),
        status: str(o.status),
        isWaiting: o.waiting_for !== null && o.waiting_for !== undefined && o.waiting_for !== '',
        model: str(o.model),
        effort: typeof o.effort === 'string' ? o.effort : null,
        children_count: num(o.children_count) ?? 0,
        app: str(obj(o.location).app),
        tokens,
        used_pp: used,
      }
    }),
    events: arr(d.events).flatMap(ev => {
      const o = obj(ev)
      const t = num(o.t)
      if (t === null) return []
      const n = (num(o.fresh) ?? 0) + (num(o.cached) ?? 0) + (num(o.written) ?? 0) + (num(o.output) ?? 0)
      return n > 0 ? [[t, str(o.kind), n] as [number, string, number]] : []
    }),
    host:
      Object.keys(host).length === 0
        ? null
        : {
            cpu: num(host.cpu),
            mem: num(obj(host.memory).percent),
            rx: num(obj(host.network).rx),
            tx: num(obj(host.network).tx),
            diskFree: num(obj(host.disk).free),
          },
    spark,
  }
}

const isWeekly = (w: { label: string; period?: string }) => w.label === '주간' || w.period === 'weekly'
const isFiveHour = (w: { label: string; period?: string }) => w.label === '5H' || w.period === '5h'

export const fromOneTop = (st: OneTopState, period: Period, nowS: number, t: Texts): Dash => {
  const hours = PERIOD_S[period] / 3600

  // Sessions first: an account's rate is its sessions' summed.
  const byProject = new Map<string, { tokens: number; kind: string }>()
  const all: (SessionRow & { accountId: string })[] = []
  for (const s of st.root_sessions) {
    const tokens = s.tokens[period] ?? 0
    const project = s.project || KIND_NAME[s.kind] || s.kind || '?'
    if (tokens > 0) {
      const p = byProject.get(project) ?? { tokens: 0, kind: s.kind }
      p.tokens += tokens
      byProject.set(project, p)
    }
    const status = s.isWaiting ? 'waiting' : s.status === 'working' || s.status === 'idle' ? s.status : 'other'
    if (tokens <= 0 && status !== 'working' && status !== 'waiting') continue
    const share = s.used_pp[period]
    all.push({
      id: s.id || project,
      title: s.title || project,
      project,
      children: s.children_count,
      app: s.app,
      status,
      kind: s.kind,
      account: null,
      accountId: s.account,
      model: s.model ? modelName(s.model) : '',
      effort: s.effort,
      tokens,
      share: share ?? null,
      sharePerHour: share === undefined ? null : share / hours,
      tokensPerHour: tokens / hours,
    })
  }

  const accounts: Meter[] = []
  const perKind: Record<string, number> = {}
  for (const a of st.account_quotas) {
    if (a.stale || a.kind === '') continue
    const windows = a.windows.filter(w => w.pct !== null)
    const weekly = windows.find(isWeekly)
    const five = windows.find(isFiveHour)
    const main = weekly ?? five ?? windows[0]
    if (main === undefined) continue
    perKind[a.kind] = (perKind[a.kind] ?? 0) + 1
    const rates = all.filter(s => s.accountId === a.id && s.sharePerHour !== null).map(s => s.sharePerHour ?? 0)
    const window = main === weekly ? t.weekly : main === five ? t.fiveHour : main.label
    accounts.push({
      id: a.id,
      title: KIND_NAME[a.kind] ?? a.kind,
      index: perKind[a.kind] ?? 1,
      kind: a.kind,
      plan: planName(a.plan),
      window,
      sub: [planName(a.plan), window, weekly !== undefined && five !== undefined ? `5H ${Math.round(five.pct ?? 0)}%` : ''].filter(Boolean).join(' · '),
      pct: main.pct,
      rate: rates.length === 0 ? null : sum(rates),
      spark: st.spark[a.id] ?? [],
    })
  }
  accounts.sort((x, y) => kindRank(x.kind) - kindRank(y.kind) || x.index - y.index)
  const shown = accounts.filter(m => m.kind === 'Claude' || m.kind === 'Codex' || (m.pct ?? 0) > 0).slice(0, 6)
  const indexOf = new Map(accounts.map(m => [m.id, m.index]))
  const sessions: SessionRow[] = all.map(({ accountId, ...s }) => ({ ...s, account: indexOf.get(accountId) ?? null }))
  sessions.sort((a, b) => (b.share ?? -1) - (a.share ?? -1) || b.tokens - a.tokens)

  const bins = emptyBins(nowS, period)
  for (const [time, kind, n] of st.events) addToBins(bins, period, time, kind, n)
  const flowTotal = sum(bins.flatMap(b => Object.values(b.byKind)))
  const rates = sessions.map(s => s.sharePerHour).filter((x): x is number => x !== null)

  return {
    source: '1top',
    resources: st.host,
    accounts: shown,
    flow: bins,
    kinds: kindsOf(bins),
    flowTotal,
    tokensPerHour: flowTotal / hours,
    pctPerHour: rates.length === 0 ? null : sum(rates),
    counts: countsOf(sessions, accounts, st.account_quotas.filter(a => /login|auth|expired/i.test(a.status)).length),
    models: modelsOf(sessions),
    tiles: tilesOf(byProject, t.others),
    sessions: sessions.slice(0, 8),
    sessionCount: sessions.length,
  }
}

// ---------------------------------------------------------------- local

/** A record older than this is a session that ended. */
export const LIVE_S = 180

export const fromLocal = (
  status: StatusJson | null,
  fleet: readonly FleetRecord[],
  resources: Resources | null,
  period: Period,
  nowS: number,
  t: Texts,
  /** Weekly limit points per hour over the period, from this session's samples. */
  pctPerHour: number | null = null,
): Dash => {
  const hours = PERIOD_S[period] / 3600
  const accounts: Meter[] = []
  const limits = status?.rate_limits
  const five = limits?.five_hour
  const week = limits?.seven_day
  const main = week ?? five
  if (main !== undefined) {
    accounts.push({
      id: 'claude',
      title: 'Claude Code',
      index: 1,
      kind: 'Claude',
      plan: '',
      window: week !== undefined ? t.weekly : t.fiveHour,
      sub: [week !== undefined ? t.weekly : t.fiveHour, week !== undefined && five !== undefined ? `5H ${Math.round(five.used_percentage)}%` : ''].filter(Boolean).join(' · '),
      pct: main.used_percentage,
      rate: pctPerHour,
      spark: [],
    })
  }

  const bins = emptyBins(nowS, period)
  const from = nowS - PERIOD_S[period]
  const byProject = new Map<string, { tokens: number; kind: string }>()
  const sessions: SessionRow[] = []
  for (const r of fleet) {
    let tokens = 0
    for (const [m, n] of r.bins) {
      if (m < from) continue
      tokens += n
      addToBins(bins, period, m, 'Claude', n)
    }
    if (tokens > 0) {
      const p = byProject.get(r.project) ?? { tokens: 0, kind: 'Claude' }
      p.tokens += tokens
      byProject.set(r.project, p)
    }
    const isLive = nowS - r.updatedS <= LIVE_S
    if (!isLive && tokens <= 0) continue
    sessions.push({
      id: r.id,
      title: r.project,
      project: r.project,
      children: r.children,
      app: r.app,
      status: isLive ? r.status : 'other',
      kind: 'Claude',
      account: 1,
      model: r.model,
      effort: r.effort,
      tokens,
      share: null,
      sharePerHour: null,
      tokensPerHour: tokens / hours,
    })
  }
  sessions.sort((a, b) => b.tokens - a.tokens)
  const flowTotal = sum(bins.flatMap(b => Object.values(b.byKind)))

  return {
    source: 'local',
    resources,
    accounts,
    flow: bins,
    kinds: kindsOf(bins),
    flowTotal,
    tokensPerHour: flowTotal / hours,
    pctPerHour,
    counts: countsOf(sessions, accounts, 0),
    models: modelsOf(sessions),
    tiles: tilesOf(byProject, t.others),
    sessions: sessions.slice(0, 8),
    sessionCount: sessions.length,
  }
}

/** Adds `tokens` to the record's minute bin, dropping minutes past a day. */
export const addTokens = (bins: [number, number][], nowS: number, tokens: number): [number, number][] => {
  const minute = Math.floor(nowS / 60) * 60
  const kept = bins.filter(([m]) => m > nowS - 86_400)
  const last = kept[kept.length - 1]
  if (last !== undefined && last[0] === minute) return [...kept.slice(0, -1), [minute, last[1] + tokens]]
  return [...kept, [minute, tokens]]
}

/** The weekly limit's points per hour over the period, from (time ms, % used) samples. */
export const pctRate = (samples: readonly { t: number; d7: number | null }[], period: Period, nowMs: number): number | null => {
  const from = nowMs - PERIOD_S[period] * 1000
  const pts = samples.filter(s => s.t >= from && s.d7 !== null)
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (first === undefined || last === undefined || last.t - first.t < 60_000) return null
  const rise = (last.d7 ?? 0) - (first.d7 ?? 0)
  return rise < 0 ? null : (rise * 3_600_000) / (last.t - first.t)
}

/** The trip counter moved on by the minutes finished since it last counted. */
export const advanceTrip = (
  trip: { since: number; total: number; lastT: number },
  minutes: readonly (readonly [number, number])[],
  nowS: number,
): { since: number; total: number; lastT: number } => {
  const done = Math.floor(nowS / 60) * 60 // the minute still filling waits
  let total = trip.total
  for (const [t, n] of minutes) if (t >= trip.lastT && t < done && t >= trip.since) total += n
  return { since: trip.since, total, lastT: Math.max(trip.lastT, done) }
}

// ---------------------------------------------------------------- heatmap

/** Tokens of the last day: 6 rows of 10 minutes by 24 columns of an hour, oldest column first. */
export const heatGrid = (minutes: readonly (readonly [number, number])[], nowS: number): number[][] => {
  const grid = Array.from({ length: 6 }, () => Array.from({ length: 24 }, () => 0))
  const start = Math.floor(nowS / 3600) * 3600 - 23 * 3600
  for (const [t, n] of minutes) {
    if (t < start) continue
    const col = Math.floor((t - start) / 3600)
    const row = Math.floor(((t - start) % 3600) / 600)
    const line = grid[row]
    if (line !== undefined && col < 24) line[col] = (line[col] ?? 0) + n
  }
  return grid
}

// ---------------------------------------------------------------- numbers

/** 128_400_000 -> "128.4M", 23_600 -> "23.6K", 512 -> "512". */
export const compactNumber = (n: number): string => {
  const a = Math.abs(n)
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(Math.round(n))
}

/** Bytes per second: "23.6 KB/s". */
export const rate = (bps: number): string => {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} KB/s`
  return `${Math.round(bps)} B/s`
}

/** Bytes: "44.6 GB". */
export const size = (b: number): string => {
  if (b >= 1e12) return `${(b / 1e12).toFixed(1)} TB`
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  return `${(b / 1e6).toFixed(0)} MB`
}

/** A share as 1top prints it: "≈1%", "≈0.2%", "<0.1%", "0%", "—". */
export const shareText = (pp: number | null): string => {
  if (pp === null) return '—'
  if (pp <= 0) return '0%'
  if (pp < 0.1) return '<0.1%'
  return pp >= 1 ? `≈${Math.round(pp)}%` : `≈${pp.toFixed(1)}%`
}

// ---------------------------------------------------------------- treemap

export type Rect = { x: number; y: number; w: number; h: number }

/** Splits `rect` by the tiles' tokens: halves of about equal weight, along the longer side. */
export const treemap = (tiles: readonly Tile[], rect: Rect): (Tile & Rect)[] => {
  if (tiles.length === 0) return []
  const [only] = tiles
  if (tiles.length === 1 && only !== undefined) return [{ ...only, ...rect }]
  const total = sum(tiles.map(t => t.tokens))
  let acc = 0
  let cut = 1
  for (let i = 0; i < tiles.length - 1; i++) {
    acc += tiles[i]?.tokens ?? 0
    cut = i + 1
    if (acc >= total / 2) break
  }
  const a = tiles.slice(0, cut)
  const b = tiles.slice(cut)
  const share = total === 0 ? 0.5 : sum(a.map(t => t.tokens)) / total
  if (rect.w >= rect.h) {
    const w = rect.w * share
    return [...treemap(a, { ...rect, w }), ...treemap(b, { x: rect.x + w, y: rect.y, w: rect.w - w, h: rect.h })]
  }
  const h = rect.h * share
  return [...treemap(a, { ...rect, h }), ...treemap(b, { x: rect.x, y: rect.y + h, w: rect.w, h: rect.h - h })]
}

// ---------------------------------------------------------------- resources (without 1top)

/**
 * macOS `ps -A -o %cpu=`: every process's share of one core, summed, over the
 * cores, as % busy. Fast where `top` takes seconds on a busy machine.
 */
export const cpuFromPs = (out: string, cores: number): number | null => {
  if (!(cores > 0)) return null
  const shares = out.split('\n').map(s => s.trim()).filter(Boolean).map(Number).filter(n => Number.isFinite(n))
  if (shares.length === 0) return null
  return Math.round(Math.min(100, sum(shares) / cores) * 10) / 10
}

/** macOS `memory_pressure`: "System-wide memory free percentage: 23%", as % used. */
export const memFromPressure = (out: string): number | null => {
  const m = out.match(/free percentage:\s*([\d.]+)%/)
  return m?.[1] === undefined ? null : 100 - Number(m[1])
}

/** Linux /proc/meminfo, as % used. */
export const memFromMeminfo = (out: string): number | null => {
  const total = Number(out.match(/MemTotal:\s+(\d+)/)?.[1])
  const avail = Number(out.match(/MemAvailable:\s+(\d+)/)?.[1])
  return total > 0 && Number.isFinite(avail) ? Math.round(((total - avail) * 1000) / total) / 10 : null
}

/** `df -k /`: the available column, in bytes. */
export const diskFromDf = (out: string): number | null => {
  const row = out.trim().split('\n')[1]?.trim().split(/\s+/)
  const kb = Number(row?.[3])
  return Number.isFinite(kb) ? kb * 1024 : null
}

/** Bytes in and out over every interface but the loopback: macOS `netstat -ibn`, or Linux /proc/net/dev. */
export const netBytes = (out: string): { rx: number; tx: number } | null => {
  let rx = 0
  let tx = 0
  let seen = false
  const lines = out.trim().split('\n')
  if (/Ibytes/.test(lines[0] ?? '')) {
    const head = (lines[0] ?? '').trim().split(/\s+/)
    const iIn = head.indexOf('Ibytes')
    const iOut = head.indexOf('Obytes')
    for (const line of lines.slice(1)) {
      const cols = line.trim().split(/\s+/)
      if (!/^<Link#/.test(cols[2] ?? '') || (cols[0] ?? '').startsWith('lo')) continue
      const k = cols.length - head.length // a row without an address column
      rx += Number(cols[iIn + k]) || 0
      tx += Number(cols[iOut + k]) || 0
      seen = true
    }
  } else {
    for (const line of lines) {
      const m = line.match(/^\s*([^:\s]+):\s*(.*)$/)
      if (m === null || (m[1] ?? '').startsWith('lo')) continue
      const cols = (m[2] ?? '').trim().split(/\s+/)
      rx += Number(cols[0]) || 0
      tx += Number(cols[8]) || 0
      seen = true
    }
  }
  return seen ? { rx, tx } : null
}

/** Linux /proc/stat's first line: [busy, total] jiffies, for a delta between two reads. */
export const cpuTicks = (out: string): [number, number] | null => {
  const cols = out.split('\n')[0]?.trim().split(/\s+/).slice(1).map(Number) ?? []
  if (cols.length < 4 || cols.some(n => !Number.isFinite(n))) return null
  const total = sum(cols)
  const idle = (cols[3] ?? 0) + (cols[4] ?? 0)
  return [total - idle, total]
}

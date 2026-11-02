// The values this mod keeps in $.state (the session's), so a hot reload keeps them.

/** The renderer's last output (ANSI text), or why there is none. */
export type Snapshot = { output: string | null; error: string | null }

/** What only the turn's own events tell: the model and effort of the last request. */
export type Live = { model: string | null; effort: string | null }

/** One usage window, as the statusLine JSON has it (resets_at: epoch seconds). */
export type RateWindow = { used_percentage: number; resets_at?: number }

/** The statusLine-shaped JSON the band last rendered from; the cockpit reads it too. */
export type StatusJson = {
  session_id: string
  cwd: string
  model: { id: string; display_name: string }
  workspace: { current_dir: string; project_dir: string }
  version: string
  output_style: { name: string }
  effort?: { level: string }
  thinking: { enabled: boolean }
  cost: { total_cost_usd: number; total_duration_ms: number }
  context_window: {
    context_window_size: number
    used_percentage?: number
    remaining_percentage?: number
    current_usage?: number
  }
  rate_limits?: Record<string, RateWindow>
}

/** One point of the cockpit's session-flow chart (t: ms; the rest: % used). */
export type Sample = { t: number; ctx: number | null; h5: number | null; d7: number | null }

/** A tool call that is running now. */
export type Running = { id: string; tool: string; since: number; isAgent: boolean }

/** The session's tool calls: those running, and how many of each finished. */
export type Activity = { running: Running[]; counts: Record<string, number>; calls: number }

/** The cockpit's period, view, theme and lower section, as 1top's menu bar has them. */
export type Period = '10m' | '30m' | '1h' | '5h' | '12h' | '24h'
export type View = 'cluster' | 'dashboard'
export type Theme = 'dark' | 'light'
export type Section = 'sessions' | 'flow' | 'limits' | 'map' | 'heat' | 'resources' | 'session'
export type LangChoice = 'auto' | 'ko' | 'en'

/** The trip counter: tokens since `since` (epoch s), counted up to `lastT`. */
export type Trip = { since: number; total: number; lastT: number }

/** CPU and memory in %, network in bytes/s, free disk in bytes. */
export type Resources = { cpu: number | null; mem: number | null; rx: number | null; tx: number | null; diskFree: number | null }

/** What each Claude Code session running this mod writes about itself, for the others' cockpits. */
export type FleetRecord = {
  v: 1
  id: string
  project: string
  app: string
  model: string
  effort: string | null
  status: 'working' | 'idle'
  children: number
  updatedS: number
  /** [minute (epoch s), tokens] for the last 24 hours, oldest first. */
  bins: [number, number][]
}

/** The part of the 1top app's local `GET /api/state` the cockpit keeps (never its action token). */
export type OneTopState = {
  account_quotas: {
    id: string
    kind: string
    plan: string
    status: string
    windows: { label: string; pct: number | null; period?: string }[]
    stale: boolean
  }[]
  root_sessions: {
    id: string
    kind: string
    project: string
    title: string
    /** The account (an `account_quotas` id) its use counts against. */
    account: string
    status: string
    isWaiting: boolean
    model: string
    effort: string | null
    children_count: number
    app: string
    /** Tokens per period key ('1h', ...), all four kinds summed. */
    tokens: Record<string, number>
    /** Weekly percentage points per period key, where 1top calibrates them. */
    used_pp: Record<string, number>
  }[]
  /** One-minute bins: [epoch s, kind, tokens]. */
  events: [number, string, number][]
  host: Resources | null
  /** Each account's weekly use over the last day, a few points, oldest first. */
  spark: Record<string, number[]>
}

declare module 'claude-code' {
  interface PluginState {
    'awesome-statusline-mod': {
      snapshot: Snapshot
      live: Live
      hasStatusLine: boolean
      /** When this process first saw the session (ms), so a resumed one counts from its relaunch. */
      since: number | null
      status: StatusJson | null
      history: Sample[]
      activity: Activity
      /** Whether a surface draws the cockpit pane now; the band steps aside while it does. */
      cockpitShown: boolean
      cockpitView: View
      cockpitPeriod: Period
      cockpitTheme: Theme
      cockpitSection: Section
      cockpitLang: LangChoice
      trip: Trip | null
      /** The 1top app's last state, or null where it doesn't run. */
      oneTop: OneTopState | null
      /** Without 1top: this computer's resources, the sessions running this mod. */
      resources: Resources | null
      fleet: FleetRecord[]
      /** This session's tokens per minute, and whether a turn is running. */
      tokenBins: [number, number][]
      isWorking: boolean
    }
  }
}

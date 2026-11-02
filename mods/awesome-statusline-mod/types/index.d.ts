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
    }
  }
}

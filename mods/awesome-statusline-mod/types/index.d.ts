// The values this mod keeps in $.state (the session's), so a hot reload keeps them.

/** The renderer's last output (ANSI text), or why there is none. */
export type Snapshot = { output: string | null; error: string | null }

/** What only the turn's own events tell: the model and effort of the last request. */
export type Live = { model: string | null; effort: string | null }

declare module 'claude-code' {
  interface PluginState {
    'awesome-statusline-mod': {
      snapshot: Snapshot
      live: Live
      hasStatusLine: boolean
      /** When this process first saw the session (ms), so a resumed one counts from its relaunch. */
      since: number | null
    }
  }
}

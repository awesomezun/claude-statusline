// Awesome Statusline as a mod (beta).
//
// Runs the same renderer the statusLine uses (awesome-statusline.sh) on a
// statusline-shaped JSON built from what the session reports, and draws its
// output in the band above the prompt. That band is drawn in the terminal and
// in the Claude desktop app, which has no statusLine of its own.
//
// In the terminal the band stays hidden while a statusLine is set (option
// `terminal`: auto), so a person with the classic statusline never sees it twice.
// On every surface it steps aside while the cockpit pane is drawn.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CacheStats, Live, PromptCache, Snapshot, StatusJson } from '../types'
import { parseAnsi } from './ansi'
import { countTokens, isCockpitShown, markWorking, publishStatus, refreshCockpit, registerCockpit, startCockpit, syncCockpit } from './cockpit'

const snapshot = atom({ plugin: 'awesome-statusline-mod', key: 'snapshot' } as const, { output: null, error: null } as Snapshot)
const live = atom({ plugin: 'awesome-statusline-mod', key: 'live' } as const, { model: null, effort: null } as Live)
const hasStatusLine = atom({ plugin: 'awesome-statusline-mod', key: 'hasStatusLine' } as const, false)
const since = atom({ plugin: 'awesome-statusline-mod', key: 'since' } as const, null as number | null)

export const NO_CACHE: CacheStats = {
  startedAt: null,
  requests: 0,
  read: 0,
  input: 0,
  written: 0,
  observed: false,
  lastAt: null,
  lastCached: false,
  ttlS: 300,
  lastInput: 0,
}
const cache = atom({ plugin: 'awesome-statusline-mod', key: 'cache' } as const, NO_CACHE)

const PRESETS = new Set(
  ['xsmall', 'small', 'medium', 'large', 'xlarge'].flatMap(size => [size, `${size}-plain`, `${size}-simple`]),
)

// Re-render at least this often (reset countdowns, git status), and within a
// second of anything the session reports.
const REFRESH_MS = 15_000
const TICK_MS = 1_000

// The card the desktop app draws the lines on: Catppuccin Mocha's base, the
// palette the renderer's colours are picked for, so it reads on a light theme too.
const CARD = '#1e1e2e'
// About as many columns as the desktop app's card holds: the renderer takes the
// shorter forms of its cache and free reset figures below 100.
const DESKTOP_COLUMNS = 80

// "claude-fable-5-2" -> "Fable 5.2"; an alias ("opus") or an unknown id as given.
export const prettyModel = (id: string): string => {
  const bare = id.replace(/\[[^\]]*\]$/, '')
  const m = bare.match(/(opus|sonnet|haiku|fable|mythos)(?:-(\d{1,2})(?:-(\d{1,2}))?)?(?![\d])/i)
  if (m === null) return bare
  const family = (m[1] ?? '').charAt(0).toUpperCase() + (m[1] ?? '').slice(1).toLowerCase()
  if (m[2] === undefined) return family
  return m[3] === undefined ? `${family} ${m[2]}` : `${family} ${m[2]}.${m[3]}`
}

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

/**
 * Adds one main-loop request's usage (the API's: cache reads, writes and their
 * TTLs) to the session's cache figures; a new `startedAt` (/clear) starts them over.
 */
export const addCacheUsage = (stats: CacheStats, usage: unknown, nowMs: number, startedAt: number): CacheStats => {
  const base = stats.startedAt === startedAt ? stats : { ...NO_CACHE, startedAt }
  const u = (usage ?? {}) as Record<string, unknown>
  const read = count(u.cache_read_input_tokens)
  const written = count(u.cache_creation_input_tokens)
  const input = count(u.input_tokens) + read + written
  if (input === 0) return base
  const byTtl = (u.cache_creation ?? {}) as Record<string, unknown>
  const ttlS = count(byTtl.ephemeral_1h_input_tokens) > 0 ? 3600 : count(byTtl.ephemeral_5m_input_tokens) > 0 ? 300 : base.ttlS
  const cached = read + written > 0
  return {
    startedAt,
    requests: base.requests + 1,
    read: base.read + read,
    input: base.input + input,
    written: base.written + written,
    observed: base.observed || cached,
    lastAt: nowMs,
    lastCached: cached,
    ttlS,
    lastInput: input,
  }
}

/** The figures as the statusLine JSON's prompt_cache, or nothing before the first request. */
export const promptCacheOf = (stats: CacheStats, nowMs: number): PromptCache | undefined => {
  if (stats.requests === 0 || stats.lastAt === null) return undefined
  const expiresMs = stats.lastCached ? stats.lastAt + stats.ttlS * 1000 : null
  return {
    warm: expiresMs !== null && nowMs < expiresMs,
    caching_observed: stats.observed,
    ttl: stats.ttlS === 3600 ? '1h' : '5m',
    expires_at: expiresMs === null ? null : Math.ceil(expiresMs / 1000),
    requests: stats.requests,
    hit_ratio: stats.input === 0 ? null : stats.read / stats.input,
    cache_write_tokens: stats.written,
    recache_tokens_if_cold: stats.lastInput,
  }
}

type RateLimits = Record<string, { used_percentage: number; resets_at?: number }>

// A window seen earlier in the session that is no longer reported once its reset
// time has passed (Pro / Max's 5-hour one, until the next reply opens a new one)
// is a fresh window at 0%, not a missing one: dropping it would switch Pro / Max
// to the Ultra layout until then. `seen` maps each kind to its last reset (epoch s).
export const keepExpiredWindows = (rateLimits: RateLimits, seen: Map<string, number>, nowSec: number): RateLimits => {
  const out: RateLimits = { ...rateLimits }
  for (const [kind, resetsAt] of seen) {
    if (!(kind in out) && resetsAt <= nowSec) out[kind] = { used_percentage: 0 }
  }
  return out
}

const firstExisting = async ($: EngineInterface, paths: string[]) => {
  for (const path of paths) {
    if (await $.fs.exists(path)) return path
  }
  return null
}

// The JSON Claude Code would pipe to a statusLine command, from the session's own figures.
const statusInput = async (
  $: EngineInterface,
  settings: Record<string, unknown>,
  seen: Map<string, number>,
): Promise<StatusJson> => {
  const [usage, cwd, root, sessionModel, sessionId, version, now, l, seenAt, envEffort, maxThinking, cached] = await Promise.all([
    $.session.usage(),
    $.session.cwd(),
    $.session.root(),
    $.session.model(),
    $.session.id(),
    $.session.version(),
    $.clock.now(),
    read($, live),
    read($, since),
    $.env.get('CLAUDE_EFFORT'),
    $.env.get('MAX_THINKING_TOKENS'),
    read($, cache),
  ])
  // Figures from before a /clear belong to the old conversation.
  const promptCache = cached.startedAt === usage.startedAt ? promptCacheOf(cached, now) : undefined

  const modelId = l.model ?? sessionModel
  // Thinking is on unless switched off, as the statusLine JSON reports it.
  const thinking = settings.alwaysThinkingEnabled !== false && maxThinking !== '0'
  // The effort of the last request; before the first one, the session's own
  // (CLAUDE_EFFORT, which the engine also hands Bash), then the setting.
  const effort =
    l.effort ?? envEffort ?? (typeof settings.effortLevel === 'string' ? settings.effortLevel : null)
  const outputStyle = typeof settings.outputStyle === 'string' ? settings.outputStyle : 'default'

  const reported: RateLimits = {}
  for (const window of usage.rateLimits) {
    const resetsAt = window.resetsAt === undefined ? NaN : Math.floor(Date.parse(window.resetsAt) / 1000)
    if (Number.isFinite(resetsAt)) seen.set(window.kind, resetsAt)
    reported[window.kind] = {
      used_percentage: window.percentUsed,
      ...(Number.isFinite(resetsAt) ? { resets_at: resetsAt } : {}),
    }
  }
  const rateLimits = keepExpiredWindows(reported, seen, Math.floor(now / 1000))

  // A resumed session's startedAt is its first launch (weeks back, maybe); the
  // statusLine counts this run. /clear moves startedAt up, so take the later one.
  const startedAt = Math.max(usage.startedAt, seenAt ?? usage.startedAt)

  const ctx = usage.context
  return {
    session_id: sessionId,
    cwd,
    model: { id: modelId, display_name: prettyModel(modelId) },
    workspace: { current_dir: cwd, project_dir: root },
    version: version.version,
    output_style: { name: outputStyle },
    ...(effort === null ? {} : { effort: { level: effort } }),
    thinking: { enabled: thinking },
    cost: {
      total_cost_usd: usage.cost?.usd ?? 0,
      total_duration_ms: Math.max(0, now - startedAt),
    },
    context_window: {
      context_window_size: ctx.window,
      ...(ctx.percent === undefined ? {} : { used_percentage: ctx.percent, remaining_percentage: 100 - ctx.percent }),
      ...(ctx.tokens === undefined ? {} : { current_usage: ctx.tokens }),
    },
    ...(Object.keys(rateLimits).length === 0 ? {} : { rate_limits: rateLimits }),
    ...(promptCache === undefined ? {} : { prompt_cache: promptCache }),
  }
}

const renderOnce = async ($: EngineInterface, preset: string, seen: Map<string, number>, columns: number) => {
  const settings = ((await $.settings.read()) ?? {}) as Record<string, unknown>
  const statusLine = settings.statusLine as { command?: unknown } | undefined
  const isSet = typeof statusLine?.command === 'string' && statusLine.command.trim() !== ''
  if ((await read($, hasStatusLine)) !== isSet) await update($, hasStatusLine, () => isSet)

  const home = (await $.env.get('HOME')) ?? ''
  const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${home}/.claude`
  const script = await firstExisting($, [
    `${$.plugin.root}/awesome-statusline.sh`,
    `${configDir}/awesome-statusline.sh`,
  ])

  // The cockpit reads the same figures, and keeps a point of them for its chart.
  const input = await statusInput($, settings, seen)
  await publishStatus($, input, await $.clock.now())

  let next: Snapshot
  if (script === null) {
    next = { output: null, error: 'Awesome Statusline: renderer not found. Re-run the installer and choose Mods.' }
  } else {
    const path = (await $.env.get('PATH')) ?? ''
    const bash = (await $.fs.exists('/bin/bash')) ? '/bin/bash' : 'bash'
    try {
      const ran = await $.process.run([bash, script, preset], {
        cwd: input.cwd,
        stdin: JSON.stringify(input),
        timeoutMs: 5_000,
        // An app started from the Dock has a short PATH: keep jq and git findable.
        // The band draws 24-bit colour on every surface, tmux or not.
        env: {
          PATH: [path, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean).join(':'),
          AWESOME_STATUSLINE_COLOR: 'truecolor',
          // The width the band is drawn at, as Claude Code passes a statusLine its terminal's.
          COLUMNS: String(columns),
        },
      })
      next =
        ran.exitCode === 0 && ran.stdout.trim() !== ''
          ? { output: ran.stdout, error: null }
          : { output: null, error: `Awesome Statusline: ${ran.stderr.trim().split('\n')[0] || `exit ${ran.exitCode}`}` }
    } catch (error) {
      next = { output: null, error: `Awesome Statusline: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  const last = await read($, snapshot)
  if (last.output !== next.output || last.error !== next.error) await update($, snapshot, () => next)
}

export const register: Register = (on, options) => {
  const preset = typeof options.preset === 'string' && PRESETS.has(options.preset) ? options.preset : 'large'
  const terminal = options.terminal === 'show' || options.terminal === 'hide' ? options.terminal : 'auto'
  const cockpit = options.cockpit === 'auto' ? 'auto' : 'command'
  registerCockpit(on)

  // Module state: a reload starts it over, and session.start runs again then.
  let isDirty = true
  let isRunning = false
  let lastRun = 0
  // The width of the surface that last drew the band.
  let columns = DESKTOP_COLUMNS
  // Each usage window's last reset time this session (kind -> epoch s).
  const seenWindows = new Map<string, number>()

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await startCockpit($, cockpit)
    // Kept in $.state, so a hot reload doesn't restart the clock.
    if ((await read($, since)) === null) {
      const now = await $.clock.now()
      await update($, since, () => now)
    }

    $.clock.every(TICK_MS, async () => {
      await syncCockpit($)
      refreshCockpit($).catch(() => undefined)
      if (isRunning) return
      const now = await $.clock.now()
      if (!isDirty && now - lastRun < REFRESH_MS) return

      isRunning = true
      isDirty = false
      try {
        await renderOnce($, preset, seenWindows, columns)
      } finally {
        lastRun = now
        isRunning = false
      }
    })

    return result
  })

  // Usage, cost or context moved.
  on('session.measure', ($, e, next) => {
    isDirty = true
    return next(e)
  })

  // The main loop's model and effort, as each request goes out; every request's
  // tokens, subagents' too, for the cockpit.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const effort = e.effort === undefined ? null : String(e.effort)
      const l = await read($, live)
      if (l.model !== e.model || l.effort !== effort) await update($, live, () => ({ model: e.model, effort }))
      await markWorking($, true)
      isDirty = true
    }
    const result = yield* next(e)
    await countTokens($, result.usage)
    // The cache figures count the main loop only, as Claude Code's own do.
    if (e.agentId === undefined) {
      const [now, { startedAt }] = await Promise.all([$.clock.now(), $.session.usage()])
      await update($, cache, stats => addCacheUsage(stats, result.usage, now, startedAt))
      isDirty = true
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    isDirty = true
    if (e.agentId === undefined) await markWorking($, false)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    if (await isCockpitShown($)) return next(e)

    const isTerminal = e.surface === 'terminal'
    if (isTerminal && (terminal === 'hide' || (terminal === 'auto' && (await read($, hasStatusLine))))) {
      return next(e)
    }
    // Only a surface that draws the band sets the width it's rendered at.
    const width = isTerminal && typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : DESKTOP_COLUMNS
    if (width !== columns) {
      columns = width
      isDirty = true
    }

    const { output, error } = await read($, snapshot)
    if (output === null && error === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    if (output === null) {
      return (
        <Box>
          <Text dimColor>{error ?? ''}</Text>
        </Box>
      )
    }

    // A terminal keeps runs of spaces; the app's text would fold them, and the
    // labels and bars line up by them.
    const spaced = (text: string) => (isTerminal ? text : text.replace(/ /g, ' '))
    const card = isTerminal ? {} : { backgroundColor: CARD, paddingX: 2, paddingY: 1 }

    return (
      <Box flexDirection="column" {...card}>
        {parseAnsi(output).map(line => (
          <Text mono wrap="truncate-end">
            {line.map(run => (
              <Text {...(run.color === undefined ? {} : { color: run.color })} {...(run.bold ? { weight: 'bold' as const } : {})}>
                {spaced(run.text)}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
    )
  })
}

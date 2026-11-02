import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { parseAnsi } from './ansi'
import { prettyModel } from './register'

const E = '\x1b'
// Two lines as the renderer writes them (large preset, shortened).
const OUTPUT =
  `🤖 ${E}[1m${E}[38;2;148;226;213mOpus 5.5${E}[0m ${E}[38;2;250;179;135m⚡high${E}[0m${E}[K\n` +
  `🧠 ${E}[38;2;245;194;231mContext${E}[0m   ${E}[38;2;245;194;231m█${E}[38;2;234;99;119m░░${E}[0m ${E}[1m 23%${E}[0m${E}[K\n`

const BAND = {
  plugin: 'awesome-statusline-mod',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

test('ANSI output becomes coloured runs, line by line', async () => {
  const lines = parseAnsi(OUTPUT)

  expect(lines.length).toBe(2)
  expect(lines[0]?.[1]).toEqual({ text: 'Opus 5.5', color: '#94e2d5', bold: true })
  expect(lines[0]?.[3]).toEqual({ text: '⚡high', color: '#fab387' })
  expect(lines[1]?.map(run => run.text).join('')).toBe('🧠 Context   █░░  23%')
})

test('model ids read as the statusline names them', async () => {
  expect(prettyModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5')
  expect(prettyModel('claude-sonnet-5-5-20261001')).toBe('Sonnet 5.5')
  expect(prettyModel('claude-fable-5-1')).toBe('Fable 5.1')
  expect(prettyModel('opus')).toBe('Opus')
  expect(prettyModel('gpt-x')).toBe('gpt-x')
})

const seed = (on: On, hasStatusLine: boolean) => {
  on('state.get', (_, e) => {
    const key = (e as { key?: string }).key
    if (key === 'snapshot') return { value: { value: { output: OUTPUT, error: null }, version: 1 } }
    if (key === 'hasStatusLine') return { value: { value: hasStatusLine, version: 1 } }
    return { value: { value: undefined, version: 0 } }
  })
}

test('the band draws the renderer output on the terminal and in the desktop app', async ($, on) => {
  seed(on, false)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /Opus/ }))?.text).toContain('Opus')
    expect(await ui.find({ type: 'Text', text: /23%/ })).toBeDefined()
    await ui.unmount()
  }
})

test('with a statusLine set, the terminal keeps the band empty and the desktop app still draws it', async ($, on) => {
  seed(on, true)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: /Opus/ })).toBeUndefined()
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desktop.find({ type: 'Text', text: /Opus/ })).toBeDefined()
  await desktop.unmount()
})

import {describe, expect, it, vi} from 'vitest'
import {runLinkFlow} from '../src/lib/link/engine.js'

describe('runLinkFlow', () => {
  it('uses checkbox prompts for item and target selection', async () => {
    const events: string[] = []
    const promptForMultiSelect = vi.fn()
      .mockResolvedValueOnce(['expo'])
      .mockResolvedValueOnce(['Codex'])

    await runLinkFlow({
      adapter: {
        async discoverItems() {
          events.push('discover')
          return [{name: 'expo', marker: '[ ]', detail: 'bundle', kind: 'bundle', members: ['expo-api-routes']}]
        },
        async discoverTargets() {
          events.push('targets')
          return [{name: 'Codex', path: '.codex/skills', marker: '[ ]'}]
        },
        async apply() {
          events.push('apply')
          return []
        }
      },
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForMultiSelect,
      render: () => {
        events.push('render')
      }
    })

    expect(promptForMultiSelect).toHaveBeenNthCalledWith(
      1,
      'Select items',
      expect.arrayContaining([
        expect.objectContaining({name: '[ ] expo (Bundle)', value: 'expo'})
      ])
    )
    expect(promptForMultiSelect).toHaveBeenNthCalledWith(
      2,
      'Select targets',
      expect.arrayContaining([
        expect.objectContaining({name: '[ ] Codex (.codex/skills)', value: 'Codex'})
      ])
    )
    expect(events).toEqual(['discover', 'targets', 'apply', 'render'])
  })
})

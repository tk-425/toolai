import {describe, expect, it, vi} from 'vitest'
import {runLinkFlow} from '../src/lib/link/engine.js'

describe('runLinkFlow', () => {
  it('uses checkbox prompts for item and target selection', async () => {
    const events: string[] = []
    const promptForMultiSelect = vi.fn()
      .mockResolvedValueOnce(['expo'])
      .mockResolvedValueOnce(['__all__'])
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
        expect.objectContaining({name: '[ ] [Bundle] expo', value: 'expo'})
      ])
    )
    expect(promptForMultiSelect).toHaveBeenNthCalledWith(
      2,
      'Select members from expo',
      expect.arrayContaining([
        expect.objectContaining({value: '__all__'}),
        expect.objectContaining({value: 'expo-api-routes'})
      ])
    )
    expect(promptForMultiSelect).toHaveBeenNthCalledWith(
      3,
      'Select targets',
      expect.arrayContaining([
        expect.objectContaining({name: '[ ] Codex (.codex/skills)', value: 'Codex'})
      ])
    )
    expect(events).toEqual(['discover', 'targets', 'apply', 'render'])
  })

  it('disables fully linked items only in add mode', async () => {
    const addPrompt = vi.fn()
      .mockResolvedValueOnce(['expo'])
      .mockResolvedValueOnce(['Codex'])
    const removePrompt = vi.fn()
      .mockResolvedValueOnce(['expo'])
      .mockResolvedValueOnce(['__all__'])
      .mockResolvedValueOnce(['Codex'])

    const adapter = {
      async discoverItems() {
        return [{name: 'expo', marker: '[✓]' as const, detail: 'bundle', kind: 'bundle' as const, members: ['expo-api-routes']}]
      },
      async discoverTargets() {
        return [{name: 'Codex', path: '.codex/skills', marker: '[ ]' as const}]
      },
      async apply() {
        return []
      }
    }

    await runLinkFlow({
      adapter,
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForMultiSelect: addPrompt,
      render: () => undefined
    })

    await runLinkFlow({
      adapter,
      promptForScope: async () => 'project',
      promptForOperation: async () => 'remove',
      promptForMultiSelect: removePrompt,
      render: () => undefined
    })

    expect(addPrompt).not.toHaveBeenCalled()
    expect(removePrompt).toHaveBeenNthCalledWith(
      1,
      'Select items',
      expect.arrayContaining([
        expect.objectContaining({value: 'expo', disabled: undefined})
      ])
    )
  })

  it('renders a message and skips apply when no targets are available', async () => {
    const promptForMultiSelect = vi.fn()
      .mockResolvedValueOnce(['expo'])
    const render = vi.fn()

    const result = await runLinkFlow({
      adapter: {
        async discoverItems() {
          return [{name: 'expo', marker: '[ ]' as const, kind: 'item' as const}]
        },
        async discoverTargets() {
          return []
        },
        async apply() {
          throw new Error('apply should not be called')
        }
      },
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForMultiSelect,
      render
    })

    expect(result).toEqual([])
    expect(promptForMultiSelect).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledWith([
      'No targets available for the selected scope. If you chose project scope, run this command from the project root or choose global.'
    ])
  })

  it('renders a message and skips target selection when no items are available', async () => {
    const promptForMultiSelect = vi.fn()
    const render = vi.fn()

    const result = await runLinkFlow({
      adapter: {
        async discoverItems() {
          return []
        },
        async discoverTargets() {
          throw new Error('discoverTargets should not be called')
        },
        async apply() {
          throw new Error('apply should not be called')
        }
      },
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForMultiSelect,
      render
    })

    expect(result).toEqual([])
    expect(promptForMultiSelect).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledWith([
      'No items are available for the selected scope and operation.'
    ])
  })

  it('renders a message when add mode has no selectable items', async () => {
    const promptForMultiSelect = vi.fn()
    const render = vi.fn()

    const result = await runLinkFlow({
      adapter: {
        async discoverItems() {
          return [
            {name: 'expo', marker: '[✓]' as const, kind: 'item' as const},
            {name: 'codex', marker: '[✓]' as const, kind: 'item' as const}
          ]
        },
        async discoverTargets() {
          throw new Error('discoverTargets should not be called')
        },
        async apply() {
          throw new Error('apply should not be called')
        }
      },
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForMultiSelect,
      render
    })

    expect(result).toEqual([])
    expect(promptForMultiSelect).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledWith([
      'All discovered items are already linked for the selected scope.'
    ])
  })

  it('skips member picker when only standalone items are selected', async () => {
    const promptForMultiSelect = vi.fn()
      .mockResolvedValueOnce(['standalone-a'])
      .mockResolvedValueOnce(['Codex'])

    const applyArgs: string[][] = []
    await runLinkFlow({
      adapter: {
        async discoverItems() {
          return [{name: 'standalone-a', marker: '[ ]' as const, kind: 'item' as const}]
        },
        async discoverTargets() {
          return [{name: 'Codex', path: '.codex/skills', marker: '[ ]' as const}]
        },
        async apply(_scope, _operation, items, _targets) {
          applyArgs.push([...items])
          return []
        }
      },
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForMultiSelect,
      render: () => undefined
    })

    expect(promptForMultiSelect).toHaveBeenCalledTimes(2)
    expect(promptForMultiSelect).toHaveBeenNthCalledWith(1, 'Select items', expect.any(Array))
    expect(promptForMultiSelect).toHaveBeenNthCalledWith(2, 'Select targets', expect.any(Array))
    expect(applyArgs[0]).toEqual(['standalone-a'])
  })

  it('expands bundle into selected members only', async () => {
    const promptForMultiSelect = vi.fn()
      .mockResolvedValueOnce(['my-bundle'])
      .mockResolvedValueOnce(['skill-a', 'skill-c'])
      .mockResolvedValueOnce(['Codex'])

    const applyArgs: string[][] = []
    await runLinkFlow({
      adapter: {
        async discoverItems() {
          return [{name: 'my-bundle', marker: '[ ]' as const, kind: 'bundle' as const, members: ['skill-a', 'skill-b', 'skill-c']}]
        },
        async discoverTargets() {
          return [{name: 'Codex', path: '.codex/skills', marker: '[ ]' as const}]
        },
        async apply(_scope, _operation, items, _targets) {
          applyArgs.push([...items])
          return []
        }
      },
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForMultiSelect,
      render: () => undefined
    })

    expect(promptForMultiSelect).toHaveBeenNthCalledWith(
      2,
      'Select members from my-bundle',
      expect.arrayContaining([
        expect.objectContaining({value: '__all__'}),
        expect.objectContaining({value: 'skill-a'}),
        expect.objectContaining({value: 'skill-b'}),
        expect.objectContaining({value: 'skill-c'})
      ])
    )
    expect(applyArgs[0]).toEqual(['skill-a', 'skill-c'])
  })

  it('shows one member picker per bundle in order', async () => {
    const promptForMultiSelect = vi.fn()
      .mockResolvedValueOnce(['bundle-1', 'standalone-x', 'bundle-2'])
      .mockResolvedValueOnce(['b1-skill-a'])
      .mockResolvedValueOnce(['__all__'])
      .mockResolvedValueOnce(['Codex'])

    const applyArgs: string[][] = []
    await runLinkFlow({
      adapter: {
        async discoverItems() {
          return [
            {name: 'bundle-1', marker: '[ ]' as const, kind: 'bundle' as const, members: ['b1-skill-a', 'b1-skill-b']},
            {name: 'bundle-2', marker: '[ ]' as const, kind: 'bundle' as const, members: ['b2-skill-a', 'b2-skill-b']},
            {name: 'standalone-x', marker: '[ ]' as const, kind: 'item' as const}
          ]
        },
        async discoverTargets() {
          return [{name: 'Codex', path: '.codex/skills', marker: '[ ]' as const}]
        },
        async apply(_scope, _operation, items, _targets) {
          applyArgs.push([...items])
          return []
        }
      },
      promptForScope: async () => 'project',
      promptForOperation: async () => 'add',
      promptForMultiSelect,
      render: () => undefined
    })

    expect(promptForMultiSelect).toHaveBeenNthCalledWith(2, 'Select members from bundle-1', expect.any(Array))
    expect(promptForMultiSelect).toHaveBeenNthCalledWith(3, 'Select members from bundle-2', expect.any(Array))
    expect(applyArgs[0]).toEqual(['b1-skill-a', 'standalone-x', 'b2-skill-a', 'b2-skill-b'])
  })
})

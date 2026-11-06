import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { createTestingPinia } from '@opencloud-eu/web-test-helpers'
import { ref } from 'vue'
import { Editor } from '@tiptap/core'
import {
  codeLanguageForExtension,
  useStrategyCode
} from '../../../../../src/editor/composables/strategies/code'
import { withSetup } from '../helpers'

const source = 'def greet(name):\n\n    # say hello\n    return "Hi " + name\n'

function createEditor(language?: string) {
  const { result: strategy } = withSetup(() =>
    useStrategyCode({ sourceMode: ref(false) }, language)
  )
  const element = document.createElement('div')
  document.body.appendChild(element)
  const editor = new Editor({
    element,
    extensions: strategy.extensions(),
    content: strategy.deserialize(source)
  })
  return { editor, strategy }
}

describe('code strategy', () => {
  let editor: Editor | null = null
  beforeEach(() => {
    createTestingPinia()
  })
  afterEach(() => {
    editor?.destroy()
    editor = null
    document.body.innerHTML = ''
  })

  it('maps file extensions to highlight.js languages', () => {
    expect(codeLanguageForExtension('py')).toBe('py')
    expect(codeLanguageForExtension('YML')).toBe('yaml')
    expect(codeLanguageForExtension('tsx')).toBe('typescript')
    expect(codeLanguageForExtension('json')).toBe('json')
    expect(codeLanguageForExtension('txt')).toBeUndefined()
    expect(codeLanguageForExtension('log')).toBeUndefined()
    expect(codeLanguageForExtension(undefined)).toBeUndefined()
  })

  it('keeps the file text unchanged', () => {
    const created = createEditor('python')
    editor = created.editor
    expect(created.strategy.serialize(editor as any)).toBe(source)
    expect(editor.state.doc.childCount).toBe(1)
  })

  it('highlights the code', () => {
    editor = createEditor('python').editor
    expect(editor.view.dom.querySelector('pre .hljs-keyword')?.textContent).toBe('def')
    expect(editor.view.dom.querySelector('pre .hljs-comment')?.textContent).toBe('# say hello')
  })

  it('handles an empty file', () => {
    const { result: strategy } = withSetup(() =>
      useStrategyCode({ sourceMode: ref(false) }, 'json')
    )
    const element = document.createElement('div')
    editor = new Editor({
      element,
      extensions: strategy.extensions(),
      content: strategy.deserialize('')
    })
    expect(strategy.serialize(editor as any)).toBe('')
  })
})

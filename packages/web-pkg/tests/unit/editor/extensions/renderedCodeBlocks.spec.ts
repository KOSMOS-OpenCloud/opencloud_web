import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { RenderedCodeBlocks } from '../../../../src/editor/extensions/renderedCodeBlocks'

const markdown = '# Title\n\n```mermaid\ngraph TD; A-->B\n```\n\n```js\nconst a = 1\n```\n'

function createEditor() {
  const element = document.createElement('div')
  document.body.appendChild(element)
  return new Editor({
    element,
    extensions: [
      StarterKit,
      Markdown,
      RenderedCodeBlocks.configure({
        renderers: { mermaid: async () => '<svg xmlns="http://www.w3.org/2000/svg"></svg>' },
        labels: { showCode: 'Code', showGraphic: 'Graphic', renderError: 'Error' }
      })
    ],
    content: markdown,
    contentType: 'markdown'
  } as any)
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('RenderedCodeBlocks', () => {
  let editor: Editor | null = null
  afterEach(() => {
    editor?.destroy()
    editor = null
    document.body.innerHTML = ''
  })

  it('shows a renderable code block as graphic and hides its code', async () => {
    editor = createEditor()
    await flush()
    const widgets = editor.view.dom.querySelectorAll('.oc-rendered-code-block')
    expect(widgets).toHaveLength(1)
    expect(widgets[0].querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/)
    const codeBlocks = editor.view.dom.querySelectorAll('pre')
    expect(codeBlocks).toHaveLength(2)
    expect((codeBlocks[0] as HTMLElement).style.display).toBe('none')
    expect((codeBlocks[1] as HTMLElement).style.display).toBe('')
  })

  it('toggles between graphic and code without changing the document', async () => {
    editor = createEditor()
    const before = editor.getMarkdown().trimEnd()
    const toggle = editor.view.dom.querySelector('.oc-rendered-code-block button') as HTMLButtonElement
    expect(toggle.textContent).toBe('Code')
    toggle.click()
    const shownCode = editor.view.dom.querySelector('pre') as HTMLElement
    expect(shownCode.style.display).toBe('')
    const toggleBack = editor.view.dom.querySelector('.oc-rendered-code-block button') as HTMLButtonElement
    expect(toggleBack.textContent).toBe('Graphic')
    expect(editor.view.dom.querySelector('.oc-rendered-code-block img')).toBeNull()
    // StarterKit's trailing node may append an empty paragraph on the first transaction
    expect(editor.getMarkdown().trimEnd()).toBe(before)
  })
})

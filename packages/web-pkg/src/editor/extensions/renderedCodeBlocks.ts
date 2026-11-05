import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import type { CodeBlockRenderer } from '../types'

// Code blocks of a renderable language (e.g. mermaid, svg) are shown as a
// graphic with a toggle to their code. The document stays unchanged: the
// graphic is a widget decoration, the hidden code block a node decoration.
// The renderer returns SVG markup; it is shown as <img> with a data URL, so
// scripts in the SVG never run.

export interface RenderedCodeBlocksOptions {
  renderers: Record<string, CodeBlockRenderer>
  labels: {
    showCode: string
    showGraphic: string
    renderError: string
  }
}

interface RenderedCodeBlocksState {
  /** Positions of code blocks currently shown as code */
  codeShown: number[]
  decorations: DecorationSet
}

const renderedCodeBlocksKey = new PluginKey<RenderedCodeBlocksState>('renderedCodeBlocks')

function svgDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return 'data:image/svg+xml;base64,' + btoa(binary)
}

function hashCode(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

function createWidget(
  options: RenderedCodeBlocksOptions,
  renderer: CodeBlockRenderer,
  code: string,
  language: string,
  codeShown: boolean,
  view: EditorView,
  getPos: () => number | undefined
): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'oc-rendered-code-block my-2 flex flex-col gap-1'
  wrapper.contentEditable = 'false'

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'self-end text-xs text-role-on-surface-variant underline cursor-pointer'
  toggle.textContent = codeShown ? options.labels.showGraphic : options.labels.showCode
  toggle.addEventListener('mousedown', (event) => event.preventDefault())
  toggle.addEventListener('click', (event) => {
    event.preventDefault()
    const pos = getPos()
    if (pos !== undefined) {
      view.dispatch(view.state.tr.setMeta(renderedCodeBlocksKey, { toggle: pos }))
    }
  })
  wrapper.appendChild(toggle)

  if (!codeShown) {
    const image = document.createElement('img')
    image.className = 'max-w-full self-center'
    image.alt = language
    wrapper.appendChild(image)
    renderer(code)
      .then((svg) => {
        image.src = svgDataUrl(svg)
      })
      .catch((err) => {
        image.remove()
        const message = document.createElement('div')
        message.className = 'text-sm text-role-error'
        message.textContent = options.labels.renderError
        message.title = String(err?.message ?? err)
        wrapper.appendChild(message)
      })
  }
  return wrapper
}

function buildDecorations(
  doc: ProseMirrorNode,
  codeShown: number[],
  options: RenderedCodeBlocksOptions
): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') {
      return true
    }
    const language = String(node.attrs.language ?? '').toLowerCase()
    const renderer = options.renderers[language]
    if (!renderer) {
      return false
    }
    const shown = codeShown.includes(pos)
    const code = node.textContent
    decorations.push(
      Decoration.widget(
        pos,
        (view, getPos) => createWidget(options, renderer, code, language, shown, view, getPos),
        { key: `${language}:${shown}:${hashCode(code)}`, side: -1, ignoreSelection: true }
      )
    )
    if (!shown) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { style: 'display: none' }))
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export const RenderedCodeBlocks = Extension.create<RenderedCodeBlocksOptions>({
  name: 'renderedCodeBlocks',

  addOptions() {
    return {
      renderers: {},
      labels: { showCode: 'Code', showGraphic: 'Graphic', renderError: 'Could not render' }
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin<RenderedCodeBlocksState>({
        key: renderedCodeBlocksKey,
        state: {
          init: (_, state) => ({
            codeShown: [],
            decorations: buildDecorations(state.doc, [], options)
          }),
          apply: (tr, value, _oldState, newState) => {
            const meta = tr.getMeta(renderedCodeBlocksKey) as { toggle?: number } | undefined
            if (!tr.docChanged && meta?.toggle === undefined) {
              return value
            }
            let codeShown = value.codeShown.map((pos) => tr.mapping.map(pos))
            if (meta?.toggle !== undefined) {
              codeShown = codeShown.includes(meta.toggle)
                ? codeShown.filter((pos) => pos !== meta.toggle)
                : [...codeShown, meta.toggle]
            }
            return { codeShown, decorations: buildDecorations(newState.doc, codeShown, options) }
          }
        },
        props: {
          decorations: (state) => renderedCodeBlocksKey.getState(state)?.decorations
        }
      })
    ]
  }
})

import type { Editor } from '@tiptap/vue-3'
import type { Extension } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { useGettext } from 'vue3-gettext'
import { EditorActionGroup, useEditorActions } from '../useEditorActions'
import { ContentTypeStrategy } from './types'
import { TextEditorState } from '../../types'

// Source code files (py, js, json, yaml, …): the whole file is one code block
// with syntax highlighting by lowlight (highlight.js grammars). The document
// holds nothing but that block, so the file text round-trips unchanged.

const lowlight = createLowlight(common)

/** highlight.js language for a file extension, undefined if not highlighted */
export function codeLanguageForExtension(extension?: string): string | undefined {
  const ext = (extension ?? '').toLowerCase()
  const aliases: Record<string, string> = {
    jsx: 'javascript',
    tsx: 'typescript',
    vue: 'xml',
    yml: 'yaml',
    conf: 'ini',
    env: 'bash',
    sh: 'bash',
    bat: 'dos',
    dockerfile: 'dockerfile',
    makefile: 'makefile'
  }
  const language = aliases[ext] ?? ext
  // highlight.js knows txt/text as "plaintext", those stay plain text files
  if (['txt', 'text', 'plaintext'].includes(language)) {
    return undefined
  }
  return language && lowlight.registered(language) ? language : undefined
}

const CodeDocument = Document.extend({ content: 'codeBlock' })

export const useStrategyCode = (
  editorState: TextEditorState,
  language?: string
): ContentTypeStrategy => {
  const { $gettext } = useGettext()

  const serialize = (editor: Editor): string => {
    return editor.state.doc.textContent
  }

  const deserialize = (content: string): Record<string, unknown> => {
    return {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: language ?? null },
          content: content ? [{ type: 'text', text: content }] : []
        }
      ]
    }
  }

  const extensions = (): Extension[] => {
    return [
      CodeDocument,
      // only text and undo/redo, the document holds a single code block
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        document: false,
        dropcursor: false,
        gapcursor: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        paragraph: false,
        strike: false,
        trailingNode: false,
        underline: false
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: language ?? null,
        enableTabIndentation: true,
        exitOnTripleEnter: false,
        exitOnArrowDown: false
      })
    ] as Extension[]
  }

  const { undo, redo } = useEditorActions(editorState)
  const editorActionGroups = (): EditorActionGroup[] => {
    return [
      {
        id: 'history',
        title: $gettext('History'),
        actions: [undo(), redo()]
      }
    ]
  }

  return {
    serialize,
    deserialize,
    extensions,
    editorActionGroups
  }
}

import type { ShallowRef, Ref, ComputedRef } from 'vue'
import { Editor } from '@tiptap/vue-3'
import { EditorActionGroup } from './composables'

export type ContentType = 'plain-text' | 'markdown' | 'html' | 'tiptap-json' | 'code'

/** Renders the code of a code block (e.g. mermaid) to SVG markup */
export type CodeBlockRenderer = (code: string) => Promise<string>

export interface TextEditorOptions {
  contentType: ContentType
  /** highlight.js language for contentType 'code', e.g. from codeLanguageForExtension() */
  language?: string
  modelValue?: Ref<string>
  readonly?: boolean
  slashCommands?: boolean
  placeholder?: string
  onUpdate?: (content: string) => void
  onRequestLinkUrl?: (currentUrl?: string) => Promise<string | null>
  onRequestImageUrl?: () => Promise<string | null>
  /**
   * Code blocks of these languages are shown as graphic with a toggle to
   * their code, e.g. { mermaid: renderMermaid, svg: async (code) => code }
   */
  codeBlockRenderers?: Record<string, CodeBlockRenderer>
}

export interface TextEditorState {
  sourceMode: Ref<boolean>
}

export interface TextEditorInstance {
  state: TextEditorState
  editor: ShallowRef<Editor | null>
  contentType: Ref<ContentType>
  readonly: Ref<boolean>
  actionGroups(): EditorActionGroup[]
  getContent(): string
  isEmpty: ComputedRef<boolean>
  isFocused: ComputedRef<boolean>
  focus(): void
  blur(): void
  destroy(): void
}

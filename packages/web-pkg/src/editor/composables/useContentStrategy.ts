import type { ContentType, TextEditorState } from '../types'
import {
  ContentTypeStrategy,
  useStrategyCode,
  useStrategyHtml,
  useStrategyMarkdown,
  useStrategyPlainText,
  useStrategyTiptapJson
} from './strategies'

export const useContentStrategy = () => {
  const resolveStrategy = (
    contentType: ContentType,
    editorState: TextEditorState,
    language?: string
  ): ContentTypeStrategy => {
    switch (contentType) {
      case 'plain-text':
        return useStrategyPlainText(editorState)
      case 'markdown':
        return useStrategyMarkdown(editorState)
      case 'html':
        return useStrategyHtml(editorState)
      case 'code':
        return useStrategyCode(editorState, language)
      case 'tiptap-json':
        return useStrategyTiptapJson(editorState)
      default:
        throw new Error(`Unknown content type: ${contentType}`)
    }
  }

  return {
    resolveStrategy
  }
}

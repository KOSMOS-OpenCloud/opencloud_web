import {
  ActionExtension,
  useFileActionsCopyPermanentLink,
  useFileActionsImmutable,
  useFileActionsOpenShortcut,
  useFileActionsShowShares
} from '@opencloud-eu/web-pkg'
import {
  batchActionsExtensionPoint,
  contextActionsExtensionPoint,
  quickActionsExtensionPoint
} from '../../extensionPoints'
import { unref } from 'vue'

export const useFileActions = (): ActionExtension[] => {
  const { actions: openShortcutActions } = useFileActionsOpenShortcut()
  const { actions: showSharesActions } = useFileActionsShowShares()
  const { actions: permanentLinkActions } = useFileActionsCopyPermanentLink()
  const { actions: immutableActions } = useFileActionsImmutable()

  const singleItemActions = unref(immutableActions).filter(
    (a) => !a.name.startsWith('protect-folder') && !a.name.startsWith('unprotect-folder')
  )
  const batchableActions = unref(immutableActions).filter(
    (a) => a.name === 'protect-folder' || a.name === 'unprotect-folder'
  )

  return [
    {
      id: 'com.github.opencloud-eu.web.files.context-action.open-shortcut',
      extensionPointIds: [contextActionsExtensionPoint.id],
      type: 'action',
      action: unref(openShortcutActions)[0]
    },
    {
      id: 'com.github.opencloud-eu.web.files.quick-action.collaborator',
      extensionPointIds: [quickActionsExtensionPoint.id],
      type: 'action',
      action: unref(showSharesActions)[0]
    },
    {
      id: 'com.github.opencloud-eu.web.files.quick-action.quicklink',
      extensionPointIds: [quickActionsExtensionPoint.id],
      type: 'action',
      action: unref(permanentLinkActions)[0]
    },
    // Single-item quick actions (freeze, frozen, shielded indicators)
    ...singleItemActions.map((action) => ({
      id: `com.github.opencloud-eu.web.files.quick-action.${action.name}`,
      extensionPointIds: [quickActionsExtensionPoint.id],
      type: 'action' as const,
      action
    })),
    // Protect/Unprotect: quick action (single) + batch action (multi-select)
    ...batchableActions.map((action) => ({
      id: `com.github.opencloud-eu.web.files.quick-action.${action.name}`,
      extensionPointIds: [quickActionsExtensionPoint.id],
      type: 'action' as const,
      action
    })),
    ...batchableActions.map((action) => ({
      id: `com.github.opencloud-eu.web.files.batch-action.${action.name}`,
      extensionPointIds: [batchActionsExtensionPoint.id],
      type: 'action' as const,
      action
    }))
  ]
}

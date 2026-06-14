import {
  ActionExtension,
  useFileActionsCopyPermanentLink,
  useFileActionsImmutable,
  useFileActionsOpenShortcut,
  useFileActionsShowShares
} from '@opencloud-eu/web-pkg'
import { contextActionsExtensionPoint, quickActionsExtensionPoint } from '../../extensionPoints'
import { unref } from 'vue'

export const useFileActions = (): ActionExtension[] => {
  const { actions: openShortcutActions } = useFileActionsOpenShortcut()
  const { actions: showSharesActions } = useFileActionsShowShares()
  const { actions: permanentLinkActions } = useFileActionsCopyPermanentLink()
  const { actions: immutableActions } = useFileActionsImmutable()

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
    ...unref(immutableActions).map((action) => ({
      id: `com.github.opencloud-eu.web.files.quick-action.${action.name}`,
      extensionPointIds: [quickActionsExtensionPoint.id],
      type: 'action' as const,
      action
    }))
  ]
}

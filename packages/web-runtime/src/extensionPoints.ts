import {
  AccountExtension,
  AppMenuItemExtension,
  CustomComponentExtension,
  QuickMenuItemExtension,
  NotificationHandlerExtension,
  SidebarPanelExtension,
  Extension,
  ExtensionPoint,
  $gettext
} from '@opencloud-eu/web-pkg'
import { computed } from 'vue'

export const appMenuExtensionPoint: ExtensionPoint<AppMenuItemExtension> = {
  id: 'app.runtime.header.app-menu',
  extensionType: 'appMenuItem',
  multiple: true
}

export const preferencesPanelExtensionPoint: ExtensionPoint<AccountExtension> = {
  id: 'app.runtime.preferences.panels',
  extensionType: 'accountExtension',
  multiple: true
}

export const progressBarExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'app.runtime.global-progress-bar',
  extensionType: 'customComponent',
  multiple: false,
  defaultExtensionId: 'com.github.opencloud-eu.web.runtime.default-progress-bar',
  userPreference: {
    label: $gettext('Global progress bar'),
    description: $gettext('Customize your progress bar')
  }
}

export const topBarCenterExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'app.runtime.header.center',
  extensionType: 'customComponent',
  multiple: true
}

export const topBarLeftExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'app.runtime.header.left',
  extensionType: 'customComponent',
  multiple: true
}

export const topBarAppActionsExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'app.runtime.header.app-actions',
  extensionType: 'customComponent',
  multiple: true
}

export const topBarRightExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'app.runtime.header.right',
  extensionType: 'customComponent',
  multiple: true
}

// Quick menu: lightning button in the top bar, tiles from apps (see QuickMenu.vue)
export const quickMenuExtensionPoint: ExtensionPoint<QuickMenuItemExtension> = {
  id: 'app.runtime.header.quick-menu',
  extensionType: 'quickMenuItem',
  multiple: true
}

// Globale rechte Seitenleiste (kosmos 2026-11-10): Panels, die von überall angefordert werden können (Chat der
// Station). Anforderung per Fenster-Ereignis `oc:global-sidebar` {panel}, weil der eventBus zwischen MF-Modulen isoliert
// ist; Application.vue rendert die SideBar nur, solange keine App-eigene Seitenleiste (#app-sidebar) im DOM steht.
export const globalSideBarExtensionPoint: ExtensionPoint<SidebarPanelExtension<any, any, any>> = {
  id: 'app.runtime.sidebar',
  extensionType: 'sidebarPanel',
  multiple: true
}

// Glocke (kosmos 2026-11-09): Apps öffnen Benachrichtigungen ihrer dApp (object_type dock, plugin/kind/id)
export const notificationHandlerExtensionPoint: ExtensionPoint<NotificationHandlerExtension> = {
  id: 'app.runtime.notifications.open',
  extensionType: 'notificationHandler',
  multiple: true
}

export const appModeNavExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'app.runtime.appMode.primaryNav',
  extensionType: 'customComponent',
  multiple: false
}

export const appModeSecondaryNavExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'app.runtime.appMode.secondaryNav',
  extensionType: 'customComponent',
  multiple: false
}

export const extensionPoints = () => {
  return computed<ExtensionPoint<Extension>[]>(() => {
    return [
      appMenuExtensionPoint,
      preferencesPanelExtensionPoint,
      progressBarExtensionPoint,
      topBarCenterExtensionPoint,
      topBarLeftExtensionPoint,
      topBarAppActionsExtensionPoint,
      topBarRightExtensionPoint,
      quickMenuExtensionPoint,
      notificationHandlerExtensionPoint,
      appModeNavExtensionPoint,
      appModeSecondaryNavExtensionPoint
    ]
  })
}

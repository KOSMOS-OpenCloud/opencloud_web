import { computed, unref } from 'vue'
import {
  FloatingActionButtonExtension,
  useActiveApp,
  useExtensionRegistry,
  useRoute
} from '@opencloud-eu/web-pkg'

/**
 * Floating action buttons of the current page. An app that is hung into a primary app (mount, e.g.
 * `/calendar/todos`) brings its own button at `app.<primary app>.<segment>.floating-action-button`,
 * without one the button of the primary app stays.
 */
export function useFloatingActionButton() {
  const { requestExtensions } = useExtensionRegistry()
  const activeApp = useActiveApp()
  const route = useRoute()

  function requestVisibleButtons(extensionPointId: string) {
    return requestExtensions<FloatingActionButtonExtension>({
      id: extensionPointId,
      extensionType: 'floatingActionButton'
    }).filter(({ isVisible }) => !isVisible || isVisible())
  }

  const floatingActionButtons = computed(() => {
    const mountSegment = unref(route).path.split('/')[2]
    if (mountSegment) {
      const mountButtons = requestVisibleButtons(
        `app.${unref(activeApp)}.${mountSegment}.floating-action-button`
      )
      if (mountButtons.length) {
        return mountButtons
      }
    }
    return requestVisibleButtons(`app.${unref(activeApp)}.floating-action-button`)
  })

  const floatingActionButton = computed(() => unref(floatingActionButtons)[0])

  return { floatingActionButtons, floatingActionButton }
}

import {
  CustomComponentExtension,
  ExtensionPoint,
  ResourceIndicatorExtension,
  ResourceTransformerExtension
} from './composables'
import { computed } from 'vue'

export const fileSideBarSpaceDetailsTableExtensionPoint: ExtensionPoint<CustomComponentExtension> =
  {
    id: 'app.files.sidebar.space-details.table',
    extensionType: 'customComponent'
  }

export const resourceIndicatorExtensionPoint: ExtensionPoint<ResourceIndicatorExtension> = {
  id: 'global.files.resource-indicator',
  extensionType: 'resourceIndicator',
  multiple: true
}

export const resourceTransformerExtensionPoint: ExtensionPoint<ResourceTransformerExtension> = {
  id: 'global.files.resource-transformer',
  extensionType: 'resourceTransformer',
  multiple: true
}

export const extensionPoints = () => {
  return computed<ExtensionPoint<any>[]>(() => {
    return [
      fileSideBarSpaceDetailsTableExtensionPoint,
      resourceIndicatorExtensionPoint,
      resourceTransformerExtensionPoint
    ]
  })
}

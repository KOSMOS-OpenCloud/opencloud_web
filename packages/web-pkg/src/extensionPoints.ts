import {
  CustomComponentExtension,
  ExtensionPoint,
  ResourceIndicatorExtension,
  ResourceTransformerExtension,
  SortFieldModifierExtension
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

export const sortFieldModifierExtensionPoint: ExtensionPoint<SortFieldModifierExtension> = {
  id: 'global.files.sort-field-modifier',
  extensionType: 'sortFieldModifier',
  multiple: true
}

export const extensionPoints = () => {
  return computed<ExtensionPoint<any>[]>(() => {
    return [
      fileSideBarSpaceDetailsTableExtensionPoint,
      resourceIndicatorExtensionPoint,
      resourceTransformerExtensionPoint,
      sortFieldModifierExtensionPoint
    ]
  })
}

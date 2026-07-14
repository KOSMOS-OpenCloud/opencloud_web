import { XMLBuilder } from 'fast-xml-parser'
import { DavProperties, DavPropertyValue } from '../constants'

export const NsOwncloudMetadata = 'http://owncloud.org/ns/metadata'

const getNamespacedDavProps = (
  obj: Partial<Record<DavPropertyValue, unknown>>,
  extraProps: string[]
) => {
  return Object.fromEntries(
    Object.entries(obj).map(([name, value]) => {
      if (extraProps.includes(name)) {
        // om: namespace for custom metadata properties
        if (name.startsWith('om:')) {
          return [`om:${name.slice(3)}`, value || '']
        }
        return [name, value || '']
      }

      const davNamespace = DavProperties.DavNamespace.includes(name as unknown as DavPropertyValue)
      const propName = davNamespace ? `d:${name}` : `oc:${name}`
      return [propName, value || '']
    })
  )
}

export const buildPropFindBody = (
  properties: DavPropertyValue[] = [],
  {
    pattern,
    filterRules,
    limit = 0,
    extraProps = []
  }: {
    pattern?: string
    filterRules?: Partial<Record<DavPropertyValue, unknown>>
    limit?: number
    extraProps: string[]
  }
): string => {
  let bodyType = 'd:propfind'
  if (pattern) {
    bodyType = 'oc:search-files'
  }

  if (filterRules) {
    bodyType = 'oc:filter-files'
  }

  const object = properties.reduce<Record<string, unknown>>((obj, item) => Object.assign(obj, { [item]: null }), {})
  for (const ep of extraProps) {
    if (!(ep in object)) {
      object[ep] = null
    }
  }
  const props = getNamespacedDavProps(object, extraProps)

  const hasOmProps = extraProps.some((ep) => ep.startsWith('om:'))

  const xmlObj = {
    [bodyType]: {
      'd:prop': props,
      '@@xmlns:d': 'DAV:',
      '@@xmlns:oc': 'http://owncloud.org/ns',
      ...(hasOmProps && { '@@xmlns:om': NsOwncloudMetadata }),
      ...(pattern && {
        'oc:search': { 'oc:pattern': pattern, 'oc:limit': limit }
      }),
      ...(filterRules && {
        'oc:filter-rules': getNamespacedDavProps(filterRules, [])
      })
    }
  }

  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    attributeNamePrefix: '@@',
    suppressEmptyNode: true
  })

  return builder.build(xmlObj)
}

export const buildPropPatchBody = (
  properties: Partial<Record<DavPropertyValue, unknown>>,
  extraProps: string[] = []
): string => {
  const hasOmProps = Object.keys(properties).some((k) => k.startsWith('om:'))

  const xmlObj = {
    'd:propertyupdate': {
      'd:set': { 'd:prop': getNamespacedDavProps(properties, extraProps) },
      '@@xmlns:d': 'DAV:',
      '@@xmlns:oc': 'http://owncloud.org/ns',
      ...(hasOmProps && { '@@xmlns:om': NsOwncloudMetadata })
    }
  }

  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    attributeNamePrefix: '@@',
    suppressEmptyNode: true
  })

  return builder.build(xmlObj)
}

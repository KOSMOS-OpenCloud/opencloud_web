import { RouteComponents } from './router'
import { RouteLocationNamedRaw, RouteRecordRaw } from 'vue-router'
import { createLocation, isLocationActiveDirector } from './utils'
import { $gettext } from '../utils/dummyGettext'

type commonTypes =
  | 'files-common-favorites'
  | 'files-common-search'
  | 'files-common-smart-folders'
  | 'files-common-smart-folder'

export const createLocationCommon = (name: commonTypes, location = {}): RouteLocationNamedRaw =>
  createLocation(name, location)

export const locationFavorites = createLocationCommon('files-common-favorites')
export const locationSearch = createLocationCommon('files-common-search')
export const locationSmartFolders = createLocationCommon('files-common-smart-folders')
export const locationSmartFolder = createLocationCommon('files-common-smart-folder')

// locationSmartFolder is not listed: it has a required param, router.resolve
// throws without it. Check it by route name (FolderLoaderSmartFolder).
export const isLocationCommonActive = isLocationActiveDirector<commonTypes>(
  locationFavorites,
  locationSearch,
  locationSmartFolders
)

export const buildRoutes = (components: RouteComponents): RouteRecordRaw[] => [
  {
    path: '/search',
    component: components.App,
    children: [
      {
        name: locationSearch.name,
        path: 'list/:page?',
        component: components.SearchResults,
        meta: {
          authContext: 'user',
          title: $gettext('Search results'),
          contextQueryItems: [
            'term',
            'provider',
            'q_tags',
            'q_lastModified',
            'q_titleOnly',
            'q_mediaType',
            'scope',
            'useScope',
            'sort-by',
            'sort-dir'
          ]
        }
      }
    ]
  },
  {
    path: '/favorites',
    component: components.App,
    children: [
      {
        name: locationFavorites.name,
        path: '',
        component: components.Favorites,
        meta: {
          authContext: 'user',
          title: $gettext('Favorite files')
        }
      }
    ]
  },
  {
    path: '/smart-folders',
    component: components.App,
    children: [
      {
        name: locationSmartFolders.name,
        path: '',
        component: components.SmartFolders,
        meta: {
          authContext: 'user',
          title: $gettext('Smart folders')
        }
      },
      {
        name: locationSmartFolder.name,
        path: ':smartFolderId',
        component: components.SmartFolder,
        meta: {
          authContext: 'user',
          title: $gettext('Smart folder')
        }
      }
    ]
  }
]

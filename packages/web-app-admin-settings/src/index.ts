import translations from '../l10n/translations.json'
import General from './views/General.vue'
import Users from './views/Users.vue'
import Groups from './views/Groups.vue'
import Spaces from './views/Spaces.vue'
import { urlJoin } from '@opencloud-eu/web-client'
import {
  ApplicationInformation,
  AppMenuItemExtension,
  ClassicApplicationScript,
  CreateNewActionExtension,
  defineWebApplication,
  Extension,
  FloatingActionButtonExtension,
  useAbility,
  useExtensionRegistry,
  useRoute,
  useSpaceActionsCreate,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  useGroupActionsCreateGroup,
  useSpaceSettingsStore,
  useUserActionsCreateUser
} from './composables'
import { APPID } from './appid'
import { extensionPoints } from './extensionPoints'

export const routes: ClassicApplicationScript['routes'] = ({ $ability, $gettext }) => [
  {
    path: '/',
    component: General,
    beforeEnter: (to, from, next) => {
      if ($ability.can('read-all', 'Setting')) {
        next({ name: 'admin-settings-general' })
      }
      if ($ability.can('read-all', 'Account')) {
        next({ name: 'admin-settings-users' })
      }
      if ($ability.can('read-all', 'Group')) {
        next({ name: 'admin-settings-groups' })
      }
      if ($ability.can('read-all', 'Drive')) {
        next({ name: 'admin-settings-spaces' })
      }
      next({ path: '/' })
    }
  },
  {
    path: '/general',
    name: 'admin-settings-general',
    component: General,
    beforeEnter: (to, from, next) => {
      if (!$ability.can('read-all', 'Setting')) {
        next({ path: '/' })
      }
      next()
    },
    meta: {
      authContext: 'user',
      title: $gettext('General')
    }
  },
  {
    path: '/users',
    name: 'admin-settings-users',
    component: Users,
    beforeEnter: (to, from, next) => {
      if (!$ability.can('read-all', 'Account')) {
        next({ path: '/' })
      }
      next()
    },
    meta: {
      authContext: 'user',
      title: $gettext('Users')
    }
  },
  {
    path: '/groups',
    name: 'admin-settings-groups',
    component: Groups,
    beforeEnter: (to, from, next) => {
      if (!$ability.can('read-all', 'Group')) {
        next({ path: '/' })
      }
      next()
    },
    meta: {
      authContext: 'user',
      title: $gettext('Groups')
    }
  },
  {
    path: '/spaces',
    name: 'admin-settings-spaces',
    component: Spaces,
    beforeEnter: (to, from, next) => {
      if (!$ability.can('read-all', 'Drive')) {
        next({ path: '/' })
      }
      next()
    },
    meta: {
      authContext: 'user',
      title: $gettext('Spaces')
    }
  }
]

export const navItems: ClassicApplicationScript['navItems'] = ({ $ability, $gettext }) => [
  {
    name: $gettext('General'),
    icon: 'settings-4',
    route: {
      path: `/${APPID}/general?`
    },
    isVisible: () => {
      return $ability.can('read-all', 'Setting')
    },
    priority: 10
  },
  {
    name: $gettext('Users'),
    icon: 'user',
    route: {
      path: `/${APPID}/users?`
    },
    isVisible: () => {
      return $ability.can('read-all', 'Account')
    },
    priority: 20
  },
  {
    name: $gettext('Groups'),
    icon: 'group-2',
    route: {
      path: `/${APPID}/groups?`
    },
    isVisible: () => {
      return $ability.can('read-all', 'Group')
    },
    priority: 30
  },
  {
    name: $gettext('Spaces'),
    icon: 'layout-grid',
    route: {
      path: `/${APPID}/spaces?`
    },
    isVisible: () => {
      return $ability.can('read-all', 'Drive')
    },
    priority: 40
  }
]

export default defineWebApplication({
  setup() {
    const { can } = useAbility()
    const userStore = useUserStore()
    const { $gettext } = useGettext()
    const currentRoute = useRoute()
    const { upsertSpace } = useSpaceSettingsStore()

    const { actions: createUserActions } = useUserActionsCreateUser()
    const createUserAction = computed(() => unref(createUserActions)[0])
    const { actions: createGroupActions } = useGroupActionsCreateGroup()
    const createGroupAction = computed(() => unref(createGroupActions)[0])
    const { actions: createSpaceActions } = useSpaceActionsCreate({
      onSpaceCreated: (space) => {
        upsertSpace(space)
      }
    })
    const createSpaceAction = computed(() => unref(createSpaceActions)[0])

    const appInfo: ApplicationInformation = {
      name: $gettext('Admin Settings'),
      id: APPID,
      icon: 'settings-4',
      color: '#2b2b2b'
    }

    const extensions = computed<Extension[]>(() => {
      const items: Extension[] = []

      const menuItemAvailable =
        userStore.user &&
        (can('read-all', 'Setting') ||
          can('read-all', 'Account') ||
          can('read-all', 'Group') ||
          can('read-all', 'Drive'))

      if (menuItemAvailable) {
        const menuItem: AppMenuItemExtension = {
          id: `app.${appInfo.id}.menuItem`,
          type: 'appMenuItem',
          label: () => appInfo.name,
          color: appInfo.color,
          icon: appInfo.icon,
          priority: 40,
          path: urlJoin(appInfo.id)
        }

        items.push(menuItem)
      }

      // Default create-new-actions for built-in admin views
      const createNewActions: CreateNewActionExtension[] = [
        {
          id: 'com.github.opencloud-eu.web.admin-settings.create-new-action.space',
          extensionPointIds: ['app.admin-settings.create-new-action'],
          type: 'createNewAction',
          isActive: () =>
            unref(currentRoute).name === 'admin-settings-spaces' &&
            unref(createSpaceAction).isVisible(),
          handler: () => unref(createSpaceAction).handler(),
          mode: 'handler',
        },
        {
          id: 'com.github.opencloud-eu.web.admin-settings.create-new-action.user',
          extensionPointIds: ['app.admin-settings.create-new-action'],
          type: 'createNewAction',
          isActive: () =>
            unref(currentRoute).name === 'admin-settings-users' &&
            unref(createUserAction).isVisible(),
          handler: () => unref(createUserAction).handler(),
          mode: 'handler',
        },
        {
          id: 'com.github.opencloud-eu.web.admin-settings.create-new-action.group',
          extensionPointIds: ['app.admin-settings.create-new-action'],
          type: 'createNewAction',
          isActive: () =>
            unref(currentRoute).name === 'admin-settings-groups' &&
            unref(createGroupAction).isVisible(),
          handler: () => unref(createGroupAction).handler(),
          mode: 'handler',
        },
      ]
      items.push(...createNewActions)

      // FloatingActionButton driven by create-new-action registry
      const { requestExtensions } = useExtensionRegistry()
      const activeAction = () =>
        requestExtensions<CreateNewActionExtension>({
          id: 'app.admin-settings.create-new-action',
          extensionType: 'createNewAction'
        }).find((ext) => ext.isActive())

      const floatingActionButton: FloatingActionButtonExtension = {
        id: `com.github.opencloud-eu.web.${appInfo.id}.floating-action-button`,
        extensionPointIds: ['app.admin-settings.floating-action-button'],
        type: 'floatingActionButton',
        icon: 'add',
        label: () => activeAction()?.label?.() || $gettext('New'),
        mode: () => activeAction()?.mode || 'handler',
        handler: () => activeAction()?.handler(),
        isDisabled: () => !activeAction(),
      }

      items.push(floatingActionButton)

      return items
    })

    return {
      appInfo,
      routes,
      navItems,
      translations,
      extensions,
      extensionPoints: extensionPoints()
    }
  }
})

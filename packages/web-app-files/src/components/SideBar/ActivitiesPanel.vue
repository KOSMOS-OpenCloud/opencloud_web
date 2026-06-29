<template>
  <div>
    <!-- Time range + group by controls -->
    <div class="flex flex-wrap gap-1 mb-3">
      <button
        v-for="range in timeRanges"
        :key="range.value"
        class="px-2 py-0.5 rounded text-xs cursor-pointer border"
        :class="selectedTimeRange === range.value
          ? 'bg-role-primary text-role-on-primary border-role-primary'
          : 'bg-transparent text-role-on-surface border-role-outline hover:bg-surface-secondary'"
        @click="selectedTimeRange = range.value"
      >
        {{ range.label }}
      </button>
      <span class="mx-1" />
      <button
        v-for="mode in groupModes"
        :key="mode.value"
        class="px-2 py-0.5 rounded text-xs cursor-pointer border"
        :class="selectedGroupBy === mode.value
          ? 'bg-role-primary text-role-on-primary border-role-primary'
          : 'bg-transparent text-role-on-surface border-role-outline hover:bg-surface-secondary'"
        @click="selectedGroupBy = selectedGroupBy === mode.value ? '' : mode.value"
      >
        {{ mode.label }}
      </button>
    </div>

    <oc-loader v-if="isLoading" />
    <template v-else>
      <p v-if="!hasActivities" v-text="$gettext('No activities')" />

      <!-- Grouped view -->
      <div v-else-if="groupedData" class="ml-2">
        <div v-for="group in groupedData.groups" :key="group.key" class="mb-3">
          <div
            class="flex items-center cursor-pointer py-1 hover:bg-surface-secondary rounded"
            @click="toggleGroup(group.key)"
          >
            <oc-icon
              :name="expandedGroups.has(group.key) ? 'arrow-down-s' : 'arrow-right-s'"
              size="small"
            />
            <span class="font-semibold text-sm ml-1">{{ groupName(group.label) }}</span>
            <span v-if="groupContext(group.label)" class="text-role-on-surface-variant text-xs ml-1">{{ groupContext(group.label) }}</span>
            <span class="ml-1 text-role-on-surface-variant text-xs">({{ group.count }})</span>
          </div>
          <oc-list v-if="expandedGroups.has(group.key)" class="oc-timeline break-all ml-3">
            <li v-for="activity in group.activities" :key="activity.id">
              <div class="flex items-center">
                <oc-avatars
                  :items="getAvatarsFromActivity(activity)"
                  class="mr-1 inline-flex"
                  stacked
                  gap-size="small"
                  :width="16.8"
                  icon-size="xsmall"
                >
                  <template #userAvatars="{ avatars, width }">
                    <user-avatar
                      v-for="avatar in avatars"
                      :key="avatar.userId"
                      :user-id="avatar.userId"
                      :user-name="avatar.userName"
                      :width="width"
                    />
                  </template>
                </oc-avatars>
                <span v-html="getHtmlFromActivity(activity)" />
              </div>
              <span
                class="text-role-on-surface-variant text-sm mt-2"
                v-text="getTimeFromActivity(activity)"
              />
            </li>
          </oc-list>
        </div>
      </div>

      <!-- Flat view (default) -->
      <div v-else class="ml-2">
        <oc-list class="oc-timeline break-all">
          <li v-for="activity in activities" :key="activity.id">
            <div class="flex items-center">
              <oc-avatars
                :items="getAvatarsFromActivity(activity)"
                class="mr-1 inline-flex"
                stacked
                gap-size="small"
                :width="16.8"
                icon-size="xsmall"
              >
                <template #userAvatars="{ avatars, width }">
                  <user-avatar
                    v-for="avatar in avatars"
                    :key="avatar.userId"
                    :user-id="avatar.userId"
                    :user-name="avatar.userName"
                    :width="width"
                  />
                </template>
              </oc-avatars>
              <span v-html="getHtmlFromActivity(activity)" />
            </div>
            <span
              class="text-role-on-surface-variant text-sm mt-2"
              v-text="getTimeFromActivity(activity)"
            />
          </li>
        </oc-list>
        <p class="text-role-on-surface-variant text-sm" v-text="activitiesFooterText" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, Ref, ref, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  FolderVaultEngine,
  formatDateFromDateTime,
  getVaultClaim,
  resolveFolderVault,
  useClientService,
  useExtensionRegistry,
  useGetMatchingSpace,
  UserAvatar
} from '@opencloud-eu/web-pkg'
import { useTask } from 'vue-concurrency'
import { call, Resource } from '@opencloud-eu/web-client'
import { DateTime } from 'luxon'
import { Activity } from '@opencloud-eu/web-client/graph/generated'
import escape from 'lodash-es/escape'

interface ActivityGroup {
  key: string
  label: string
  count: number
  activities: Activity[]
}

interface GroupedResponse {
  groupBy: string
  groups: ActivityGroup[]
}

const { $gettext, $ngettext, current: currentLanguage } = useGettext()
const clientService = useClientService()
const extensionRegistry = useExtensionRegistry()
const { getMatchingSpace } = useGetMatchingSpace()
const resource = inject<Ref<Resource>>('resource')
const activities = ref<Activity[]>([])
const groupedData = ref<GroupedResponse | null>(null)
const expandedGroups = ref(new Set<string>())
const activitiesLimit = 200

const selectedTimeRange = ref('')
const selectedGroupBy = ref('')

const timeRanges = [
  { value: '7d', label: $gettext('7d') },
  { value: '1m', label: $gettext('1M') },
  { value: '3m', label: $gettext('3M') },
  { value: '1y', label: $gettext('1J') },
  { value: '', label: $gettext('Alle') }
]

const groupModes = [
  { value: 'user', label: $gettext('Nutzer') },
  { value: 'container', label: $gettext('Ordner') }
]

const groupName = (label: string) => label.split(' → ')[0]
const groupContext = (label: string) => {
  const parts = label.split(' → ')
  return parts.length > 1 ? `in ${parts[1]}` : ''
}

const toggleGroup = (key: string) => {
  const s = new Set(unref(expandedGroups))
  if (s.has(key)) {
    s.delete(key)
  } else {
    s.add(key)
  }
  expandedGroups.value = s
}

const hasActivities = computed(() => {
  if (unref(groupedData)) {
    return unref(groupedData)!.groups.length > 0
  }
  return unref(activities).length > 0
})

// Inside an unlocked vault the activity feed carries the encrypted blob names
// the server stores. Decrypt every resource-name variable in place so the
// feed reads like the user's cleartext file names.
const decryptActivityNames = async (items: Activity[], engine: FolderVaultEngine) => {
  for (const activity of items) {
    const variables = activity.template?.variables as Record<string, any> | undefined
    if (!variables) {
      continue
    }
    for (const [key, value] of Object.entries(variables)) {
      if (key === 'user' || key === 'sharee' || !value) {
        continue
      }
      for (const field of ['name', 'displayName'] as const) {
        if (typeof value[field] !== 'string') {
          continue
        }
        try {
          value[field] = await engine.decryptPath(value[field])
        } catch {
          // not a vault-encrypted segment - leave it untouched
        }
      }
    }
  }
}

const activitiesFooterText = computed(() => {
  return $ngettext(
    'Showing %{activitiesCount} activity',
    'Showing %{activitiesCount} activities',
    unref(activities).length,
    {
      activitiesCount: unref(activities).length.toString()
    }
  )
})

const loadActivitiesTask = useTask(function* (signal) {
  const filters = [`itemid:${unref(resource).fileId}`, `limit:${activitiesLimit}`, 'sort:desc']

  const tr = unref(selectedTimeRange)
  if (tr) {
    filters.push(`timerange:${tr}`)
  }

  const gb = unref(selectedGroupBy)
  if (gb) {
    filters.push(`groupby:${gb}`)
  }

  // When groupby is active, fetch raw response to get grouped format
  if (gb) {
    const httpClient = (clientService as any).httpAuthenticated
    if (httpClient) {
      try {
        const { data } = yield httpClient.get(
          `/graph/v1beta1/extensions/org.libregraph/activities?kql=${encodeURIComponent(filters.join(' AND '))}`
        )
        if (data.groupBy) {
          groupedData.value = data as GroupedResponse
          activities.value = []
          expandedGroups.value = new Set(data.groups.map((g: ActivityGroup) => g.key))

          // Decrypt vault names in grouped activities
          const res = unref(resource)
          const space = res ? getMatchingSpace(res) : null
          const claim = space ? getVaultClaim(extensionRegistry, space, res.path) : null
          if (claim?.encryptsNames) {
            const vaultEngine = yield* call(resolveFolderVault(extensionRegistry, space, res.path))
            if (vaultEngine) {
              for (const group of data.groups) {
                yield* call(decryptActivityNames(group.activities, vaultEngine))
              }
            }
          }
          return
        }
      } catch { /* fall through to flat */ }
    }
  }

  // Flat response
  groupedData.value = null
  const loaded = yield* call(
    clientService.graphAuthenticated.activities.listActivities(filters.join(' AND '), { signal })
  )

  const res = unref(resource)
  const space = res ? getMatchingSpace(res) : null
  const claim = space ? getVaultClaim(extensionRegistry, space, res.path) : null
  if (claim?.encryptsNames) {
    const vaultEngine = yield* call(resolveFolderVault(extensionRegistry, space, res.path))
    if (vaultEngine) {
      yield* call(decryptActivityNames(loaded, vaultEngine))
    }
  }

  activities.value = loaded
}).restartable()

const isLoading = computed(() => {
  return loadActivitiesTask.isRunning || !loadActivitiesTask.last
})

const getHtmlFromActivity = (activity: Activity) => {
  let message = activity.template.message
  for (const [key, value] of Object.entries(activity.template.variables)) {
    const escapedValue = escape(value.displayName || value.name)
    message = message.replace(`{${key}}`, `<strong>${escapedValue}</strong>`)
  }
  return message
}

const getAvatarsFromActivity = (activity: Activity) => {
  const avatars = []
  for (const key of ['user', 'sharee']) {
    const entry = (activity.template.variables as Record<string, any>)[key]
    if (entry) {
      avatars.push({
        userName: entry.displayName,
        displayName: entry.displayName,
        userId: entry.id,
        avatarType: entry.shareType || 'user'
      })
    }
  }
  return avatars
}

const getTimeFromActivity = (activity: Activity) => {
  const dateTime = DateTime.fromISO(activity.times.recordedTime)
  return formatDateFromDateTime(dateTime, currentLanguage)
}

watch(
  [resource, selectedTimeRange, selectedGroupBy],
  () => {
    loadActivitiesTask.perform()
  },
  {
    immediate: true,
    deep: true
  }
)
</script>

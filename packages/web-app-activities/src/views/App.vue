<template>
  <h1 class="text-lg" v-text="$gettext('Activities')" />
  <div class="w-full mb-4 flex items-center gap-2 flex-wrap">
    <item-filter
      ref="mediaTypeFilter"
      :allow-multiple="false"
      :filter-label="$gettext('Location')"
      :filterable-attributes="['name']"
      :option-filter-label="$gettext('Filter location')"
      :show-option-filter="true"
      :items="filterableSpaces"
      :close-on-click="true"
      display-name-attribute="name"
      filter-name="location"
    >
      <template #image="{ item }">
        <oc-icon :name="getLocationFilterIcon(item)" />
      </template>
      <template #item="{ item }">
        <div v-text="item.name" />
      </template>
    </item-filter>

    <!-- Time range chips -->
    <div class="flex gap-1">
      <oc-button
        v-for="range in timeRanges"
        :key="range.value"
        :variation="selectedTimeRange === range.value ? 'primary' : 'passive'"
        size="small"
        appearance="outline"
        @click="selectedTimeRange = range.value"
      >
        {{ range.label }}
      </oc-button>
    </div>

    <!-- Group by toggle -->
    <div class="flex gap-1 ml-auto">
      <oc-button
        v-for="mode in groupModes"
        :key="mode.value"
        :variation="selectedGroupBy === mode.value ? 'primary' : 'passive'"
        size="small"
        appearance="outline"
        @click="selectedGroupBy = selectedGroupBy === mode.value ? '' : mode.value"
      >
        <oc-icon :name="mode.icon" size="small" class="mr-1" />
        {{ mode.label }}
      </oc-button>
    </div>
  </div>

  <app-loading-spinner v-if="isLoading" />
  <template v-else>
    <no-content-message v-if="!hasActivities" icon="pulse">
      <template #message>
        <span v-text="$gettext('No activities found')" />
      </template>
    </no-content-message>

    <!-- Grouped view -->
    <template v-else-if="groupedResponse">
      <div v-for="group in groupedResponse.groups" :key="group.key" class="mb-6">
        <div
          class="flex items-center cursor-pointer py-2 px-1 hover:bg-surface-secondary rounded"
          @click="toggleGroup(group.key)"
        >
          <oc-icon :name="expandedGroups.has(group.key) ? 'arrow-down-s' : 'arrow-right-s'" size="small" />
          <span class="font-semibold ml-1">{{ group.label }}</span>
          <span class="ml-2 text-role-on-surface-variant text-sm">({{ group.count }})</span>
        </div>
        <ActivityList v-if="expandedGroups.has(group.key)" :activities="group.activities" class="ml-4" />
      </div>
    </template>

    <!-- Flat view (default) -->
    <ActivityList v-else :activities="activities" />
  </template>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, unref, watch } from 'vue'
import {
  AppLoadingSpinner,
  ItemFilter,
  NoContentMessage,
  useClientService,
  useRouteQuery,
  useSpacesStore
} from '@opencloud-eu/web-pkg'
import { storeToRefs } from 'pinia'
import {
  call,
  isPersonalSpaceResource,
  isProjectSpaceResource,
  SpaceResource
} from '@opencloud-eu/web-client'
import { useTask } from 'vue-concurrency'
import { Activity } from '@opencloud-eu/web-client/graph/generated'
import { useGettext } from 'vue3-gettext'
import ActivityList from './ActivityList.vue'

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

export default defineComponent({
  name: 'App',
  components: { ActivityList, NoContentMessage, ItemFilter, AppLoadingSpinner },
  setup() {
    const { $gettext } = useGettext()
    const spacesStore = useSpacesStore()
    const { spaces } = storeToRefs(spacesStore)
    const clientService = useClientService()
    const activities = ref<Activity[]>([])
    const groupedResponse = ref<GroupedResponse | null>(null)
    const expandedGroups = ref(new Set<string>())

    const selectedTimeRange = ref('')
    const selectedGroupBy = ref('')

    const locationQuery = useRouteQuery('q_location')

    const timeRanges = [
      { value: '7d', label: $gettext('7 Days') },
      { value: '1m', label: $gettext('1 Month') },
      { value: '3m', label: $gettext('3 Months') },
      { value: '1y', label: $gettext('1 Year') },
      { value: '', label: $gettext('All') }
    ]

    const groupModes = [
      { value: 'user', label: $gettext('By User'), icon: 'user' },
      { value: 'container', label: $gettext('By Folder'), icon: 'folder' }
    ]

    const filterableSpaces = computed(() => {
      return [...unref(spaces)]
        .filter(
          (space) =>
            !space.disabled && (isProjectSpaceResource(space) || isPersonalSpaceResource(space))
        )
        .sort((a, b) => {
          if (isPersonalSpaceResource(a) === isPersonalSpaceResource(b)) {
            return a.name.localeCompare(b.name)
          }
          return isPersonalSpaceResource(a) ? -1 : 1
        })
    })

    const hasActivities = computed(() => {
      if (unref(groupedResponse)) {
        return unref(groupedResponse)!.groups.length > 0
      }
      return unref(activities).length > 0
    })

    const toggleGroup = (key: string) => {
      const s = new Set(unref(expandedGroups))
      if (s.has(key)) {
        s.delete(key)
      } else {
        s.add(key)
      }
      expandedGroups.value = s
    }

    const loadActivitiesTask = useTask(function* (signal) {
      const filters = ['sort:desc', 'limit:200']

      if (unref(locationQuery)) {
        filters.push(`itemid:${unref(locationQuery)}`)
      }

      const tr = unref(selectedTimeRange)
      if (tr) {
        filters.push(`timerange:${tr}`)
      }

      const gb = unref(selectedGroupBy)
      if (gb) {
        filters.push(`groupby:${gb}`)
      }

      const httpClient = (clientService as any).graphAuthenticated.activities
      const response = yield* call(
        httpClient.listActivities(filters.join(' AND '), { signal })
      )

      // The API returns either { value: [...] } (flat) or { groupBy, groups } (grouped)
      // listActivities extracts .value, so for grouped responses we need the raw response
      if (gb) {
        // Re-fetch with raw axios to get grouped response
        const axiosClient = (clientService as any).httpAuthenticated
        if (axiosClient) {
          try {
            const { data } = yield axiosClient.get(
              `/graph/v1beta1/extensions/org.libregraph/activities?kql=${encodeURIComponent(filters.join(' AND '))}`
            )
            if (data.groupBy) {
              groupedResponse.value = data as GroupedResponse
              activities.value = []
              // Auto-expand all groups
              expandedGroups.value = new Set(data.groups.map((g: ActivityGroup) => g.key))
              return
            }
          } catch { /* fall through to flat */ }
        }
      }

      groupedResponse.value = null
      activities.value = response
    })

    const isLoading = computed(() => loadActivitiesTask.isRunning || !loadActivitiesTask.last)

    const getLocationFilterIcon = (space: SpaceResource) => {
      if (isPersonalSpaceResource(space)) {
        return 'folder'
      }
      return 'layout-grid'
    }

    onMounted(() => {
      loadActivitiesTask.perform()
    })

    watch([locationQuery, selectedTimeRange, selectedGroupBy], () => {
      loadActivitiesTask.perform()
    })

    return {
      activities,
      groupedResponse,
      expandedGroups,
      filterableSpaces,
      getLocationFilterIcon,
      hasActivities,
      isLoading,
      selectedTimeRange,
      selectedGroupBy,
      timeRanges,
      groupModes,
      toggleGroup
    }
  }
})
</script>

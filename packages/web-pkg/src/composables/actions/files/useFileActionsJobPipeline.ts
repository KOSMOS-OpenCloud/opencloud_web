import { computed, ref, unref, watch } from 'vue'
import { useJobService, useJobProgress, Pipeline } from '../../jobs'
import { FileAction } from '../../../composables/actions'
import { useAuthStore } from '../../../composables/piniaStores'
import { Resource } from '@opencloud-eu/web-client'

export const useFileActionsJobPipeline = () => {
  const jobService = useJobService()
  const { showJobProgress } = useJobProgress()
  const authStore = useAuthStore()
  const pipelines = ref<Pipeline[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  const loadPipelines = async () => {
    if (unref(loaded) || unref(loading)) return
    if (!authStore.accessToken) return
    loading.value = true
    console.debug('[jobengine] loading pipelines...')
    try {
      pipelines.value = await jobService.getPipelines()
      loaded.value = true
      console.debug('[jobengine] loaded', pipelines.value.length, 'pipelines:', pipelines.value.map((p) => p.id))
    } catch (e) {
      console.warn('[jobengine] failed to load pipelines:', e)
      pipelines.value = []
    } finally {
      loading.value = false
    }
  }

  // Load pipelines once auth token is available
  watch(() => authStore.accessToken, (token) => {
    if (token && !unref(loaded)) {
      loadPipelines()
    }
  }, { immediate: true })

  const actions = computed<FileAction[]>(() => {
    return unref(pipelines).map((pipeline) => ({
      name: `job-${pipeline.id}`,
      icon: pipeline.icon || 'play',
      label: () => pipeline.label,
      isVisible: ({ resources }: { resources: Resource[] }) => {
        if (!resources.length) return false
        if (!pipeline.batch && resources.length > 1) return false
        return resources.some((r) =>
          pipeline.sourceTypes.includes('*') ||
          pipeline.sourceTypes.includes(r.mimeType?.toLowerCase() || '')
        )
      },
      handler: async ({ resources }: { resources: Resource[] }) => {
        const resourceIds = resources.map((r) => r.fileId).filter(Boolean) as string[]
        if (!resourceIds.length) return

        try {
          const job = await jobService.submitJob({
            pipeline: pipeline.id,
            resources: resourceIds
          })
          showJobProgress(job.jobId)
        } catch (e: any) {
          console.error('Job submission failed:', e)
        }
      },
      componentType: 'button',
      class: 'oc-files-actions-job-pipeline'
    }))
  })

  return { actions, pipelines, loadPipelines }
}

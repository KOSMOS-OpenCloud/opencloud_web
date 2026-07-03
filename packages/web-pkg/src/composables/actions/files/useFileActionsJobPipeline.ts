import { computed, ref, unref, watch } from 'vue'
import { useJobService, useJobProgress, Pipeline } from '../../jobs'
import { FileAction, FileActionOptions } from '../../../composables/actions'
import { useAuthStore } from '../../../composables/piniaStores'
import { useGetMatchingSpace } from '../../../composables/spaces'

export const useFileActionsJobPipeline = () => {
  const jobService = useJobService()
  const { showJobProgress } = useJobProgress()
  const authStore = useAuthStore()
  const { getMatchingSpace } = useGetMatchingSpace()
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
    return unref(pipelines)
      .filter((p) => !p.menu || p.menu === 'context')
      .map((pipeline) => ({
        name: `job-${pipeline.id}`,
        icon: pipeline.icon || 'play',
        label: () => pipeline.label,
        isVisible: ({ resources }: FileActionOptions) => {
          if (!resources?.length) return false
          if (!pipeline.sourceTypes?.length) return true
          return resources.some((r) =>
            pipeline.sourceTypes.includes('*') ||
            pipeline.sourceTypes.includes(r.mimeType?.toLowerCase() || '')
          )
        },
        handler: async ({ resources }: FileActionOptions) => {
          if (!resources?.length) return

          try {
            if (pipeline.shares?.type) {
              // Share-based job: create shares, submit with WebDAV URLs
              const space = getMatchingSpace(resources[0])
              if (!space) {
                console.error('No matching space for resource')
                return
              }
              const { job } = await jobService.submitJobWithShares(pipeline, resources, space)
              showJobProgress(job.jobId)
            } else {
              // Param-only job: submit without shares
              const resourceIds = resources.map((r) => r.fileId).filter(Boolean) as string[]
              const job = await jobService.submitJob({
                pipeline: pipeline.id,
                resources: resourceIds
              })
              showJobProgress(job.jobId)
            }
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

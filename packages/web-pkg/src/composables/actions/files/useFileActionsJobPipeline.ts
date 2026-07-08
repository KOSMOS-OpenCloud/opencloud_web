import { computed, ref, unref, watch } from 'vue'
import { useJobService, useJobProgress, Pipeline } from '../../jobs'
import { FileAction, FileActionOptions } from '../../../composables/actions'
import { useAuthStore } from '../../../composables/piniaStores'
import { useMessages } from '../../../composables/piniaStores/messages'
import { useGetMatchingSpace } from '../../../composables/spaces'
import type { Resource } from '@opencloud-eu/web-client'

/**
 * Check if a parentDir share can be created for this resource.
 * Personal space root cannot be shared via public link.
 */
function canShareParent(resource: Resource): boolean {
  if (!resource.parentFolderId) return false
  // parentFolderId equals the space root → can't share personal root
  if (resource.path === '/' + resource.name) return false
  return true
}

export const useFileActionsJobPipeline = () => {
  const jobService = useJobService()
  const { showJobProgress } = useJobProgress()
  const authStore = useAuthStore()
  const { showErrorMessage } = useMessages()
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

          // Check source type match
          // Folders have no mimeType in the frontend; treat them as httpd/unix-directory (WebDAV standard)
          const typeMatch = !pipeline.sourceTypes?.length || resources.some((r) => {
            const mime = r.mimeType?.toLowerCase() || (r.isFolder ? 'httpd/unix-directory' : '')
            return pipeline.sourceTypes.includes('*') || pipeline.sourceTypes.includes(mime)
          })
          if (!typeMatch) return false

          // parentDir shares require a shareable parent folder
          if (pipeline.shares?.type === 'parentDir') {
            return resources.every((r) => canShareParent(r))
          }

          return true
        },
        handler: async ({ resources }: FileActionOptions) => {
          if (!resources?.length) return

          try {
            if (pipeline.shares?.type) {
              const space = getMatchingSpace(resources[0])
              if (!space) {
                showErrorMessage({ title: 'Kein passender Space gefunden', errors: [] })
                return
              }
              const { job } = await jobService.submitJobWithShares(pipeline, resources, space)
              showJobProgress(job.jobId)
            } else {
              const resourceIds = resources.map((r) => r.fileId).filter(Boolean) as string[]
              const job = await jobService.submitJob({
                pipeline: pipeline.id,
                resources: resourceIds
              })
              showJobProgress(job.jobId)
            }
          } catch (e: any) {
            console.error('Job submission failed:', e)
            showErrorMessage({
              title: `${pipeline.label} fehlgeschlagen`,
              errors: [e]
            })
          }
        },
        componentType: 'button',
        class: 'oc-files-actions-job-pipeline'
      }))
  })

  return { actions, pipelines, loadPipelines }
}

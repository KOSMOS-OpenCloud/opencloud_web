import { computed, ref, unref, Ref } from 'vue'
import { useJobService, useJobProgress, Pipeline } from '../../jobs'
import { FileAction } from '../../../composables/actions'
import { Resource } from '@opencloud-eu/web-client'

export const useFileActionsJobPipeline = () => {
  const jobService = useJobService()
  const { showJobProgress } = useJobProgress()
  const pipelines = ref<Pipeline[]>([])
  const loaded = ref(false)

  const loadPipelines = async () => {
    if (unref(loaded)) return
    try {
      pipelines.value = await jobService.getPipelines()
    } catch {
      pipelines.value = []
    }
    loaded.value = true
  }

  // Load pipelines on first access
  loadPipelines()

  const actions = computed<FileAction[]>(() => {
    return unref(pipelines).map((pipeline) => ({
      name: `job-${pipeline.id}`,
      icon: pipeline.icon || 'play',
      label: () => pipeline.label,
      isVisible: ({ resources }: { resources: Resource[] }) => {
        if (!resources.length) return false
        if (!pipeline.batch && resources.length > 1) return false
        return resources.some((r) =>
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

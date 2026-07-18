import { ref, onUnmounted } from 'vue'
import { useJobService, Job } from './useJobService'
import { useMessages } from '../piniaStores/messages'
import { addActiveJob, removeActiveJob } from './activeJobs'

export const useJobProgress = () => {
  const jobService = useJobService()
  const messageStore = useMessages()
  const activePolls = ref(new Map<string, ReturnType<typeof setInterval>>())

  const pollJob = (jobId: string, onComplete?: (job: Job) => void) => {
    if (activePolls.value.has(jobId)) return
    addActiveJob(jobId)

    const interval = setInterval(async () => {
      try {
        const job = await jobService.getJobStatus(jobId)

        if (job.status === 'completed') {
          stopPolling(jobId)
          await jobService.cleanupJobShares(jobId)
          messageStore.showMessage({
            title: `${job.pipeline}: fertig`,
            status: 'success'
          })
          onComplete?.(job)
        } else if (job.status === 'failed') {
          stopPolling(jobId)
          await jobService.cleanupJobShares(jobId)
          messageStore.showMessage({
            title: `${job.pipeline} fehlgeschlagen: ${job.error || 'Unbekannter Fehler'}`,
            status: 'danger'
          })
        } else if (job.status === 'cancelled') {
          stopPolling(jobId)
          await jobService.cleanupJobShares(jobId)
          messageStore.showMessage({
            title: `${job.pipeline} abgebrochen`,
            status: 'warning'
          })
        }
      } catch {
        stopPolling(jobId)
      }
    }, 2000)

    activePolls.value.set(jobId, interval)
  }

  const stopPolling = (jobId: string) => {
    const interval = activePolls.value.get(jobId)
    if (interval) {
      clearInterval(interval)
      activePolls.value.delete(jobId)
    }
    removeActiveJob(jobId)
  }

  const showJobProgress = async (jobId: string, onComplete?: (job: Job) => void) => {
    messageStore.showMessage({
      title: 'Job gestartet...',
      status: 'info'
    })
    pollJob(jobId, onComplete)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    for (const [jobId] of activePolls.value) {
      stopPolling(jobId)
    }
  })

  return { showJobProgress, pollJob, stopPolling }
}

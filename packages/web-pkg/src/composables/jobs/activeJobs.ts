import { ref, computed } from 'vue'

/**
 * Global reactive set of active job IDs.
 * Updated by useJobService (on submit) and useJobProgress (on completion).
 * Read by any component that wants to show an active-job count.
 */
const activeJobIds = ref<Set<string>>(new Set())

let initialized = false

export function addActiveJob(jobId: string) {
  activeJobIds.value = new Set([...activeJobIds.value, jobId])
}

export function removeActiveJob(jobId: string) {
  const next = new Set(activeJobIds.value)
  next.delete(jobId)
  activeJobIds.value = next
}

export const activeJobCount = computed(() => activeJobIds.value.size)

/**
 * One-time initial load of active jobs. Called once after auth is ready.
 */
export async function initActiveJobs(httpClient: any) {
  if (initialized) return
  initialized = true
  try {
    const { data } = await httpClient.get('/api/v0/jobs/')
    const jobs = data?.jobs ?? []
    for (const j of jobs) {
      if (j.status === 'running' || j.status === 'queued') {
        activeJobIds.value = new Set([...activeJobIds.value, j.jobId])
      }
    }
  } catch {
    // jobengine not available
  }
}

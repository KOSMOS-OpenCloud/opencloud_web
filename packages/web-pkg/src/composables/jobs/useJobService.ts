import { useClientService } from '../clientService'
import { usePasswordPolicyService } from '../passwordPolicyService'
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { SharingLinkType } from '@opencloud-eu/web-client/graph/generated'

export interface SharesConfig {
  type: string // srcFile | srcDir | parentDir | sameFile | sameDir | srcDstFile | srcDstDir
}

export interface Pipeline {
  id: string
  label: string
  icon: string
  sourceTypes: string[]
  targetLocation: string
  menu?: string
  shares?: SharesConfig
  jobType: string
  notification?: string
  designedBy?: string
}

export interface JobSubmission {
  pipeline: string
  resources: string[]
  targetPath?: string
  createTarget?: boolean
  params?: Record<string, any>
}

export interface JobResult {
  source: string
  target: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  error?: string
}

export interface Job {
  jobId: string
  pipeline: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  completed: number
  total: number
  results: JobResult[]
  error?: string
}

interface ShareRef {
  permId: string
  driveId: string
  itemId: string
}

export const useJobService = () => {
  const clientService = useClientService()
  const passwordPolicyService = usePasswordPolicyService()

  const getPipelines = async (): Promise<Pipeline[]> => {
    const httpClient = (clientService as any).httpAuthenticated
    const { data } = await httpClient.get('/api/v0/jobs/pipelines')
    return data.pipelines || []
  }

  const submitJob = async (submission: JobSubmission): Promise<Job> => {
    const httpClient = (clientService as any).httpAuthenticated
    const { data } = await httpClient.post('/api/v0/jobs', submission)
    return data
  }

  /**
   * Submit a job with automatic share creation based on pipeline.shares config.
   * Creates public link shares for origin (and optionally destination),
   * passes WebDAV URLs as job params, and cleans up shares after completion.
   */
  const submitJobWithShares = async (
    pipeline: Pipeline,
    resources: Resource[],
    space: SpaceResource,
    params?: Record<string, any>
  ): Promise<{ job: Job; shares: ShareRef[] }> => {
    const shares: ShareRef[] = []
    const jobParams: Record<string, any> = { ...(params || {}) }

    const shareType = pipeline.shares?.type
    if (shareType && resources.length > 0) {
      const resource = resources[0]
      const password = passwordPolicyService.generatePassword()
      const writable = ['parentDir', 'sameFile', 'sameDir', 'srcDstFile', 'srcDstDir'].includes(shareType)
      const useParent = shareType === 'parentDir'

      const shareResource = useParent && resource.parentFolderId
        ? { ...resource, id: resource.parentFolderId } as Resource
        : resource
      const link = await createJobShare(space, shareResource, password, writable)
      shares.push({
        permId: link.id,
        driveId: space.id,
        itemId: shareResource.id
      })
      jobParams.origin_url = buildWebdavUrl(link.webUrl, password)
      jobParams.origin_password = password
      if (useParent) {
        jobParams.origin_filename = resource.name
      }
    }

    const job = await submitJob({
      pipeline: pipeline.id,
      resources: resources.map((r) => r.id),
      params: jobParams
    })

    // Store share refs for cleanup
    if (shares.length > 0) {
      storeJobShares(job.jobId, shares)
    }

    return { job, shares }
  }

  const createJobShare = async (
    space: SpaceResource,
    resource: Resource,
    password: string,
    writable = false
  ) => {
    const graphClient = clientService.graphAuthenticated
    const expiresIn = new Date(Date.now() + 3600 * 1000) // 1 hour

    const link = await graphClient.permissions.createLink(space.id, resource.id, {
      type: writable ? SharingLinkType.Edit : SharingLinkType.View,
      password,
      expirationDateTime: expiresIn.toISOString()
    })

    return link
  }

  const cleanupJobShares = async (jobId: string) => {
    const refs = getJobShares(jobId)
    if (!refs?.length) return

    const graphClient = clientService.graphAuthenticated
    for (const ref of refs) {
      try {
        await graphClient.permissions.deletePermission(ref.driveId, ref.itemId, ref.permId)
      } catch {
        // share may already be expired
      }
    }
    removeJobShares(jobId)
  }

  const getJobStatus = async (jobId: string): Promise<Job> => {
    const httpClient = (clientService as any).httpAuthenticated
    const { data } = await httpClient.get(`/api/v0/jobs/${jobId}`)
    return data
  }

  const cancelJob = async (jobId: string): Promise<void> => {
    const httpClient = (clientService as any).httpAuthenticated
    await httpClient.delete(`/api/v0/jobs/${jobId}`)
  }

  const listJobs = async (status?: string): Promise<Job[]> => {
    const httpClient = (clientService as any).httpAuthenticated
    const params = status ? `?status=${status}` : ''
    const { data } = await httpClient.get(`/api/v0/jobs${params}`)
    return data.jobs || []
  }

  return {
    getPipelines,
    submitJob,
    submitJobWithShares,
    cleanupJobShares,
    getJobStatus,
    cancelJob,
    listJobs
  }
}

// Simple in-memory store for job → share refs (cleanup tracking)
const jobShareStore = new Map<string, ShareRef[]>()

function storeJobShares(jobId: string, shares: ShareRef[]) {
  jobShareStore.set(jobId, shares)
}

function getJobShares(jobId: string): ShareRef[] | undefined {
  return jobShareStore.get(jobId)
}

function removeJobShares(jobId: string) {
  jobShareStore.delete(jobId)
}

// Password generation removed — uses PasswordPolicyService.generatePassword() instead
  return pw
}

function buildWebdavUrl(webUrl: string, password: string): string {
  // Convert share web URL to WebDAV public-files URL
  // e.g. https://cloud.example.com/s/abc123 → https://cloud.example.com/dav/public-files/abc123
  try {
    const url = new URL(webUrl)
    const token = url.pathname.split('/').pop()
    return `${url.origin}/dav/public-files/${token}`
  } catch {
    return webUrl
  }
}

import { useClientService } from '../clientService'

export interface Pipeline {
  id: string
  label: string
  icon: string
  sourceTypes: string[]
  targetLocation: string
  userChoosableTarget: boolean
  batch: boolean
}

export interface JobSubmission {
  pipeline: string
  resources: string[]
  targetPath?: string
  createTarget?: boolean
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

export const useJobService = () => {
  const clientService = useClientService()

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

  return { getPipelines, submitJob, getJobStatus, cancelJob, listJobs }
}

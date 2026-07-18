import { SSEEventOptions } from './types'
import { removeActiveJob } from '@opencloud-eu/web-pkg'

export const onSSEJobFinishedEvent = ({ messageStore, sseData }: SSEEventOptions) => {
  const status = sseData.status
  const pipeline = sseData.pipeline || 'Job'
  const jobId = sseData.jobId

  if (jobId) {
    removeActiveJob(jobId)
  }

  if (status === 'completed') {
    messageStore.showMessage({
      title: `${pipeline}: abgeschlossen`,
      status: 'success'
    })
  } else if (status === 'failed') {
    messageStore.showMessage({
      title: `${pipeline}: fehlgeschlagen`,
      desc: sseData.error || '',
      status: 'danger'
    })
  }
}

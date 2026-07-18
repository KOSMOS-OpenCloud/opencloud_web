import { SSEEventOptions } from './types'

export const onSSEJobFinishedEvent = ({ messageStore, sseData }: SSEEventOptions) => {
  const status = sseData.status
  const pipeline = sseData.pipeline || 'Job'

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

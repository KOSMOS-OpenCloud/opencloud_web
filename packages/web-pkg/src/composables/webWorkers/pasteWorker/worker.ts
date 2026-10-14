import PQueue from 'p-queue'
import { join } from 'path'
import { webdav as _webdav } from '@opencloud-eu/web-client'
import type { WorkerTopic } from '../../piniaStores/webWorkers'
import { TransferType } from '../../../helpers/resource/conflictHandling/types'
import type { TransferData } from '../../../helpers/resource/conflictHandling'
import { PasteWorkerReturnData } from './usePasteWorker'

type MessageData = {
  baseUrl?: string
  accessToken?: string
  headers?: Record<string, string>
  transferData?: TransferData[]
}

type Message = {
  topic: WorkerTopic
  data: MessageData
}

let storedHeaders: Record<string, string>

self.onmessage = async (e: MessageEvent) => {
  const { topic, data } = JSON.parse(e.data) as Message

  if (topic === 'tokenUpdate' && storedHeaders) {
    const existingToken = storedHeaders.Authorization

    // token must only be updated for bearer tokens, not on public links
    if (existingToken?.toString().startsWith('Bearer')) {
      storedHeaders.Authorization = data.accessToken
    }

    return
  }

  const { baseUrl, headers, transferData } = data

  storedHeaders = headers
  const webdav = _webdav(baseUrl, () => storedHeaders)

  const successful: PasteWorkerReturnData['successful'] = []
  const failed: PasteWorkerReturnData['failed'] = []
  const queue = new PQueue({ concurrency: 4 })

  const doCopy = (transferData: TransferData) =>
    webdav.copyFiles(
      transferData.sourceSpace,
      transferData.resource,
      transferData.targetSpace,
      { path: transferData.path },
      { overwrite: transferData.overwrite }
    )

  const doMove = (transferData: TransferData) =>
    webdav.moveFiles(
      transferData.sourceSpace,
      transferData.resource,
      transferData.targetSpace,
      { path: transferData.path },
      { overwrite: transferData.overwrite }
    )

  const toFailure = (resource: TransferData['resource'], e: any) => ({
    resourceName: resource.name,
    message: e.message,
    statusCode: e.statusCode,
    xReqId: e.response?.headers?.get('x-request-id')
  })

  const transfers = transferData.filter((data) => !data.mergeFinalize)
  // deepest folders first, so nested merged folders are cleaned up before their parents
  const finalizers = transferData
    .filter((data) => data.mergeFinalize)
    .sort((a, b) => b.resource.path.split('/').length - a.resource.path.split('/').length)

  const promises = transfers.map((data) => {
    return queue.add(async () => {
      const resource = data.resource

      console.log(`[paste] ${data.transferType} "${resource.name}" from: ${resource.path} to: ${data.path}`)

      try {
        if (data.transferType === TransferType.COPY) {
          await doCopy(data)
          resource.id = undefined
          resource.fileId = undefined
        } else {
          await doMove(data)
        }

        resource.path = join(data.targetFolder.path, resource.name)
        resource.webDavPath = join(data.targetFolder.webDavPath, resource.name)

        // parts of a folder merge are reported via their finalize entry
        if (!data.mergePart) {
          successful.push(resource)
        }
      } catch (e) {
        console.error(e)
        failed.push(toFailure(resource, e))
      }
    })
  })

  await Promise.allSettled(promises)

  for (const data of finalizers) {
    const resource = data.resource
    try {
      if (data.transferType === TransferType.MOVE) {
        const { children } = await webdav.listFiles(data.sourceSpace, { path: resource.path })
        if (children.length > 0) {
          // entries kept on purpose (or failed above) remain in the source folder
          continue
        }
        console.log(`[paste] merge: removing emptied source folder ${resource.path}`)
        await webdav.deleteFile(data.sourceSpace, { path: resource.path })
      }

      if (data.mergeFinalize.report) {
        resource.path = join(data.targetFolder.path, resource.name)
        resource.webDavPath = join(data.targetFolder.webDavPath, resource.name)
        successful.push(resource)
      }
    } catch (e) {
      console.error(e)
      failed.push(toFailure(resource, e))
    }
  }

  postMessage(JSON.stringify({ successful, failed }))
}

import { unref } from 'vue'
import { useWebWorker } from '@vueuse/core'
import PasteWorker from '../../../../../src/composables/webWorkers/pasteWorker/worker?worker'
import { TransferType } from '../../../../../src/helpers/resource/conflictHandling'
import { mock } from 'vitest-mock-extended'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'

const resourceMock = {
  id: 'resourceId',
  name: 'resourceName'
}

const targetSpaceMock = {
  id: 'targetSpaceId'
}

const sourceSpaceMock = {
  id: 'sourceSpaceId'
}

const targetFolderMock = {
  id: 'targetFolderId',
  path: '/',
  webDavPath: '/'
}

const transferDataMock = {
  resource: resourceMock,
  sourceSpace: sourceSpaceMock,
  targetSpace: targetSpaceMock,
  targetFolder: targetFolderMock,
  path: '',
  baseUrl: 'https://example.com'
}

describe('paste worker', () => {
  let worker: ReturnType<typeof useWebWorker>
  let webDavMock: ReturnType<typeof mock<WebDAV>>

  let resolveTest: (value: boolean) => unknown
  let workerPromise: Promise<unknown>

  beforeEach(() => {
    worker = useWebWorker(PasteWorker as unknown as string, { type: 'module' })
    webDavMock = mock<WebDAV>()

    workerPromise = new Promise((resolve) => {
      resolveTest = resolve
    })

    vi.doMock('@opencloud-eu/web-client', async (importOriginal) => ({
      ...(await importOriginal<any>()),
      webdav: () => webDavMock
    }))
  })

  afterEach(() => {
    worker.terminate()

    workerPromise = undefined
    resolveTest = undefined
    webDavMock = undefined
  })

  it('calls webdav copy operation for copy actions', async () => {
    webDavMock.copyFiles.mockResolvedValue(undefined)

    unref(worker.worker).onmessage = (e: MessageEvent) => {
      const { successful } = JSON.parse(e.data)
      expect(successful.length).toBe(1)
      expect(webDavMock.copyFiles).toHaveBeenCalledTimes(1)

      resolveTest(true)
    }

    worker.post(
      JSON.stringify({
        topic: 'startProcess',
        data: {
          transferData: [{ ...transferDataMock, transferType: TransferType.COPY }]
        }
      })
    )

    await workerPromise
  })

  it('calls webdav move operation for move actions', async () => {
    webDavMock.moveFiles.mockResolvedValue(undefined)

    unref(worker.worker).onmessage = (e: MessageEvent) => {
      const { successful } = JSON.parse(e.data)
      expect(successful.length).toBe(1)
      expect(webDavMock.moveFiles).toHaveBeenCalledTimes(1)

      resolveTest(true)
    }

    worker.post(
      JSON.stringify({
        topic: 'startProcess',
        data: {
          transferData: [{ ...transferDataMock, transferType: TransferType.MOVE }]
        }
      })
    )

    await workerPromise
  })

  describe('folder merge', () => {
    const part = {
      ...transferDataMock,
      resource: { id: 'part', name: 'new.txt', path: '/src/x/new.txt' },
      transferType: TransferType.MOVE,
      mergePart: true
    }
    const finalize = {
      ...transferDataMock,
      resource: { id: 'src-x', name: 'x', path: '/src/x' },
      transferType: TransferType.MOVE,
      mergeFinalize: { report: true }
    }

    it('deletes the emptied source folder and reports only the merged folder', async () => {
      webDavMock.moveFiles.mockResolvedValue(undefined)
      webDavMock.listFiles.mockResolvedValue({ resource: undefined, children: [] })
      webDavMock.deleteFile.mockResolvedValue(undefined)

      unref(worker.worker).onmessage = (e: MessageEvent) => {
        const { successful, failed } = JSON.parse(e.data)
        expect(failed.length).toBe(0)
        expect(successful.map((r: { id: string }) => r.id)).toEqual(['src-x'])
        expect(webDavMock.moveFiles).toHaveBeenCalledTimes(1)
        expect(webDavMock.deleteFile).toHaveBeenCalledTimes(1)

        resolveTest(true)
      }

      worker.post(
        JSON.stringify({ topic: 'startProcess', data: { transferData: [part, finalize] } })
      )

      await workerPromise
    })

    it('keeps the source folder without error when entries were kept', async () => {
      webDavMock.moveFiles.mockResolvedValue(undefined)
      webDavMock.listFiles.mockResolvedValue({
        resource: undefined,
        children: [{ id: 'kept', name: 'same.txt', path: '/src/x/same.txt' }]
      })

      unref(worker.worker).onmessage = (e: MessageEvent) => {
        const { successful, failed } = JSON.parse(e.data)
        expect(failed.length).toBe(0)
        expect(successful.length).toBe(0)
        expect(webDavMock.deleteFile).not.toHaveBeenCalled()

        resolveTest(true)
      }

      worker.post(
        JSON.stringify({ topic: 'startProcess', data: { transferData: [part, finalize] } })
      )

      await workerPromise
    })
  })

  it('returns failed files', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    webDavMock.copyFiles.mockRejectedValue({ response: {} })

    unref(worker.worker).onmessage = (e: MessageEvent) => {
      const { failed } = JSON.parse(e.data)
      expect(failed.length).toBe(1)

      resolveTest(true)
    }

    worker.post(
      JSON.stringify({
        topic: 'startProcess',
        data: {
          transferData: [{ ...transferDataMock, transferType: TransferType.COPY }]
        }
      })
    )

    await workerPromise
  })
})

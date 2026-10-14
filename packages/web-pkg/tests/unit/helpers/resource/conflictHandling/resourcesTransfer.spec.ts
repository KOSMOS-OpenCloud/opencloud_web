import {
  ResolveConflict,
  ResolveStrategy,
  ResourceTransfer,
  TransferType,
  resolveFileNameDuplicate
} from '../../../../../src/helpers/resource/conflictHandling'
import { mock, mockDeep, mockReset } from 'vitest-mock-extended'
import { buildSpace, Resource, SpaceResource } from '@opencloud-eu/web-client'
import { ListFilesResult } from '@opencloud-eu/web-client/webdav'
import { Drive } from '@opencloud-eu/web-client/graph/generated'
import { createTestingPinia } from '@opencloud-eu/web-test-helpers'
import { ClientService } from '../../../../../src/services'
import { computed } from 'vue'

const clientServiceMock = mockDeep<ClientService>()
let resourcesToMove: Resource[]
let sourceSpace: SpaceResource
let targetSpace: SpaceResource
let targetFolder: Resource

describe('resourcesTransfer', () => {
  beforeEach(() => {
    createTestingPinia()
    mockReset(clientServiceMock)
    resourcesToMove = [
      {
        id: 'a',
        name: 'a',
        path: '/a',
        type: 'folder'
      },
      {
        id: 'b',
        name: 'b',
        path: '/b'
      }
    ]
    const spaceOptions = {
      id: 'c42c9504-2c19-44fd-87cc-b4fc20ecbb54'
    } as unknown as Drive
    sourceSpace = buildSpace(spaceOptions)
    targetSpace = buildSpace(spaceOptions)
    targetFolder = {
      id: 'target',
      path: 'target',
      webDavPath: '/target'
    }
  })
  it.each([
    { name: 'a', extension: '', expectName: 'a (1)' },
    { name: 'a', extension: '', expectName: 'a (2)', existing: [{ name: 'a (1)' }] },
    { name: 'a (1)', extension: '', expectName: 'a (1) (1)' },
    { name: 'b.png', extension: 'png', expectName: 'b (1).png' },
    { name: 'b.png', extension: 'png', expectName: 'b (2).png', existing: [{ name: 'b (1).png' }] }
  ])('should name duplicate file correctly', (dataSet) => {
    const existing = dataSet.existing ? [...resourcesToMove, ...dataSet.existing] : resourcesToMove
    const result = resolveFileNameDuplicate(dataSet.name, dataSet.extension, existing as Resource[])
    expect(result).toEqual(dataSet.expectName)
  })

  it('should prevent recursive paste', async () => {
    const resourcesTransfer = new ResourceTransfer(
      sourceSpace,
      resourcesToMove,
      targetSpace,
      resourcesToMove[0],
      computed(() => mock<Resource>()),
      clientServiceMock,
      vi.fn(),
      vi.fn()
    )
    const result = await resourcesTransfer.getTransferData(TransferType.COPY)
    expect(result.length).toBe(0)
  })

  describe('copyMoveResource without conflicts', () => {
    it.each([TransferType.COPY, TransferType.MOVE])(
      'should copy / move files without renaming them if no conflicts exist',
      async (action: TransferType) => {
        const listFilesResult: ListFilesResult = {
          resource: {} as Resource,
          children: []
        }
        clientServiceMock.webdav.listFiles.mockReturnValueOnce(
          new Promise((resolve) => resolve(listFilesResult))
        )
        const resourcesTransfer = new ResourceTransfer(
          sourceSpace,
          resourcesToMove,
          targetSpace,
          targetFolder,
          computed(() => mock<Resource>()),
          clientServiceMock,
          vi.fn(),
          vi.fn()
        )
        const transferData = await resourcesTransfer.getTransferData(action)

        expect(transferData.length).toBe(resourcesToMove.length)

        for (let i = 0; i < resourcesToMove.length; i++) {
          const input = resourcesToMove[i]
          const output = transferData[i]
          expect(input.name).toBe(output.resource.name)
        }
      }
    )
  })
  it('should show message if conflict exists', async () => {
    const targetFolderItems = [
      {
        id: 'a',
        path: 'target/a',
        webDavPath: '/target/a',
        name: '/target/a'
      }
    ]
    const resourcesTransfer = new ResourceTransfer(
      sourceSpace,
      resourcesToMove,
      targetSpace,
      resourcesToMove[0],
      computed(() => mock<Resource>()),
      clientServiceMock,
      vi.fn(),
      vi.fn()
    )
    resourcesTransfer.resolveTransferConflict = vi
      .fn()
      .mockImplementation(() => Promise.resolve({ strategy: 0 } as ResolveConflict))
    await resourcesTransfer.resolveAllConflicts(resourcesToMove, targetFolder, targetFolderItems)

    expect(resourcesTransfer.resolveTransferConflict).toHaveBeenCalled()
  })
  it('should show error message if trying to overwrite parent', () => {
    const targetFolderItems = [
      {
        id: 'a',
        path: 'target/a',
        webDavPath: '/target/a',
        name: '/target/a'
      }
    ]
    const resourcesTransfer = new ResourceTransfer(
      sourceSpace,
      resourcesToMove,
      targetSpace,
      resourcesToMove[0],
      computed(() => mock<Resource>({ path: '/' })),
      clientServiceMock,
      vi.fn(),
      vi.fn()
    )
    const namingClash = resourcesTransfer.isOverwritingParentFolder(
      resourcesToMove[0],
      targetFolder,
      targetFolderItems
    )
    const noNamingClash = resourcesTransfer.isOverwritingParentFolder(
      resourcesToMove[1],
      targetFolder,
      targetFolderItems
    )

    expect(namingClash).toBeTruthy()
    expect(noNamingClash).toBeFalsy()
  })

  describe('folder merge', () => {
    const rootFolder = { id: 'root', path: '/', webDavPath: '/' } as Resource
    const sourceFolder = {
      id: 'src-x',
      name: 'x',
      path: '/src/x',
      isFolder: true,
      type: 'folder'
    } as Resource

    // source /src/x: new.txt, same.txt, sub/deep.txt
    // target /x:     same.txt, sub/
    const listings: Record<string, ListFilesResult> = {
      '/': {
        resource: rootFolder,
        children: [{ id: 'tgt-x', name: 'x', path: '/x', isFolder: true } as Resource]
      },
      '/src/x': {
        resource: sourceFolder,
        children: [
          { id: 'n', name: 'new.txt', path: '/src/x/new.txt', isFolder: false },
          { id: 's', name: 'same.txt', path: '/src/x/same.txt', isFolder: false },
          { id: 'sub', name: 'sub', path: '/src/x/sub', isFolder: true }
        ] as Resource[]
      },
      '/x': {
        resource: { id: 'tgt-x', path: '/x', webDavPath: '/x' } as Resource,
        children: [
          { id: 's2', name: 'same.txt', path: '/x/same.txt', isFolder: false },
          { id: 'sub2', name: 'sub', path: '/x/sub', isFolder: true }
        ] as Resource[]
      },
      '/src/x/sub': {
        resource: { id: 'sub', path: '/src/x/sub' } as Resource,
        children: [
          { id: 'd', name: 'deep.txt', path: '/src/x/sub/deep.txt', isFolder: false }
        ] as Resource[]
      },
      '/x/sub': {
        resource: { id: 'sub2', path: '/x/sub', webDavPath: '/x/sub' } as Resource,
        children: []
      }
    }

    const getTransfer = (strategy: ResolveStrategy, resources = [sourceFolder]) => {
      clientServiceMock.webdav.listFiles.mockImplementation((_space, { path }) =>
        Promise.resolve(listings[path])
      )
      const transfer = new ResourceTransfer(
        sourceSpace,
        resources,
        targetSpace,
        rootFolder,
        computed(() => mock<Resource>({ path: '/src' })),
        clientServiceMock,
        vi.fn(),
        vi.fn()
      )
      transfer.resolveTransferConflict = vi
        .fn()
        .mockResolvedValue({ strategy, doForAllConflicts: false } as ResolveConflict)
      return transfer
    }

    it('merges and replaces existing files', async () => {
      const result = await getTransfer(ResolveStrategy.MERGE).getTransferData(TransferType.MOVE)

      const parts = result.filter((d) => d.mergePart)
      expect(parts.map((d) => [d.path, d.overwrite])).toEqual([
        ['/x/new.txt', false],
        ['/x/same.txt', true],
        ['/x/sub/deep.txt', false]
      ])
      const finalizers = result.filter((d) => d.mergeFinalize)
      expect(finalizers.map((d) => [d.resource.path, d.mergeFinalize.report])).toEqual([
        ['/src/x/sub', false],
        ['/src/x', true]
      ])
    })

    it('merges but keeps existing files', async () => {
      const result = await getTransfer(ResolveStrategy.MERGE_KEEP_EXISTING).getTransferData(
        TransferType.MOVE
      )

      const parts = result.filter((d) => d.mergePart)
      expect(parts.map((d) => d.path)).toEqual(['/x/new.txt', '/x/sub/deep.txt'])
      expect(parts.every((d) => !d.overwrite)).toBe(true)
    })

    it('never replaces a folder as a whole', async () => {
      const result = await getTransfer(ResolveStrategy.REPLACE).getTransferData(TransferType.MOVE)

      expect(result.some((d) => d.resource.id === 'src-x' && d.overwrite)).toBe(false)
      expect(result.filter((d) => d.mergePart).length).toBe(3)
    })

    it('does not merge a folder into itself', async () => {
      const itself = { ...sourceFolder, id: 'tgt-x', path: '/x' } as Resource
      const result = await getTransfer(ResolveStrategy.MERGE, [itself]).getTransferData(
        TransferType.MOVE
      )

      expect(result.length).toBe(0)
    })
  })
})

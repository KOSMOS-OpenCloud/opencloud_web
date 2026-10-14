import { basename, join } from 'path'
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { ResolveStrategy, TransferType, type TransferData } from './types'
import { ConflictDialog } from './conflictDialog'
import { resolveFileNameDuplicate, isResourceBeeingMovedToSameLocation } from './conflictUtils'
import type { ClientService } from '../../../services'
import { useMessages, useResourcesStore } from '../../../composables'
import { Ref, unref } from 'vue'
import type { Language } from 'vue3-gettext'
import { HttpError } from '@opencloud-eu/web-client'

export class ResourceTransfer extends ConflictDialog {
  // filled while planning a folder merge, used for the result message
  private mergeSummary: { transferred: number; kept: number } | null = null

  constructor(
    private sourceSpace: SpaceResource,
    private resourcesToMove: Resource[],
    private targetSpace: SpaceResource,
    private targetFolder: Resource,
    private currentFolder: Ref<Resource>,
    private clientService: ClientService,
    $gettext: Language['$gettext'],
    $ngettext: Language['$ngettext']
  ) {
    super($gettext, $ngettext)
  }

  hasRecursion(): boolean {
    if (this.sourceSpace.id !== this.targetSpace.id) {
      return false
    }
    return this.resourcesToMove.some(
      (resource: Resource) => this.targetFolder.path === resource.path
    )
  }

  showRecursionErrorMessage() {
    const count = this.resourcesToMove.length
    const title = this.$ngettext(
      "You can't paste the selected file at this location because you can't paste an item into itself.",
      "You can't paste the selected files at this location because you can't paste an item into itself.",
      count
    )
    const messageStore = useMessages()
    messageStore.showErrorMessage({ title })
  }

  showResultMessage(
    errors: { resourceName: string; error: Error }[],
    movedResources: Array<Resource>,
    transferType: TransferType
  ) {
    if (errors.length === 0 && this.mergeSummary) {
      const messageStore = useMessages()
      messageStore.showMessage({
        title: this.$gettext('Merge completed'),
        desc: this.$gettext('Transferred: %{transferred}, kept existing: %{kept}', {
          transferred: this.mergeSummary.transferred.toString(),
          kept: this.mergeSummary.kept.toString()
        }),
        status: 'success'
      })
      return
    }
    if (errors.length === 0) {
      const count = movedResources.length
      if (count === 0) {
        return
      }
      const title =
        transferType === TransferType.COPY
          ? this.$ngettext(
              '%{count} item was copied successfully',
              '%{count} items were copied successfully',
              count,
              { count: count.toString() }
            )
          : this.$ngettext(
              '%{count} item was moved successfully',
              '%{count} items were moved successfully',
              count,
              { count: count.toString() }
            )
      const messageStore = useMessages()
      messageStore.showMessage({ title, status: 'success' })
      return
    }
    let title =
      transferType === TransferType.COPY
        ? this.$gettext('Failed to copy %{count} resources', { count: errors.length.toString() })
        : this.$gettext('Failed to move %{count} resources', { count: errors.length.toString() })
    if (errors.length === 1) {
      title =
        transferType === TransferType.COPY
          ? this.$gettext('Failed to copy »%{name}«', { name: errors[0]?.resourceName })
          : this.$gettext('Failed to move »%{name}«', { name: errors[0]?.resourceName })
    }
    let description = ''
    if (errors.some(({ error }) => error instanceof HttpError && error.statusCode === 507)) {
      description = this.$gettext('Insufficient quota')
    }
    const messageStore = useMessages()
    messageStore.showErrorMessage({
      title,
      ...(description && { desc: description }),
      errors: errors.map(({ error }) => error)
    })
  }

  /**
   * Gathers transfer data after resolving all potential conflicts.
   * This data can then be used to feed the web worker for pasting resources.
   */
  async getTransferData(transferType: TransferType) {
    if (this.hasRecursion()) {
      this.showRecursionErrorMessage()
      return []
    }
    if (this.sourceSpace.id !== this.targetSpace.id && transferType === TransferType.MOVE) {
      const resourcesStore = useResourcesStore()
      if (!resourcesStore.isCrossSpaceMoveEnabled) {
        // User has not enabled cross-space move — fall back to copy (with confirmation)
        const doCopyInsteadOfMove = await this.resolveDoCopyInsteadOfMoveForSpaces()
        if (!doCopyInsteadOfMove) {
          return []
        }
        transferType = TransferType.COPY
      }
      // else: user wants cross-space move — keep TransferType.MOVE, server handles it
    }

    const targetFolderResources = (
      await this.clientService.webdav.listFiles(this.targetSpace, this.targetFolder)
    ).children

    const resolvedConflicts = await this.resolveAllConflicts(
      this.resourcesToMove,
      this.targetFolder,
      targetFolderResources
    )

    const result: TransferData[] = []
    const mergeCounter = { kept: 0, merged: false }

    for (const resourceToMove of this.resourcesToMove) {
      // shallow copy of resources to prevent modifying existing rows
      const resource = { ...resourceToMove }
      // Restore original name if prefixed by resourceTransformer (e.g. Aktenzeichen)
      if ((resource as any)._originalName) {
        resource.name = (resource as any)._originalName
      }
      const { id, name, extension } = resource

      const hasConflict = resolvedConflicts.some((e) => e.resource.id === id)
      let targetName = name
      let overwriteTarget = false

      if (hasConflict) {
        let resolveStrategy = resolvedConflicts.find((e) => e.resource.id === id)?.strategy
        const existingTarget = targetFolderResources.find(
          (r) => r.path === join(this.targetFolder.path, name)
        )
        const isFolderOnFolder = resource.isFolder && existingTarget?.isFolder

        if (isFolderOnFolder) {
          // A folder is never replaced as a whole: that would delete everything that
          // only exists in the target folder. Merge into it instead.
          if (resolveStrategy === ResolveStrategy.REPLACE) {
            resolveStrategy = ResolveStrategy.MERGE
          }
          if (
            resolveStrategy === ResolveStrategy.MERGE ||
            resolveStrategy === ResolveStrategy.MERGE_KEEP_EXISTING
          ) {
            const isSameFolder =
              this.sourceSpace.id === this.targetSpace.id && existingTarget.id === resource.id
            if (!isSameFolder) {
              await this.collectFolderMerge(
                resource,
                existingTarget,
                resolveStrategy === ResolveStrategy.MERGE,
                transferType,
                true,
                result,
                mergeCounter
              )
              mergeCounter.merged = true
            }
            continue
          }
        } else if (resolveStrategy === ResolveStrategy.MERGE) {
          // merge chosen via "apply to all" on a file conflict: replace the file
          resolveStrategy = ResolveStrategy.REPLACE
        } else if (resolveStrategy === ResolveStrategy.MERGE_KEEP_EXISTING) {
          // merge-but-keep-existing on a file conflict: leave both files as they are
          resolveStrategy = ResolveStrategy.SKIP
        }

        if (resolveStrategy === ResolveStrategy.SKIP) {
          continue
        }
        if (resolveStrategy === ResolveStrategy.REPLACE) {
          if (this.isOverwritingParentFolder(resource, this.targetFolder, targetFolderResources)) {
            const error = new Error()
            this.showResultMessage([{ error, resourceName: name }], [], transferType)
            continue
          }
          overwriteTarget = true
        }
        if (resolveStrategy === ResolveStrategy.KEEP_BOTH) {
          targetName = resolveFileNameDuplicate(name, extension, targetFolderResources)
          resource.name = targetName
        }
      }

      if (
        isResourceBeeingMovedToSameLocation(
          this.sourceSpace,
          resource,
          this.targetSpace,
          this.targetFolder
        ) &&
        overwriteTarget
      ) {
        continue
      }

      result.push({
        resource,
        sourceSpace: this.sourceSpace,
        targetSpace: this.targetSpace,
        targetFolder: this.targetFolder,
        path: join(this.targetFolder.path, targetName),
        overwrite: overwriteTarget,
        transferType
      })
    }

    this.mergeSummary = mergeCounter.merged
      ? {
          transferred: result.filter((data) => !data.mergeFinalize).length,
          kept: mergeCounter.kept
        }
      : null

    return result
  }

  /**
   * Plans merging `sourceFolder` into the already existing `targetFolder`:
   * - children missing in the target are transferred as a whole
   * - folders existing on both sides are merged recursively
   * - files existing on both sides are replaced if `replaceExisting`, otherwise left in the source
   * A finalize entry per folder follows its children; on MOVE the worker deletes the
   * source folder once it is empty.
   */
  private async collectFolderMerge(
    sourceFolder: Resource,
    targetFolder: Resource,
    replaceExisting: boolean,
    transferType: TransferType,
    isTopLevel: boolean,
    result: TransferData[],
    counter: { kept: number }
  ): Promise<void> {
    const [source, target] = await Promise.all([
      this.clientService.webdav.listFiles(this.sourceSpace, { path: sourceFolder.path }),
      this.clientService.webdav.listFiles(this.targetSpace, { path: targetFolder.path })
    ])
    const existingByName = new Map(target.children.map((r) => [basename(r.path), r]))

    for (const child of source.children) {
      const childName = basename(child.path)
      const existing = existingByName.get(childName)

      if (!existing) {
        result.push({
          resource: child,
          sourceSpace: this.sourceSpace,
          targetSpace: this.targetSpace,
          targetFolder: target.resource,
          path: join(target.resource.path, childName),
          overwrite: false,
          transferType,
          mergePart: true
        })
        continue
      }

      if (child.isFolder && existing.isFolder) {
        await this.collectFolderMerge(
          child,
          existing,
          replaceExisting,
          transferType,
          false,
          result,
          counter
        )
        continue
      }

      if (!child.isFolder && !existing.isFolder && replaceExisting) {
        result.push({
          resource: child,
          sourceSpace: this.sourceSpace,
          targetSpace: this.targetSpace,
          targetFolder: target.resource,
          path: join(target.resource.path, childName),
          overwrite: true,
          transferType,
          mergePart: true
        })
        continue
      }

      // keep the existing entry (or file/folder type mismatch): the source entry stays put
      counter.kept++
    }

    result.push({
      resource: sourceFolder,
      sourceSpace: this.sourceSpace,
      targetSpace: this.targetSpace,
      targetFolder: this.targetFolder,
      path: targetFolder.path,
      overwrite: false,
      transferType,
      mergeFinalize: { report: isTopLevel }
    })
  }

  // This is for an edge case if a user moves a subfolder with the same name as the parent folder into the parent of the parent folder (which is not possible because of the backend)
  public isOverwritingParentFolder(
    resource: Resource,
    targetFolder: Resource,
    targetFolderResources: Resource[]
  ) {
    if (resource.type !== 'folder') {
      return false
    }

    const currentFolderPath = unref(this.currentFolder)?.path
    if (!currentFolderPath || targetFolder.path === currentFolderPath) {
      return false
    }

    const folderName = basename(resource.path)
    const newPath = join(targetFolder.path, folderName)

    if (currentFolderPath.split('/').length < newPath.split('/').length) {
      // this edge case is only possible when moving folders upwards in the hierarchy
      return false
    }

    return targetFolderResources.some((resource) => resource.path === newPath)
  }
}

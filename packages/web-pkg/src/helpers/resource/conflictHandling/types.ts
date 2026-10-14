import type { Resource, SpaceResource } from '@opencloud-eu/web-client'

export enum ResolveStrategy {
  SKIP,
  REPLACE,
  KEEP_BOTH,
  MERGE,
  // folder transfer: merge into the existing folder, but never overwrite existing files
  MERGE_KEEP_EXISTING
}
export interface ResolveConflict {
  strategy: ResolveStrategy
  doForAllConflicts: boolean
}

export enum TransferType {
  COPY,
  MOVE
}

export type TransferData = {
  resource: Resource
  sourceSpace: SpaceResource
  targetSpace: SpaceResource
  targetFolder: Resource
  path: string
  overwrite: boolean
  transferType: TransferType
  // A folder merge is split into one transfer per child. Parts are not reported as
  // successful on their own, so callers don't insert nested resources into the view.
  mergePart?: boolean
  // Runs after all parts: on MOVE the source folder is deleted if it ended up empty.
  // `report` marks the folder the user actually selected.
  mergeFinalize?: { report: boolean }
}

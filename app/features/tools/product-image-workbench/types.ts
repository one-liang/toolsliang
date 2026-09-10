export interface WorkbenchArchiveEntryInput {
  /** Built from the output's purpose and the item's position; never from a source file. */
  name: string
  blob: Blob
}

export interface WorkbenchArchiveInput { entries: WorkbenchArchiveEntryInput[] }

export interface ArchiveWireOutput { bytes: ArrayBuffer }

export interface WorkbenchArchiveOutput { blob: Blob }

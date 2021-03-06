/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export enum WorkspaceFileState {
  UNCHANGED = 'u',
  CHANGED = 'c',
  DELETED = 'd',
  NEW = 'n',
  DUP = 'p',
}

export type ReadableFileState = 'Unchanged' | 'Changed' | 'Deleted' | 'Add' | 'Duplicate' | 'Unknown';

export function toReadableState(state: WorkspaceFileState): ReadableFileState {
  switch (state) {
    case WorkspaceFileState.UNCHANGED:
      return 'Unchanged';
    case WorkspaceFileState.CHANGED:
      return 'Changed';
    case WorkspaceFileState.DELETED:
      return 'Deleted';
    case WorkspaceFileState.NEW:
      return 'Add';
    case WorkspaceFileState.DUP:
      return 'Duplicate';
    default:
      return 'Unknown';
  }
}

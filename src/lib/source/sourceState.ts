/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * States of source
 * @type {{UNCHANGED: string, CHANGED: string, DELETED: string, NEW: string, toString: sourceState.toString}}
 */
const sourceState = {
  UNCHANGED: 'u',
  CHANGED: 'c',
  DELETED: 'd',
  NEW: 'n',
  DUP: 'p',

  /**
   * Get the string representation of a source state
   * @param state - The state to get the string for
   * @returns {*} - String representation of the state
   */
  toString(state) {
    switch (state) {
      case sourceState.UNCHANGED:
        return 'Unchanged';
      case sourceState.CHANGED:
        return 'Changed';
      case sourceState.DELETED:
        return 'Deleted';
      case sourceState.NEW:
        return 'Add';
      case sourceState.DUP:
        return 'Duplicate';
      default:
        return 'Unknown';
    }
  }
};

export = sourceState;

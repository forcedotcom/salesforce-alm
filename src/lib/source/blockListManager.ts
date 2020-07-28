/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';

let _blocklist = [];

/**
 * manage blocklisted metadata members.
 */
class BlockListManager {
  /**
   * simple getter for the blocklisted elements
   * @returns {Array}
   */
  static get blocklist() {
    return _blocklist;
  }

  /**
   * blocklist a member
   * @param {string} metadataName - the metadata api type name. i.e. ApexClass, CustomObject
   */
  static blockListMember(metadataName) {
    _blocklist.push(metadataName);
  }

  /**
   * query to determine if a type is blocklisted.
   * @param {string} metadataName - the metadata type name to check
   * @returns {boolean} - true if the element is on the blocklist.
   */
  static isBlockListed(metadataName) {
    if (!util.isNullOrUndefined(metadataName)) {
      return BlockListManager.blocklist.includes(metadataName);
    }
    return false;
  }

  /**
   * remove an element from the block list
   * @param {string} metadataName - The metadata type name to remove
   */
  static deList(metadataName) {
    _blocklist = _blocklist.filter(element => element !== metadataName);
  }
}

export = BlockListManager;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';

let _blacklist = [];

/**
 * manage blacklisted metadata members.
 */
class BlacklistManager {
  /**
   * simple getter for the blacklisted elements
   * @returns {Array}
   */
  static get blacklist() {
    return _blacklist;
  }

  /**
   * blacklist a member
   * @param {string} metadataName - the metadata api type name. i.e. ApexClass, CustomObject
   */
  static blacklistMember(metadataName) {
    _blacklist.push(metadataName);
  }

  /**
   * query to determine if a type is blacklisted.
   * @param {string} metadataName - the metadata type name to check
   * @returns {boolean} - true if the element is on the blacklist.
   */
  static isBlacklisted(metadataName) {
    if (!util.isNullOrUndefined(metadataName)) {
      return BlacklistManager.blacklist.includes(metadataName);
    }
    return false;
  }

  /**
   * remove an element from the black list
   * @param {string} metadataName - The metadata type name to remove
   */
  static deList(metadataName) {
    _blacklist = _blacklist.filter(element => element !== metadataName);
  }
}

export = BlacklistManager;

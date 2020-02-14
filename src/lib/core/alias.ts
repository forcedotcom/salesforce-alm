/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholely superceded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import * as almError from './almError';
import { FileKeyValueStore } from './fileKeyValueStore';

const ALIAS_FILE_NAME = 'alias.json';

const aliasFileStore = new FileKeyValueStore(ALIAS_FILE_NAME);

/**
 * Manage aliases in the global .sfdx folder under alias.json. Aliases allow users
 * to specify alternate names for different properties used by the cli, such as orgs.
 *
 * All aliases are stored under a group. By default, all aliases are stored for
 * orgs but groups allow aliases to be applied for other commands, settings, and flags.
 *
 */
class Alias {
  // Different groups of aliases. Only support orgs for now.
  static Groups = { ORGS: 'orgs' };

  /**
   * Set a group of aliases in a bulk save.
   * @param {array} aliasKeyAndValues An array of strings in the format <alias>=<value>
   * @param {string} group The group the alias belongs to. Defaults to ORGS.
   * @returns {Promise<object>} The new aliases that were saved.
   */
  static parseAndSet(aliasKeyAndValues, group = Alias.Groups.ORGS) {
    const newAliases = {};
    if (aliasKeyAndValues.length === 0) {
      throw almError({ keyName: 'NoAliasesFound', bundle: 'alias' }, []);
    }

    aliasKeyAndValues.forEach(arg => {
      const split = arg.split('=');

      if (split.length !== 2) {
        throw almError({ keyName: 'InvalidFormat', bundle: 'alias' }, [arg]);
      }
      const [name, value] = split;
      newAliases[name] = value || undefined;
    });

    return aliasFileStore.setValues(newAliases, group);
  }

  /**
   * Delete an alias from a group
   * @param {string} alias The name of the alias to delete
   * @param {string} group The group the alias belongs to. Defaults to Orgs
   * @returns {Promise} The promise resolved when the alias is deleted
   */
  static delete(alias, group = Alias.Groups.ORGS) {
    return aliasFileStore.delete(alias, group);
  }

  /**
   * Set an alias on a group
   * @param {string} alias The name of the alias to set
   * @param {string} property The value of the alias
   * @param {string} group The group the alias belongs to. Defaults to Orgs
   * @returns {Promise} The promise resolved when the alias is set
   */
  static set(alias, property, group = Alias.Groups.ORGS) {
    return aliasFileStore.set(alias, property, group);
  }

  /**
   * Unset one or more aliases on a group
   * @param {string[]} aliases The names of the aliases to unset
   * @param {string} group The group the alias belongs to. Defaults to Orgs
   * @returns {Promise} The promise resolved when the aliases are unset
   */
  static unset(aliasesToUnset, group = Alias.Groups.ORGS) {
    return aliasFileStore.unset(aliasesToUnset, group);
  }

  /**
   * Get an alias from a group
   * @param {string} alias The name of the alias to get
   * @param {string} group The group the alias belongs to. Defaults to Orgs
   * @returns {Promise} The promise resolved when the alias is retrieved
   */
  static get(alias, group = Alias.Groups.ORGS) {
    return aliasFileStore.get(alias, group);
  }

  /**
   * Get all alias from a group
   * @param {string} group The group of aliases to retrieve. Defaults to Orgs
   * @returns {Promise} The promise resolved when the aliases are retrieved
   */
  static list(group = Alias.Groups.ORGS) {
    return aliasFileStore.list(group);
  }

  /**
   * Get an alias from a group by value
   * @param {string} value The value of the alias to match
   * @param {string} group The group the alias belongs to. Defaults to Orgs
   * @returns {Promise} The promise resolved when the alias is retrieved
   */
  static byValue(value, group = Alias.Groups.ORGS) {
    return aliasFileStore.byValue(value, group);
  }
}

export = Alias;

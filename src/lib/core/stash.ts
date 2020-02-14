/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholly superseded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import * as almError from './almError';
import { FileKeyValueStore } from './fileKeyValueStore';

const STASH_FILE_NAME = 'stash.json';

const stashFileStore = new FileKeyValueStore(STASH_FILE_NAME);

function isValidCommand(command) {
  return command && Stash.Commands[command];
}

/**
 * Manage stashed values in the global .sfdx folder under stash.json. Stashed aliases allow commands
 * to specify various values that get persisted in the global directory for use later.
 *
 * All aliases are stored under a group that corresponds to the command performing the stash.
 *
 */
class Stash {
  // Different groups of values. Should be divided by command. The key and value in this object should be the same.
  public static readonly Commands = {
    MDAPI_RETRIEVE: 'MDAPI_RETRIEVE',
    MDAPI_DEPLOY: 'MDAPI_DEPLOY',
    SOURCE_DEPLOY: 'SOURCE_DEPLOY'
  };

  /**
   * Set a group of stashed values in a bulk save.
   * @param {object} newStashValues An object of key value pairs that should be set in stash
   * @param {string} command The command the alias belongs to.
   * @returns {Promise<object>} The new aliases that were saved.
   */
  static setValues(newStashValues: any, command: string): Promise<any> {
    if (!isValidCommand(command)) return Promise.reject(almError('InvalidCommandGroup'));
    return stashFileStore.setValues(newStashValues, command);
  }

  /**
   * Set an alias on a command group
   * @param {string} alias The name of the alias to set
   * @param {string} property The value of the alias
   * @param {string} command The command the alias belongs to. Defaults to Orgs
   * @returns {Promise} The promise resolved when the alias is set
   */
  static set(alias: string, property: string | number, command: string): Promise<any> {
    if (!isValidCommand(command)) return Promise.reject(almError('InvalidCommandGroup'));

    return stashFileStore.set(alias, property, command);
  }

  /**
   * Unset one or more aliases on a command group
   * @param {string|string[]} aliases The names of the aliases to unset
   * @param {string} command The command the alias belongs to. Defaults to Orgs
   * @returns {Promise} The promise resolved when the aliases are unset
   */
  static unset(aliasesToUnset: string | string[], command: string): Promise<any> {
    if (!isValidCommand(command)) return Promise.reject(almError('InvalidCommandGroup'));

    return stashFileStore.unset(Array.isArray(aliasesToUnset) ? aliasesToUnset : [aliasesToUnset], command);
  }

  /**
   * Get an alias from a command group
   * @param {string} alias The name of the alias to get
   * @param {string} command The command the alias belongs to. Defaults to Orgs
   * @returns {Promise} The promise resolved when the alias is retrieved
   */
  static get(alias: string | number, command: string): Promise<any> {
    if (!isValidCommand(command)) return Promise.reject(almError('InvalidCommandGroup'));

    return stashFileStore.get(alias as string, command);
  }

  /**
   * Get all alias from a command group
   * @param {string} command The command of aliases to retrieve. Defaults to Orgs
   * @returns {Promise} The promise resolved when the aliases are retrieved
   */
  static list(command: string): Promise<any> {
    if (!isValidCommand(command)) return Promise.reject(almError('InvalidCommandGroup'));

    return stashFileStore.list(command);
  }
}

export = Stash;

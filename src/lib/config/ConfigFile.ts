/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as os from 'os';

import * as _ from 'lodash';
import * as BBPromise from 'bluebird';
const mkdirp = BBPromise.promisify(require('mkdirp'));

const fs = BBPromise.promisifyAll(require('fs'));

// Local
import * as project from '../core/projectDir';
import * as almError from '../core/almError';
import srcDevUtil = require('../core/srcDevUtil');

const STATE_FOLDER = srcDevUtil.getWorkspaceStateFolderName();

/**
 * Represents a json config file that the toolbelt uses to manage settings and
 * state. Global config files are stores in the home directory hidden state
 * folder (.sfdx) and local config files are stored in the project path, either
 * in the hidden state folder or wherever specifed.
 *
 */
class ConfigFile {
  // TODO: proper property typing
  [property: string]: any;

  /**
   * Constructor that sets the path and name. The path is generaterated from
   * all the passed in parameters.
   *
   * @constructor
   * @param {string} fileName The name of the config file.
   * @param {boolean} isGlobal If true, file root is set to the home directory.
   * If false or not a boolean, file root is set to the project directory.
   * @param {boolean} isState If true, file is stored in the hidden state folder
   * witin the file root. This will automatically be set to true if isGlobal is true.
   * @param {string} filePath The path of the config file appended to the file
   * root. i.e. a relatvie path from the global or local project directories.
   * @throws {Error} Throws an InvalidParameter error if name is not a non-empty string.
   * @throws {Error} Throws an InvalidProjectWorkspace error trying to instantiate a
   * local config file outside of a project workpace
   */
  constructor(fileName, isGlobal = false, isState = true, filePath = '') {
    if (!_.isString(fileName) && !_.isEmpty(fileName)) {
      throw almError('InvalidParameter', ['name', fileName]);
    }

    isGlobal = _.isBoolean(isGlobal) && isGlobal;
    isState = _.isBoolean(isState) && isState;

    let root = isGlobal ? os.homedir() : project.getPath();

    // Don't let users store config files in homedir without being in the
    // state folder.
    if (isGlobal || isState) {
      root = path.join(root, STATE_FOLDER);
    }

    this.name = fileName;
    this.path = path.join(root, filePath, fileName);
  }

  /**
   * Read the config file and set this.contents
   *
   * @returns {BBPromise<object>} the json contents of the config file
   * @throws {Error} Throws error if there was a problem reading or parsing the file
   */
  read() {
    return srcDevUtil
      .readJSON(this.path)
      .then(content => {
        this.contents = content;
        return content;
      })
      .catch(err => this.checkEnoent(err));
  }

  /**
   * Write the config file with new contents. If no new contents is passed in,
   * it will write this.contents that was set from read().
   *
   * @param {object} newContents the new contents of the file
   * @returns {BBPromise<object>} the written contents
   */
  write() {
    if (_.isNil(this.contents)) {
      // Dev error - should never happen.
      throw new Error('Can not write config before reading it.');
    }
    return mkdirp(path.dirname(this.path))
      .then(() => fs.writeFileAsync(this.path, JSON.stringify(this.contents, null, 4)))
      .then(() => this.contents);
  }

  async clear() {
    await this.read();
    this.contents = {};
    await this.write();
  }

  /**
   * Check to see if the config file exist
   *
   * @returns {BBPromise<boolean>} true if the config file exist and has access,
   * false otherwise.
   */
  exist() {
    return fs
      .statAsync(this.path)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Delete the config file
   *
   * @returns {BBPromise<boolean>} true if the file was deleted, false otherwise
   */
  delete() {
    return this.exist().then(exist => {
      if (exist) {
        return fs.unlinkAsync(this.path).then(() => true);
      }
      return BBPromise.resolve(false);
    });
  }

  checkEnoent(err) {
    if (err.code === 'ENOENT') {
      this.contents = {};
      return this.contents;
    } else {
      throw err;
    }
  }
}

export = ConfigFile;

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholely superceded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

// Node
import * as os from 'os';
import * as util from 'util';
import * as path from 'path';
import * as crypto from 'crypto';
import * as mkdirp from 'mkdirp';
import * as archiver from 'archiver';

// Thirdparty
import * as BBPromise from 'bluebird';
import { Org } from '@salesforce/core';
import { parseJson } from '@salesforce/kit';
import { AnyJson } from '@salesforce/ts-types';

import * as _ from 'lodash';
const fs = BBPromise.promisifyAll(require('fs-extra'));

// Local
import Messages = require('../messages');
import * as errors from './errors';
import consts = require('./constants');
const messages = Messages();
import logger = require('./logApi');

// The hidden folder that we keep all SFDX's state in.
const STATE_FOLDER = '.sfdx';
const SFDX_CONFIG_FILE_NAME = 'sfdx-config.json';

// For 208 this needs to be 'sfdx toolbelt'
const SfdxCLIClientId = 'sfdx toolbelt';
const SFDX_HTTP_HEADERS = {
  'content-type': 'application/json',
  'user-agent': SfdxCLIClientId,
};

const DEV_HUB_SOQL = "SELECT CreatedDate,Edition,ExpirationDate FROM ActiveScratchOrg WHERE ScratchOrg='%s'";
let zipDirPath: string;

const _getHomeDir = function () {
  return os.homedir();
};

const _getGlobalHiddenFolder = function () {
  return path.join(_getHomeDir(), STATE_FOLDER);
};

const _toLowerCase = (val, key) => key.toLowerCase();

const _checkEmptyContent = function (data, jsonPath, throwOnEmpty = true) {
  // REVIEWME: why throw?  shouldn't the caller handle?
  if (!data.length) {
    if (throwOnEmpty) {
      throw new Error(messages.getMessage('JsonParseError', [jsonPath, 1, 'FILE HAS NO CONTENT']));
    } else {
      data = {};
    }
  }
  return data;
};

/**
 *
 * @param data JSON data as a string to parse
 * @param jsonPath path to the json file used for error reporting
 * @param throwOnEmpty throw a JsonParseError when the content is empty
 */
function parseJSON(data, jsonPath, throwOnEmpty = true): AnyJson {
  const _data = _checkEmptyContent(data, jsonPath, throwOnEmpty);
  return parseJson(_data, jsonPath, throwOnEmpty);
}

const self = {
  queryOrgInfoFromDevHub(hubOrg, orgId) {
    return hubOrg.force.query(hubOrg, util.format(DEV_HUB_SOQL, this.trimTo15(orgId)));
  },

  /**
   * Returns whether the org has source tracking ability.
   *
   * @param {string} username the org username
   * @returns {boolean}
   */
  async isSourceTrackedOrg(username) {
    let isSourceTracked = false;
    try {
      const org = await Org.create(username);
      await org.getConnection().tooling.query('select id from SourceMember');
      isSourceTracked = true;
    } catch (e) {
      /* ignore */
    }

    return isSourceTracked;
  },

  /**
   * Read a file and convert it to JSON
   *
   * @param {string} jsonPath The path of the file
   * @return promise The contents of the file as a JSON object
   */
  async readJSON(jsonPath, throwOnEmpty = true) {
    const data = await fs.readFile(jsonPath, 'utf8');
    return parseJSON(data, jsonPath, throwOnEmpty);
  },

  parseJSON,

  /**
   * Helper for handling errors resulting from reading and then parsing a JSON file
   *
   * @param e - the error
   * @param filePath - the filePath to the JSON file being read
   */
  processReadAndParseJsonFileError(e, filePath) {
    if (e.name === 'SyntaxError') {
      e.message = messages.getMessage('InvalidJson', filePath);
    }
    return e;
  },

  /**
   * simple helper for creating an error with a name.
   *
   * @param message - the message for the error
   * @param name - the name of the error. preferably containing no spaces, starting with a capital letter, and camel-case.
   * @returns {Error}
   */
  getError(message, name) {
    let error = new Error(message);
    error['name'] = name;
    if (util.isNullOrUndefined(message) || util.isNullOrUndefined(name)) {
      error = new Error('Both name and message are required for sf toolbelt errors.');
      error['name'] = 'NameAndMessageRequired';
    }
    return error;
  },

  /**
   * function that normalizes cli args between yargs and heroku toolbelt
   *
   * @param context - the cli context
   * @returns {object}
   */
  fixCliContext(context) {
    // This can be called from heroku or appconfig.
    let fixedContext = context;
    if (!util.isNullOrUndefined(context.flags)) {
      fixedContext = context.flags;
    }
    return fixedContext;
  },

  /**
   * Simple helper method to determine that the path is a file (all SFDX files have an extension)
   *
   * @param localPath
   * @returns {boolean}
   */
  containsFileExt(localPath) {
    const typeExtension = path.extname(localPath);
    return typeExtension && typeExtension !== '';
  },

  /**
   * Simple helper method to determine if a fs path exists.
   *
   * @param localPath The path to check. Either a file or directory.
   * @returns {boolean} true if the path exists false otherwise.
   */
  pathExistsSync(localPath) {
    try {
      return fs.statSync(localPath);
    } catch (err) {
      return false;
    }
  },

  /**
   * Ensure that a directory exists, creating as necessary
   *
   * @param localPath The path to the directory
   */
  ensureDirectoryExistsSync(localPath) {
    if (!self.pathExistsSync(localPath)) {
      mkdirp.sync(localPath);
    }
  },

  /**
   * If a file exists, delete it
   *
   * @param localPath - Path of the file to delete.
   */
  deleteIfExistsSync(localPath) {
    if (self.pathExistsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.isDirectory()) {
        fs.rmdirSync(localPath);
      } else {
        fs.unlinkSync(localPath);
      }
    }
  },

  /**
   * If a directory exists, force remove it and anything inside
   *
   * @param localPath - Path of the directory to delete.
   */
  deleteDirIfExistsSync(localPath) {
    fs.removeSync(localPath);
  },

  /**
   * If a directory exists, return all the items inside of it
   *
   * @param localPath - Path of the directory
   * @param deep{boolean} - Whether to include files in all subdirectories recursively
   * @param excludeDirs{boolean} - Whether to exclude directories in the returned list
   * @returns {Array} - files in directory
   */
  getDirectoryItems(localPath: string, deep?: boolean, excludeDirs?: boolean) {
    let dirItems = [];
    if (self.pathExistsSync(localPath)) {
      fs.readdirSync(localPath).forEach((file) => {
        const curPath = path.join(localPath, file);
        const isDir = fs.statSync(curPath).isDirectory();
        if (!isDir || (isDir && !excludeDirs)) {
          dirItems.push(curPath);
        }
        if (deep && isDir) {
          dirItems = [...dirItems, ...this.getDirectoryItems(curPath, true, excludeDirs)];
        }
      });
    }
    return dirItems;
  },

  getGlobalHiddenFolder() {
    return _getGlobalHiddenFolder();
  },

  /**
   * Helper method for removing config file data from .sfdx.
   *
   * @param jsonConfigFileName The name of the config file stored in .sfdx.
   * @returns BBPromise
   */
  deleteGlobalConfig(jsonConfigFileName) {
    if (util.isNullOrUndefined(jsonConfigFileName)) {
      throw new errors.MissingRequiredParameter('jsonConfigFileName');
    }

    const filepath = path.join(_getGlobalHiddenFolder(), jsonConfigFileName);
    return fs.unlinkAsync(filepath);
  },

  /**
   * Helper method for getting config file data from $HOME/.sfdx.
   *
   * @param {string} jsonConfigFileName The name of the config file stored in .sfdx.
   * @param {object} defaultIfNotExist A value returned if the files doesn't exist. It not set, an error would be thrown.
   * @returns {BBPromise<object>} The resolved content as a json object.
   */
  getGlobalConfig(jsonConfigFileName, defaultIfNotExist?) {
    if (util.isNullOrUndefined(jsonConfigFileName)) {
      throw new errors.MissingRequiredParameter('jsonConfigFileName');
    }

    const configFilePath = path.join(_getGlobalHiddenFolder(), jsonConfigFileName);
    return this.readJSON(configFilePath).catch((err) => {
      if (err.code === 'ENOENT' && _.isObject(defaultIfNotExist)) {
        return BBPromise.resolve(defaultIfNotExist);
      }
      return BBPromise.reject(err);
    });
  },

  /**
   * Synchronous version of getAppConfig.
   *
   * @deprecated
   */
  getGlobalConfigSync(jsonConfigFileName) {
    if (util.isNullOrUndefined(jsonConfigFileName)) {
      throw new errors.MissingRequiredParameter('jsonConfigFileName');
    }

    const configPath = path.join(_getGlobalHiddenFolder(), jsonConfigFileName);

    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      throw this.processReadAndParseJsonFileError(e, configPath);
    }
  },

  /**
   * Helper method for saving config files to .sfdx.
   *
   * @param config The config.json configuration object.
   * @param jsonConfigFileName The name for the config file to store in .sfdx.
   * @param jsonConfigObject The json object to store in .sfdx/[jsonConfigFileName]
   * @returns BBPromise
   */
  saveGlobalConfig(jsonConfigFileName, jsonConfigObject) {
    if (util.isNullOrUndefined(jsonConfigFileName)) {
      throw new errors.MissingRequiredParameter('jsonConfigFileName');
    }

    if (util.isNullOrUndefined(jsonConfigObject)) {
      throw new errors.MissingRequiredParameter('jsonConfigObject');
    }

    return (
      fs
        .mkdirAsync(path.join(_getGlobalHiddenFolder()), consts.DEFAULT_USER_DIR_MODE)

        .error((err) => {
          // This directory already existing is a normal and expected thing.
          if (err.code !== 'EEXIST') {
            throw err;
          }
        })

        // Handle the login result and persist the access token.
        .then(() => {
          const configFilePath = path.join(_getGlobalHiddenFolder(), jsonConfigFileName);
          return fs.writeFileAsync(configFilePath, JSON.stringify(jsonConfigObject, undefined, 4), {
            encoding: 'utf8',
            flag: 'w+',
            mode: consts.DEFAULT_USER_FILE_MODE,
          });
        })
    );
  },

  /**
   * Get the name of the directory containing workspace state
   *
   * @returns {string}
   */
  getWorkspaceStateFolderName() {
    return STATE_FOLDER;
  },

  getConfigFileName() {
    return SFDX_CONFIG_FILE_NAME;
  },

  /**
   * Get the full path to the file storing the workspace org config information
   *
   * @param wsPath - The root path of the workspace
   * @returns {*}
   */
  getWorkspaceOrgConfigPath(wsPath) {
    return path.join(wsPath, STATE_FOLDER, this.getConfigFileName());
  },

  /**
   * Helper function that returns true if a value is an integer.
   *
   * @param value the value to compare
   * @returns {boolean} true if value is an integer. this is not a mathematical definition. that is -0 returns true.
   * this is in intended to be followed up with parseInt.
   */
  isInt(value) {
    return (
      !isNaN(value) &&
      (function (x) {
        return (x | 0) === x;
      })(parseFloat(value))
    );
  },

  /**
   * Execute each function in the array sequentially.
   *
   * @param promiseFactories  An array of functions to be executed that return BBPromises.
   * @returns {BBPromise.<T>}
   */
  sequentialExecute(promiseFactories) {
    let result = BBPromise.resolve();
    promiseFactories.forEach((promiseFactory) => {
      result = result.then(promiseFactory);
    });
    return result;
  },

  /**
   * Execute each function in the array in parallel.
   *
   * @param promiseFactories  An array of functions to be executed that return BBPromises.
   * @returns {BBPromise.<*>}
   */
  parallelExecute(promiseFactories) {
    return BBPromise.all(promiseFactories.map((factory) => factory()));
  },

  /**
   * Given a request object or string url a request object is returned with the additional http headers needed by force.com
   *
   * @param {(string|object)} request - A string url or javascript object.
   * @param options - {object} that may contain headers to add to request
   * @returns {object} a request object containing {method, url, headers}
   */
  setSfdxRequestHeaders(request, options: any = {}) {
    if (!request) {
      return undefined;
    }

    // if request is simple string, regard it as url in GET method
    const _request = _.isString(request) ? { method: 'GET', url: request } : request;

    // normalize header keys
    const reqHeaders = _.mapKeys(request.headers, _toLowerCase);
    const optHeaders = _.mapKeys(options.headers, _toLowerCase);

    // set headers, overriding as appropriate
    _request.headers = Object.assign({}, this.getSfdxRequestHeaders(), reqHeaders, optHeaders);

    return _request;
  },

  getSfdxRequestHeaders() {
    return SFDX_HTTP_HEADERS;
  },

  getSfdxCLIClientId() {
    if (process.env.SFDX_SET_CLIENT_IDS) {
      return `${SfdxCLIClientId}:${process.env.SFDX_SET_CLIENT_IDS}`;
    }

    return SfdxCLIClientId;
  },

  isVerbose() {
    return process.argv.indexOf('--verbose') > 0;
  },

  trimTo15(id) {
    // FIXME: remove once 18-char orgid is figured out
    if (!util.isNullOrUndefined(id) && id.length && id.length > 15) {
      id = id.substring(0, 15);
    }

    return id;
  },

  /**
   * @returns {boolean} returns true if process.env.SFDX_USE_GENERIC_UNIX_KEYCHAIN is set to true.
   */
  useGenericUnixKeychain() {
    // Support the old env var name
    const useGenericUnixKeychain = process.env.SFDX_USE_GENERIC_UNIX_KEYCHAIN || process.env.USE_GENERIC_UNIX_KEYCHAIN;
    return !_.isNil(useGenericUnixKeychain) && useGenericUnixKeychain.toLowerCase() === 'true';
  },

  /**
   * Zips directory to given zipfile.
   *
   * https://github.com/archiverjs/node-archiver
   *
   * @param dir to zip
   * @param zipfile
   * @param options
   */
  zipDir(dir, zipfile, options = {}) {
    const file = path.parse(dir);
    const outFile = zipfile || path.join(os.tmpdir() || '.', `${file.base}.zip`);
    const output = fs.createWriteStream(outFile);
    this.setZipDirPath(outFile);

    const timer = process.hrtime();
    return new BBPromise((resolve, reject) => {
      const archive = archiver('zip', options);
      archive.on('finish', () => {
        logger.debug(`${archive.pointer()} bytes written to ${outFile} using ${this.getElapsedTime(timer)}ms`);
        // zip file returned once stream is closed, see 'close' listener below
      });

      archive.on('error', (err) => {
        reject(err);
      });

      output.on('close', () => {
        resolve(outFile);
      });

      archive.pipe(output);
      archive.directory(dir, '');
      archive.finalize();
    });
  },

  setZipDirPath(path: string) {
    zipDirPath = path;
  },

  getZipDirPath() {
    return zipDirPath;
  },

  getElapsedTime(timer) {
    const elapsed = process.hrtime(timer);
    return (elapsed[0] * 1000 + elapsed[1] / 1000000).toFixed(3);
  },

  /**
   *  Uses Lodash _.mapKeys to convert object keys to another format using the specified conversion function.
   *
   *  E.g., to deep convert all object keys to camelCase:  mapKeys(myObj, _.camelCase, true)
   *        to shallow convert object keys to lower case:  mapKeys(myObj, _.toLower)
   *
   *  NOTE: This mutates the object passed in for conversion.
   *
   *  @param obj - {Object} The object to convert the keys
   *  @param converterFn - {Function} The function that converts the object key
   *  @param deep - {boolean} Whether to do a deep object key conversion
   *  @return {Object} - the object with the converted keys
   */
  mapKeys(obj, converterFn, deep?) {
    return _.mapKeys(obj, (val, key, o) => {
      const _key = converterFn.call(null, key);

      if (deep) {
        let _val = val;
        if (_.isArray(val)) {
          _.forEach(val, (v1) => {
            if (_.isPlainObject(v1)) {
              _val = this.mapKeys(v1, converterFn, deep);
            }
          });
        } else if (_.isPlainObject(val)) {
          _val = this.mapKeys(val, converterFn, deep);
        }
        o[_key] = _val;
        if (key !== _key) {
          delete o[key];
        }
      }

      return _key;
    });
  },

  // A very common usecase of mapKeys.
  toLowerCaseKeys(obj, deep?) {
    return this.mapKeys(obj, _.toLower, deep);
  },

  /**
   *  Returns the first key within the object that has an upper case first letter.
   *
   *  @param obj - {Object} The object to check key casing
   *  @param blocklist - don't include results in this array
   *  @return {string} - the key that starts with upper case
   */
  findUpperCaseKeys(obj, blocklist = []) {
    let _key;
    _.findKey(obj, (val, key) => {
      if (blocklist.includes(key)) {
        return _key;
      }
      if (key[0] === key[0].toUpperCase()) {
        _key = key;
      } else if (_.isPlainObject(val)) {
        _key = this.findUpperCaseKeys(val);
      }
      return _key;
    });

    return _key;
  },

  /**
   * Helper to make a nodejs base64 encoded string compatible with rfc4648 alternative encoding for urls.
   *
   * @param {string} base64Encoded - a nodejs base64 encoded string
   * @returns {string} returns the string escaped.
   */
  base64UrlEscape(base64Encoded?) {
    // builtin node js base 64 encoding is not 64 url compatible.
    // See - https://toolsn.ietf.org/html/rfc4648#section-5
    return _.replace(base64Encoded, /\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  },

  /**
   * Helper that will un-escape a base64 url encoded string.
   *
   * @param {string} base64EncodedAndEscaped - the based 64 escaped and encoded string.
   * @returns {string} returns the string un-escaped.
   */
  base64UrlUnEscape(base64EncodedAndEscaped) {
    // builtin node js base 64 encoding is not 64 url compatible.
    // See - https://toolsn.ietf.org/html/rfc4648#section-5
    const _unescaped = _.replace(base64EncodedAndEscaped, /-/g, '+').replace(/_/g, '/');
    return _unescaped + '==='.slice((_unescaped.length + 3) % 4);
  },

  getContentHash(contents) {
    return crypto.createHash('sha1').update(contents).digest('hex');
  },

  /**
   * Logs the collection of unsupported mime types to the server
   *
   * @param unsupportedMimeTypes
   * @param _logger
   * @param force
   */
  async logUnsupportedMimeTypeError(unsupportedMimeTypes, _logger, force) {
    if (unsupportedMimeTypes.length > 0) {
      const errName = 'UnsupportedMimeTypes';
      const unsupportedMimeTypeError = new Error();
      unsupportedMimeTypeError.name = errName;
      unsupportedMimeTypeError.message = messages.getMessage(errName, [...new Set(unsupportedMimeTypes)]);
      unsupportedMimeTypeError.stack = '';
      _.set(unsupportedMimeTypeError, 'errAllowlist', errName);
      try {
        // TODO Use new telemetry exception throwing.
      } catch (err) {
        // Ignore; Don't fail source commands if logServerError fails
      }
    }
    return BBPromise.resolve();
  },
};

export = self;

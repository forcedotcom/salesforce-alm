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

// Node
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';

// Thirdparty
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';

// Local module object.
import SfdxConfig = require('../config/SfdxConfig');
import * as errors from './errors';
import messages = require('../messages');
import * as almError from './almError';
import * as projectDirectory from './projectDir';
import srcDevUtil = require('./srcDevUtil');
import consts = require('./constants');
import SchemaValidator = require('../schema/schemaValidator');
import logApi = require('./logApi');

const pjson = require('../../../package.json');
const sfdxProjectSchemaPath = path.join(__dirname, '..', '..', '..', 'schemas', 'sfdxProjectSchema.json');
const _DEFAULT_PORT = 1717;

const fsWriteFile = BBPromise.promisify(fs.writeFile);

const checkHiddenStateFolder = function(projectDir) {
  const stateFolderPath = path.join(projectDir, srcDevUtil.getWorkspaceStateFolderName());

  if (!srcDevUtil.pathExistsSync(stateFolderPath)) {
    try {
      // Make sure state folder exists in the root of the workspace.
      // @todo Fix sync.
      fs.mkdirSync(stateFolderPath);
    } catch (err) {
      // Rethrow the error if it's something other than directory already exists.
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }
};

const sfdxProjectBlackList = ['packageAliases'];

// constructor
export const Config = function(projectDir?) {
  this.projectDir = projectDir;
  this.pjson = pjson;
  this.validator = new SchemaValidator(logApi, sfdxProjectSchemaPath);
};

const _throwUnexpectedVersionFormat = function(incorrectVersion) {
  const errorName = 'UnexpectedVersionFormat';
  throw srcDevUtil.getError(messages().getMessage(errorName, [incorrectVersion], 'versionCommand'), errorName);
};

/**
 * Return the salesforce toolbelt api version:
 *
 * How we find the version number:
 * 1) see if it's defined in $HOME/.sfdx/sfdx-project.json
 * 2) Otherwise get it from package.json.
 *
 * @returns {string}
 */
Config.prototype.getApiVersion = function() {
  // If we already stored an api version return it.
  if (!util.isNullOrUndefined(this.apiVersion)) {
    return this.apiVersion;
  }

  try {
    // This should use SfdxAggregator but can't because too many places in the code
    // call this as a sync method
    const globalConfig = new SfdxConfig(true).readSync();
    let localConfig;
    try {
      localConfig = new SfdxConfig(false).readSync();
    } catch (e) {
      // This could be a non-project directory;
    }

    // local takes precedence; also sfdx config defaults to returning an empty object when
    // no config is defined.
    const _config = _.merge({}, globalConfig, localConfig);
    const apiVersion = process.env.SFDX_API_VERSION || _config.apiVersion;
    const apiVersionRegEx = /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)/;

    if (apiVersionRegEx.test(apiVersion)) {
      this.apiVersion = apiVersion;
    }
    // If there is something in workspace config and it didn't validate throw an error.
    else if (!util.isNullOrUndefined(apiVersion)) {
      _throwUnexpectedVersionFormat(apiVersion);
    }
    // else proceed
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }

  // Not globally defined so the apiVersion comes off of package.json version.
  if (util.isNullOrUndefined(this.apiVersion)) {
    // No version specified in pjson - unlikely but...
    if (util.isNullOrUndefined(this.pjson.version)) {
      const errorName = 'MissingVersionAttribute';
      throw srcDevUtil.getError(messages().getMessage(errorName, null, 'versionCommand'), errorName);
    }

    const versionTrimmed = this.pjson.version.trim();

    const sfdxValidVersionRegEx = /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z\-]+(?:\.[\da-z\-]+)*)?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?\b/gi;

    if (sfdxValidVersionRegEx.test(versionTrimmed)) {
      this.apiVersion = `${versionTrimmed.split('.')[0]}.0`;
    } else {
      _throwUnexpectedVersionFormat(versionTrimmed);
    }
  }

  return this.apiVersion;
};

Config.prototype.getProjectPath = function() {
  if (util.isNullOrUndefined(this.projectDir)) {
    this.projectDir = projectDirectory.getPath();
    checkHiddenStateFolder(this.projectDir);
  }

  return this.projectDir;
};

// The toolbelt only supports us english.
Config.prototype.getLocale = function() {
  return messages().getLocale();
};

/**
 * Users may override the oauth port used for the http server.
 * @returns {number} 1717 is the default listen port number
 */
Config.prototype.getOauthLocalPort = function() {
  const appConfig = this.getAppConfigIfInWorkspace();
  const configPort = Number(appConfig.OauthLocalPort || appConfig.oauthLocalPort || _DEFAULT_PORT);

  if (Number.isNaN(configPort) || configPort < 1 || configPort > Math.pow(2, 16) - 1) {
    const error = new Error(messages(this.getLocale()).getMessage('invalidPortNumber', [configPort]));
    error['name'] = 'InvalidOAuthRedirectUrlPort';
    throw error;
  }
  return configPort;
};

/**
 * @returns {string} The App Cloud standard Connected App Callback URL.
 */
Config.prototype.getOauthCallbackUrl = function() {
  return `http://localhost:${this.getOauthLocalPort()}/OauthRedirect`;
};

/**
 * Reads the app config from disk and caches it.
 * @returns {*} A key value.
 */
Config.prototype.getAppConfig = function() {
  if (util.isNullOrUndefined(this.appConfig)) {
    this.appConfig = this.getConfigContent();
  }

  return this.appConfig;
};

/**
 * Reads the workspace app config, if we are in a workspace.
 * @param {object} force The force object
 * @returns {object} the workspace config object, or an empty object if not in a workspace
 */
Config.prototype.getAppConfigIfInWorkspace = function() {
  try {
    return this.getAppConfig();
  } catch (e) {
    if (e.name !== 'InvalidProjectWorkspace') {
      throw e;
    }
  }
  return {};
};

Config.prototype.getGlobalHiddenFolder = function() {
  return srcDevUtil.getGlobalHiddenFolder();
};

Config.prototype.getWorkspaceConfigFilename = function() {
  return consts.WORKSPACE_CONFIG_FILENAME;
};

Config.prototype.getOldAndBustedWorkspaceConfigFilename = function() {
  return consts.OLD_WORKSPACE_CONFIG_FILENAME;
};

Config.prototype.setWorkspaceTypeDefault = function(type, username) {
  const config = {};
  config[type] = username;
  _.assign(this.getAppConfig(), config);
  return this.setWorkspaceOrgConfigContent(this.getProjectPath(), config);
};

/**
 * Copy the artifact paths out of the sfdx-project.json, if they exist.
 *
 * @param messagesLocale This is for unit tests to solve a dependency issue
 * @param configObject The app config object
 * @param workspaceConfig The JSON representation of the workspace config file.
 * @param projectDir The root workspace directory
 * @returns {*} An array representing the artifact paths.
 */
const _extractPackageDirPaths = function(messagesLocale, configObject, workspaceConfig, projectDir) {
  const pathsArray = [];
  const packageDirectories = workspaceConfig.packageDirectories;

  if (!util.isNullOrUndefined(packageDirectories) && packageDirectories.length !== 0) {
    packageDirectories.forEach(packageDir => {
      if (!util.isNullOrUndefined(packageDir.path)) {
        if (path.isAbsolute(packageDir.path)) {
          const error = new Error(messagesLocale.getMessage('InvalidAbsolutePath', packageDir.path));
          error['name'] = 'InvalidProjectWorkspace';
          throw error;
        }
        pathsArray.push(path.resolve(projectDir, packageDir.path));
      }
      if (!util.isNullOrUndefined(packageDir.default)) {
        if (typeof packageDir.default !== 'boolean') {
          const error = new Error(messagesLocale.getMessage('InvalidValueForDefaultPath'));
          error['name'] = 'InvalidProjectWorkspace';
          throw error;
        }
        if (packageDir.default === true) {
          if (util.isNullOrUndefined(configObject.defaultPackagePath)) {
            configObject.defaultPackagePath = packageDir.path;
          } else {
            const error = new Error(messagesLocale.getMessage('MultipleDefaultPaths'));
            error['name'] = 'InvalidProjectWorkspace';
            throw error;
          }
        }
      } else if (packageDirectories.length === 1) {
        configObject.defaultPackagePath = packageDir.path;
      }
    });

    if (util.isNullOrUndefined(configObject.defaultPackagePath)) {
      const error = new Error(messagesLocale.getMessage('MissingDefaultPath'));
      error['name'] = 'InvalidProjectWorkspace';
      throw error;
    }
  }

  return pathsArray;
};

Config.prototype._getConfigContent = function(projectDir, workspaceConfigObject) {
  let configObject;
  try {
    // get sfdx-project.json from the ~/.sfdx directory
    configObject = srcDevUtil.getGlobalConfigSync(this.getWorkspaceConfigFilename());

    // Verify that the configObject does not have upper case keys; throw if it does.  Must be heads down camelcase.
    const upperCaseKey = srcDevUtil.findUpperCaseKeys(configObject, sfdxProjectBlackList);
    if (upperCaseKey) {
      throw almError('InvalidJsonCasing', [upperCaseKey, JSON.stringify(configObject, null, 4)]);
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      configObject = {};
    } else {
      throw e;
    }
  }

  // Add additional fields from the workspace sfdx-project.json
  const projectConfigDotJsonPath = path.join(projectDir, this.getWorkspaceConfigFilename());
  try {
    // Verify that the workspaceConfigObject does not have upper case keys; throw if it does.  Must be heads down camelcase.
    const upperCaseKey = srcDevUtil.findUpperCaseKeys(workspaceConfigObject, sfdxProjectBlackList);
    if (upperCaseKey) {
      throw almError('InvalidJsonCasing', [upperCaseKey, JSON.stringify(workspaceConfigObject, null, 4)]);
    }

    const defaultConfig = {
      packageDirectoryPaths: _extractPackageDirPaths(
        messages(this.getLocale()),
        configObject,
        workspaceConfigObject,
        projectDir
      ),
      sfdcLoginUrl: 'https://login.salesforce.com',

      defaultSrcWaitMinutes: consts.DEFAULT_SRC_WAIT_MINUTES,
      defaultSrcWaitMs: consts.DEFAULT_SRC_WAIT_MINUTES * 60000,
      defaultMdapiPollIntervalMinutes: consts.DEFAULT_MDAPI_POLL_INTERVAL_MINUTES,
      defaultMdapiPollIntervalMs: consts.DEFAULT_MDAPI_POLL_INTERVAL_MINUTES * 60000,
      defaultMdapiWaitMinutes: consts.DEFAULT_MDAPI_WAIT_MINUTES
    };

    _.defaults(configObject, workspaceConfigObject, defaultConfig);

    // TODO move to SfdxAggregator when this method is converted to async
    // Add fields in sfdx-config.json
    const workspaceOrgConfigPath = srcDevUtil.getWorkspaceOrgConfigPath(projectDir);
    if (srcDevUtil.pathExistsSync(workspaceOrgConfigPath)) {
      try {
        const fileContents = fs.readFileSync(workspaceOrgConfigPath, 'utf8');
        if (fileContents.length) {
          _.assign(configObject, JSON.parse(fileContents));
        }
      } catch (e) {
        throw srcDevUtil.processReadAndParseJsonFileError(e, workspaceOrgConfigPath);
      }
    }

    // Allow override of sfdcLoginUrl via env var FORCE_SFDC_LOGIN_URL
    if (process.env.FORCE_SFDC_LOGIN_URL) {
      configObject.sfdcLoginUrl = process.env.FORCE_SFDC_LOGIN_URL;
    }

    return configObject;
  } catch (e) {
    throw srcDevUtil.processReadAndParseJsonFileError(e, projectConfigDotJsonPath);
  }
};

const _getWorkspaceConfigObject = function(projectConfigDotJsonPath) {
  if (srcDevUtil.pathExistsSync(projectConfigDotJsonPath)) {
    return JSON.parse(fs.readFileSync(projectConfigDotJsonPath, 'utf8'));
  } else {
    throw new errors.MissingAppConfig();
  }
};

Config.prototype.getConfigContentWithValidation = async function(projectDir = this.getProjectPath()) {
  const projectConfigDotJsonPath = path.join(projectDir, this.getWorkspaceConfigFilename());
  const workspaceConfigObject = _getWorkspaceConfigObject(projectConfigDotJsonPath);

  try {
    await this.validator.validate(workspaceConfigObject);
    return this._getConfigContent(projectDir, workspaceConfigObject);
  } catch (err) {
    if (err.name === 'ValidationSchemaFieldErrors') {
      throw almError(
        {
          bundle: 'configGetCommand',
          keyName: 'sfdxProjectValidationFailure'
        },
        ['sfdx-project.json', err.message]
      );
    }
    throw err;
  }
};

Config.prototype.getConfigContent = function(projectDir = this.getProjectPath()) {
  const projectConfigDotJsonPath = path.join(projectDir, this.getWorkspaceConfigFilename());
  const workspaceConfigObject = _getWorkspaceConfigObject(projectConfigDotJsonPath);
  return this._getConfigContent(projectDir, workspaceConfigObject);
};

/**
 * Updates a config object on disk.
 * @param config The object to save.
 * @param projectDir The absolute path to the directory containing the workspace.
 */
Config.prototype.setConfigContent = function(configFileName, configDir, config) {
  if (!util.isNullOrUndefined(config)) {
    srcDevUtil.ensureDirectoryExistsSync(configDir);

    let promise = BBPromise.resolve({});

    const configFilePath = path.join(configDir, configFileName);
    if (srcDevUtil.pathExistsSync(configFilePath)) {
      promise = srcDevUtil.readJSON(configFilePath);
    }

    return promise
      .then(existingConfig => _.assign(existingConfig, config))
      .then(async newConfig => {
        // file is customer-editable, so write w/ spaces for readability
        await fsWriteFile(configFilePath, JSON.stringify(newConfig, null, 4), {
          flag: 'w',
          encoding: 'utf-8'
        });
      });
  } else {
    throw new errors.MissingRequiredParameter(config);
  }
};

/**
 * Updates the workspace org config object on disk.
 * @param config The object to save.
 * @param projectDir The absolute path to the directory containing the workspace.
 */
Config.prototype.setWorkspaceOrgConfigContent = function(projectDir, config) {
  return this.setConfigContent(
    srcDevUtil.getConfigFileName(),
    path.join(projectDir, srcDevUtil.getWorkspaceStateFolderName()),
    config
  );
};

/**
 * Updates the workspace org config object on disk.
 * @param config The object to save.
 * @param projectDir The absolute path to the directory containing the workspace.
 */
Config.prototype.setWorkspaceConfigContent = function(projectDir, config) {
  return this.setConfigContent(this.getWorkspaceConfigFilename(), projectDir, config);
};

Config.defaultSrcWaitMinutes = consts.DEFAULT_SRC_WAIT_MINUTES;
Config.defaultSrcWaitMs = consts.DEFAULT_SRC_WAIT_MINUTES * 60000;
Config.defaultMdapiPollIntervalMinutes = consts.DEFAULT_MDAPI_POLL_INTERVAL_MINUTES;
Config.defaultMdapiPollIntervalMs = consts.DEFAULT_MDAPI_POLL_INTERVAL_MINUTES * 60000;
Config.defaultMdapiWaitMinutes = consts.DEFAULT_MDAPI_WAIT_MINUTES;

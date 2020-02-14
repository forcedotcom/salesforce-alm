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
import * as path from 'path';

// Thirdparty
import * as BBPromise from 'bluebird';
import * as moment from 'moment';
import * as optional from 'optional-js';
import * as _ from 'lodash';
import * as mkdirp from 'mkdirp';

// Local
import { Config } from './configApi';
import Alias = require('./alias');
import * as OrgInfo from '../org/scratchOrgInfoApi';
import SfdxConfig = require('../config/SfdxConfig');
import { ConfigAggregator } from '@salesforce/core';
import * as almError from './almError';
import configValidator = require('./configValidator');
import logger = require('./logApi');
import orgConfigAttributes = require('../org/orgConfigAttributes');
import srcDevUtil = require('./srcDevUtil');
import * as apphub from '../apphub/appHubApi';
import MdapiDeployApi = require('../mdapi/mdapiDeployApi');
import { set } from '@salesforce/kit';
import { AuthInfo } from '@salesforce/core';

const defaultConnectedAppInfo = require('./defaultConnectedApp');
import Messages = require('../messages');
const messages = Messages();
const urls = require('../urls');
const fs = BBPromise.promisifyAll(require('fs'));

const _buildNoOrgError = org => {
  let message = messages.getMessage('defaultOrgNotFound', org.type);
  if (!_.isNil(org.name)) {
    message = messages.getMessage('namedOrgNotFound', org.name);
  }

  const noConfigError = new Error(message);
  noConfigError.name = 'NoOrgFound';
  if (org.type === SfdxConfig.OrgDefaults.USERNAME) {
    set(noConfigError, 'action', messages.getMessage('defaultOrgNotFoundAction'));
  } else if (org.type === SfdxConfig.OrgDefaults.DEVHUB) {
    set(noConfigError, 'action', messages.getMessage('defaultOrgNotFoundDevHubAction'));
  }
  return noConfigError;
};

/**
 * Represents a config json file in the state folder that consumers can interact with.
 *
 * TODO Extract out
 * TODO Make async. Has huge implications on source*.js files
 * TODO remove config with workspace.js in sfdx-core
 */
class StateFile {
  // TODO: proper property typing
  [property: string]: any;

  constructor(config, filePath, contents = {}) {
    this.path = path.join(config.getProjectPath(), srcDevUtil.getWorkspaceStateFolderName(), filePath);
    this.backupPath = `${this.path}.bak`;
    this.contents = contents;
  }

  _read(filePath) {
    // TODO use readJSON when async
    try {
      return JSON.parse(fs.readFileSync(filePath));
    } catch (e) {
      if (e.code === 'ENOENT') {
        return {};
      } else {
        throw e;
      }
    }
  }

  _write(filePath, contents) {
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(contents, null, 4));
  }

  _exist(filePath) {
    try {
      return fs.statSync(filePath);
    } catch (err) {
      return false;
    }
  }

  _delete(filePath) {
    if (this._exist(filePath)) {
      return fs.unlinkSync(filePath);
    }
    return false;
  }

  read() {
    this.contents = this._read(this.path);
    return this.contents;
  }

  write(newContents) {
    if (!_.isNil(newContents)) {
      this.contents = newContents;
    }

    this._write(this.path, this.contents);
    return this.contents;
  }

  exist() {
    return this._exist(this.path);
  }

  delete() {
    return this._delete(this.path);
  }

  backup() {
    if (this.exist()) {
      this._write(this.backupPath, this.read());
    }
  }

  revert() {
    if (this._exist(this.backupPath)) {
      this.write(this._read(this.backupPath));
      this._delete(this.backupPath);
    }
    return this.contents;
  }
}

/**
 * reduce metaConfigs down to an object that contains a consolidated view of ScratchOrgInfo objects across all
 * locally configured dev hubs.
 * @param {object} metaConfigs
 * @private
 */
const _localOrgMetaConfigsReduction = function(metaConfigs) {
  return metaConfigs.reduce((accum, currentValue) => {
    // Initialize the map to store scratchOrgInfos across all locally configured devHubs
    accum.mergedScratchOrgInfosAcrossLocalDevHubs = accum.mergedScratchOrgInfosAcrossLocalDevHubs || new Map();

    // Place to store locally authenticated orgs. drawing a distinction here of: {scratchOrg, devHub, non ScratchOrg
    accum.orgs = accum.orgs || [];

    // devhubs have ScratchOrgInfo objects keyed by username. Need to consolidate down to one map. The third index
    // of current value will contain devHub member data. an error object otherwise.
    if (_.isError(currentValue[2])) {
      if (currentValue[2].errorCode === 'INVALID_TYPE') {
        // Invalid type means we connected and there is not an sobject ScratchOrgInfo
        currentValue[1].connectedStatus = 'Connected';
      } else {
        currentValue[1].connectedStatus = currentValue[2].code || currentValue[2].errorCode || currentValue[2].name;
      }
    }
    // Not nil and not an error it must be a hub org.
    else if (!_.isNil(currentValue[2])) {
      currentValue[1].connectedStatus = 'Connected';
      currentValue[1].isDevHub = true;
      accum.mergedScratchOrgInfosAcrossLocalDevHubs = new Map([
        ...accum.mergedScratchOrgInfosAcrossLocalDevHubs,
        ...currentValue[2]
      ]);
    }
    // nil - we know for a fact it's not a dev hub
    else {
      currentValue[1].connectedStatus = 'Unknown';
    }

    // update the lastUsed value to the fstats returned from the previous handler.
    currentValue[1].lastUsed = currentValue[0].atime;
    accum.orgs.push(currentValue[1]);
    return accum;
  }, {});
};

/**
 * Helper to match orgMeta usernames against the project configuration for defaultdevhubusername and defaultusername
 * @param {object} orgMeta - the metadata containing the username to check
 * @param {array} _defaultOrgs - an array containing the default username and devhub
 * @private
 */
const _identifyDefaultOrgs = function(orgMeta, _defaultOrgs) {
  if (orgMeta.username === _defaultOrgs[0]) {
    orgMeta.isDefaultDevHubUsername = true;
  } else if (orgMeta.username === _defaultOrgs[1]) {
    orgMeta.isDefaultUsername = true;
  }
};

/**
 * Helper utility to remove sensitive information from a scratch org auth config. By default refreshTokens and client secrets are removed.
 * @param {*} config - scratch org auth object.
 * @param {string[]} properties - properties to exclude ex ['refreshToken', 'clientSecret']
 * @returns the config less the sensitive information.
 */
const _removeRestrictedInfoFromConfig = function(config, properties = ['refreshToken', 'clientSecret']) {
  return _.omit(config, properties);
};

/**
 * Helper to group orgs by {devHub, scratchOrg, nonScratchOrgs}
 * @param {object} configsAcrossDevHubs - The orgs and scratchOrgInfo map. See _localOrgMetaConfigsReduction
 * @param {object} orgClass - The scratchOrg prototype
 * @param {string[]} excludeProperties - properties to exclude from the grouped configs ex. ['refreshToken', 'clientSecret']
 * @private
 */
const _groupOrgs = async function(configsAcrossDevHubs, orgClass, excludeProperties) {
  const self = this;
  const _accum = {};

  _.set(_accum, 'scratchOrgs', new Map());
  _.set(_accum, 'nonScratchOrgs', new Map());
  _.set(_accum, 'devHubs', new Map());

  // Since configsAcrossDevHubs can actually have no orgs we want to return a valid empty data structure.
  if (_.isNil(configsAcrossDevHubs.orgs)) {
    return BBPromise.resolve(_accum);
  }

  // This promise handler is used to find the default project configuration for targetusername and
  // targetdevhubusername
  return BBPromise.all([
    orgClass
      .create(undefined, orgClass.Defaults.DEVHUB)
      .then(org => org.name)
      .catch(() => null),
    orgClass
      .create(undefined, orgClass.Defaults.USERNAME)
      .then(org => org.name)
      .catch(() => null)
  ]).then(defaultOrgs =>
    configsAcrossDevHubs.orgs.reduce((accum, _currentValue) => {
      const currentValue = _removeRestrictedInfoFromConfig(_currentValue, excludeProperties);

      _identifyDefaultOrgs.call(self, currentValue, defaultOrgs);

      const info = configsAcrossDevHubs.mergedScratchOrgInfosAcrossLocalDevHubs.get(currentValue.username);

      // This means we found a scratchOrgInfo object from some dev hub so we can get the status.
      if (!_.isNil(info)) {
        // update the info object with an expiration indicator.
        info.isExpired = moment(info.expirationDate).isBefore(moment());

        // Note that the info object contains a devHubUsername reference. It will be merged in/over.
        // This will ensure if we lose contact with a devHub we can determine this is a scratchOrg.
        accum.scratchOrgs.set(currentValue.username, _.merge(currentValue, info));
      } else if (currentValue.devHubUsername) {
        // In this scenario there was no hit on this org as it pertains to being a member of a devhub. But this org
        // was tagged as a scratch org during either a local create:org command or a previous invocation of the
        // list command. The org could have been deleted after the last time org:list was executed.
        currentValue.isMissing = true;
        accum.scratchOrgs.set(currentValue.username, _.merge(currentValue, info));
      } else {
        accum.nonScratchOrgs.set(currentValue.username, currentValue);
      }

      if (currentValue.isDevHub) {
        accum.devHubs.set(currentValue.username, currentValue);
      }

      return accum;
    }, _accum)
  );
};

/**
 * helper that updates all the org auth files with indicators to reduce the number of queries to the server.
 * @param {Array} groupedOrgs - an array of scratchOrg, nonScratchOrgs, devHubs
 * @param {function} _orgUpdate - a function to perform the file update
 * @returns {BBPromise.<TResult>}
 */
const _updateOrgIndicators = function(groupedOrgs, _orgUpdate) {
  return BBPromise.map(
    groupedOrgs.scratchOrgs,
    meta => _orgUpdate(meta[1], { devHubUsername: meta[1].devHubUsername }),
    { concurrency: 1 }
  )
    .catch(err => {
      // by some remote chance we cannot update the cache value for isDevHub it's not the end of the world. If
      // there is a large number of orgs the performance could be slower each time the command is invoked. Putting a
      // warning in the log is appropriate.
      this.logger.warn(`error writing files: ${err.message} stack: ${err.stack}`);
    })
    .then(() => groupedOrgs);
};

/**
 * @deprecated The functionality is moving to sfdx-core
 */
class Org {
  // TODO: proper property typing
  [property: string]: any;

  /**
   * Org types that can be set as a default for local and global configs.
   * All commands target USERNAME, except commands that specify a different
   * default, like org:create specifing DEVHUB has a default.
   */
  static Defaults = SfdxConfig.OrgDefaults;

  /**
   * Construct a new org. No configuration is initialized at this point. To
   * get any auth data, getConfig must first be called which will try to get
   * the default org of the given type unless the setName method is called.
   * Any calls to org.force will call getConfig.
   *
   * @param {Force} force The force api
   * @param {string} type The type of org for the CLI. This is used to store
   * and find defaults for the project.
   * @constructor
   */
  constructor(force?, type = SfdxConfig.OrgDefaults.USERNAME) {
    // eslint-disable-next-line
    const Force = require('./force');

    this.force = optional.ofNullable(force).orElse(new Force(new Config()));
    this.config = this.force.getConfig();
    this.logger = logger.child('Org');
    this.type = type;
    this.mdDeploy = new MdapiDeployApi(this);
  }

  retrieveMaxApiVersion() {
    // getting the max api version does not require auth. So if you think adding a call to refreshAuth here is the correct
    // thing to do. it's not!
    return this.force.getApiVersions(this).then(versions => _.maxBy(versions, (_ver: any) => _ver.version));
  }
  /**
   * Gets the name of this scratch org.
   */
  getName() {
    return this.name;
  }

  resolveDefaultName() {
    // If the name is set, we don't want to resolve the default
    if (this.getName()) {
      return BBPromise.resolve();
    }

    return this.resolvedAggregator().then(sfdxConfig => {
      const name = sfdxConfig.getPropertyValue(this.type);

      return Alias.get(name).then(orgName => {
        this.setName(orgName || name);
      });
    });
  }

  /**
   * Sets the name of this scratch org. After setting the name any call to getConfig will result in the org associated
   * with $HOME/.sfdx/[name].json being returned.
   * @param name - the name of the org.
   */
  setName(name) {
    this.name = name;
    this.logger.setConfig('username', name);
    this.force.logger.setConfig('username', name);
  }

  async resolvedAggregator() {
    if (!this.aggregator) {
      this.aggregator = ConfigAggregator.create();
    }

    return this.aggregator;
  }

  /**
   * Get if this org is the actual workspace org. The WORKSPACE type is set by default
   * so we can retrive the workspace org by default when getConfig is called. However,
   * if someone wants to know if an org is actually a workspace org, we need to make sure
   * that the current username is the actual name in the sfdx-config.json, otherwise
   * it is not the workspace org, even if it should be but isn't saved yet. i.e.
   * setName is called after which happens if the --username falg is set.
   */
  isWorkspaceOrg() {
    return (
      this.type === SfdxConfig.OrgDefaults.USERNAME &&
      this.getName() === this.config.getAppConfigIfInWorkspace()[this.type]
    );
  }

  getDataPath(filename?) {
    const username = this.getName();

    if (!username) {
      throw _buildNoOrgError(this);
    }

    // Create a path like <project>/.sfdx/orgs/<username>/<filename>
    return path.join(...['orgs', username, filename].filter(e => !!e));
  }

  /**
   * Clean all data files in the org's data path, then remove the data directory.
   * Usually <workspace>/.sfdx/orgs/<username>
   */
  cleanData(orgDataPath) {
    let dataPath;
    try {
      dataPath = path.join(
        this.config.getProjectPath(),
        srcDevUtil.getWorkspaceStateFolderName(),
        orgDataPath || this.getDataPath()
      );
    } catch (err) {
      if (err.name === 'InvalidProjectWorkspace') {
        // If we aren't in a project dir, we can't clean up data files.
        // If the user deletes this org outside of the workspace they used it in,
        // data files will be left over.
        return;
      }
      throw err;
    }

    const removeDir = dirPath => {
      let stats;

      try {
        stats = fs
          .readdirSync(dirPath)
          .map(file => path.join(dirPath, file))
          .map(filePath => ({ filePath, stat: fs.statSync(filePath) }));

        stats.filter(({ stat }) => stat.isDirectory()).forEach(({ filePath }) => removeDir(filePath));
        stats.filter(({ stat }) => stat.isFile()).forEach(({ filePath }) => fs.unlinkSync(filePath));

        fs.rmdirSync(dirPath);
      } catch (err) {
        this.logger.warn(`failed to read directory ${dirPath}`);
      }
    };

    removeDir(dataPath);
  }

  /**
   * Get the full path to the file storing the maximum revision value from the last valid pull from workspace scratch org
   * @param wsPath - The root path of the workspace
   * @returns {*}
   */
  getMaxRevision() {
    return new StateFile(this.config, this.getDataPath('maxrevision.json'));
  }

  /**
   * Get the full path to the file storing the workspace source path information
   * @param wsPath - The root path of the workspace
   * @returns {*}
   */
  getSourcePathInfos() {
    return new StateFile(this.config, this.getDataPath('sourcePathInfos.json'));
  }

  /**
   * Get the full path to the file storing the workspace metadata typeDefs
   * @param wsPath - The root path of the workspace
   * @returns {*}
   */
  getMetadataTypeInfos() {
    return new StateFile(this.config, this.getDataPath('metadataTypeInfos.json'));
  }

  /**
   * Returns a promise to retrieve the ScratchOrg configuration for this workspace.
   * @returns {BBPromise}
   */
  getConfig() {
    if (this.authConfig) {
      return BBPromise.resolve(this.authConfig);
    }
    return this.resolveDefaultName()
      .then(() => this.resolvedAggregator())
      .then(sfdxConfig => {
        const username = this.getName();
        // The username of the org can be set by the username config var, env var, or command line.
        // If the username is not set, getName will resolve to the default username for the workspace.
        // If the username is an access token, use that instead of getting the username auth file.
        const accessTokenMatch = _.isString(username) && username.match(/^(00D\w{12,15})![\.\w]*$/);

        if (accessTokenMatch) {
          let instanceUrl;
          const orgId = accessTokenMatch[1];

          this.usingAccessToken = true;

          // If it is an env var, use it instead of the local workspace sfdcLoginUrl property,
          // otherwise try to use the local sfdx-project property instead.
          if (sfdxConfig.getInfo('instanceUrl').isEnvVar()) {
            instanceUrl = sfdxConfig.getPropertyValue('instanceUrl');
          } else {
            instanceUrl = sfdxConfig.getPropertyValue('instanceUrl') || urls.production;
          }

          // If the username isn't an email, is it as a accessToken
          return {
            accessToken: username,
            instanceUrl,
            orgId
          };
        } else {
          return srcDevUtil
            .getGlobalConfig(`${username}.json`)
            .then(config => configValidator.getCleanObject(config, orgConfigAttributes, false))
            .then(config => {
              if (_.isNil(config.clientId)) {
                config.clientId = defaultConnectedAppInfo.legacyClientId;
                config.clientSecret = defaultConnectedAppInfo.legacyClientSecret;
              }
              return config;
            })
            .catch(error => {
              let returnError = error;

              if (error.code === 'ENOENT') {
                returnError = _buildNoOrgError(this);
              }

              return BBPromise.reject(returnError);
            });
        }
      })
      .then(config => {
        this.authConfig = config;
        return config;
      });
  }

  /**
   * Removes the scratch org config file at $HOME/.sfdx/[name].json, any project level org
   * files, all user auth files for the org, matching default config settings, and any
   * matching aliases.
   * @deprecated See Org.ts in sfdx-core
   */
  deleteConfig() {
    // If deleting via the access token there shouldn't be any auth config files
    // so just return;
    if (this.usingAccessToken) {
      return BBPromise.resolve();
    }

    let orgFileName;
    const aliases = [];

    // If the org being deleted is the workspace org then we need to do this so that subsequent calls to the
    // cli won't fail when trying to retrieve scratch org info from ~/.sfdx
    const cleanup = name => {
      let alias;
      return Alias.byValue(name)
        .then(_alias => {
          alias = _alias;
          _alias && aliases.push(_alias);
        })
        .then(() => this.resolvedAggregator())
        .then(aggregator => {
          // Get the aggregated config for this type of org
          const info = aggregator.getInfo(this.type);

          // We only want to delete the default if it is in the local or global
          // config file. i.e. we can't delete an env var.
          if ((info.value === name || info.value === alias) && (info.isGlobal() || info.isLocal())) {
            // Pass in undefined to unset it
            return SfdxConfig.set(info.isGlobal(), this.type);
          }
          return BBPromise.resolve();
        })
        .then(() => this.cleanData(path.join('orgs', name)))
        .then(() => {
          AuthInfo.clearCache(name);
          return srcDevUtil.deleteGlobalConfig(`${name}.json`);
        });
    };

    return this.getConfig()
      .then(orgData => {
        orgFileName = `${orgData.orgId}.json`;
        return srcDevUtil.getGlobalConfig(orgFileName, {});
      })
      .then(({ usernames }) => {
        if (!usernames) {
          usernames = [this.getName()];
          orgFileName = null;
        }
        return usernames;
      })
      .then(usernames => {
        this.logger.info(`Cleaning up usernames: ${usernames} in org: ${this.authConfig.orgId}`);
        return BBPromise.all(usernames.map(username => cleanup(username)));
      })
      .then(() => Alias.unset(aliases))
      .then(() => {
        if (orgFileName) {
          return srcDevUtil.deleteGlobalConfig(orgFileName);
        }
        return BBPromise.resolve();
      });
  }

  getFileName() {
    return `${this.name}.json`;
  }

  /**
   * Returns a promise to save a valid workspace scratch org configuration to disk.
   * @param configObject - The object to save. If the object isn't valid an error will be thrown.
   * { orgId:, redirectUri:, accessToken:, refreshToken:, instanceUrl:, clientId: }
   * @param saveAsDefault {boolean} - whether to save this org as the default for this workspace.
   * @returns {BBPromise.<Object>} Not the access tokens will be encrypted. Call get config to get decrypted access tokens.
   */
  saveConfig(configObject, saveAsDefault?) {
    if (this.usingAccessToken) {
      return BBPromise.resolve(configObject);
    }

    this.name = configObject.username;

    let savedData;
    // For security reasons we don't want to arbitrarily write the configObject to disk.
    return configValidator
      .getCleanObject(configObject, orgConfigAttributes, true)
      .then(dataToSave => {
        savedData = dataToSave;
        return srcDevUtil.saveGlobalConfig(this.getFileName(), savedData);
      })
      .then(() => {
        AuthInfo.clearCache(configObject.username);
        this.logger.info(`Saved org configuration: ${this.getFileName()}`);

        if (saveAsDefault) {
          return this.saveAsDefault().then(() => {
            this.authConfig = configObject;
            return savedData;
          });
        }
        this.authConfig = configObject;
        return BBPromise.resolve(savedData);
      });
  }

  saveAsDefault() {
    let config;
    let local = true;

    try {
      config = new SfdxConfig();
    } catch (err) {
      if (err.name === 'InvalidProjectWorkspace') {
        local = false;
        config = new SfdxConfig(true);
      } else {
        throw err;
      }
    }

    return config
      .read()
      .then(contents => {
        contents[this.type] = this.alias || this.name;
        return config.write(contents);
      })
      .then(() => {
        this.logger.info(`Updated ${local ? 'local' : 'global'} org reference`);
      });
  }

  /**
   *  Check that this org is a scratch org by asking the dev hub if it knows about this org.
   *  @param devHubUsername - the username of the dev hub org
   *  @returns {BBPromise<Config>}
   *  @deprecated See Org.ts in sfdx-core
   */
  checkScratchOrg(devHubUsername) {
    return this.getConfig().then(config => {
      let hubOrgPromise;
      // If we know the hub org from the auth, use that instead and ignore
      // the flag and defaults.
      if (config.devHubUsername) {
        hubOrgPromise = Org.create(config.devHubUsername);
      } else {
        hubOrgPromise = Org.create(devHubUsername, Org.Defaults.DEVHUB);
      }

      return hubOrgPromise
        .catch(err => {
          err['action'] = messages.getMessage('action', [], 'generatePassword');
          throw err;
        })
        .then(hubOrg =>
          srcDevUtil
            .queryOrgInfoFromDevHub(hubOrg, config.orgId)
            .then((results = {}) => {
              // If no results, org is not associated with the devhub
              if (_.get(results, 'records.length') !== 1) {
                return hubOrg.getConfig().then(hubConfig => {
                  throw almError({ keyName: 'notFoundOnDevHub', bundle: 'generatePassword' }, [hubConfig.username], {
                    keyName: 'action',
                    bundle: 'generatePassword'
                  });
                });
              }
              return BBPromise.resolve(config);
            })
            .catch(err => {
              if (err.name === 'INVALID_TYPE') {
                return hubOrg.getConfig().then(hubConfig => {
                  throw almError({ keyName: 'notADevHub', bundle: 'generatePassword' }, [hubConfig.username], {
                    keyName: 'action',
                    bundle: 'generatePassword'
                  });
                });
              }
              throw err;
            })
        );
    });
  }

  /**
   * Refresh a users access token.
   * @returns {*|BBPromise.<{}>}
   * @deprecated See Org.ts in sfdx-core
   */
  refreshAuth() {
    return this.force.describeData(this);
  }

  /** Use the settings to generate a package ZIP and deploy it to the scratch org.
   * @param settings the settings generator
   * @returns {*|BBPromise.<{}>}
   */
  applySettings(settings, apiVersion) {
    // Create our own options so we can control the MD deploy of the settings package.
    const options = {
      wait: -1,
      disableLogging: true
    };

    return (
      settings
        .createDeployDir(apiVersion)
        // Package it all up and send to the scratch org
        .then(deploydir => this.mdDeploy.deploy(Object.assign(options, { deploydir })))
        .catch(err => {
          this.mdDeploy._reporter._printComponentFailures(err.result);
          return BBPromise.reject(almError('ProblemDeployingSettings'));
        })
    );
  }
  /**
   *  Reads and returns the global, hidden org file in $HOME/.sfdx for this org.
   *    E.g., $HOME/.sfdx/00Dxx0000001gPFEAY.json
   *  @returns {Object} - The contents of the org file, or an empty object if not found.
   */
  readOrgFile() {
    return this.getConfig().then(orgData => srcDevUtil.getGlobalConfig(`${orgData.orgId}.json`, {}));
  }

  /**
   *  Reads and returns the content of all user auth files for this org.
   *  @returns {Array} - An array of all user auth file content.
   *  @deprecated - See AuthInfo.ts in sfdx-core
   */
  readUserAuthFiles() {
    return this.readOrgFile()
      .then(({ usernames }) => usernames || [this.name])
      .map(username => srcDevUtil.getGlobalConfig(`${username}.json`));
  }

  /**
   * Returns Org object representing this org's Dev Hub org.
   *
   *  @returns {Org} - Org object or null if org is not affiliated to a Dev Hub (according to local config).
   *  @deprecated - See org.ts in sfdx-core
   */
  getDevHubOrg() {
    return this.getConfig().then(orgData => {
      let org = null;

      if (orgData.isDevHub) {
        org = this;
      } else if (orgData.devHubUsername) {
        org = Org.create(orgData.devHubUsername, Org.Defaults.DEVHUB);
      }

      return org;
    });
  }

  /**
   * Returns true if org if a Dev Hub.
   *
   *  @returns Boolean
   */
  isDevHubOrg() {
    return this.getConfig().then(orgData => orgData.isDevHub);
  }

  /**
   * Returns Org object representing this org's Dev Hub org.
   *
   *  @returns {Org} - Org object or null if org is not affiliated to a Dev Hub (according to local config).
   */
  getAppHub() {
    return this.getDevHubOrg().then(devHubOrg => apphub.getAppHub(devHubOrg));
  }

  /**
   * Returns the regular expression that filters files stored in $HOME/.sfdx
   * @returns {RegExp} - The auth file name filter regular expression
   */
  static getAuthFilenameFilterRegEx() {
    return /^[^.][^@]*@[^.]+(\.[^.\s]+)+\.json$/;
  }

  /**
   * The intent of the function is to determine if a user has authenticated at least once. The only way to really do this
   * is to check to see if there are any org files. If so, then we can assume there is a keychain in use only if there is
   * no generic keychain file. This covers the new install or reset case.
   */
  static hasAuthentications() {
    return Org.readAllUserFilenames()
      .then(users => !_.isEmpty(users))
      .catch(err => {
        // ENOENT
        if (err.name === 'noOrgsFound' || err.code === 'ENOENT') {
          return false;
        }
        throw err;
      });
  }

  /**
   * returns a list of all username auth file's stored in $HOME/.sfdx
   * @deprecated See Org.js and Auth.js in sfdx-core
   */
  static readAllUserFilenames() {
    return fs.readdirAsync(srcDevUtil.getGlobalHiddenFolder()).then(files => {
      const sfdxFiles = files.filter(file => file.match(Org.getAuthFilenameFilterRegEx()));
      // Want to throw a clean error if no files are found.
      if (_.isEmpty(sfdxFiles)) {
        throw almError(
          { keyName: 'noOrgsFound', bundle: 'scratchOrgApi' },
          null,
          { keyName: 'noOrgsFoundAction', bundle: 'scratchOrgApi' },
          null
        );
      } else {
        // At least one org is here. Maybe it's a dev hub
        return sfdxFiles;
      }
    });
  }

  /**
   * Returns a data structure containing all devhubs and scratch orgs stored locally in $HOME/.sfdx
   * @param {array} userFilenames - use readAllUserFilenames() to get a list of everything configured locally. This also
   * supports providing a subset of filenames which is useful if one only wants status information on one org. We can
   * limit unnecessary calls to the server.
   * @param {number} concurrency - the max number of requests that can be sent to the server at a time.
   * @returns {BBPromise.<*>}
   */
  static readMapOfLocallyValidatedMetaConfig(userFilenames, concurrency = 3) {
    if (concurrency < 1) {
      return BBPromise.reject(new Error('concurrency setting must be greater than zero.'));
    }

    const orgInfo = new OrgInfo();

    if (_.isNil(userFilenames) || _.isEmpty(userFilenames)) {
      return BBPromise.reject(new Error('file names not specified.'));
    }

    const fileDoesntExistFilter = BBPromise.all(
      _.map(userFilenames, fileName => {
        const filePath = path.join(srcDevUtil.getGlobalHiddenFolder(), fileName);
        return BBPromise.all([
          fs
            .statAsync(filePath)
            .then(stat => stat)
            .catch(() => null),
          srcDevUtil
            .readJSON(filePath)
            .then(content => content)
            .catch(err => {
              logger.warn(`Problem reading file: ${filePath} skipping`);
              logger.warn(err.message);
              return null;
            })
        ]);
      })
    )
      // also removes non-admin auth files; i.e., users created via user:create
      .filter(
        statsAndContent =>
          !_.isNil(statsAndContent[0]) &&
          !_.isNil(statsAndContent[1]) &&
          _.isNil(statsAndContent[1].scratchAdminUsername)
      );

    return fileDoesntExistFilter
      .then(fileContentsAndMeta => {
        const orgIds15 = _.map(fileContentsAndMeta, fileContentAndMeta => {
          if (fileContentAndMeta && fileContentAndMeta.length > 0) {
            return srcDevUtil.trimTo15(fileContentAndMeta[1].orgId);
          }
          return null;
        });
        return BBPromise.map(
          fileContentsAndMeta,
          fileContentAndMeta => {
            /**
             * If the org represented by filename is a devhub it will have the ScratchOrgInfo metadata at the third
             * position in the promise array returned in this peer scope.
             * @returns {BBPromise.<array>}
             */
            const promiseDevHubMetadata = username => {
              const org = new Org();
              org.setName(username);

              return org
                .getConfig()
                .then(configData => {
                  // Do the query for orgs without a devHubUsername attribute. In some cases scratch org auth
                  // files may not have a devHubUsername property; but that's ok. We will discover if it.
                  if (_.isNil(configData.devHubUsername)) {
                    return org
                      .refreshAuth()
                      .catch(err => {
                        org.logger.trace(`error refreshing auth for org: ${configData.username}`);
                        org.logger.trace(err);
                        return err;
                      })
                      .then(result => {
                        if (_.isError(result)) {
                          return result;
                        }
                        return orgInfo.retrieveScratchOrgInfosWhereInOrgIds(org, orgIds15);
                      })
                      .catch(err => {
                        org.logger.trace(
                          `error retrieving ScratchOrgInfo object for org: ${configData.username}. this is expected for non-devhubs`
                        );
                        org.logger.trace(err);
                        return err;
                      });
                  } else {
                    // only if we know for certain that an org isn't a dev hub.
                    return null;
                  }
                })
                .catch(err => err);
            };

            // Get the file metadata attributes, content, also assume this org is devHub so attempt to get
            // ScratchOrgInfo objects..
            return BBPromise.all([
              fileContentAndMeta[0],
              fileContentAndMeta[1],
              promiseDevHubMetadata(fileContentAndMeta[1].username).catch(() => null)
            ]);
          },

          { concurrency }
        );
      })
      .then(metaConfigs => _localOrgMetaConfigsReduction(metaConfigs));
  }

  /**
   * this methods takes all locally configured orgs and organizes them into the following buckets:
   * { devHubs: [{}], nonScratchOrgs: [{}], scratchOrgs: [{}] }
   * @param [{string}] - an array of strings that are validated for devHubs against the server.
   * @param {number} concurrency - this is the max batch number of http requests that will be sent to the server for
   * the scratchOrgInfo query.
   * @param {string[]|null} excludeProperties - properties to exclude from the configs defaults. ['refreshToken', 'clientSecret']. Specify null to include all properties.
   */
  static readLocallyValidatedMetaConfigsGroupedByOrgType(userFilenames, concurrency = 3, excludeProperties?) {
    return Org.readMapOfLocallyValidatedMetaConfig(userFilenames, concurrency)
      .then(configsAcrossDevHubs =>
        Alias.list().then(aliases => {
          _.forEach(configsAcrossDevHubs.orgs, org => {
            org.alias = _.findKey(aliases, alias => alias === org.username);
          });
          return configsAcrossDevHubs;
        })
      )
      .then(configsAcrossDevHubsWithAlias =>
        _groupOrgs.call(new Config(), configsAcrossDevHubsWithAlias, Org, excludeProperties)
      )
      .then(groupedOrgs =>
        _updateOrgIndicators.call(
          {
            logger: logger.child('readLocallyValidatedMetaConfigGroupdByOrgType')
          },
          groupedOrgs,
          (meta, attributesToMerge) => {
            const org = new Org();
            org.setName(meta.username);
            return org
              .getConfig()
              .then(configData => {
                // we want to merge the attributes and save the config only if the attributes to merge are
                // different.
                if (!_.isNil(attributesToMerge)) {
                  const matcher = _.matches(attributesToMerge);
                  if (!matcher(configData)) {
                    return org.saveConfig(_.merge(configData, attributesToMerge));
                  }
                }
                return null;
              })
              .catch(() => null);
          }
        )
      );
  }

  /**
   * Determines the value of the status field that is reported to the user
   * @param {object} val - the scratchOrg
   * @param {map} devHubs - a map of devhubs found locally.
   */
  static computeAndUpdateStatusForMetaConfig(val, devHubs) {
    if (val) {
      if (val.isExpired) {
        val.status = 'Expired';
      }

      const devHub = !_.isNil(val.devHubUsername) ? devHubs.get(val.devHubUsername) : null;
      // this means we know we have a scratch org, but no dev hub is providing ownership.
      // the org is likely gone. this could also mean the dev hub this auth file is
      // associated with hasn't been locally authorized.
      if (val.isMissing) {
        val.status = _.isNil(val.devHubUsername) || _.isNil(devHub) ? 'Unknown' : 'Missing';
      }
    }
  }

  /**
   * @deprecated See Org.ts in sfdx-core
   */
  static async create(username?, defaultType?) {
    // If orgType is undefined, Org will use the right default.
    const org = new Org(undefined, defaultType);

    if (_.isString(username) && !_.isEmpty(username)) {
      // Check if the user is an alias
      const actualUsername = await Alias.get(username);
      const verbose = srcDevUtil.isVerbose();
      if (_.isString(actualUsername) && !_.isEmpty(actualUsername)) {
        if (verbose) {
          logger.log(`Using resolved username ${actualUsername} from alias ${username}${logger.getEOL()}`);
        }

        org.alias = username;
        org.setName(actualUsername);
      } else {
        if (verbose) {
          logger.log(`Using specified username ${username}${logger.getEOL()}`);
        }

        org.setName(username);
      }
    }
    // If the username isn't set or passed in, the default username
    // will be resolved on config.
    await org.getConfig();
    return org;
  }
}

export = Org;

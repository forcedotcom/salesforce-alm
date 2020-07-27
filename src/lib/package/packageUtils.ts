/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import * as urlLib from 'url';

//Node
import * as BBPromise from 'bluebird';

import PackageVersionCreateRequestApi = require('./packageVersionCreateRequestApi');

import { SfdxError, Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);

import Messages_old = require('../messages');

const messages = Messages_old();

const NOT_FOUND_MESSAGE = 'The requested resource does not exist';
const INVALID_TYPE_REGEX = /[\w]*(sObject type '[A-Za-z]*Package[2]?[A-Za-z]*' is not supported)[\w]*/im;
const ID_REGISTRY = [
  {
    prefix: '0Ho',
    label: 'Package Id'
  },
  {
    prefix: '05i',
    label: 'Package Version Id'
  },
  {
    prefix: '08c',
    label: 'Package Version Create Request Id'
  },
  {
    prefix: '04t',
    label: 'Subscriber Package Version Id'
  }
];

const LATEST_BUILD_NUMBER_TOKEN = 'LATEST';
const NEXT_BUILD_NUMBER_TOKEN = 'NEXT';
const VERSION_NUMBER_SEP = '.';

const INSTALL_URL_BASE = 'https://login.salesforce.com/packaging/installPackage.apexp?p0=';

// https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_soslsoql.htm
const SOQL_WHERE_CLAUSE_MAX_LENGTH = 4000;

const POLL_INTERVAL_SECONDS: number = 30;

const DEFAULT_PACKAGE_DIR = {
  path: '',
  package: '',
  versionName: 'ver 0.1',
  versionNumber: '0.1.0.NEXT',
  default: true
};

class SubscriberPackageVersionQuery {
  static readonly SELECT =
    'SELECT Package2ContainerOptions, SubscriberPackageId, InstallValidationStatus, ' +
    'RemoteSiteSettings, CspTrustedSites FROM SubscriberPackageVersion ';
  // Represents case when the SubscriberPackageVersion table row can't be queried because:
  //  - the user didn't provide an installKey and it was needed
  //  - or, the user provided an incorrect installKey
  private invalidInstallKey: boolean = false;
  subscriberPackageId: string;
  installationValidationStatus: string;
  // All RSS/CSP external third party websites
  trustedSites: [];
  package2ContainerOptions: string;
  org: any;
  force: any;
  allPackageVersionId: string;
  installationKey: string;
  queryStr: string;
  logger: any;

  /**
   *
   * @param allPackageVersionId the id to use for querying SubscriberPackageVerison
   * @param installationKey (optional) provide this if
   */
  constructor(org: any, force: any, logger: any, allPackageVersionId: string, installationKey: string) {
    this.org = org;
    this.force = force;
    this.logger = logger;
    this.allPackageVersionId = allPackageVersionId;
    this.installationKey = installationKey;
    if (installationKey != null) {
      const escapedInstallationKey =
        this.installationKey != null ? this.installationKey.replace(/\\/g, '\\\\').replace(/\'/g, "\\'") : null;
      this.queryStr =
        SubscriberPackageVersionQuery.SELECT +
        `WHERE Id = '${allPackageVersionId}' AND InstallationKey = '${escapedInstallationKey}'`;
    } else {
      this.queryStr = SubscriberPackageVersionQuery.SELECT + `WHERE Id = '${allPackageVersionId}'`;
    }
  }

  /**
   *
   */
  async _runQuery() {
    let queryResult = null;
    try {
      queryResult = await this.force.toolingQuery(this.org, this.queryStr);
      return queryResult;
    } catch (e) {
      if (e.name === 'INSTALL_KEY_INVALID' || e.name === 'INSTALL_KEY_REQUIRED') {
        // it's replicated but an install key is required for install, but wasn't provided.
        // this is an acceptable condition due to ability to install a package version into a
        // scratch org w/o install key if it's installed in the scratch org's dev hub
        this.invalidInstallKey = true;
      } else if (!SubscriberPackageVersionQuery.isErrorPackageNotAvailable(e)) {
        throw e;
      }
      return null;
    }
  }

  /**
   * Run the query, populate all the fields, designed to be run multiple times for replication checking
   * @param retries total number of retries to allow the package to replicate
   * @param pollInterval ms to wait between retries
   * @returns nothing, if this doesn't throw an exception it can be considered a valid object,
   *          however the properties may be undefined if the values couldn't be retrieved due to installKey problems
   * @throws runtime exceptions that cannot be handled and Error when APV hasn't replicated yet
   */
  async query(retries: number, pollInterval: number) {
    while (retries-- >= 0) {
      let queryResult = await this._runQuery();
      if (queryResult == null) {
        if (this.invalidInstallKey) {
          return; // no sense in retrying
        } // else fall through to retry
      } else {
        if (queryResult.records && queryResult.records.length > 0) {
          this.installationValidationStatus = queryResult.records[0].InstallValidationStatus;
          if (
            this.installationValidationStatus != 'PACKAGE_UNAVAILABLE' &&
            this.installationValidationStatus != 'UNINSTALL_IN_PROGRESS'
          ) {
            this._populateObject(queryResult.records[0]);
            return;
          }
        }
      }
      if (retries > 0) {
        await BBPromise.delay(pollInterval).then(() => {
          this.logger.log(messages.getMessage('publishWaitProgress', [], 'package_install'));
        });
      }
    }

    if (this.installationValidationStatus && this.installationValidationStatus == 'UNINSTALL_IN_PROGRESS') {
      // There are no more reties.  Throw an error indicating the package is unavailable.
      // For UNINSTALL_IN_PROGRESS, though, allow install to proceed which will result in an appropriate UninstallInProgressProblem
      // error message being displayed.
      return;
    } else {
      throw new Error(messages.getMessage('errorApvIdNotPublished', [], 'package_install'));
    }
  }

  private _populateObject(queryResultRecord) {
    this.subscriberPackageId = queryResultRecord.SubscriberPackageId;
    this.installationValidationStatus = queryResultRecord.InstallValidationStatus;
    this.package2ContainerOptions = queryResultRecord.Package2ContainerOptions;
    const rssUrls = queryResultRecord.RemoteSiteSettings.settings.map(rss => rss.url);
    const cspUrls = queryResultRecord.CspTrustedSites.settings.map(csp => csp.endpointUrl);
    this.trustedSites = rssUrls.concat(cspUrls);
  }

  private static isErrorPackageNotAvailable(err) {
    return err.name === 'UNKNOWN_EXCEPTION' || err.name === 'PACKAGE_UNAVAILABLE';
  }
}

export = {
  SubscriberPackageVersionQuery,

  async getSubscriberPackageVersionQuery(
    org: any,
    force: any,
    logger: any,
    allPackageVersionId: string,
    installationKey: string,
    retries: number,
    pollInterval: number
  ): Promise<SubscriberPackageVersionQuery> {
    let spv = new SubscriberPackageVersionQuery(org, force, logger, allPackageVersionId, installationKey);
    await spv.query(retries, pollInterval);
    return spv;
  },

  BY_PREFIX: (function() {
    const byIds: any = {};
    ID_REGISTRY.forEach(id => {
      byIds[id.prefix] = id;
    });
    return byIds;
  })(),

  BY_LABEL: (function() {
    const byLabels: any = {};
    ID_REGISTRY.forEach(id => {
      byLabels[id.label.replace(/ /g, '_').toUpperCase()] = id;
    });
    return byLabels;
  })(),

  validateId(idObj, value) {
    if (!this.validateIdNoThrow(idObj, value)) {
      const msg = messages.getMessage(
        'invalidIdOrAlias',
        [
          Array.isArray(idObj) ? idObj.map(e => e.label).join(' or ') : idObj.label,
          value,
          Array.isArray(idObj) ? idObj.map(e => e.prefix).join(' or ') : idObj.prefix
        ],
        'packaging'
      );
      throw new Error(msg);
    }
  },

  validateIdNoThrow(idObj, value) {
    if (!value || (value.length !== 15 && value.length !== 18)) {
      return false;
    }
    return Array.isArray(idObj) ? idObj.some(e => value.startsWith(e.prefix)) : value.startsWith(idObj.prefix);
  },

  validateVersionNumber(versionNumberString, supportedBuildNumberToken) {
    if (!versionNumberString) {
      throw new Error(messages.getMessage('errorMissingVersionNumber', [], 'packaging'));
    }

    // split into array of [major, minor, patch, build]
    const versionNumber = versionNumberString.split(VERSION_NUMBER_SEP);
    if (versionNumber.length !== 4) {
      throw new Error(messages.getMessage('errorInvalidVersionNumber', versionNumberString, 'packaging'));
    }

    if (versionNumber[3] !== supportedBuildNumberToken && Number.isNaN(parseInt(versionNumber[3]))) {
      throw new Error(
        messages.getMessage('errorInvalidBuildNumber', [versionNumberString, supportedBuildNumberToken], 'packaging')
      );
    }

    if (Number.isNaN(parseInt(versionNumber[1]))) {
      throw new Error(messages.getMessage('errorInvalidMajorMinorNumber', [versionNumberString, 'minor'], 'packaging'));
    }

    if (Number.isNaN(parseInt(versionNumber[0]))) {
      throw new Error(messages.getMessage('errorInvalidMajorMinorNumber', [versionNumberString, 'major'], 'packaging'));
    }
    return versionNumber;
  },

  async validatePatchVersion(force, org, versionNumberString, packageId) {
    const query = `SELECT ContainerOptions FROM Package2 WHERE id ='${packageId}'`;
    const queryResult = await force.toolingQuery(org, query);

    if (queryResult.records === null || queryResult.records.length === 0) {
      throw SfdxError.create('salesforce-alm', 'packaging', 'errorInvalidPackageId', [packageId]);
    }

    // Enforce a patch version of zero (0) for Locked packages only
    if (queryResult.records[0].ContainerOptions === 'Locked') {
      // Break-up version string into [major, minor, patch, build] array
      const versionNumber = versionNumberString.split(VERSION_NUMBER_SEP);
      if (versionNumber.length !== 4) {
        throw new Error(messages.getMessage('errorInvalidVersionNumber', versionNumberString, 'packaging'));
      }

      const patch = parseInt(versionNumber[2]);
      if (Number.isNaN(patch) || patch !== 0) {
        throw new Error(messages.getMessage('errorInvalidPatchNumber', versionNumberString, 'packaging'));
      }
    }
  },

  // check that the provided url has a valid format
  validUrl(url) {
    try {
      new urlLib.URL(url);
      return true;
    } catch (err) {
      return false;
    }
  },

  isErrorPackageNotAvailable(err) {
    return err.name === 'UNKNOWN_EXCEPTION' || err.name === 'PACKAGE_UNAVAILABLE';
  },

  // overwrites error message under certain conditions
  massageErrorMessage(err) {
    if (err.name === 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST') {
      err['message'] = messages.getMessage('invalidPackageTypeMessage', [], 'packaging');
    }

    if (
      err.name === 'MALFORMED_ID' &&
      (err.message.includes('Version ID') || err.message.includes('Version Definition ID'))
    ) {
      err['message'] = messages.getMessage('malformedPackageVersionIdMessage', [], 'packaging');
    }

    if (err.name === 'MALFORMED_ID' && err.message.includes('Package2 ID')) {
      err['message'] = messages.getMessage('malformedPackageIdMessage', [], 'packaging');
    }

    // remove references to Second Generation
    if (err.message.includes('Second Generation ')) {
      err['message'] = err.message.replace('Second Generation ', '');
    }

    return err;
  },

  // applies actions to common package errors
  applyErrorAction(err) {
    // append when actions already exist
    const actions = [];

    // include existing actions
    if (err.action) {
      actions.push(err.action);
    }

    // TODO:
    // until next generation packaging is GA, wrap perm-based errors w/
    // 'contact sfdc' action (REMOVE once GA'd)
    if (
      (err.name === 'INVALID_TYPE' && INVALID_TYPE_REGEX.test(err.message)) ||
      (err.name === 'NOT_FOUND' && err.message === NOT_FOUND_MESSAGE)
    ) {
      // contact sfdc customer service
      actions.push(messages.getMessage('packageNotEnabledAction', [], 'packaging'));
    }

    if (err.name === 'INVALID_FIELD' && err.message.includes('Instance')) {
      actions.push(messages.getMessage('packageInstanceNotEnabled', [], 'packaging'));
    }

    if (err.name === 'INVALID_FIELD' && err.message.includes('SourceOrg')) {
      actions.push(messages.getMessage('packageSourceOrgNotEnabled', [], 'packaging'));
    }

    if (err.name === 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST') {
      actions.push(messages.getMessage('invalidPackageTypeAction', [], 'packaging'));
    }

    if (
      err.name === 'MALFORMED_ID' &&
      err.message === messages.getMessage('malformedPackageIdMessage', [], 'packaging')
    ) {
      actions.push(messages.getMessage('malformedPackageIdAction', [], 'packaging'));
    }

    if (
      err.name === 'MALFORMED_ID' &&
      err.message === messages.getMessage('malformedPackageVersionIdMessage', [], 'packaging')
    ) {
      actions.push(messages.getMessage('malformedPackageVersionIdAction', [], 'packaging'));
    }

    if (
      (err.message.includes(this.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID.label) && err.message.includes('is invalid')) ||
      err.name === 'INVALID_ID_FIELD' ||
      (err.name === 'INVALID_INPUT' && err.message.includes('Verify you entered the correct ID')) ||
      err.name === 'MALFORMED_ID'
    ) {
      actions.push(messages.getMessage('idNotFoundAction', [], 'packaging'));
    }

    if (actions.length > 0) {
      err['action'] = actions.join('\n');
    }

    return err;
  },

  /**
   * Given a subscriber package version ID (04t) or package version ID (05i), return the package version ID (05i)
   * @param versionId The suscriber package version ID
   * @param force For tooling query
   * @param org For tooling query
   */
  getPackageVersionId(versionId, force, org) {
    // if it's already a 05i return it, otherwise query for it
    if (!versionId || versionId.startsWith(this.BY_LABEL.PACKAGE_VERSION_ID.prefix)) {
      return versionId;
    }
    const query = `SELECT Id FROM Package2Version WHERE SubscriberPackageVersionId = '${versionId}'`;
    return force.toolingQuery(org, query).then(queryResult => {
      if (!queryResult || !queryResult.totalSize) {
        throw new Error(
          messages.getMessage(
            'errorInvalidIdNoMatchingVersionId',
            [this.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID.label, versionId, this.BY_LABEL.PACKAGE_VERSION_ID.label],
            'packaging'
          )
        );
      }
      return queryResult.records[0].Id;
    });
  },

  /**
   * Given 0Ho the package type type (Managed, Unlocked, Locked(deprecated?))
   * @param package2Id the 0Ho
   * @param force For tooling query
   * @param org For tooling query
   * @throws Error with message when package2 cannot be found
   */
  async getPackage2Type(package2Id: string, force: any, org: any): Promise<string> {
    const query = `SELECT ContainerOptions FROM Package2 WHERE id ='${package2Id}'`;

    const queryResult = await force.toolingQuery(org, query);
    if (!queryResult || queryResult.records === null || queryResult.records.length === 0) {
      throw SfdxError.create('salesforce-alm', 'packaging', 'errorInvalidPackageId', [package2Id]);
    }
    return queryResult.records[0].ContainerOptions;
  },

  /**
   * Given a package version ID (05i) or subscriber package version ID (04t), return the subscriber package version ID (04t)
   * @param versionId The suscriber package version ID
   * @param force For tooling query
   * @param org For tooling query
   */
  getSubscriberPackageVersionId(versionId, force, org) {
    // if it's already a 04t return it, otherwise query for it
    if (!versionId || versionId.startsWith(this.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID.prefix)) {
      return versionId;
    }
    const query = `SELECT SubscriberPackageVersionId FROM Package2Version WHERE Id = '${versionId}'`;
    return force.toolingQuery(org, query).then(queryResult => {
      if (!queryResult || !queryResult.totalSize) {
        throw new Error(
          messages.getMessage(
            'errorInvalidIdNoMatchingVersionId',
            [this.BY_LABEL.PACKAGE_VERSION_ID.label, versionId, this.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID.label],
            'packaging'
          )
        );
      }
      return queryResult.records[0].SubscriberPackageVersionId;
    });
  },

  /**
   * Get the ContainerOptions for the specified Package2 (0Ho) IDs.
   * @return Map of 0Ho id to container option api value
   * @param poackage2Ids The list of package IDs
   * @param force For tooling query
   * @param org For tooling query
   */
  async getContainerOptions(package2Ids, force, org) {
    let results = new Map();
    if (!package2Ids || package2Ids.length === 0) {
      return results;
    }
    const query = 'SELECT Id, ContainerOptions FROM Package2 WHERE Id IN (%IDS%)';

    return this.queryWithInConditionChunking(query, package2Ids, '%IDS%', force, org).then(records => {
      if (records && records.length > 0) {
        records.forEach(record => {
          results.set(record.Id, record.ContainerOptions);
        });
      }
      return results;
    });
  },

  /**
   * Given a list of subscriber package version IDs (04t), return the associated version strings (e.g., Major.Minor.Patch.Build)
   * @return Map of subscriberPackageVersionId to versionString
   * @param versionIds The list of suscriber package version IDs
   * @param force For tooling query
   * @param org For tooling query
   */
  async getPackageVersionStrings(subscriberPackageVersionIds, force, org) {
    let results = new Map();
    if (!subscriberPackageVersionIds || subscriberPackageVersionIds.length === 0) {
      return results;
    }
    const query =
      'SELECT SubscriberPackageVersionId, MajorVersion, MinorVersion, PatchVersion, BuildNumber FROM Package2Version WHERE SubscriberPackageVersionId IN (%IDS%)';

    return this.queryWithInConditionChunking(query, subscriberPackageVersionIds, '%IDS%', force, org).then(records => {
      if (records && records.length > 0) {
        records.forEach(record => {
          const version = this.concatVersion(
            record.MajorVersion,
            record.MinorVersion,
            record.PatchVersion,
            record.BuildNumber
          );
          results.set(record.SubscriberPackageVersionId, version);
        });
      }
      return results;
    });
  },

  /**
   * For queries with an IN condition, determine if the WHERE clause will exceed
   * SOQL's 4000 character limit.  Perform multiple queries as needed to stay below the limit.
   *
   * @return concatenated array of records returned from the resulting query(ies)
   * @param query The full query to execute containing the replaceToken param in its IN clause
   * @param items The IN clause items.  A length-appropriate single-quoted comma-separated string chunk will be made from the items.
   * @param replaceToken A placeholder in the query's IN condition that will be replaced with the chunked items
   * @param force For tooling query
   * @param org For tooling query
   */
  async queryWithInConditionChunking(query, items, replaceToken, force, org) {
    const SOQL_WHERE_CLAUSE_MAX_LENGTH = this.getSoqlWhereClauseMaxLength();
    let records = [];
    if (!query || !items || !replaceToken) {
      return records;
    }

    const whereClause = query.substring(query.toLowerCase().indexOf('where'), query.length);
    const inClauseItemsMaxLength = SOQL_WHERE_CLAUSE_MAX_LENGTH - whereClause.length - replaceToken.length;

    let itemsQueried = 0;
    while (itemsQueried < items.length) {
      let chunkCount = this.getInClauseItemsCount(items, itemsQueried, inClauseItemsMaxLength);
      const itemsStr = "'" + items.slice(itemsQueried, itemsQueried + chunkCount).join("','") + "'";
      let queryChunk = query.replace(replaceToken, itemsStr);
      const result = await this.toolingQuery(queryChunk, force, org);
      if (result && result.length > 0) {
        records = records.concat(result);
      }
      itemsQueried += chunkCount;
    }
    return records;
  },

  /**
   *   Returns the number of items that can be included in a quoted comma-separated string (e.g., "'item1','item2'") not exceeding maxLength
   */
  getInClauseItemsCount(items, startIndex, maxLength) {
    let resultLength = 0;
    let includedCount = 0;

    while (startIndex + includedCount < items.length) {
      let itemLength = 0;
      if (items[startIndex + includedCount]) {
        itemLength = items[startIndex + includedCount].length + 3; //3 = length of '',
        if (resultLength + itemLength > maxLength) {
          // the limit has been exceeded, return the current count
          return includedCount;
        }
      }
      includedCount++;
      resultLength += itemLength;
    }
    return includedCount;
  },

  /**
   *   Execute a tooling query
   */
  async toolingQuery(query, force, org) {
    return force.toolingQuery(org, query).then(queryResult => {
      return queryResult.records;
    });
  },

  /**
   * Return a version string in Major.Minor.Patch.Build format, using 0 for any emtpy part
   */
  concatVersion(major, minor, patch, build) {
    return [major ? major : '0', minor ? minor : '0', patch ? patch : '0', build ? build : '0'].join('.');
  },

  /**
   * Given a package descriptor, return the ancestor ID.
   * @param packageDescriptorJson JSON for packageDirectories element in sfdx-project.json
   * @param force For tooling query
   * @param org For tooling query
   */
  getAncestorId(packageDescriptorJson, force, org) {
    return Promise.resolve().then(async () => {
      let ancestorId = '';
      // ancestorID can be alias, 05i, or 04t;
      // validate and convert to 05i, as needed
      if (packageDescriptorJson.ancestorId) {
        ancestorId = this.getPackageIdFromAlias(packageDescriptorJson.ancestorId, force);
        this.validateId([this.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, this.BY_LABEL.PACKAGE_VERSION_ID], ancestorId);
        ancestorId = await this.getPackageVersionId(ancestorId, force, org);
      }

      if (!packageDescriptorJson.ancestorVersion) {
        return ancestorId;
      } else {
        var regNumbers = new RegExp('^[0-9]+$');
        const versionNumber = packageDescriptorJson.ancestorVersion.split(VERSION_NUMBER_SEP);
        if (
          versionNumber.length < 3 ||
          versionNumber.length > 4 ||
          !versionNumber[0].match(regNumbers) ||
          !versionNumber[1].match(regNumbers) ||
          !versionNumber[2].match(regNumbers)
        ) {
          throw new Error(
            messages.getMessage('errorInvalidAncestorVersionFormat', packageDescriptorJson.ancestorVersion, 'packaging')
          );
        }

        // If an id property is present, use it.  Otherwise, look up the id from the package property.
        const packageId = packageDescriptorJson.id
          ? packageDescriptorJson.id
          : this.getPackageIdFromAlias(packageDescriptorJson.package, force);

        const query =
          'SELECT Id, IsReleased FROM Package2Version ' +
          `WHERE Package2Id = '${packageId}' AND MajorVersion = ${versionNumber[0]} AND MinorVersion = ${versionNumber[1]} AND PatchVersion = ${versionNumber[2]}`;

        return force.toolingQuery(org, query).then(queryResult => {
          if (!queryResult || !queryResult.totalSize) {
            throw new Error(
              messages.getMessage(
                'errorNoMatchingAncestor',
                [packageDescriptorJson.ancestorVersion, packageId],
                'packaging'
              )
            );
          } else if (!queryResult.records[0].IsReleased) {
            throw new Error(
              messages.getMessage('errorAncestorNotReleased', [packageDescriptorJson.ancestorVersion], 'packaging')
            );
          }

          // check for discrpancy between queried ancestorId and descriptor's ancestorId
          const queriedAncestorId = queryResult.records[0].Id;
          if (
            Object.prototype.hasOwnProperty.call(packageDescriptorJson, 'ancestorId') &&
            ancestorId !== queriedAncestorId
          ) {
            throw new Error(
              messages.getMessage(
                'errorAncestorIdVersionMismatch',
                [packageDescriptorJson.ancestorVersion, packageDescriptorJson.ancestorId],
                'packaging'
              )
            );
          }

          return queriedAncestorId;
        });
      }
    });
  },

  getConfigPackageDirectories(context) {
    return context.org.force.config.getConfigContent().packageDirectories;
  },

  getConfigPackageDirectory(packageDirs, lookupProperty, lookupValue) {
    let packageDir;
    if (packageDirs) {
      packageDir = packageDirs.find(x => x[lookupProperty] === lookupValue);
    }
    return packageDir;
  },

  /**
   * Given a packageAlias, attempt to return the associated id from the config
   * @param packageAlias string representing a package alias
   * @param force for obtaining the project config
   * @returns the associated id or the arg given.
   */
  getPackageIdFromAlias(packageAlias, force) {
    const configContent = force.config.getConfigContent();
    const packageAliases = configContent.packageAliases;

    // if there are no aliases defined, return
    if (!packageAliases) {
      return packageAlias;
    }

    // return alias if it exists, otherwise return what was passed in
    return packageAliases[packageAlias] || packageAlias;
  },

  /**
   * @param stringIn pascal or camel case string
   * @returns space delimited and lower-cased (except for 1st char) string (e.g. in "AbcdEfghIj" => "Abcd efgh ij")
   */
  convertCamelCaseStringToSentence(stringIn) {
    function upperToSpaceLower(match, offset, string) {
      return offset > 0 ? ' ' + match.toLowerCase() : '' + match;
    }

    return stringIn.replace(/[A-Z]/g, upperToSpaceLower);
  },

  /**
   * Given a package id, attempt to return the associated aliases from the config
   * @param packageid string representing a package id
   * @param force for obtaining the project config
   * @returns an array of alias for the given id.
   */
  getPackageAliasesFromId(packageId, force) {
    const configContent = force.config.getConfigContent();
    const packageAliases = configContent.packageAliases;

    // if there are no aliases defined, return undefined
    if (!packageAliases) {
      return [];
    }

    // otherwise check for a matching alias
    const matchingAliases = Object.entries(packageAliases).filter(alias => alias[1] === packageId);

    return matchingAliases.map(alias => alias[0]);
  },

  async findOrCreatePackage2(seedPackage: string, force, org) {
    const query = `SELECT Id FROM Package2 WHERE ConvertedFromPackageId = '${seedPackage}'`;
    const queryResult = await force.toolingQuery(org, query);
    const records = queryResult.records;
    if (records && records.length > 1) {
      const ids = records.map(r => r.Id);
      throw new Error(messages.getMessage('errorMoreThanOnePackage2WithSeed', ids, 'package_convert'));
    }

    if (records && records.length === 1) {
      // return the package2 object
      return records[0].Id;
    }

    // Need to create a new Package2
    const subQuery = `SELECT Name, Description, NamespacePrefix FROM SubscriberPackage WHERE Id = '${seedPackage}'`;
    const subscriberResult = await force.toolingQuery(org, subQuery);
    const subscriberRecords = subscriberResult.records;
    if (!subscriberRecords || subscriberRecords.length <= 0) {
      throw new Error(messages.getMessage('errorNoSubscriberPackageRecord', [seedPackage], 'package_convert'));
    }

    const request: any = {
      Name: subscriberRecords[0].Name,
      Description: subscriberRecords[0].Description,
      NamespacePrefix: subscriberRecords[0].NamespacePrefix,
      ContainerOptions: 'Managed',
      ConvertedFromPackageId: seedPackage
    };

    const createResult = await force.toolingCreate(org, 'Package2', request);
    if (!createResult.success) {
      throw new Error(createResult.errors);
    }
    return createResult.id;
  },

  _getPackageVersionCreateRequestApi(force, org) {
    return new PackageVersionCreateRequestApi(force, org);
  },

  pollForStatusWithInterval(context, id, retries, packageId, logger, withProject, force, org, interval) {
    const STATUS_ERROR = 'Error';
    const STATUS_SUCCESS = 'Success';
    const STATUS_UNKNOWN = 'Unknown';

    const pvcrApi = this._getPackageVersionCreateRequestApi(force, org);

    return pvcrApi.byId(id).then(async results => {
      if (this._isStatusEqualTo(results, [STATUS_SUCCESS, STATUS_ERROR])) {
        // complete
        if (this._isStatusEqualTo(results, [STATUS_SUCCESS])) {
          // success
          if (withProject && !process.env.SFDX_PROJECT_AUTOUPDATE_DISABLE_FOR_PACKAGE_VERSION_CREATE) {
            const query = `SELECT MajorVersion, MinorVersion, PatchVersion, BuildNumber FROM Package2Version WHERE Id = '${results[0].Package2VersionId}'`;
            const package2VersionVersionString = await force.toolingQuery(org, query).then(pkgQueryResult => {
              const record = pkgQueryResult.records[0];
              return `${record.MajorVersion}.${record.MinorVersion}.${record.PatchVersion}-${record.BuildNumber}`;
            });
            const newConfig = await this._generatePackageAliasEntry(
              context,
              results[0].SubscriberPackageVersionId,
              package2VersionVersionString,
              context.flags.branch,
              packageId
            );
            await this._writeProjectConfigToDisk(context, newConfig, logger);
          }
          return results[0];
        } else {
          let status = 'Unknown Error';
          if (results && results.length > 0 && results[0].Error.length > 0) {
            status = results[0].Error;
          }
          throw new Error(status);
        }
      } else {
        if (retries > 0) {
          // poll/retry
          let currentStatus = STATUS_UNKNOWN;
          if (results && results.length > 0) {
            currentStatus = results[0].Status;
          }
          logger.log(
            `Request in progress. Sleeping ${interval} seconds. Will wait a total of ${interval *
              retries} more seconds before timing out. Current Status='${this.convertCamelCaseStringToSentence(
              currentStatus
            )}'`
          );
          return BBPromise.delay(interval * 1000).then(() =>
            this.pollForStatus(context, id, retries - 1, packageId, logger, withProject, force, org)
          );
        } else {
          // Timed out
        }
      }

      return results;
    });
  },
  pollForStatus(context, id, retries, packageId, logger, withProject, force, org) {
    return this.pollForStatusWithInterval(
      context,
      id,
      retries,
      packageId,
      logger,
      withProject,
      force,
      org,
      this.POLL_INTERVAL_SECONDS
    );
  },

  /**
   * Writes objects specified in the config to the sfdx-project.json file on disk.
   * @param context
   * @private
   */
  _writeProjectConfigToDisk(context, config, logger) {
    try {
      // write it to sfdx-project.json
      return context.org.force.config
        .setWorkspaceConfigContent(context.org.force.config.getProjectPath(), config)
        .then(() => {
          logger.log(messages.getMessage('updatedSfdxProject', null, 'packaging'));
        })
        .catch(err => {
          logger.warnUser(
            context,
            messages.getMessage('errorSfdxProjectFileWrite', [JSON.stringify(config, null, 4), err], 'packaging')
          );
        });
    } catch (err) {
      logger.log(err.stack);
      logger.warnUser(
        context,
        messages.getMessage('errorSfdxProjectFileWrite', [JSON.stringify(config, null, 4), err], 'packaging')
      );
      return Promise.reject(err);
    }
  },

  /**
   * Generate package alias json entry for this package version that can be written to sfdx-project.json
   * @param context
   * @param packageVersionId 04t id of the package to create the alias entry for
   * @param packageVersionNumber that will be appended to the package name to form the alias
   * @param packageId the 0Ho id
   * @private
   */
  async _generatePackageAliasEntry(context, packageVersionId, packageVersionNumber, branch, packageId) {
    const configContent = context.org.force.config.getConfigContent();
    const packageAliases = configContent.packageAliases || {};

    const aliasForPackageId = this.getPackageAliasesFromId(packageId, context.org.force);
    let packageName;
    if (!aliasForPackageId || aliasForPackageId.length === 0) {
      const query = `SELECT Name FROM Package2 WHERE Id = '${packageId}'`;
      packageName = await context.org.force.toolingQuery(context.org, query).then(pkgQueryResult => {
        const record = pkgQueryResult.records[0];
        return record.Name;
      });
    } else {
      packageName = aliasForPackageId[0];
    }

    const packageAlias = branch
      ? `${packageName}@${packageVersionNumber}-${branch}`
      : `${packageName}@${packageVersionNumber}`;
    packageAliases[packageAlias] = packageVersionId;

    return { packageAliases };
  },

  /**
   * Return true if the queryResult.records[0].Status is equal to one of the values in statuses.
   * @param results to examine
   * @param statuses array of statuses to look for
   * @returns {boolean} if one of the values in status is found.
   */
  _isStatusEqualTo(results, statuses?) {
    if (!results || results.length <= 0) {
      return false;
    }
    const record = results[0];
    for (let i = 0, len = statuses.length; i < len; i++) {
      const status = statuses[i];
      if (record.Status === status) {
        return true;
      }
    }
    return false;
  },

  // added for unit testing
  getSoqlWhereClauseMaxLength() {
    return this.SQL_WHERE_CLAUSE_MAX_LENGTH;
  },

  LATEST_BUILD_NUMBER_TOKEN,
  NEXT_BUILD_NUMBER_TOKEN,
  VERSION_NUMBER_SEP,
  INSTALL_URL_BASE,
  DEFAULT_PACKAGE_DIR,
  SOQL_WHERE_CLAUSE_MAX_LENGTH,
  POLL_INTERVAL_SECONDS
};

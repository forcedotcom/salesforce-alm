/*
 * Copyright, 1999-2016, salesforce.com
 * All Rights Reserved
 * Company Confidential
 */

// Local
import * as _ from 'lodash';
import * as urlLib from 'url';

import Messages = require('../messages');
const messages = Messages();

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

const DEFAULT_PACKAGE_DIR = {
  path: '',
  package: '',
  versionName: 'ver 0.1',
  versionNumber: '0.1.0.NEXT',
  default: true
};

export = {
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
      throw new Error(messages.getMessage('errorInvalidPackageId', packageId, 'packaging'));
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
    }
    catch (err) {
      return false;
    }
  },

  // determines if error is from malformed SubscriberPackageVersion query
  // this is in place to allow cli to run against app version 214, where SPV queries
  // do not require installation key
  isErrorFromSPVQueryRestriction(err) {
    return (
      err.name === 'MALFORMED_QUERY' &&
      err.message.includes('Implementation restriction: You can only perform queries of the form Id')
    );
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
        if (versionNumber.length < 3 || versionNumber.length > 4 ||
            !versionNumber[0].match(regNumbers) || !versionNumber[1].match(regNumbers) || !versionNumber[2].match(regNumbers)) {
          throw new Error(
            messages.getMessage('errorInvalidAncestorVersionFormat', packageDescriptorJson.ancestorVersion, 'packaging')
          );
        }

        // If an id property is present, use it.  Otherwise, look up the id from the package property.
        const packageId = (packageDescriptorJson.id) ? packageDescriptorJson.id : this.getPackageIdFromAlias(packageDescriptorJson.package, force);

        const query =
          'SELECT Id FROM Package2Version ' +
          `WHERE Package2Id = '${packageId}' AND IsReleased = true AND MajorVersion = ${
            versionNumber[0]
            } AND MinorVersion = ${versionNumber[1]} AND PatchVersion = ${versionNumber[2]}`;

        return force.toolingQuery(org, query).then(queryResult => {
          if (!queryResult || !queryResult.totalSize) {
            throw new Error(
              messages.getMessage(
                'errorNoMatchingAncestor',
                [packageDescriptorJson.ancestorVersion, packageId],
                'packaging'
              )
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
      return (offset > 0 ? ' ' + match.toLowerCase() : '' + match);
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

  LATEST_BUILD_NUMBER_TOKEN,
  NEXT_BUILD_NUMBER_TOKEN,
  VERSION_NUMBER_SEP,
  INSTALL_URL_BASE,
  DEFAULT_PACKAGE_DIR
};

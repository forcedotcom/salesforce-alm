/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import logger = require('../core/logApi');
import messages = require('../messages');
import * as Package1VersionListApi from './package1VersionListApi';

const Package1VersionListCommand = function (org) {
  this.releaseOrg = org;
  this.messages = messages();
  this.logger = logger.child('Package1VersionListCommand');
  this.listApi = new Package1VersionListApi(this.releaseOrg);
};

const requestFromContext = function (context) {
  return {
    MetadataPackageId: context.flags.packageid,
  };
};

/**
 * Lists a new version of the Managed Package in the target org.
 *
 * @param context: heroku context
 * @returns {*|promise}
 */
Package1VersionListCommand.prototype.execute = function (context) {
  const request = requestFromContext(context);

  return this.listApi.list(request.MetadataPackageId);
};

/**
 * returns a human readable message for a cli output
 *
 * @param result - the data representing the Package Version
 * @returns {string}
 */
Package1VersionListCommand.prototype.getHumanSuccessMessage = function () {
  return this.messages.getMessage('package1VersionListHumanSuccess');
};

/**
 * indicates that the human readable message should be tabular
 *
 * @returns {[{}...]}
 */
Package1VersionListCommand.prototype.getColumnData = function () {
  return [
    { key: 'MetadataPackageVersionId', label: 'MetadataPackageVersionId' },
    { key: 'MetadataPackageId', label: 'MetadataPackageId' },
    { key: 'Name', label: 'Name' },
    { key: 'Version', label: 'Version' },
    { key: 'ReleaseState', label: 'ReleaseState' },
    { key: 'BuildNumber', label: 'BuildNumber' },
  ];
};

/**
 * returns a human readable message for cli error output
 *
 * @returns {string}
 */
Package1VersionListCommand.prototype.getHumanErrorMessage = function (err) {
  if (!err.action) {
    err['action'] = this.messages.getMessage('package1VersionListAction');
  }
};

export = Package1VersionListCommand;

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import logger = require('../core/logApi');
import messages = require('../messages');
import * as Package1VersionDisplayApi from './package1VersionDisplayApi';

const Package1VersionDisplayCommand = function (org) {
  this.releaseOrg = org;
  this.logger = logger.child('Package1VersionListCommand');
  this.messages = messages();
  this.displayApi = new Package1VersionDisplayApi(this.releaseOrg);
};

const requestFromContext = function (context) {
  return {
    MetadataPackageVersionId: context.flags.packageversionid,
  };
};

/**
 * Displays information about the specified package version
 *
 * @param context: heroku context
 * @returns {*|promise}
 */
Package1VersionDisplayCommand.prototype.execute = function (context) {
  const request = requestFromContext(context);

  return this.displayApi.display(request.MetadataPackageVersionId);
};

/**
 * returns a human readable message for a cli output
 *
 * @param result - the data representing the Package Version
 * @returns {string}
 */
Package1VersionDisplayCommand.prototype.getHumanSuccessMessage = function () {
  return this.messages.getMessage('package1VersionDisplayHumanSuccess');
};

/**
 * indicates that the human readable message should be tabular
 *
 * @returns {[{}...]}
 */
Package1VersionDisplayCommand.prototype.getColumnData = function () {
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
Package1VersionDisplayCommand.prototype.getHumanErrorMessage = function (err) {
  if (!err.action) {
    err['action'] = this.messages.getMessage('package1VersionDisplayAction');
  }
};

export = Package1VersionDisplayCommand;

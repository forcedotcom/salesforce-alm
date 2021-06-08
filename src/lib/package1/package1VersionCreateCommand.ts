/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import logger = require('../core/logApi');
import messages = require('../messages');
import * as Package1VersionCreateApi from './package1VersionCreateApi';

const Package1VersionCreateCommand = function () {
  this.messages = messages();
  this.logger = logger.child('Package1VersionCreateCommand');
  this.createApi = new Package1VersionCreateApi();
};

Package1VersionCreateCommand.prototype.execute = function (context) {
  this.org = context.org;
  return this.createApi.execute(context);
};

Package1VersionCreateCommand.prototype.poll = function (context, id, retries) {
  this.org = context.org;
  return this.createApi.poll(context, id, retries);
};

/**
 * returns a human readable message for a cli output
 *
 * @param result - the data representing the Package Version
 * @returns {string}
 */
Package1VersionCreateCommand.prototype.getHumanSuccessMessage = function (result) {
  const arg = result.Status === 'SUCCESS' ? [result.MetadataPackageVersionId] : [result.Id, this.org.name];
  return this.messages.getMessage(result.Status, arg, 'package1_version_create_get');
};

export = Package1VersionCreateCommand;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Contains config details and operations meant for package subscriber orgs.
 * This could potentially include test orgs used by CI process for testing packages,
 * and target subscriber orgs.
 **/
import logger = require('../core/logApi');
import * as Package1VersionCreateCommand from './package1VersionCreateCommand';

const DEFAULT_MAX_POLL = 0;

class Package1VersionCreateGetCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.maxRetries = DEFAULT_MAX_POLL;
    this.packageUploadRequestId = null;
    this.logger = logger.child('Package1VersionCreateGetCommand');
  }

  execute(context) {
    this.packageUploadRequestId = context.flags.requestid;
    this.package1VersionCreateCommand = new Package1VersionCreateCommand();

    return this.package1VersionCreateCommand.poll(context, this.packageUploadRequestId, this.maxRetries);
  }

  /**
   * returns a human readable message for a cli output
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    return this.package1VersionCreateCommand.getHumanSuccessMessage(result);
  }
}

export = Package1VersionCreateGetCommand;

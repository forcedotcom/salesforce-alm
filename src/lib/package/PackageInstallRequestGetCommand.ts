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
import PackageInstallCommand = require('./packageInstallCommand');

const DEFAULT_MAX_POLL = 0;

class PackageInstallRequestGetCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.maxRetries = DEFAULT_MAX_POLL;
    this.packageInstallRequestId = null;
    this.logger = logger.child('PackageInstallRequestGetCommand');
  }

  execute(context) {
    this.packageInstallRequestId = context.flags.requestid;
    this.packageInstallCommand = new PackageInstallCommand(context);

    return this.packageInstallCommand.poll(context, this.packageInstallRequestId, this.maxRetries);
  }

  /**
   * returns a human readable message for a cli output
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    return this.packageInstallCommand.getHumanSuccessMessage(result);
  }
}

export = PackageInstallRequestGetCommand;

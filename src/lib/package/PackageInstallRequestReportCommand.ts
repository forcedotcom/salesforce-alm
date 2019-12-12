/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Contains config details and operations meant for package subscriber orgs.
 * This could potentially include test orgs used by CI process for testing packages,
 * and target subscriber orgs.
 **/
import logger = require('../core/logApi');
import PackageInstallCommand = require('./packageInstallCommand');

const DEFAULT_MAX_POLL = 0;

class PackageInstallRequestReportCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.maxRetries = DEFAULT_MAX_POLL;
    this.packageInstallRequestId = null;
    this.logger = logger.child('PackageInstallRequestReportCommand');
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

export = PackageInstallRequestReportCommand;

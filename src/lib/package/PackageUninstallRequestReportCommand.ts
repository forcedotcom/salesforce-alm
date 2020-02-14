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
import PackageUninstallCommand = require('./packageUninstallCommand');

const DEFAULT_MAX_POLL = 0;

class PackageUninstallRequestReportCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.maxRetries = DEFAULT_MAX_POLL;
    this.packageUninstallRequestId = null;
    this.logger = logger.child('PackageUninstallRequestReportCommand');
  }

  execute(context) {
    this.packageUninstallRequestId = context.flags.requestid;
    this.packageUninstallCommand = new PackageUninstallCommand(context);

    return this.packageUninstallCommand.poll(context, this.packageUninstallRequestId, this.maxRetries);
  }

  /**
   * returns a human readable message for a cli output
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    return this.packageUninstallCommand.getHumanSuccessMessage(result);
  }
}

export = PackageUninstallRequestReportCommand;

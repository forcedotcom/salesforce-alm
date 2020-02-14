/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import MdapiDeployReportApi = require('./mdapiDeployReportApi');
import Stash = require('../core/stash');

/**
 * Command implementation that uses mdapiDeployApi to deploy source - directory or zip - to given org.
 */
class MetadataDeployReportCommand {
  private mdDeployReport;

  constructor(context, private stashkey: string = Stash.Commands.MDAPI_DEPLOY) {
    this.mdDeployReport = new MdapiDeployReportApi(context.org, undefined, this.stashkey);
  }

  validate(context): Promise<any> {
    return this.mdDeployReport.validate(context);
  }

  execute(context): Promise<any> {
    return this.mdDeployReport.report(context);
  }
}

export = MetadataDeployReportCommand;

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Stash = require('../core/stash');
import MdapiDeployReportApi = require('./mdapiDeployReportApi');

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

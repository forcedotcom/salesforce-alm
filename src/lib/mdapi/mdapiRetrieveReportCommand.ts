/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import MdapiRetrieveReportApi = require('./mdapiRetrieveReportApi');

/**
 * Command implementation that uses mdapiDeployApi * API to retrieve source defined by given or generated package.xml.
 */
class MetadataRetrieveReportCommand {
  private mdRetrieveReport;

  constructor(context) {
    this.mdRetrieveReport = new MdapiRetrieveReportApi(context.org);
  }

  validate(context) {
    return this.mdRetrieveReport.validate(context);
  }

  execute(options) {
    return this.mdRetrieveReport.report(options);
  }
}

export = MetadataRetrieveReportCommand;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import DataExportApi = require('./dataExportApi');

class DataExportCommand {
  // TODO: proper property typing
  [property: string]: any;

  validate(context) {
    console.log(context.org.force);

    this.dataExport = new DataExportApi(context.org);
    return this.dataExport.validate(context);
  }

  execute(context) {
    context.ux.startSpinner('Exporting Data');
    const executed = this.dataExport.execute(context);
    context.ux.stopSpinner();
    return executed;
  }

  getHumanSuccessMessage() {
    return '';
  }
}

export = DataExportCommand;

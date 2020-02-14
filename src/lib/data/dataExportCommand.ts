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
    this.dataExport = new DataExportApi(context.org);
    return this.dataExport.validate(context.flags);
  }

  execute(context) {
    return this.dataExport.execute(context);
  }

  getHumanSuccessMessage() {
    return '';
  }
}

export = DataExportCommand;

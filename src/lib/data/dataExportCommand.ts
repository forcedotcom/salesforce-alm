/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

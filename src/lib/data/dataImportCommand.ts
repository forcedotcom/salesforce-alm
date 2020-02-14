/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import DataImportApi = require('./dataImportApi');

class DataImportCommand {
  // TODO: proper property typing
  [property: string]: any;

  validate(context) {
    this.dataImport = new DataImportApi(context.org);
    return this.dataImport.validate(context.flags);
  }

  execute(context) {
    return this.dataImport.execute(context);
  }

  getColumnData() {
    this.dataImport.logger.styledHeader(this.dataImport.logger.color.blue('Import Results'));
    return this.dataImport.getColumnData();
  }
}

export = DataImportCommand;

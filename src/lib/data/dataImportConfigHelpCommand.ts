/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import DataImportApi = require('./dataImportApi');
import SchemaPrinter = require('../schema/schemaPrinter');

class DataImportCommand {
  // TODO: proper property typing
  [property: string]: any;

  validate() {
    return Promise.resolve();
  }

  execute(context) {
    return this.showSchema(context);
  }

  getHumanSuccessMessage() {
    return this.status.join('\n');
  }

  getHumanErrorMessage() {
    return 'Data Import Config Help Error:';
  }

  showSchema(context) {
    this.dataImport = new DataImportApi(context.org);
    return this.dataImport.validator.loadSchema().then(schema => {
      this.status = new SchemaPrinter(schema).lines;

      // Return for json results
      return schema;
    });
  }
}

export = DataImportCommand;

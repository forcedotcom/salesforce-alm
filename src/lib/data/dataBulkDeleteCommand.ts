/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Config from '../force-cli/force-cli-config';
import * as almError from '../core/almError';
import * as DataBulkUpsert from './dataBulkUpsertCommand';
import { Connection } from 'jsforce';
import fs = require('fs');

export class DataBulkDeleteCommand {
  async execute(context): Promise<any> {
    context.ux.startSpinner('Bulk Delete');
    let conn: Connection = await Config.getActiveConnection(context);

    let csvRecords;
    try {
      fs.statSync(context.flags.csvfile);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return Promise.reject(almError('PathDoesNotExist', context.flags.csvfile));
      } else {
        throw err;
      }
    }
    csvRecords = fs.createReadStream(context.flags.csvfile);
    let job = conn.bulk.createJob(context.flags.sobjecttype, 'delete');

    return new Promise(async (resolve, reject) => {
      job.on('error', function(err): void {
        context.ux.stopSpinner();
        reject(err);
      });

      let batches: Object[][] = await DataBulkUpsert.splitIntoBatches(csvRecords);

      try {
        resolve(
          await DataBulkUpsert.createAndExecuteBatches(
            conn,
            job,
            batches,
            context.flags.sobjecttype,
            context.flags.wait
          )
        );
        context.ux.stopSpinner();
      } catch (e) {
        context.ux.stopSpinner();
        reject(e);
      }
    });
  }
}

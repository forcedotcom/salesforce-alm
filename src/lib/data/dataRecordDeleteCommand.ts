/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';
import * as DataRecordUtils from './dataRecordUtils';
import { Connection } from 'jsforce';
import { RecordResult } from 'jsforce';

export class DataRecordDeleteCommand {
  async execute(context): Promise<RecordResult> {
    DataRecordUtils.validateIdXorWhereFlags(context);

    const conn: Connection = await Config.getActiveConnection(context);
    const sobjectid = await DataRecordUtils.retrieveId(conn, context);
    context.ux.startSpinner(`Deleting Record`);
    // TODO: delete() returns RecordResult[] so this may be a bug in the impl unless we know
    //       we are assured of only deleting 1 record.
    const result: any = context.flags.usetoolingapi
      ? await conn.tooling.destroy(context.flags.sobjecttype, sobjectid)
      : await conn.sobject(context.flags.sobjecttype).destroy(sobjectid);
    if (result.success) {
      context.ux.stopSpinner();
      Display.success(Messages.get('DataRecordDeleteSuccess', sobjectid));
    } else {
      let errors = '';
      if (result.errors) {
        errors = '\nErrors:\n';
        result.errors.forEach(function(err) {
          errors += '  ' + err + '\n';
        });
      }
      context.ux.stopSpinner();
      Display.failure(Messages.get('DataRecordDeleteFailure', errors));
    }
    return result as RecordResult;
  }
}

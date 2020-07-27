/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as DataRecordUtils from './dataRecordUtils';
import { Connection } from 'jsforce';

export class DataRecordGetCommand {
  async execute(context): Promise<any> {
    DataRecordUtils.validateIdXorWhereFlags(context);
    context.ux.startSpinner('Getting Record');
    const conn: Connection = await Config.getActiveConnection(context);
    const sobjectid = await DataRecordUtils.retrieveId(conn, context);
    const record = context.flags.usetoolingapi
      ? await conn.tooling.retrieve(context.flags.sobjecttype, sobjectid)
      : await conn.sobject(context.flags.sobjecttype).retrieve(sobjectid);
    context.ux.stopSpinner();
    Display.record(record);
    return record;
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';
import * as TextUtils from '../force-cli/force-cli-textutils';
import * as DataRecordUtils from './dataRecordUtils';
import { Connection } from 'jsforce';
import { RecordResult } from 'jsforce';

const ID_FIELD = 'Id';

export class DataRecordUpdateCommand {
  async execute(context): Promise<RecordResult> {
    DataRecordUtils.validateIdXorWhereFlags(context);

    const conn: Connection = await Config.getActiveConnection(context);

    const updateObject = await createUpdateObject(conn, context);

    // TODO: update() returns RecordResult | RecordResult[] so this may be a bug in the impl unless we know
    //       we are assured of only updating 1 record.
    let result: any = context.flags.usetoolingapi
      ? await conn.tooling.update(context.flags.sobjecttype, updateObject)
      : await conn.sobject(context.flags.sobjecttype).update(updateObject);

    if (result.success) {
      Display.success(Messages.get('DataRecordUpdateSuccess', updateObject[ID_FIELD]));
    } else {
      let errors = '';
      if (result.errors) {
        errors = '\nErrors:\n';
        result.errors.forEach(function(err) {
          errors += '  ' + err + '\n';
        });
      }
      Display.failure(Messages.get('DataRecordUpdateFailure', errors));
    }
    return result as RecordResult;
  }
}

export const createUpdateObject = async function(connection: Connection, context: any): Promise<Object> {
  const sobjectid = await DataRecordUtils.retrieveId(connection, context);
  const keyValuePairs = TextUtils.parseKeyValueSequence(context.flags.values);
  const updateObject = TextUtils.transformKeyValueSequence(keyValuePairs);
  updateObject[ID_FIELD] = sobjectid;
  return updateObject;
};

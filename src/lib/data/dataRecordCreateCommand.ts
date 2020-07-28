/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Display from '../force-cli/force-cli-display';
import * as Error from '../force-cli/force-cli-error';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';
import * as TextUtils from '../force-cli/force-cli-textutils';
import { Connection } from 'jsforce';
import { RecordResult } from 'jsforce';

export class DataRecordCreateCommand {
  async execute(context): Promise<any> {
    if (context.flags.sobjecttype && context.flags.values) {
      return await createRecord(context);
    } else {
      Error.exitDisplayHelp(context.command);
    }
  }
}

export const createRecord = async function(context: any): Promise<RecordResult> {
  const conn: Connection = await Config.getActiveConnection(context);
  const sobject: string = context.flags.sobjecttype;
  const insertObject = await createInsertObject(context);
  context.ux.startSpinner(`Creating Record for ${sobject}`);

  // TODO: create() returns RecordResult | RecordResult[] so this may be a bug in the impl unless we know
  //        we are assured of only creating 1 record.
  const result: any = context.flags.usetoolingapi
    ? await conn.tooling.create(sobject, insertObject)
    : await conn.sobject(sobject).create(insertObject);

  if (result.success) {
    let id = 'unknown id';
    if (result.id) {
      id = result.id;
    }
    context.ux.stopSpinner();
    Display.success(Messages.get('DataRecordCreateSuccess', id));
  } else {
    let errors = '';
    if (result.errors) {
      errors = '\nErrors:\n';
      result.errors.forEach(function(err) {
        errors += '  ' + err + '\n';
      });
    }
    context.ux.stopSpinner();
    Display.failure(Messages.get('DataRecordCreateFailure', errors));
  }
  return result;
};

export let createInsertObject = async function(context: any): Promise<Object> {
  const keyValuePairs = TextUtils.parseKeyValueSequence(context.flags.values);
  return TextUtils.transformKeyValueSequence(keyValuePairs);
};

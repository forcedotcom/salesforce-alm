import * as Error from '../force-cli/force-cli-error';
import * as Messages from '../force-cli/force-cli-messages';
import * as TextUtil from '../force-cli/force-cli-textutils';
import { Connection } from 'jsforce';

export const retrieveId = async function(connection: Connection, context: any): Promise<string> {
  let sobjectid;
  if (context.flags.where) {
    sobjectid = await queryByWhere(
      connection,
      context.flags.sobjecttype,
      context.flags.where,
      context.flags.usetoolingapi
    );
  } else {
    sobjectid = context.flags.sobjectid;
  }
  return sobjectid;
};

export const queryByWhere = async function queryByWhere(
  connection: Connection,
  sobjectType: string,
  keyValueSequence: string,
  useToolingApi?: boolean | false
): Promise<string> {
  try {
    const keyValuePairs = TextUtil.parseKeyValueSequence(keyValueSequence);
    const queryObject = TextUtil.transformKeyValueSequence(keyValuePairs);

    const records: any = useToolingApi
      ? await connection.tooling.sobject(sobjectType).find(queryObject, 'id')
      : await connection.sobject(sobjectType).find(queryObject, 'id');

    if (!records || records.length === 0) {
      return Error.exitWithMessage(Messages.get('DataRecordGetNoRecord'));
    }

    if (records.length !== 1) {
      Error.exitWithMessage(
        Messages.get('DataRecordGetMultipleRecords', keyValueSequence, sobjectType, records.length)
      );
    }
    return records[0]['Id'];
  } catch (err) {
    return Error.exitWithMessage(err.message);
  }
};

export function validateIdXorWhereFlags(context) {
  if (!(context.flags.sobjectid || context.flags.where)) {
    Error.exitWithMessage(Messages.get('DataRecordNeitherSobjectidNorWhereError'));
  }
  if (context.flags.sobjectid && context.flags.where) {
    Error.exitWithMessage(Messages.get('DataRecordBothSobjectidAndWhereError'));
  }
}

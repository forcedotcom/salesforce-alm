import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as DataRecordUtils from './dataRecordUtils';
import { Connection } from 'jsforce';

export class DataRecordGetCommand {
  async execute(context): Promise<any> {
    DataRecordUtils.validateIdXorWhereFlags(context);

    const conn: Connection = await Config.getActiveConnection(context);
    const sobjectid = await DataRecordUtils.retrieveId(conn, context);
    const record = context.flags.usetoolingapi
      ? await conn.tooling.retrieve(context.flags.sobjecttype, sobjectid)
      : await conn.sobject(context.flags.sobjecttype).retrieve(sobjectid);
    Display.record(record);
    return record;
  }
}

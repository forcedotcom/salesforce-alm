import { ApexLogApi } from './apexLogApi';

const MAX_NUM_OF_LOGS = 25;
export class ApexLogGetCommand {
  async execute(context, doneCallback?: (...args) => any): Promise<any> {
    const org = context.org;
    const apexLogApi = new ApexLogApi(org, context.flags);

    if (context.flags.logid) {
      return await apexLogApi.logLog(context.flags.logid);
    } else {
      const numOfLogs = +context.flags.number || 1;
      return await apexLogApi.logLogs(numOfLogs > MAX_NUM_OF_LOGS ? MAX_NUM_OF_LOGS : numOfLogs);
    }
  }
}

import { ApexLogApi } from './apexLogApi';

export class ApexLogListCommand {
  async execute(context): Promise<any> {
    const org = context.org;
    const apexLogApi = new ApexLogApi(org, context.flags);
    return await apexLogApi.listLogs();
  }
}

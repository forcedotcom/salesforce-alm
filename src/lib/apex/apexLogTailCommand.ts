import { ApexLogApi } from './apexLogApi';

export class ApexLogTailCommand {
  async execute(context): Promise<any> {
    const org = context.org;
    const apexLogApi = new ApexLogApi(org, context.flags);
    if (!context.flags.skiptraceflag) {
      await apexLogApi.prepareTraceFlag(context.flags.debuglevel);
    }

    return await apexLogApi.tail();
  }
}

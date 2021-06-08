/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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

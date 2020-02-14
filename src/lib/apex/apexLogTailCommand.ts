/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

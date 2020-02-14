/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Display from '../force-cli/force-cli-display';

export class SchemaSObjectDescribeCommand {
  async execute(context): Promise<any> {
    return await describeSingleObject(context, context.flags.sobjecttype);
  }
}

export const describeSingleObject = async function(context, sobjecttype: string): Promise<string> {
  const force = context.org.force;
  let description = context.flags.usetoolingapi
    ? await force.toolingDescribe(context.org, context.flags.sobjecttype)
    : await force.describe(context.org, context.flags.sobjecttype);

  Display.info(<string>description);
  return description;
};

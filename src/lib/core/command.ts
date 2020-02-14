/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger } from '@salesforce/core';

abstract class Command {
  private logger: Logger;
  protected readonly loggerName: string;

  constructor(readonly name: string) {
    this.loggerName = name;
  }

  protected async getLogger(): Promise<Logger> {
    if (!this.logger) {
      this.logger = await Logger.child(this.loggerName);
    }
    return this.logger;
  }

  async validate(context: any): Promise<any> {
    return Promise.resolve(context);
  }

  abstract async execute(context: any, stdinValues?: any): Promise<any>;
}

export default Command;

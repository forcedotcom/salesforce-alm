/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxError, Messages } from '@salesforce/core';

import { MdapiDeployCancel } from '../mdapi/mdapiDeployCancel';
import { parseWaitParam } from '../source/sourceUtil';

import Stash = require('../core/stash');

Messages.importMessagesDirectory(__dirname);

export class MdapiCancelCommand {
  private org: any;

  constructor(private stashKey: string = Stash.Commands.MDAPI_DEPLOY) {}
  /**
   * Executes the mdapi deploy cancel command
   * @param context - the cli context
   * @returns {Promise}
   */
  public async execute(context: any) {
    return await new MdapiDeployCancel(this.org).cancel(this.org, context);
  }

  /**
   * Validates the mdapi deploy cancel command parameters
   * @param context - the cli context
   * @returns {Promise}
   */
  public async validate(context: any): Promise<any> {
    const options = context.flags;
    this.org = context.org;

    if (!options.jobid) {
      let stashedValues = await Stash.list(this.stashKey);
      options.jobid = stashedValues.jobid;
    }

    if (!options.jobid) {
      throw SfdxError.create('salesforce-alm', 'mdapi_cancel', 'MissingRequiredParameter');
    }

    // Validate the wait param if set and convert to an integer.
    parseWaitParam(options);

    return Promise.resolve(options);
  }
}

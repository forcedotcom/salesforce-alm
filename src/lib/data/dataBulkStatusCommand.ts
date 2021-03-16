/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';
import { Connection } from 'jsforce';
import { BatchInfo } from 'jsforce';
import { JobInfo } from 'jsforce';
import { Job } from 'jsforce';

export class DataBulkStatusCommand {
  async execute(context): Promise<any> {
    context.ux.startSpinner('Getting Status');
    let conn: Connection = await Config.getActiveConnection(context);
    if (context.flags.jobid && context.flags.batchid) {
      // view batch status
      const batchStatus = await fetchAndDisplayBatchStatus(conn, context.flags.jobid, context.flags.batchid);
      context.ux.stopSpinner();
      return batchStatus;
    } else {
      // view job status
      const jobStatus = await fetchAndDisplayJobStatus(conn, context.flags.jobid);
      context.ux.stopSpinner();
      return jobStatus;
    }
  }
}

/**
 * get and display the batch status
 * exposed for unit testing
 * @param conn {Connection}
 * @param jobId {string}
 * @param batchId {string}
 */
export let fetchAndDisplayBatchStatus = async function(
  conn: Connection,
  jobId: string,
  batchId: string
): Promise<BatchInfo[]> {
  let job = await conn.bulk.job(jobId);
  let found = false;

  let batches: BatchInfo[] = await job.list();
  batches.forEach(function(batch: BatchInfo): void {
    if (batch.id === batchId) {
      Display.bulkBatchStatus(batch);
      found = true;
    }
  });
  if (!found) {
    throw new Error(Messages.get('DataBulkStatusNoBatchFound', batchId, jobId));
  }

  return batches;
};

/**
 * get and display the job status; close the job if completed
 * @param conn {Connection}
 * @param jobId {string}
 */
export let fetchAndDisplayJobStatus = async function(
  conn: Connection,
  jobId: string,
  doneCallback?: (...args) => any
): Promise<JobInfo> {
  let job: Job = conn.bulk.job(jobId);
  let jobInfo: JobInfo = await job.check();

  Display.bulkJobStatus(jobInfo);

  if (doneCallback) {
    doneCallback({ job: jobInfo });
  }

  return jobInfo;
};

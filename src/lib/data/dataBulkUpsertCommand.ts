/// <reference path="../../../node_modules/@types/csv-parse/csv-parse.d.ts" />

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Display from '../force-cli/force-cli-display';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';
import * as almError from '../core/almError';
import * as DataBulkStatus from './dataBulkStatusCommand';

import { Connection } from 'jsforce';
import { BatchInfo } from 'jsforce';
import { Batch } from 'jsforce';
import { BatchResultInfo } from 'jsforce';

import fs = require('fs');
import parse = require('csv-parse');
import { Job } from 'jsforce';

import * as _ from 'lodash';

const BATCH_RECORDS_LIMIT = 10000;
const POLL_FREQUENCY_MS = 5000;

export class DataBulkUpsertCommand {
  async execute(context): Promise<any> {
    let csvStream: fs.ReadStream;
    let conn: Connection = await Config.getActiveConnection(context);
    context.ux.startSpinner();
    try {
      fs.statSync(context.flags.csvfile);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return Promise.reject(almError('PathDoesNotExist', context.flags.csvfile));
      } else {
        throw err;
      }
    }
    csvStream = fs.createReadStream(context.flags.csvfile);

    let externalId: string = context.flags.externalid || (await findAnExternalId(conn, context.flags.sobjecttype));
    let job = conn.bulk.createJob(context.flags.sobjecttype, 'upsert', {
      extIdField: externalId,
      concurrencyMode: 'Parallel'
    });

    return new Promise(async (resolve, reject) => {
      job.on('error', function(err): void {
        context.ux.stopSpinner();
        reject(err);
      });

      let batches: Object[][];

      try {
        batches = await splitIntoBatches(csvStream);
      } catch (e) {
        return reject(e);
      }

      try {
        resolve(await createAndExecuteBatches(conn, job, batches, context.flags.sobjectType, context.flags.wait));
        context.ux.stopSpinner();
      } catch (e) {
        return reject(e);
      }
    });
  }
}

export let retrieveCvsStream = context => {
  try {
    fs.statSync(context.flags.csvfile);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw almError('PathDoesNotExist', context.flags.csvfile);
    } else {
      throw err;
    }
  }
  return fs.createReadStream(context.flags.csvfile);
};

/**
 * pick one of the possible many external ids
 * exposed for unit testing
 * @param conn {Connection}
 * @param objName {string}
 * @returns {string} - external id field name
 */
export let findAnExternalId = async function(conn: Connection, objName: string): Promise<string> {
  let existingObjectMetadata = await conn.describe(objName);

  let fields = existingObjectMetadata['fields'];
  let externalId = '';
  fields.forEach(function(field: Object): void {
    if (field['externalId']) {
      externalId = field['name'];
    }
  });
  return externalId;
};

/**
 * registers the listener in charge of distributing all csv records into batches
 * exposed for unit testing
 * @param readStream - the read stream
 * @returns {Object[][]}
 */
export let splitIntoBatches = async function(readStream: fs.ReadStream): Promise<any> {
  // split all records into batches
  let batches: Object[][] = [];
  let batchIndex = 0;
  batches[batchIndex] = [];

  let parser = parse({
    columns: true,
    skip_empty_lines: true
  });

  readStream.pipe(parser);

  return new Promise((resolve, reject) => {
    parser.on('data', element => {
      batches[batchIndex].push(element);
      if (batches[batchIndex].length === BATCH_RECORDS_LIMIT) {
        // next batch
        batchIndex++;
        batches[batchIndex] = [];
      }
    });
    parser.on('error', err => {
      reject(err);
      readStream.destroy();
    });
    parser.on('end', () => {
      resolve(batches);
      readStream.destroy();
    });
  });
};

/**
 * create and execute batches based on the record arrays; wait for completion response if -w flag is set with > 0 minutes
 * exposed for unit testing
 * @param conn {Connection}
 * @param job {Job}
 * @param batches {Object[][]}
 * @param sobjectType {string}
 * @param wait {number}
 */
export let createAndExecuteBatches = async function(
  conn: Connection,
  job: Job,
  batches: Object[][],
  sobjectType: string,
  wait?: number
): Promise<any[]> {
  let batchesCompleted = 0;
  let batchesQueued = 0;
  let overallInfo = false;

  // The error handling for this gets quite tricky when there are multiple batches
  // Currently, we bail out early by calling an Error.exit
  // But, we might want to actually continue to the next batch.
  return await Promise.all(
    batches.map(async function(batch: Object[], i: number): Promise<any> {
      const newBatch = job.createBatch();
      return new Promise((resolve, reject) => {
        newBatch.on('error', function(err: Error): void {
          // reword no external id error message to direct it to org user rather than api user
          if (err.message.startsWith('External ID was blank')) {
            err['message'] = Messages.get('DataBulkUpsertExternalIdRequired', sobjectType);
          }
          if (err.message.startsWith('Polling time out')) {
            let jobIdIndex = err.message.indexOf('750');
            let batchIdIndex = err.message.indexOf('751');
            Display.info(
              Messages.get('DataBulkTimeOut', err.message.substr(jobIdIndex, 18), err.message.substr(batchIdIndex, 18))
            );
          }
          reject(err.message);
        });

        newBatch.on('queue', async function(batchInfo: BatchInfo): Promise<void> {
          batchesQueued++;
          if (batchesQueued === batches.length) {
            const id = job['id'];
            await job.close();
            /* jsforce clears out the id after close, but you should be able to close a job
            after the queue, so add it back so future batch.check don't fail.*/
            job['id'] = id;
          }
        });

        if (!wait) {
          newBatch.on('queue', async function(batchInfo: BatchInfo): Promise<void> {
            Display.info(Messages.get('DataBulkUpsertCheckStatusCommand', i + 1, batchInfo.jobId, batchInfo.id));
            let result: BatchInfo = await newBatch.check();
            if (result.state === 'Failed') {
              reject(result.stateMessage);
            } else {
              resolve(batchInfo);
            }
          });
        } else {
          resolve(waitForCompletion(conn, newBatch, batchesCompleted, overallInfo, i + 1, batches.length, wait));
        }
        newBatch.execute(batch, (err, result) => {
          if (err) {
            reject(err);
          }
        });
      });
    })
  );
};

/**
 * register completion event listeners on the batch
 * exposed for unit testing
 * @param conn
 * @param newBatch
 * @param batchesCompleted
 * @param overallInfo
 * @param batchNum
 * @param totalNumBatches
 */
export let waitForCompletion = async function(
  conn: Connection,
  newBatch: Batch,
  batchesCompleted: number,
  overallInfo: boolean,
  batchNum: number,
  totalNumBatches: number,
  waitMins: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    newBatch.on('queue', async function(batchInfo: BatchInfo): Promise<void> {
      let result: BatchInfo = await newBatch.check();
      if (result.state === 'Failed') {
        reject(result.stateMessage);
      } else {
        if (!overallInfo) {
          Display.info(Messages.get('DataBulkUpsertPollingInfo', POLL_FREQUENCY_MS / 1000, batchInfo.jobId));
          overallInfo = true;
        }
      }
      Display.info(Messages.get('DataBulkUpsertBatchQueued', batchNum, batchInfo.id));
      newBatch.poll(POLL_FREQUENCY_MS, waitMins * 60000);
    });
    newBatch.on('response', async function(results: BatchResultInfo[]): Promise<void> {
      let summary: BatchInfo = await newBatch.check();
      Display.bulkBatchStatus(summary, results, batchNum);
      batchesCompleted++;
      if (batchesCompleted === totalNumBatches) {
        resolve(await DataBulkStatus.fetchAndDisplayJobStatus(conn, summary.jobId));
      }
    });
  });
};

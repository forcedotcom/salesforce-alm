/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

// 3pp
import * as mkdirp from 'mkdirp';
import * as BBPromise from 'bluebird';

// Local
import logger = require('../core/logApi');
import * as almError from '../core/almError';
import * as mdApiUtil from './mdApiUtil';
import { FileProperties } from 'jsforce';
const fs = BBPromise.promisifyAll(require('fs'));

/**
 * API that wraps Metadata API to retrieve listmetadata result.
 *
 * @param force
 * @constructor
 */
export class MdListmetadataApi {
  private org;
  private force;
  private logger;
  private retrieveTargetPath;

  constructor(org) {
    this.org = org;
    this.force = org.force;
    this.logger = logger.child('md-listmetadata');
  }

  // retreive source from org
  async retrieve(context): Promise<FileProperties[] | { message: string }> {
    const options = context.flags;
    // set target org, org other than workspace defined org
    const orgApi = this.org;

    if (options.resultfile) {
      this.retrieveTargetPath = path.resolve(options.resultfile);
    }

    const retrieveOptions = await this.formatRetrieveOptions(options);
    const result = await this.retrieveListmetadata(orgApi, retrieveOptions);

    if (this.retrieveTargetPath) {
      return this.createOutputJSONResultFile(this.retrieveTargetPath, result, this);
    } else {
      this.print(result);
      return result;
    }
  }

  private async retrieveListmetadata(orgApi, retrieveOptions) {
    const connection = await mdApiUtil.getMetadataConnection(orgApi);
    const listmetadataQuery = this.getListmetadataQuery(retrieveOptions);
    return connection.metadata.list(listmetadataQuery, retrieveOptions.apiVersion);
  }

  private getListmetadataQuery(retrieveOptions) {
    return new ListmetadataQuery(retrieveOptions.metadatatype, retrieveOptions.folder);
  }

  private async createOutputJSONResultFile(retrieveTargetPath, resultJson, mdApi) {
    try {
      await fs.accessAsync(path.dirname(mdApi.retrieveTargetPath));
    } catch (err) {
      mkdirp.sync(path.dirname(mdApi.retrieveTargetPath));
    }

    const fileName = retrieveTargetPath;
    const json = JSON.stringify(resultJson);
    await fs.writeFileAsync(fileName, json);
    this.print(`Wrote result file to ${fileName}.`);
    return { message: `Wrote result file to ${fileName}.` };
  }

  private formatRetrieveOptions(options) {
    const retrieveOptions: any = {};
    retrieveOptions.apiVersion = options.apiversion || this.force.config.getApiVersion();
    retrieveOptions.resultfile = options.resultfile;
    retrieveOptions.targetusername = options.targetusername;
    retrieveOptions.metadatatype = options.metadatatype;
    retrieveOptions.folder = options.folder;
    return retrieveOptions;
  }

  private print(message) {
    this.logger.log(message);
  }

  async validate(context) {
    const options = context.flags;

    const currentApiVersion = this.force.config.getApiVersion();
    if (
      options.apiversion &&
      (isNaN(+options.apiversion) || +options.apiversion < 0 || +options.apiversion > currentApiVersion)
    ) {
      throw almError('mdListmetadataCommandCliInvalidApiVersionError', currentApiVersion);
    }

    if (options.resultfile) {
      const retrieveTargetPath = path.resolve(options.resultfile);
      try {
        const data = await fs.statAsync(retrieveTargetPath);
        if (!data.isFile()) {
          throw almError('InvalidArgumentFilePath', ['resultfile', retrieveTargetPath]);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }
  }
}

class ListmetadataQuery {
  type: string;
  folder?: string;
  constructor(metadatatype, folder) {
    this.type = metadatatype;
    if (folder) {
      this.folder = folder;
    }
  }
}

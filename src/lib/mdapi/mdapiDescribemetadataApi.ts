/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

// Local
import logger = require('../core/logApi');
import * as almError from '../core/almError';
import * as mdApiUtil from './mdApiUtil';
import { DescribeMetadataResult, MetadataObject } from 'jsforce';
import * as fsx from 'fs-extra';
import MetadataRegistry = require('../source/metadataRegistry');

/**
 * API that wraps Metadata API to retrieve describemetadata result.
 *
 * @param force
 * @constructor
 */
export class MdDescribemetadataApi {
  private org;
  private force;
  private logger;
  private retrieveTargetPath;

  constructor(org) {
    this.org = org;
    this.force = org.force;
    this.logger = logger.child('md-describemetadata');
  }

  // retrieve source from org
  async retrieve(context): Promise<DescribeMetadataResult | { message: string }> {
    const options = context.flags;

    if (options.resultfile) {
      this.retrieveTargetPath = path.resolve(options.resultfile);
    }

    const retrieveOptions = this.formatRetrieveOptions(options);
    let result: DescribeMetadataResult = await this.retrieveDescribemetadata(this.org, retrieveOptions);

    if (options.filterknown) {
      result = await this.filterResult(result);
    }

    if (this.retrieveTargetPath) {
      return this.createOutputJSONResultFile(this.retrieveTargetPath, result);
    } else {
      this.print(result);
      return result;
    }
  }

  /**
   * Filter a DescribeMetadataResult based on whats found in metadata registry. This method is handy for determining
   * what not supported by the CLI.
   * @param result The result to filter
   */
  private async filterResult(result: DescribeMetadataResult): Promise<DescribeMetadataResult> {
    const registry = new MetadataRegistry();
    const registeredTypeDefs = registry.getMetadataTypeDefs();

    const map: Map<string, MetadataObject> = new Map();
    // Begin O2n Perf
    result.metadataObjects.forEach((mdObject: MetadataObject) => {
      map.set(mdObject.xmlName, mdObject);
    });

    Object.keys(registeredTypeDefs).forEach(key => {
      map.delete(key);
    });
    // End O2n Perf
    result.metadataObjects = [];
    for (let key of map.keys()) {
      result.metadataObjects.push(map.get(key));
    }

    return result;
  }

  private async retrieveDescribemetadata(orgApi, retrieveOptions) {
    const connection = await mdApiUtil.getMetadataConnection(orgApi);
    return connection.metadata.describe(retrieveOptions.apiVersion);
  }

  private async createOutputJSONResultFile(retrieveTargetPath, resultJson) {
    await fsx.outputJson(retrieveTargetPath, resultJson, { spaces: 2 });
    this.print(`Wrote result file to ${retrieveTargetPath}.`);
    return { message: `Wrote result file to ${retrieveTargetPath}.` };
  }

  private formatRetrieveOptions(options) {
    const retrieveOptions: any = {};
    retrieveOptions.apiVersion = options.apiversion || this.force.config.getApiVersion();
    retrieveOptions.resultfile = options.resultfile;
    retrieveOptions.targetusername = options.targetusername;
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
      throw almError('mdDescribeMetadataCommandCliInvalidApiVersionError', currentApiVersion);
    }

    if (options.resultfile) {
      const retrieveTargetPath = path.resolve(options.resultfile);
      try {
        const data = fsx.statSync(retrieveTargetPath);
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

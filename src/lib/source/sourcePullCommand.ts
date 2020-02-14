/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as BBPromise from 'bluebird';
import * as util from 'util';

import Messages = require('../messages');
import * as almError from '../core/almError';
import srcDevUtil = require('../core/srcDevUtil');
import { parseWaitParam } from './sourceUtil';
import * as syncCommandHelper from './syncCommandHelper';
import MetadataRegistry = require('./metadataRegistry');
import logger = require('../core/logApi');
import { Messages as CoreMessages } from '@salesforce/core';
import { MdapiPullApi } from './sourcePullApi';

const messages = Messages();
CoreMessages.importMessagesDirectory(__dirname);

class MdapiPullCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('source:pull');
    this.commonMsgs = CoreMessages.loadMessages('salesforce-alm', 'source');
  }

  validate(context) {
    // Validate the wait param if set and convert to an integer.
    parseWaitParam(context.flags);

    return BBPromise.resolve(context);
  }

  getPreExecuteMessage({ orgId, username }) {
    return messages.getMessage('pullCommandCliPreExecute', [orgId, username]);
  }

  execute(context) {
    const scratchOrg = context.org;
    const force = scratchOrg.force;
    const options = context.flags || {};
    const rows = [];
    const projectPath = force.config.getProjectPath();
    return MetadataRegistry.initializeMetadataTypeInfos(scratchOrg)
      .then(() => MdapiPullApi.create({ org: scratchOrg }))
      .then((mdapiPull: MdapiPullApi) => {
        options.unsupportedMimeTypes = []; // for logging unsupported static resource mime types
        return mdapiPull.doPull(options);
      })
      .catch(e => {
        if (e.name === 'SourceConflict') {
          const error = almError('sourceConflictDetected');
          e.sourceConflictElements.forEach(sourceElement =>
            syncCommandHelper.createConflictRows(rows, sourceElement, projectPath)
          );
          error['columns'] = syncCommandHelper.getColumnMetaInfo(this.commonMsgs);
          error['result'] = rows;
          this.logger.error(messages.getMessage('pullCommandConflictMsg'));
          throw error;
        } else {
          throw e;
        }
      })
      .then(result => {
        if (!util.isNullOrUndefined(result)) {
          result.inboundFiles.forEach(sourceItem => syncCommandHelper.createDisplayRows(rows, sourceItem, projectPath));
        }
      })
      .then(() => this.logger.styledHeader(this.logger.color.blue(messages.getMessage('pullCommandHumanSuccess'))))
      .then(() => srcDevUtil.logUnsupportedMimeTypeError(options.unsupportedMimeTypes, this.logger, force))
      .then(() => (options.json ? { pulledSource: rows } : rows));
  }

  /**
   * this indicated to index.js this command should produce tabular output.
   * @returns {*[]}
   */
  getColumnData() {
    return syncCommandHelper.getColumnMetaInfo(this.commonMsgs);
  }
}

export = MdapiPullCommand;

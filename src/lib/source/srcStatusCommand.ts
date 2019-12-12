/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import messages = require('../messages');

import * as syncCommandHelper from './syncCommandHelper';
import MetadataRegistry = require('./metadataRegistry');
import logger = require('../core/logApi');
import { SrcStatusApi } from './srcStatusApi';
const { Messages } = require('@salesforce/core');

Messages.importMessagesDirectory(__dirname);

function SrcStatusCommand(context) {
  this.scratchOrg = context.org;
  this.force = this.scratchOrg.force;
  this.projectPath = this.force.config.getProjectPath();
  this.messages = messages(this.force.config.getLocale());
  this.logger = logger.child('source:status');
}

SrcStatusCommand.prototype.reject = function reject(...args) {
  const msg = this.messages.getMessage(...args);
  return Promise.reject(new Error(msg));
};

SrcStatusCommand.prototype.execute = function execute(options) {
  const rows = [];
  let api;
  return MetadataRegistry.initializeMetadataTypeInfos(this.scratchOrg)
    .then(() => SrcStatusApi.create({ org: this.scratchOrg }))
    .then((srcStatusApi: SrcStatusApi) => {
      api = srcStatusApi
    })
    .then(() => api.doStatus(options))
    .then(() => {
      api
        .getLocalChanges()
        .forEach(workspaceElement => syncCommandHelper.createStatusLocalRows(rows, workspaceElement, this.projectPath));
      api
        .getRemoteChanges()
        .forEach(workspaceElement =>
          syncCommandHelper.createStatusRemoteRows(rows, workspaceElement, this.projectPath)
        );
      this.logger.styledHeader(this.logger.color.blue(this.messages.getMessage('statusCommandHumanSuccess')));
      return rows;
    });
};

/**
 * this indicated to index.js this command should produce tabular output.
 * @returns {*[]}
 */
SrcStatusCommand.prototype.getColumnData = function() {
  const commonMsgs = Messages.loadMessages('salesforce-alm', 'source');
  return syncCommandHelper.getColumnMetaInfo(commonMsgs);
};

export = SrcStatusCommand;

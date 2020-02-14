/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// Thirdparty
import * as BBPromise from 'bluebird';
import * as optional from 'optional-js';
import * as os from 'os';

// Local

import * as Force from '../core/force';
import MetadataRegistry = require('./metadataRegistry');
import MdapiConvertApi = require('./mdapiConvertApi');
import ScratchOrg = require('../core/scratchOrgApi');
import messages = require('../messages');
import srcDevUtil = require('../core/srcDevUtil');
import * as syncCommandHelper from './syncCommandHelper';
import logger = require('../core/logApi');
const { Messages } = require('@salesforce/core');

Messages.importMessagesDirectory(__dirname);

const COMMAND_TEMP_ORG = 'mdapiConvertTemp@org.org';

class MdapiConvertCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor(force?) {
    this.force = optional.ofNullable(force).orElse(new Force());
    this.messages = messages(this.force.config.getLocale());
    this.org = new ScratchOrg();
    this.org.setName(COMMAND_TEMP_ORG);
    this.logger = logger.child('mdapi:convert');
  }

  validate(context) {
    const fixedContext = srcDevUtil.fixCliContext(context);
    this.api = new MdapiConvertApi(this.force);
    this.api.root = fixedContext.rootdir;
    if (!util.isNullOrUndefined(fixedContext.outputdir)) {
      this.api.outputDirectory = fixedContext.outputdir;
    }
    return BBPromise.resolve(fixedContext);
  }

  execute(context) {
    return MetadataRegistry.initializeMetadataTypeInfos(this.org)
      .then(() => {
        this.api.unsupportedMimeTypes = []; // for logging unsupported static resource mime types
        return this.api.convertSource(this.org, context);
      })
      .then(outputElements =>
        srcDevUtil
          .logUnsupportedMimeTypeError(this.api.unsupportedMimeTypes, this.logger, this.force)
          .then(() => outputElements)
      )
      .finally(() => this.org.cleanData());
  }

  /**
   * We are a using a two table output now, one table for the files that were converted and another one for duplicate files.
   * Note that if there was already a file with same name/type but the contents are identical then no .dup file will be
   * created and nothing will be shown in the output for that file.
   */
  getHumanSuccessMessage(data) {
    const commonMsgs = Messages.loadMessages('salesforce-alm', 'source');
    const header = this.messages.getMessage('tableName', [], 'mdapiConvertCommand');
    const columns = syncCommandHelper.getColumnMetaInfo(commonMsgs);

    const converted = [];
    const duplicates = [];

    data.forEach(e => {
      if (e.state === 'Duplicate') {
        duplicates.push(e);
      } else {
        converted.push(e);
      }
    });

    let needNewLine = false;
    if (converted.length > 0) {
      this.logger.styledHeader(this.logger.color.blue(header));
      this.logger.table(converted, { columns });
      needNewLine = true;
    }

    if (duplicates.length > 0) {
      if (needNewLine) {
        this.logger.log(os.EOL);
      }
      this.logger.styledHeader(
        this.logger.color.blue(this.messages.getMessage('tableNameDups', [], 'mdapiConvertCommand'))
      );
      this.logger.log(this.messages.getMessage('dupsExplanation', [], 'mdapiConvertCommand'));
      this.logger.log(os.EOL);
      this.logger.table(duplicates, { columns });
    }
  }

  static getCommandTempOrg() {
    return COMMAND_TEMP_ORG;
  }
}

export = MdapiConvertCommand;

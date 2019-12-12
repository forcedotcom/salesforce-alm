/*
 * Copyright, 1999-2017, salesforce.com
 * All Rights Reserved
 * Company Confidential
 */

// Node
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';

// 3PP
import * as BBPromise from 'bluebird';
import * as optional from 'optional-js';

// Local
import srcDevUtil = require('../core/srcDevUtil');
import MetadataRegistry = require('./metadataRegistry');
import SourceConvertApi = require('./sourceConvertApi');
import Messages = require('../messages');
const messages = Messages();
import Org = require('../core/scratchOrgApi');
import logger = require('../core/logApi');

const COMMAND_TEMP_ORG = 'sourceConvertTempOrg@org.org';

class SourceConvertCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('source:convert');
  }

  validate(context) {
    const fixedContext = srcDevUtil.fixCliContext(context);
    this.scratchOrg = new Org();
    this.scratchOrg.setName(COMMAND_TEMP_ORG);
    const defaultOutputDir = `metadataPackage_${Date.now()}`;
    this.outputDir = optional.ofNullable(fixedContext.outputdir).orElse(defaultOutputDir);
    this.packagename = optional.ofNullable(fixedContext.packagename).orElse(null);

    if (util.isNullOrUndefined(fixedContext.rootdir)) {
      this.rootDir = path.resolve(this.scratchOrg.config.getAppConfig().defaultPackagePath);
    } else {
      this.rootDir = path.resolve(fixedContext.rootdir);
      const rootDirParentPath = path.dirname(this.rootDir);
      const filenames = fs.readdirSync(rootDirParentPath);
      if (filenames.indexOf(path.basename(this.rootDir)) === -1) {
        const error = new Error(messages.getMessage('invalidRootDirectory', this.rootDir, 'sourceConvertCommand'));
        return BBPromise.reject(error);
      }
    }
    fixedContext.outputDir = this.outputDir;
    fixedContext.rootDir = this.rootDir;
    fixedContext.packagename = this.packagename;
    return BBPromise.resolve(fixedContext);
  }

  execute(context) {
    return MetadataRegistry.initializeMetadataTypeInfos(this.scratchOrg)
      .then(() => {
        const sourceConvertApi = new SourceConvertApi(this.scratchOrg);
        context.unsupportedMimeTypes = []; // for logging unsupported static resource mime types
        return sourceConvertApi
          .doConvert(context)
          .then(() =>
            srcDevUtil.logUnsupportedMimeTypeError(context.unsupportedMimeTypes, this.logger, this.scratchOrg.force)
          )
          .then(() => BBPromise.resolve({ location: path.resolve(this.outputDir) }));
      })
      .finally(() => this.scratchOrg.cleanData());
  }

  getHumanSuccessMessage() {
    return messages.getMessage('success', path.resolve(this.outputDir), 'sourceConvertCommand');
  }

  static getCommandTempOrg() {
    return COMMAND_TEMP_ORG;
  }
}

export = SourceConvertCommand;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages, SfdxError } from '@salesforce/core';
import { SourceRetrieve, SourceRetrieveOutput } from './sourceRetrieve';
import { parseWaitParam, validateManifestPath } from './sourceUtil';
import * as syncCommandHelper from './syncCommandHelper';
import logApi = require('../core/logApi');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'source_retrieve');
// One of these flags must be specified for a valid retrieve.
const requiredFlags = ['manifest', 'metadata', 'sourcepath', 'packagenames'];

/**
 * Command for retrieving metadata from a non-source-tracked org and updating a local SFDX project.
 */
export class SourceRetrieveCommand {
  private logger;

  constructor() {
    this.logger = logApi.child('source:retrieve');
  }

  /**
   * Executes the source retrieve command
   * @param context - the cli context
   * @returns {Promise}
   */
  public async execute(context: any): Promise<SourceRetrieveOutput> {
    return await new SourceRetrieve(context.org).retrieve(context.flags);
  }

  /**
   * Validates the source retrieve command parameters
   * @param context - the cli context
   * @returns {Promise}
   */
  public async validate(context: any): Promise<any> {
    // Validate the wait param if set and convert to an integer.
    parseWaitParam(context.flags);

    // verify that the user defined one of: manifest, metadata, sourcepath, packagenames
    if (!Object.keys(context.flags).some(flag => requiredFlags.includes(flag))) {
      throw SfdxError.create('salesforce-alm', 'source', 'MissingRequiredParam', requiredFlags);
    }

    // verify that the manifest file exists and is readable.
    if (context.flags.manifest) {
      await validateManifestPath(context.flags.manifest);
    }

    return Promise.resolve(context);
  }

  public getHumanSuccessMessage(results): void {
    const commonMsgs = Messages.loadMessages('salesforce-alm', 'source');

    // Display any package retrievals
    if (results.packages && results.packages.length) {
      this.logger.styledHeader(this.logger.color.blue('Retrieved Packages'));
      results.packages.forEach(pkg => {
        this.logger.log(`${pkg.name} package converted and retrieved to: ${pkg.path}`);
      });
      this.logger.log('');
    }

    this.logger.styledHeader(this.logger.color.blue(messages.getMessage('retrievedSourceHeader')));
    if (results.inboundFiles && results.inboundFiles.length) {
      const columns = syncCommandHelper.getColumnMetaInfo(commonMsgs, true);
      this.logger.table(results.inboundFiles, { columns });
    } else {
      this.logger.log(messages.getMessage('NoResultsFound'));
    }

    if (results.warnings) {
      this.logger.log('');
      this.logger.styledHeader(this.logger.color.yellow(messages.getMessage('metadataNotFoundWarning')));
      results.warnings.forEach(warning => this.logger.log(warning.problem));
    }
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import { ToolbeltCommand } from '../../../ToolbeltCommand';

import Messages = require('../../../lib/messages');
const messages = Messages();
import { Config } from '../../../lib/core/configApi';
const configInstance = new Config();

export class MdapiDescribemetadataCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('mdDescribeMetadataCommandCliDescription');
  public static readonly longDescription = messages.getMessage('mdDescribeMetadataCommandCliLong');
  public static readonly help = messages.getMessage('mdDescribeMetadataCommandCliHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    apiversion: flags.builtin({
      // @ts-ignore force char override for backward compat -- don't try this at home!
      char: 'a',
      description: messages.getMessage('mdDescribeMetadataCommandCliApiVersion', configInstance.getApiVersion()),
      longDescription: messages.getMessage('mdDescribeMetadataCommandCliApiVersionLong', configInstance.getApiVersion())
    }),
    resultfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('mdDescribeMetadataCommandCliFilterKnown'),
      longDescription: messages.getMessage('mdDescribeMetadataCommandCliFilterKnownLong'),
      required: false
    }),
    filterknown: flags.boolean({
      char: 'k',
      description: messages.getMessage('mdDescribeMetadataCommandCliResultFile'),
      longDescription: messages.getMessage('mdDescribeMetadataCommandCliResultFileLong'),
      hidden: true
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiDescribemetadataCommand = require('../../../lib/mdapi/mdapiDescribemetadataCommand');
    return this.execLegacyCommand(new MdapiDescribemetadataCommand(context), context);
  }
}

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import { Config } from '../../../lib/core/configApi';
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();
const configInstance = new Config();

export class MdapiListmetadataCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('mdListmetadataCommandCliDescription');
  public static readonly longDescription = messages.getMessage('mdListmetadataCommandCliLong');
  public static readonly help = messages.getMessage('mdListmetadataCommandCliHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    apiversion: flags.builtin({
      // @ts-ignore force char override for backward compat -- don't try this at home!
      char: 'a',
      description: messages.getMessage('mdListmetadataCommandCliApiVersion', configInstance.getApiVersion()),
      longDescription: messages.getMessage('mdListmetadataCommandCliApiVersionLong', configInstance.getApiVersion()),
    }),
    resultfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('mdListmetadataCommandCliResultFile'),
      longDescription: messages.getMessage('mdListmetadataCommandCliResultFileLong'),
      required: false,
    }),
    metadatatype: flags.string({
      char: 'm',
      description: messages.getMessage('mdListmetadataCommandCliMetadatatype'),
      longDescription: messages.getMessage('mdListmetadataCommandCliMetadatatypeLong'),
      required: true,
    }),
    folder: flags.string({
      description: messages.getMessage('mdListmetadataCommandCliFolder'),
      longDescription: messages.getMessage('mdListmetadataCommandCliFolderLong'),
      required: false,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiListmetadataCommand = require('../../../lib/mdapi/mdapiListmetadataCommand');
    return this.execLegacyCommand(new MdapiListmetadataCommand(context), context);
  }
}

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
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();

export class MdapiConvertCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', null, 'mdapiConvertCommand');
  public static readonly longDescription = messages.getMessage('longDescription', null, 'mdapiConvertCommand');
  public static readonly help = messages.getMessage('help', null, 'mdapiConvertCommand');
  public static readonly initializeMetadataRegistry = true;
  public static readonly showProgress = true;
  public static readonly requiresUsername = false;
  public static readonly requiresProject = true;
  public static readonly flagsConfig: FlagsConfig = {
    rootdir: flags.directory({
      char: 'r',
      description: messages.getMessage('rootParam', null, 'mdapiConvertCommand'),
      longDescription: messages.getMessage('rootParamLongDescription', null, 'mdapiConvertCommand'),
      required: true
    }),
    outputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('outputDirectoryParam', null, 'mdapiConvertCommand'),
      longDescription: messages.getMessage('outputDirectoryParamLongDescription', null, 'mdapiConvertCommand'),
      required: false
    }),
    manifest: flags.string({
      char: 'x',
      description: messages.getMessage('manifestDescription', null, 'mdapiConvertCommand'),
      longDescription: messages.getMessage('manifestLongDescription', null, 'mdapiConvertCommand'),
      required: false
    }),
    metadata: flags.array({
      char: 'm',
      description: messages.getMessage('metadataParamDescription', null, 'mdapiConvertCommand'),
      longDescription: messages.getMessage('metadataParamLongDescription', null, 'mdapiConvertCommand'),
      required: false,
      exclusive: ['manifest', 'metadatapath']
    }),
    metadatapath: flags.array({
      char: 'p',
      required: false,
      hidden: false,
      description: messages.getMessage('sourcePathDescription', null, 'mdapiConvertCommand'),
      longDescription: messages.getMessage('sourcePathLongDescription', null, 'mdapiConvertCommand'),
      exclusive: ['manifest', 'metadata']
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiConvertCommand = require('../../../lib/source/mdapiConvertCommand');
    return this.execLegacyCommand(new MdapiConvertCommand(), context);
  }
}

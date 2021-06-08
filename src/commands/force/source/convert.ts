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
import Messages = require('../../../lib/messages');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const messages = Messages();

export class SourceConvertCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description', null, 'source_convert');
  public static readonly longDescription = messages.getMessage('longDescription', null, 'source_convert');
  public static readonly help = messages.getMessage('help', null, 'source_convert');
  public static readonly initializeMetadataRegistry = true;
  public static readonly requiresUsername = false;
  public static readonly requiresProject = true;
  public static readonly showProgress = true;
  public static readonly flagsConfig: FlagsConfig = {
    rootdir: flags.directory({
      char: 'r',
      description: messages.getMessage('rootParam', null, 'source_convert'),
      longDescription: messages.getMessage('rootParamLongDescription', null, 'source_convert'),
      required: false,
    }),
    outputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('outputDirectoryParam', null, 'source_convert'),
      longDescription: messages.getMessage('outputDirectoryParamLongDescription', null, 'source_convert'),
      required: false,
    }),
    packagename: flags.string({
      char: 'n',
      description: messages.getMessage('packageNameParam', null, 'source_convert'),
      longDescription: messages.getMessage('packageNameParamLongDescription', null, 'source_convert'),
      required: false,
    }),
    manifest: flags.string({
      char: 'x',
      description: messages.getMessage('manifestDescription', null, 'source_convert'),
      longDescription: messages.getMessage('manifestLongDescription', null, 'source_convert'),
      required: false,
    }),
    sourcepath: flags.array({
      char: 'p',
      required: false,
      hidden: false,
      description: messages.getMessage('sourcePathDescription', null, 'source_convert'),
      longDescription: messages.getMessage('sourcePathLongDescription', null, 'source_convert'),
      exclusive: ['manifest', 'metadata'],
    }),
    metadata: flags.array({
      char: 'm',
      description: messages.getMessage('metadataParamDescription', null, 'source_convert'),
      longDescription: messages.getMessage('metadataParamLongDescription', null, 'source_convert'),
      required: false,
      exclusive: ['manifest', 'sourcepath'],
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const LegacySourceConvertCommand = require('../../../lib/source/sourceConvertCommand');
    return this.execLegacyCommand(new LegacySourceConvertCommand(), context);
  }
}

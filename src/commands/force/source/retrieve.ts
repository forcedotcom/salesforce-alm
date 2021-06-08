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
import { Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { SourceRetrieveCommand as LegacySourceRetrieveCommand } from '../../../lib/source/sourceRetrieveCommand';
import { ToolbeltCommand } from '../../../ToolbeltCommand';

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('salesforce-alm', 'source_retrieve');
const mdapiMsgs = Messages.loadMessages('salesforce-alm', 'mdapi_retrieve');
const commonMsgs = Messages.loadMessages('salesforce-alm', 'source');
import consts = require('../../../lib/core/constants');

export class SourceRetrieveCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description');
  public static readonly longDescription = messages.getMessage('longDescription');
  public static readonly help = messages.getMessage('help');
  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    apiversion: flags.builtin({
      // @ts-ignore force char override for backward compat -- don't try this at home!
      char: 'a',
      description: mdapiMsgs.getMessage('apiversionFlagDescription'),
      longDescription: mdapiMsgs.getMessage('apiversionFlagLongDescription'),
    }),
    wait: flags.minutes({
      char: 'w',
      required: false,
      hidden: false,
      default: Duration.minutes(consts.DEFAULT_SRC_WAIT_MINUTES),
      min: Duration.minutes(consts.MIN_SRC_WAIT_MINUTES),
      description: commonMsgs.getMessage('waitParamDescription'),
      longDescription: commonMsgs.getMessage('waitParamDescriptionLong'),
    }),
    manifest: flags.filepath({
      char: 'x',
      description: messages.getMessage('manifestParamDescription'),
      longDescription: messages.getMessage('manifestParamLongDescription'),
      required: false,
      exclusive: ['metadata', 'sourcepath'],
    }),
    metadata: flags.array({
      char: 'm',
      description: messages.getMessage('metadataParamDescription'),
      longDescription: messages.getMessage('metadataParamLongDescription'),
      required: false,
      exclusive: ['manifest', 'sourcepath'],
    }),
    packagenames: flags.array({
      char: 'n',
      description: mdapiMsgs.getMessage('packagenamesFlagDescription'),
      longDescription: mdapiMsgs.getMessage('packagenamesFlagLongDescription'),
      required: false,
    }),
    sourcepath: flags.array({
      char: 'p',
      description: messages.getMessage('sourcePathParamDescription'),
      longDescription: messages.getMessage('sourcePathParamLongDescription'),
      required: false,
      exclusive: ['manifest', 'metadata'],
    }),
    verbose: flags.builtin({
      description: mdapiMsgs.getMessage('verboseFlagDescription'),
      longDescription: mdapiMsgs.getMessage('verboseFlagLongDescription'),
    }),
  };
  protected readonly lifecycleEventNames = ['preretrieve', 'postretrieve', 'postsourceupdate'];

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    return await this.execLegacyCommand(new LegacySourceRetrieveCommand(), context);
  }
}

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
import { Config } from '../../../lib/core/configApi';
import consts = require('../../../lib/core/constants');
import { ToolbeltCommand } from '../../../ToolbeltCommand';

const configInstance = new Config();

Messages.importMessagesDirectory(__dirname);
const messages: Messages = Messages.loadMessages('salesforce-alm', 'mdapi_retrieve');

export class MdapiRetrieveCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('retrieveCommandDescription');
  public static readonly longDescription = messages.getMessage('retrieveCommandLongDescription');
  public static readonly help = messages.getMessage('retrieveCommandHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    apiversion: flags.builtin({
      // @ts-ignore force char override for backward compat -- don't try this at home!
      char: 'a',
      description: messages.getMessage('apiversionFlagDescription', [configInstance.getApiVersion()]),
      longDescription: messages.getMessage('apiversionFlagLongDescription'),
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('waitFlagDescription', [consts.DEFAULT_MDAPI_RETRIEVE_WAIT_MINUTES]),
      longDescription: messages.getMessage('waitFlagLongDescription'),
      required: false,
    }),
    retrievetargetdir: flags.directory({
      char: 'r',
      description: messages.getMessage('retrievetargetdirFlagDescription'),
      longDescription: messages.getMessage('retrievetargetdirFlagLongDescription'),
      required: true,
    }),
    unpackaged: flags.filepath({
      char: 'k',
      description: messages.getMessage('unpackagedFlagDescription'),
      longDescription: messages.getMessage('unpackagedFlagLongDescription'),
      required: false,
    }),
    verbose: flags.builtin({
      description: messages.getMessage('verboseFlagDescription'),
      longDescription: messages.getMessage('verboseFlagLongDescription'),
    }),
    sourcedir: flags.directory({
      char: 'd',
      description: messages.getMessage('sourcedirFlagDescription', [consts.WORKSPACE_CONFIG_FILENAME]),
      longDescription: messages.getMessage('sourcedirFlagLongDescription', [consts.WORKSPACE_CONFIG_FILENAME]),
      required: false,
    }),
    packagenames: flags.array({
      char: 'p',
      description: messages.getMessage('packagenamesFlagDescription'),
      longDescription: messages.getMessage('packagenamesFlagLongDescription'),
      required: false,
    }),
    singlepackage: flags.boolean({
      char: 's',
      description: messages.getMessage('singlepackageFlagDescription'),
      longDescription: messages.getMessage('singlepackageFlagLongDescription'),
      required: false,
    }),
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiRetrieveCommand = require('../../../lib/mdapi/mdapiRetrieveCommand');
    return this.execLegacyCommand(new MdapiRetrieveCommand(context), context);
  }
}

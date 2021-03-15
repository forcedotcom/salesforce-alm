/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import { flags, FlagsConfig } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { ToolbeltCommand } from '../../../ToolbeltCommand';

import consts = require('../../../lib/core/constants');

Messages.importMessagesDirectory(__dirname);
const messages: Messages = Messages.loadMessages('salesforce-alm', 'mdapi_deploy');

export class MdapiDeployCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('mdDeployCommandCliDescription');
  public static readonly longDescription = messages.getMessage('mdDeployCommandCliLong');
  public static readonly help = messages.getMessage('mdDeployCommandCliHelp');
  public static readonly requiresProject = false;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    checkonly: flags.boolean({
      char: 'c',
      description: messages.getMessage('mdDeployCommandCliCheckOnly'),
      longDescription: messages.getMessage('mdDeployCommandCliCheckOnlyLong'),
      required: false
    }),
    deploydir: flags.directory({
      char: 'd',
      description: messages.getMessage('mdDeployCommandCliDeployDir'),
      longDescription: messages.getMessage('mdDeployCommandCliDeployDirLong'),
      required: false,
      exclusive: ['zipfile']
    }),
    wait: flags.minutes({
      char: 'w',
      description: messages.getMessage('mdapiCliWait', [consts.DEFAULT_MDAPI_WAIT_MINUTES]),
      longDescription: messages.getMessage('mdapiCliWaitLong', [consts.DEFAULT_MDAPI_WAIT_MINUTES]),
      required: false
    }),
    testlevel: flags.enum({
      char: 'l',
      description: messages.getMessage('mdDeployCommandCliTestLevel'),
      longDescription: messages.getMessage('mdDeployCommandCliTestLevelLong'),
      required: false,
      options: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg']
    }),
    runtests: flags.array({
      char: 'r',
      description: messages.getMessage('mdDeployCommandCliRunTests'),
      longDescription: messages.getMessage('mdDeployCommandCliRunTestsLong'),
      required: false
    }),
    ignoreerrors: flags.boolean({
      char: 'o',
      description: messages.getMessage('mdDeployCommandCliIgnoreErrors'),
      longDescription: messages.getMessage('mdDeployCommandCliIgnoreErrorsLong'),
      required: false
    }),
    ignorewarnings: flags.boolean({
      char: 'g',
      description: messages.getMessage('mdDeployCommandCliIgnoreWarnings'),
      longDescription: messages.getMessage('mdDeployCommandCliIgnoreWarningsLong'),
      required: false
    }),
    validateddeployrequestid: flags.id({
      char: 'q',
      description: messages.getMessage('mdDeployCommandCliValidatedDeployRequestId'),
      longDescription: messages.getMessage('mdDeployCommandCliValidatedDeployRequestIdLong'),
      required: false
    }),
    verbose: flags.builtin({
      description: messages.getMessage('mdDeployCommandCliVerbose'),
      longDescription: messages.getMessage('mdDeployCommandCliVerboseLong')
    }),
    zipfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('mdDeployCommandCliZipFile'),
      longDescription: messages.getMessage('mdDeployCommandCliZipFileLong'),
      required: false
    }),
    singlepackage: flags.boolean({
      char: 's',
      description: messages.getMessage('mdDeployCommandSinglePackageDescription'),
      longDescription: messages.getMessage('mdDeployCommandSinglePackageDescriptionLong'),
      required: false
    }),
    soapdeploy: flags.boolean({
      description: messages.getMessage('mdDeploySoapDeployDescription'),
      longDescription: messages.getMessage('mdDeploySoapDeployDescriptionLong'),
      required: false
    })
  };

  public async run(): Promise<unknown> {
    const context = await this.resolveLegacyContext();
    const MdapiDeployCommand = require('../../../lib/mdapi/mdapiDeployCommand');
    return this.execLegacyCommand(new MdapiDeployCommand(context), context);
  }
}

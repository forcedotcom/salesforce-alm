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
import { Duration } from '@salesforce/kit';
import { ToolbeltCommand } from '../../../ToolbeltCommand';

import consts = require('../../../lib/core/constants');
const { DEFAULT_SRC_WAIT_MINUTES, MIN_SRC_DEPLOY_WAIT_MINUTES } = consts;

Messages.importMessagesDirectory(__dirname);

const messages: Messages = Messages.loadMessages('salesforce-alm', 'source_deploy');
const commonMsgs: Messages = Messages.loadMessages('salesforce-alm', 'source');
const mdapiMessages: Messages = Messages.loadMessages('salesforce-alm', 'mdapi_deploy');

export class SourceDeployCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('description');
  public static readonly longDescription = messages.getMessage('longDescription');
  public static readonly help = messages.getMessage('help');
  public static readonly requiresProject = true;
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    checkonly: flags.boolean({
      char: 'c',
      description: mdapiMessages.getMessage('mdDeployCommandCliCheckOnly'),
      longDescription: mdapiMessages.getMessage('mdDeployCommandCliCheckOnlyLong'),
      required: false
    }),
    wait: flags.minutes({
      char: 'w',
      required: false,
      hidden: false,
      default: Duration.minutes(DEFAULT_SRC_WAIT_MINUTES),
      min: Duration.minutes(MIN_SRC_DEPLOY_WAIT_MINUTES),
      description: commonMsgs.getMessage('waitParamDescription'),
      longDescription: commonMsgs.getMessage('waitParamDescriptionLong')
    }),
    testlevel: flags.enum({
      char: 'l',
      description: mdapiMessages.getMessage('mdDeployCommandCliTestLevel'),
      longDescription: mdapiMessages.getMessage('mdDeployCommandCliTestLevelLong'),
      required: false,
      options: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg']
    }),
    runtests: flags.array({
      char: 'r',
      description: mdapiMessages.getMessage('mdDeployCommandCliRunTests'),
      longDescription: mdapiMessages.getMessage('mdDeployCommandCliRunTestsLong'),
      required: false
    }),
    ignoreerrors: flags.boolean({
      char: 'o',
      description: mdapiMessages.getMessage('mdDeployCommandCliIgnoreErrors'),
      longDescription: mdapiMessages.getMessage('mdDeployCommandCliIgnoreErrorsLong'),
      required: false
    }),
    ignorewarnings: flags.boolean({
      char: 'g',
      description: mdapiMessages.getMessage('mdDeployCommandCliIgnoreWarnings'),
      longDescription: mdapiMessages.getMessage('mdDeployCommandCliIgnoreWarningsLong'),
      required: false
    }),
    validateddeployrequestid: flags.id({
      char: 'q',
      description: mdapiMessages.getMessage('mdDeployCommandCliValidatedDeployRequestId'),
      longDescription: mdapiMessages.getMessage('mdDeployCommandCliValidatedDeployRequestIdLong'),
      required: false,
      exclusive: [
        'manifest',
        'metadata',
        'sourcepath',
        'checkonly',
        'testlevel',
        'runtests',
        'ignoreerrors',
        'ignorewarnings'
      ]
    }),
    verbose: flags.builtin({
      description: mdapiMessages.getMessage('mdDeployCommandCliVerbose'),
      longDescription: mdapiMessages.getMessage('mdDeployCommandCliVerboseLong')
    }),
    metadata: flags.array({
      char: 'm',
      description: messages.getMessage('metadataParamDescription'),
      longDescription: messages.getMessage('metadataParamLongDescription'),
      required: false,
      exclusive: ['manifest', 'sourcepath']
    }),
    sourcepath: flags.array({
      char: 'p',
      required: false,
      hidden: false,
      description: messages.getMessage('sourcePathDescription'),
      longDescription: messages.getMessage('sourcePathLongDescription'),
      exclusive: ['manifest', 'metadata']
    }),
    manifest: flags.filepath({
      char: 'x',
      required: false,
      hidden: false,
      description: messages.getMessage('manifestDescription'),
      longDescription: messages.getMessage('manifestLongDescription'),
      exclusive: ['metadata', 'sourcepath']
    })
  };
  public async run(): Promise<unknown> {
    const { SourceApiCommand } = require('../../../lib/source/sourceApiCommand');
    const context = await this.resolveLegacyContext();
    context.deploytype = SourceApiCommand.SOURCE_DEPLOY;
    return await this.execLegacyCommand(new SourceApiCommand(false), context);
  }
}

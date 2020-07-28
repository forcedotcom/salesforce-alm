/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Config, fs, Messages, SfdxError, SfdxErrorConfig } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { AnyJson } from '@salesforce/ts-types';
import Alias = require('../../../lib/core/alias');
import consts = require('../../../lib/core/constants');
import SFDXCommonMessages = require('../../../lib/messages');
import { SANDBOXDEF_SRC_SANDBOXNAME, SandboxEventNames } from '../../../lib/org/sandbox/sandboxConstants';
import { SandboxOrg } from '../../../lib/org/sandbox/sandboxOrg';
import { SandboxRequest } from '../../../lib/org/sandbox/sandboxOrgApi';
import { SandboxProgressReporter } from '../../../lib/org/sandbox/sandboxProgressReporter';
import { OrgTypes } from '../../../lib/orgTypes';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'org_clone');
const sfdxCommonMessages = SFDXCommonMessages();

export class OrgCloneCommand extends SfdxCommand {
  public static readonly longDescription = messages.getMessage('commandLongDescription');
  public static readonly help = messages.getMessage('commandHelp');
  /*
   * TODO: When SfdxCommand change the messages for description to include both the description and the help messages
   *       we have to remove the help from description.
   */
  public static readonly description = messages.getMessage('commandDescription') + '\n\n' + OrgCloneCommand.help;
  public static readonly showProgress = true;
  public static readonly requiresProject = false;
  public static readonly varargs = true;
  public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
  public static readonly requiresUsername = true;

  public static readonly flagsConfig: FlagsConfig = {
    type: flags.enum({
      char: 't',
      description: messages.getMessage('typeFlagDescription'),
      longDescription: messages.getMessage('typeFlagLongDescription'),
      required: true,
      options: [OrgTypes.Sandbox]
    }),
    definitionfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('definitionfileFlagDescription'),
      longDescription: messages.getMessage('definitionfileFlagLongDescription'),
      required: false
    }),
    definitionjson: flags.string({
      char: 'j',
      description: messages.getMessage('definitionjsonFlagDescription'),
      longDescription: messages.getMessage('definitionjsonFlagLongDescription'),
      hidden: true,
      required: false
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: messages.getMessage('setdefaultusernameFlagDescription'),
      longDescription: messages.getMessage('setdefaultusernameFlagLongDescription'),
      required: false
    }),
    setalias: flags.string({
      char: 'a',
      description: messages.getMessage('setaliasFlagDescription'),
      longDescription: messages.getMessage('setaliasFlagLongDescription'),
      required: false
    }),
    wait: flags.minutes({
      char: 'w',
      description: sfdxCommonMessages.getMessage('streamingWait', []),
      longDescription: sfdxCommonMessages.getMessage('streamingWaitLong', []),
      required: false,
      min: Duration.minutes(consts.MIN_STREAM_TIMEOUT_MINUTES),
      default: Duration.minutes(consts.DEFAULT_STREAM_TIMEOUT_MINUTES)
    })
  };

  async readJsonDefFile(): Promise<AnyJson> {
    // the -f option
    if (this.flags.definitionfile) {
      this.logger.debug('Reading JSON DefFile %s ', this.flags.definitionfile);
      return fs.readJson(this.flags.definitionfile);
    } else return;
  }

  public async run(): Promise<unknown> {
    this.logger.debug('Clone started with args %s ', this.flags);
    let defFileContents: AnyJson = await this.readJsonDefFile();

    if (this.flags.type === OrgTypes.Sandbox) {
      const sandboxOrg = await SandboxOrg.getInstance(this.org, this.flags.wait, this.logger, this.flags.clientid);

      // Keep all console output in the command
      sandboxOrg.on(SandboxEventNames.EVENT_ASYNCRESULT, results => {
        this.ux.log(
          messages.getMessage('commandSuccess', [results.sandboxProcessObj.Id, results.sandboxProcessObj.SandboxName])
        );
      });
      sandboxOrg.on(SandboxEventNames.EVENT_STATUS, results => {
        SandboxProgressReporter.logSandboxProgress(
          this.ux,
          results.sandboxProcessObj,
          results.interval,
          results.retries,
          results.waitingOnAuth
        );
      });
      sandboxOrg.on(SandboxEventNames.EVENT_RESULT, results => {
        SandboxProgressReporter.logSandboxProcessResult(this.ux, results.sandboxProcessObj, results.sandboxRes);
        if (results.sandboxRes && results.sandboxRes.authUserName) {
          if (this.flags.setalias) {
            Alias.set(this.flags.setalias, results.sandboxRes.authUserName).then(result =>
              this.logger.debug('Set Alias: %s result: %s', this.flags.setalias, result)
            );
          }
          if (this.flags.setdefaultusername) {
            let globalConfig: Config = this.configAggregator.getGlobalConfig();
            globalConfig.set(Config.DEFAULT_USERNAME, results.sandboxRes.authUserName);
            globalConfig
              .write()
              .then(result =>
                this.logger.debug('Set defaultUsername: %s result: %s', this.flags.setdefaultusername, result)
              );
          }
        }
      });

      this.logger.debug('Clone Varargs: %s ', this.varargs);

      let sandboxReq: SandboxRequest = new SandboxRequest();
      // definitionjson and varargs override file input
      Object.assign(sandboxReq, defFileContents, this.varargs);

      this.logger.debug('SandboxRequest after merging DefFile and Varargs: %s ', sandboxReq);

      //try to find the source sandbox name either from the definition file or the commandline arg
      //NOTE the name and the case "SourceSandboxName" must match exactly
      let srcSandboxName: string = sandboxReq[SANDBOXDEF_SRC_SANDBOXNAME];
      if (srcSandboxName) {
        //we have to delete this property from the sandboxRequest object,
        //because sandboxRequest object represent the POST request to create SandboxInfo bpo,
        //sandboxInfo does not have a column named  SourceSandboxName, this field will be converted to sourceId in the clone call below
        delete sandboxReq[SANDBOXDEF_SRC_SANDBOXNAME];
      } else {
        //error - we need SourceSandboxName to know which sandbox to clone from
        throw SfdxError.create(
          new SfdxErrorConfig('salesforce-alm', 'org_clone', 'missingSourceSandboxName', [
            SANDBOXDEF_SRC_SANDBOXNAME
          ]).addAction('missingSourceSandboxNameAction', [SANDBOXDEF_SRC_SANDBOXNAME])
        );
      }

      this.logger.debug('Calling clone with SandboxRequest: %s and SandboxName: %s ', sandboxReq, srcSandboxName);
      return await sandboxOrg.cloneSandbox(sandboxReq, srcSandboxName);
    } else {
      throw SfdxError.create(
        new SfdxErrorConfig('salesforce-alm', 'org_clone', 'commandOrganizationTypeNotSupport', [
          OrgTypes.Sandbox
        ]).addAction('commandOrganizationTypeNotSupportAction', [OrgTypes.Sandbox])
      );
    }
  }
}

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
import { Duration } from '@salesforce/kit';
import consts = require('../../../lib/core/constants');
import * as _ from 'lodash';

import * as envTypes from '../../../lib/org/envTypes';
import { AnyJson, Dictionary } from '@salesforce/ts-types';
import { Config, fs, Messages, SfdxError } from '@salesforce/core';
import { SandboxOrg } from '../../../lib/org/sandbox/sandboxOrg';
import { SandboxRequest } from '../../../lib/org/sandbox/sandboxOrgApi';
import { ToolbeltCommand } from '../../../ToolbeltCommand';
import { SandboxProgressReporter } from '../../../lib/org/sandbox/sandboxProgressReporter';
import SFDXCommonMessages = require('../../../lib/messages');
import { OrgTypes, creatableOrgTypes } from '../../../lib/orgTypes';
import { SandboxEventNames } from '../../../lib/org/sandbox/sandboxConstants';
import Alias = require("../../../lib/core/alias");

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('salesforce-alm', 'org_create');
const sfdxCommonMessages = SFDXCommonMessages();

export class OrgCreateCommand extends ToolbeltCommand {
         public static readonly theDescription = messages.getMessage('commandDescription');
         public static readonly longDescription = messages.getMessage('commandLongDescription');
         public static readonly help = messages.getMessage('commandHelp');
         public static readonly showProgress = true;
         public static readonly requiresProject = false;
         public static readonly supportsDevhubUsername = true;
         public static readonly supportsUsername = true;
         public static readonly varargs = true;
         public static readonly orgType = consts.DEFAULT_DEV_HUB_USERNAME;
         public static readonly flagsConfig: FlagsConfig = {
           type: flags.enum({
             char: 't',
             description: messages.getMessage('typeFlagDescription'),
             longDescription: messages.getMessage('typeFlagLongDescription'),
             required: false,
             options: creatableOrgTypes(),
             default: OrgTypes.Scratch
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
           nonamespace: flags.boolean({
             char: 'n',
             description: messages.getMessage('nonamespaceFlagDescription'),
             longDescription: messages.getMessage('nonamespaceFlagLongDescription'),
             required: false
           }),
           noancestors: flags.boolean({
             char: 'c',
             description: messages.getMessage('noancestorsFlagDescription'),
             longDescription: messages.getMessage('noancestorsFlagLongDescription'),
             required: false
           }),
           clientid: flags.string({
             char: 'i',
             description: messages.getMessage('clientidFlagDescription'),
             longDescription: messages.getMessage('clientidFlagLongDescription'),
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
           env: flags.enum({
             char: 'e',
             description: messages.getMessage('envFlagDescription', [envTypes.creatableTypes().toString()]),
             longDescription: messages.getMessage('envFlagLongDescription', [
               envTypes.creatableTypes().toString()
             ]),
             required: false,
             hidden: true,
             options: envTypes.creatableTypes()
           }),
           wait: flags.minutes({
             char: 'w',
             description: sfdxCommonMessages.getMessage('streamingWait', []),
             longDescription: sfdxCommonMessages.getMessage('streamingWaitLong', []),
             required: false,
             min: Duration.minutes(consts.MIN_STREAM_TIMEOUT_MINUTES),
             default: Duration.minutes(consts.DEFAULT_STREAM_TIMEOUT_MINUTES)
           }),
           durationdays: flags.number({
             char: 'd',
             description: messages.getMessage('durationdaysFlagDescription', []),
             longDescription: messages.getMessage('durationdaysFlagLongDescription', []),
             required: false
           })
         };

         async resolveHubOrgContext() : Promise<Dictionary<any>> {
           //I'd prefer not to do this, But supporting targetusername natively causes a bunch of problems for the existing dev hub
           //implementation.  Specifically, the default org will override the default dev hub org.  This could fundamentally change the
             //behavior if the scratch org create command was executed with no username args where both a default org and dev hub are setup
             //so for the dev hub case, we first need to make sure that the dev Hub has been determined and then we need to make sure that
             //we'll still default to it.
             if (_.isNil(this.hubOrg)) {
                 throw SfdxError.create('salesforce-alm', 'org', 'RequiresDevhubUsernameError');
             }
             else if (!_.isNil(this.org)) {
                 //unset the default org for the dev hub scenario
                 this.org = undefined;
             }
             return await this.resolveLegacyContext();
         }

         async readJsonDefFile(): Promise<AnyJson> {
           // the -f option
           if (this.flags.definitionfile) {
             this.logger.debug('Reading JSON DefFile %s ', this.flags.definitionfile);
             return fs.readJson(this.flags.definitionfile);
           } else return;
         }

         public async run(): Promise<unknown> {
           const heroku = require('heroku-cli-util');
           const ScratchOrgCreateCommand = require('../../../lib/org/scratchOrgCreateCommand');
           const createCommand = new ScratchOrgCreateCommand();
           this.logger.debug('Create started with args %s ', this.flags);

           if (this.flags.type === OrgTypes.Sandbox) {
             // the -f definitionFile option, both sandbox and scratch org use the flag but scratch org
             // will process it separately in the legacy command invocation
             let sandboxDefFileContents: AnyJson = await this.readJsonDefFile();

             //
             //=====================specific to Sandbox org creation ===========
             //
             if (_.isNil(this.org)) {
               throw SfdxError.create('salesforce-alm', 'org', 'RequiresUsernameError');
             }

             const sandboxOrg = await SandboxOrg.getInstance(
               this.org,
               this.flags.wait,
               this.logger,
               this.flags.clientid
             );

             if (this.flags.clientid) {
               this.ux.warn(messages.getMessage('commandClientIdNotSupported', [this.flags.clientid]));
             }
             // Keep all console output in the command
             sandboxOrg.on(SandboxEventNames.EVENT_ASYNCRESULT, results => {
               this.ux.log(
                 messages.getMessage('commandSandboxSuccess', [
                   results.sandboxProcessObj.Id,
                   results.sandboxProcessObj.SandboxName
                 ])
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
               SandboxProgressReporter.logSandboxProcessResult(
                 this.ux,
                 results.sandboxProcessObj,
                 results.sandboxRes
               );
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
                       this.logger.debug(
                         'Set defaultUsername: %s result: %s',
                         this.flags.setdefaultusername,
                         result
                       )
                     );
                 }
               }
             });

             this.logger.debug('Create Varargs: %s ', this.varargs);
             let sandboxReq: SandboxRequest = new SandboxRequest();
             // definitionjson and varargs override file input
             Object.assign(sandboxReq, sandboxDefFileContents, this.varargs);

             this.logger.debug('Calling create with SandboxRequest: %s ', sandboxReq);
             return await sandboxOrg.createSandbox(sandboxReq);
           } else {
             //
             //=====================specific to Scratch org creation ===========
             //
               const context =  await this.resolveHubOrgContext();

             if (!context.flags.clientid) {
               return this.execLegacyCommand(createCommand, context);
             } else {
               // If the user supplied a specific client ID, we have no way of knowing if it's
               // a certificate-based Connected App or not. Therefore, we have to assume that
               // we'll need the client secret, so prompt the user for it.
               return heroku
                 .prompt(sfdxCommonMessages.getMessage('stdin', [], 'auth_weblogin'), {
                   mask: true
                 })
                 .then(secret => {
                   const map = new Map();
                   map.set('secret', secret);
                   return this.execLegacyCommand(createCommand, context, map);
                 });
             }
           }
         }
       }

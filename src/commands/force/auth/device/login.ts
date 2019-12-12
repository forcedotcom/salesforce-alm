/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { DeviceFlowService, DeviceLoginOptions } from '../../../../lib/auth/deviceFlowService';

Messages.importMessagesDirectory(__dirname);
const authMessages = Messages.loadMessages('salesforce-alm', 'auth');
const commonMessages = Messages.loadMessages('salesforce-alm', 'common');
const heroku = require('heroku-cli-util');

export class AuthDeviceLoginCommand extends SfdxCommand {
  public static hidden = false;
  public static knownAuthErrors = [
    'access_denied', 'invalid_client_id', 'invalid_grant', 'invalid_request', 'server_error', 'slow_down'
  ];
  public static readonly description = authMessages.getMessage('device.description');
  public static readonly longDescription = authMessages.getMessage('device.longDescription');
  public static readonly examples = [
    authMessages.getMessage('device.example1'),
    authMessages.getMessage('device.example2'),
    authMessages.getMessage('device.example3')];
  public static readonly requiresProject = false;
  public static readonly flagsConfig: FlagsConfig = {
    clientid: flags.string({
      char: 'i',
      description: commonMessages.getMessage('clientId'),
      longDescription: commonMessages.getMessage('clientId')
    }),
    instanceurl: flags.url({
      char: 'r',
      description: commonMessages.getMessage('instanceUrl'),
      longDescription: commonMessages.getMessage('instanceUrl')
    }),
    setdefaultdevhubusername: flags.boolean({
      char: 'd',
      description: commonMessages.getMessage('setDefaultDevHub'),
      longDescription: commonMessages.getMessage('setDefaultDevHub')
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: commonMessages.getMessage('setDefaultUsername'),
      longDescription: commonMessages.getMessage('setDefaultUsername')
    }),
    setalias: flags.string({
      char: 'a',
      description: commonMessages.getMessage('setAlias'),
      longDescription: commonMessages.getMessage('setAlias')
    })
  };

  public async getClientSecret(): Promise<string> {
    return await heroku.prompt(commonMessages.getMessage('stdin.secret'));
  }

  public async run() {
    let clientSecret: string;
    const deviceCommand = await DeviceFlowService.create(this.flags as DeviceLoginOptions);
    if (this.flags.clientid) {
      clientSecret = await this.getClientSecret();
    }
    if (process.env.SFDX_ENV === 'DEMO') {
      this.ux.warn(authMessages.getMessage('device.warnAuth'));
    }
    try {
      // Request Device Login
      const loginData = await deviceCommand.requestDeviceLogin();
      if (this.flags.json) {
        this.ux.logJson(loginData);
      } else {
        this.ux.styledHeader(authMessages.getMessage('device.actionRequired'));
        this.ux.log(authMessages.getMessage('device.enterCode'), loginData.user_code, loginData.verification_uri);
        this.ux.log();
      }
      deviceCommand.logHelper('debug', 'requestDeviceLogin success');
      // Wait for user to enter code, login, 2fa ( sometimes ), and approve
      const approval = await deviceCommand.awaitDeviceApproval(loginData);
      deviceCommand.logHelper('debug', 'awaitDeviceApproval success');
      // Save an .sfdx/example@example.org authinfo file
      const authInfoResponse = await deviceCommand.authorizeAndSave(approval, clientSecret);
      deviceCommand.logHelper('debug', 'authorizeAndSave success');
      if (this.flags.json) {
        this.result = {
          data: (authInfoResponse as unknown) as AnyJson,
          ux: this.ux,
          display: () => {}
        };
      } else {
        this.ux.log(authMessages.getMessage('device.loginSuccess'), authInfoResponse.username);
        this.ux.log();
      }
      // optionally set an alias
      return deviceCommand.doSetAlias(authInfoResponse.username);
    } catch (err) {
      if (err.statusCode === 400 && err.error) {
        deviceCommand.logHelper(
          'error',
          `Device Login Command caught an error ${err.error.error.toUpperCase()} - ${err.error.error_description}`
        );
        let errorStr = `${err.error.error.toUpperCase()} - ${err.error.error_description}`;
        if (AuthDeviceLoginCommand.knownAuthErrors.includes(err.error.error)) {
          errorStr += '.\n';
          errorStr += authMessages.getMessage(`device.errors.${err.error.error}`);
        }
        throw new SfdxError(errorStr);
      } else {
        deviceCommand.logHelper('error', `Device Login Command caught an unknown error ${err}`);
        throw err;
      }
    }
  }
}

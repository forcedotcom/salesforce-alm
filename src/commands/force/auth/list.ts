/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthInfo, AuthInfoConfig, Messages } from '@salesforce/core';
import { ensureString } from '@salesforce/ts-types';
import { basename, extname } from 'path';
import Alias = require('../../../lib/core/alias');

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('salesforce-alm', 'auth');

export type AuthListInfo = {
  alias: string,
  username: string;
  orgId: string;
  instanceUrl: string;
  accessToken?: string;
  oauthMethod?: 'jwt' | 'web' | 'token' | 'unknown';
  error?: string;
};
export class AuthListCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('list.description');
  public static readonly longDescription = messages.getMessage('list.description');
  public static readonly flagsConfig: FlagsConfig = {};

  private errors = false;

  public async run(): Promise<AuthListInfo[]> {
    const auths = await this.computeAuthList();
    const columns = ['alias','username', 'orgId', 'instanceUrl', 'oauthMethod'];
    if (this.errors) {
      columns.push('error');
    }
    this.ux.styledHeader('authenticated orgs');
    this.ux.table(auths, columns);
    return auths;
  }

  protected async computeAuthList(): Promise<AuthListInfo[]> {
    const filenames = await AuthInfo.listAllAuthFiles();

    const auths: AuthListInfo[] = [];
    for (const filename of filenames) {
      const username = basename(filename, extname(filename));
      try {
        const config = await AuthInfo.create({ username });
        const fields = config.getFields();
        auths.push({
          alias: await Alias.byValue(fields.username),
          username: fields.username,
          orgId: fields.orgId,
          instanceUrl: fields.instanceUrl,
          accessToken: config.getConnectionOptions().accessToken,
          oauthMethod: config.isJwt() ? 'jwt' : config.isOauth() ? 'web' : 'token'
        });
      } catch (err) {
        // Most likely, an error decrypting the token
        const file = await AuthInfoConfig.create(AuthInfoConfig.getOptions(username));
        const contents = file.getContents();
        auths.push({
          alias: await Alias.byValue(contents.username),
          username: ensureString(contents.username),
          orgId: ensureString(contents.orgId),
          instanceUrl: ensureString(contents.instanceUrl),
          accessToken: undefined,
          oauthMethod: 'unknown',
          error: err.message
        });
        this.errors = true;
      }
    }
    return auths;
  }
}

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OutputFlags } from '@oclif/parser';
import { JsonCollection, AnyJson } from '@salesforce/ts-types';
import { UX } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { CommunityCreateResponse } from '../defs/CommunityCreateResponse';
import { CommunityCreateParams } from '../defs/CommunityCreateParams';
import { ConnectResource } from '../../connect/services/ConnectResource';

Messages.importMessagesDirectory(__dirname);
const communityMessages = Messages.loadMessages('salesforce-alm', 'community_commands');

const MESSAGE_KEY = 'message';
const NAME_KEY = 'name';
const ACTION_KEY = 'action';
/**
 * A connect api resource for creating a community
 */
export class CommunityCreateResource implements ConnectResource<CommunityCreateResponse> {
  private flags: OutputFlags<any>;
  private params: AnyJson;
  private ux: UX;

  constructor(flags: OutputFlags<any>, params: AnyJson, ux: UX) {
    this.flags = flags;
    this.params = params;
    this.ux = ux;
  }

  handleSuccess(result: JsonCollection): CommunityCreateResponse {
    const response: CommunityCreateResponse = {
      message: communityMessages.getMessage('create.response.createMessage'),
      name: result[NAME_KEY],
      action: communityMessages.getMessage('create.response.action'),
    };
    const columns = [NAME_KEY, MESSAGE_KEY, ACTION_KEY];
    this.ux.styledHeader(communityMessages.getMessage('create.response.styleHeader'));
    this.ux.table([response], columns);
    return response;
  }

  handleError(error: Error): CommunityCreateResponse {
    throw error;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async fetchRelativeConnectUrl(): Promise<string> {
    return '/connect/communities';
  }

  getRequestMethod(): string {
    return 'POST';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async fetchPostParams(): Promise<string> {
    const params: CommunityCreateParams = {
      name: this.flags.name,
      urlPathPrefix: this.flags.urlpathprefix,
      templateName: this.flags.templatename,
      description: this.flags.description,
      templateParams: this.params['templateParams'],
    };

    return JSON.stringify(params);
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConnectResource } from '../../connect/services/ConnectResource';
import { OutputFlags } from '@oclif/parser';
import { JsonCollection } from '@salesforce/ts-types';
import { UX } from '@salesforce/command';
import { CommunityCreateResponse } from '../defs/CommunityCreateResponse';
import { CommunityCreateParams } from '../defs/CommunityCreateParams';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const communityMessages = Messages.loadMessages('salesforce-alm', 'community_commands');

const MESSAGE_KEY: string = 'message';
const NAME_KEY: string = 'name';
const ACTION_KEY: string = 'action';
/**
 * A connect api resource for creating a community
 */
export class CommunityCreateResource implements ConnectResource<CommunityCreateResponse> {
  private flags: OutputFlags<any>;
  private ux: UX;

  constructor(flags: OutputFlags<any>, ux: UX) {
    this.flags = flags;
    this.ux = ux;
  }

  handleSuccess(result: JsonCollection): CommunityCreateResponse {
    const response: CommunityCreateResponse = {
      message: communityMessages.getMessage('create.response.createMessage'),
      name: result[NAME_KEY],
      action: communityMessages.getMessage('create.response.action')
    };
    const columns = [NAME_KEY, MESSAGE_KEY, ACTION_KEY];
    this.ux.styledHeader(communityMessages.getMessage('create.response.styleHeader'));
    this.ux.table([response], columns);
    return response;
  }

  handleError(error: Error): CommunityCreateResponse {
    throw error;
  }

  async fetchRelativeConnectUrl(): Promise<string> {
    return '/connect/communities';
  }

  getRequestMethod(): string {
    return 'POST';
  }

  async fetchPostParams(): Promise<string> {
    const params: CommunityCreateParams = {
      name: this.flags.name,
      urlPathPrefix: this.flags.urlpathprefix,
      templateName: this.flags.templatename,
      description: this.flags.description
    };
    return JSON.stringify(params);
  }
}

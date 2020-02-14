/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConnectResource } from '../../connect/services/ConnectResource';
import { OutputFlags } from '@oclif/parser';
import { Org } from '@salesforce/core/lib/org';
import { CommunitiesServices } from '../service/CommunitiesServices';
import { UX } from '@salesforce/command';
import { CommunityInfo } from '../defs/CommunityInfo';
import { CommunityPublishResponse } from '../defs/CommunityPublishResponse';
import { SfdxError } from '@salesforce/core/lib/sfdxError';
import { JsonCollection } from '@salesforce/ts-types';
import { URL } from 'url';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const communityMessages = Messages.loadMessages('salesforce-alm', 'community_commands');

/**
 * A connect api resource for publishing a community
 */
export class CommunityPublishResource implements ConnectResource<CommunityPublishResponse> {
  private flags: OutputFlags<any>;
  private org: Org;
  private ux: UX;

  private info: CommunityInfo;

  constructor(flags: OutputFlags<any>, org: Org, ux: UX) {
    this.flags = flags;
    this.org = org;
    this.ux = ux;
  }

  async fetchRelativeConnectUrl(): Promise<string> {
    return `/connect/communities/${await this.fetchCommunityId()}/publish`;
  }

  getRequestMethod(): string {
    return 'POST';
  }

  async fetchPostParams(): Promise<string> {
    return JSON.stringify({});
  }
  handleSuccess(result: JsonCollection): CommunityPublishResponse {
    const response: CommunityPublishResponse = {
      id: result['id'],
      message: communityMessages.getMessage('publish.response.message'),
      name: result['name'],
      status: this.info.status,
      url: new URL(result['url'])
    };
    const columns = ['id', 'message', 'name', 'status', 'url'];
    this.ux.styledHeader(communityMessages.getMessage('publish.response.styleHeader'));
    this.ux.table([response], columns);
    return response;
  }
  handleError(error: Error): CommunityPublishResponse {
    throw error;
  }

  async fetchCommunityId(): Promise<string> {
    this.info = await CommunitiesServices.fetchCommunityInfoFromName(this.org, this.flags.name);
    if (!this.info) {
      throw SfdxError.create('salesforce-alm', 'community_commands', 'publish.error.communityNotExists', [
        this.flags.name
      ]);
    }
    return this.info.id;
  }
}

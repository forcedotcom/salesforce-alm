/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConnectResource } from '../../connect/services/ConnectResource';
import { UX } from '@salesforce/command';
import { CommunityTemplatesListResponse } from '../defs/CommunityTemplatesListResponse';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const community = Messages.loadMessages('salesforce-alm', 'community_commands');

/**
 * A connect api resource for fetching community templates available to context user
 */
export class CommunityTemplatesResource implements ConnectResource<CommunityTemplatesListResponse> {
  private ux: UX;

  constructor(ux: UX) {
    this.ux = ux;
  }

  async fetchRelativeConnectUrl(): Promise<string> {
    return '/connect/communities/templates';
  }
  async fetchPostParams(): Promise<string> {
    return JSON.stringify({});
  }

  getRequestMethod(): string {
    return 'GET';
  }

  handleSuccess(result: CommunityTemplatesListResponse): CommunityTemplatesListResponse {
    const columns = ['templateName', 'publisher'];
    this.ux.styledHeader(community.getMessage('list.response.styledHeader'));
    this.ux.table(result.templates, columns);
    this.ux.log();
    this.ux.log(community.getMessage('list.response.TotalField'), result.total.toString());
    return result;
  }
  handleError(error: Error): CommunityTemplatesListResponse {
    throw error;
  }
}

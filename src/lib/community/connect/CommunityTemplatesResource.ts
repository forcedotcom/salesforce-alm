/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { UX } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { ConnectResource } from '../../connect/services/ConnectResource';
import { CommunityTemplatesListResponse } from '../defs/CommunityTemplatesListResponse';

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

  // eslint-disable-next-line @typescript-eslint/require-await
  async fetchRelativeConnectUrl(): Promise<string> {
    return '/connect/communities/templates';
  }
  // eslint-disable-next-line @typescript-eslint/require-await
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

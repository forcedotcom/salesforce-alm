/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConnectResource } from './ConnectResource';
import { Org } from '@salesforce/core/lib/org';
import { RequestInfo } from 'jsforce';
import { SfdxError } from '@salesforce/core';

/**
 * An executor which calls a connect api for the given org
 */
export class ConnectExecutor<T> {
  private connectService: ConnectResource<T>;
  private org: Org;

  constructor(connectService: ConnectResource<T>, org: Org) {
    this.connectService = connectService;
    this.org = org;
  }

  /**
   * Call the connect resource as defined by the given ConnectResource for the given org
   */
  public async callConnectApi(): Promise<T> {
    return this.org
      .getConnection()
      .request(await this.fetchRequestInfo())
      .then(result => this.connectService.handleSuccess(result))
      .catch(err => this.connectService.handleError(err));
  }

  public async fetchRequestInfo(): Promise<RequestInfo> {
    const connectUrl: string = encodeURI(await this.connectService.fetchRelativeConnectUrl());
    let method = this.connectService.getRequestMethod();
    if (method === 'GET') {
      return {
        url: connectUrl,
        method,
        body: null
      };
    } else if (method === 'POST') {
      return {
        url: connectUrl,
        method,
        body: await this.connectService.fetchPostParams()
      };
    } else {
      throw new SfdxError(`Unsupported method is given: ${method}`, 'UNSUPPORTED_OPERATION');
    }
  }
}

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JsonCollection } from '@salesforce/ts-types';

/**
 * Describe of a connect api resource
 * T - type of return type for success/failure
 */
export interface ConnectResource<T> {
  /**
   * Fetch the relative url of the connect end point
   */
  fetchRelativeConnectUrl(): Promise<string>;

  /**
   * 'GET' or 'POST'
   */
  getRequestMethod(): string;

  /**
   * This will be called only when this#getRequestMethod() is 'POST'
   * Return the post params in stringified version
   */
  fetchPostParams(): Promise<string>;

  /**
   * Called if the request is successful
   *
   * @param result - the result returned by the request
   */
  handleSuccess(result: JsonCollection): T;

  /**
   * Called if the request errored out
   *
   * @param error - the corresponding error
   */
  handleError(error: Error): T;
}

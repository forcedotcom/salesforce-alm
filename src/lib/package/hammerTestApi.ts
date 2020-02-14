/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node

// Local
const HAMMER_TEST = 'hammer-test';
const RESULT = 'result';

class HammerTestApi {
  // TODO: proper property typing
  [property: string]: any;

  constructor(org) {
    this.org = org;
  }

  /**
   * Makes a new ISV Hammer Request
   *
   * @param {string} packageVersionId
   * @param {string list} subscriberOrgIds
   * @param {datetime} scheduledDateTime
   * @param {boolean} isNextSalesforceVersion
   * @param {string} apexTestInterface
   *
   * @returns result structured as json data
   */
  async makeNewHammerRequest(
    apvIds,
    subOrgs,
    scheduledTime,
    isNextSalesforceVersion,
    isRunApexTests,
    apexTestInterface
  ) {
    const isvHammerRunRequest = {
      packageVersionIds: apvIds,
      subscriberOrgIds: subOrgs,
      scheduledDateTime: scheduledTime,
      isPreviewVersion: isNextSalesforceVersion,
      isExecuteApexTests: isRunApexTests,
      apexTestInterface: apexTestInterface
    };

    const result = this._calloutNewHammerRequest(isvHammerRunRequest);
    return result;
  }

  /**
   * Fetches statuses of existing hammerTest runs for a packageVersionId
   * @param {string} packageVersionId
   */
  async viewHammerRequests(packageVersionId) {
    let result;
    if (packageVersionId !== undefined) {
      result = this._calloutViewHammerRequests(packageVersionId);
    } else {
      result = this._calloutViewAllHammerRequests();
    }
    return result;
  }

  /**
   * Fetches statuses of existing hammerTest runs for a requestId
   * @param {string} requestId
   */
  async viewHammerTestResult(requestId) {
    const result = this._calloutViewHammerTestResult(requestId);
    return result;
  }

  async _calloutNewHammerRequest(isvHammerRunRequest) {
    return this.org.force.connectApiPost(this.org, `${HAMMER_TEST}`, isvHammerRunRequest);
  }

  async _calloutViewHammerRequests(packageVersionId) {
    const resource = `${HAMMER_TEST}/?packageVersionId=${packageVersionId}`;
    return this.org.force.connectApiGet(this.org, resource);
  }

  async _calloutViewAllHammerRequests() {
    const resource = `${HAMMER_TEST}`;
    return this.org.force.connectApiGet(this.org, resource);
  }

  async _calloutViewHammerTestResult(requestId) {
    return this.org.force.connectApiGet(this.org, `${HAMMER_TEST}/${RESULT}/${requestId}`);
  }
}

export = HammerTestApi;

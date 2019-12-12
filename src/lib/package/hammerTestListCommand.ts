/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const { Messages } = require('@salesforce/core');

// Local
import HammerTestBaseCommand = require('./hammerTestBaseCommand');
import logger = require('../core/logApi');
import hammerTestUtils = require('./hammerTestUtils');
import HammerTestApi = require('./hammerTestApi');

Messages.importMessagesDirectory(__dirname);
const messagesHammerTestList = Messages.loadMessages('salesforce-alm', 'package_hammertest_list');

class HammerTestListCommand extends HammerTestBaseCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    super();
    this.logger = logger.child('package:hammertest:list');
  }

  execute(context) {
    this.hammerTestApi = new HammerTestApi(context.org);

    const packageVersionId = context.flags.packageversionid;
    if (packageVersionId !== undefined) {
      hammerTestUtils.validateSubscriberPackageVersionId(packageVersionId);
      logger.debug(`APV ID: ${packageVersionId}`);
    } else {
      logger.debug(`APV ID: ${packageVersionId}; fetching all isv hammer requests`);
    }

    const result = this.hammerTestApi.viewHammerRequests(packageVersionId);
    return result;
  }

  /**
   * returns a human readable message for a cli output
   * @param result - the data representing the Package Version
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    const data = result.requests.map(req => ({
      requestId: req.requestId,
      status: req.status,
      createdBy: req.createdBy,
      createdDate: req.createdDate,
      isExecuteApexTests: req.isExecuteApexTests.toString(),
      isNextSalesforceVersion: req.isNextSalesforceVersion.toString(),
      apexTestInterface: req.apexTestInterface,
      lastModified: req.lastModified,
      lastModifiedBy: req.lastModifiedBy,
      scheduledDateTime: req.scheduledDateTime
    }));

    this.logger.table(data, {
      columns: [
        { key: 'requestId', label: 'RequestId' },
        { key: 'status', label: 'Status' },
        { key: 'createdBy', label: 'CreatedBy' },
        { key: 'createdDate', label: 'CreatedDate' },
        { key: 'isExecuteApexTests', label: 'IsExecuteApexTests' },
        { key: 'apexTestInterface', label: 'apexTestInterface' },
        { key: 'isNextSalesforceVersion', label: 'IsNextSalesforceVersion' },
        { key: 'lastModified', label: 'LastModified' },
        { key: 'lastModifiedBy', label: 'LastModifiedBy' },
        { key: 'scheduledDateTime', label: 'ScheduledDateTime' }
      ]
    });

    return messagesHammerTestList.getMessage('humanSuccess');
  }
}

export = HammerTestListCommand;

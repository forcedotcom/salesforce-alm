/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const { Messages, SfdxError } = require('@salesforce/core');

// Local
import logApi = require('../core/logApi');
import HammerTestBaseCommand = require('./hammerTestBaseCommand');
import hammerTestUtils = require('./hammerTestUtils');
import HammerTestApi = require('./hammerTestApi');

const logger = logApi.child('package:hammertest:run');
Messages.importMessagesDirectory(__dirname);
const messagesHammerTestRun = Messages.loadMessages('salesforce-alm', 'package_hammertest_run');

class HammerTestRunCommand extends HammerTestBaseCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    super();
    this.logger = logger.child('package:hammertest:run');
  }

  execute(context) {
    const allPackageVersionIds = hammerTestUtils.parseAllPackageVersionIds(context);
    this._validateSubscriberInfoPresent(context);
    const preview = this._validateAndGetPreviewValue(context);
    const scheduledDateTime = hammerTestUtils.validateAndGetScheduledRunDateTime(context.flags.scheduledrundatetime);
    const subscriberOrgIds = hammerTestUtils.parseSubscriberOrgIds(context);
    const runApexTests = this._validateAndGetApexTestsValue(context);
    const apexTestInterface = this._validateAndGetApexTestsInterfaceValue(context);

    // todo: we need an equivalent of empty check. this doesn't work
    if (subscriberOrgIds.length === 0) {
      throw SfdxError.create('salesforce-alm', 'package_hammertest_run', 'noSubscriberOrgIds', []);
    }

    this.hammerTestApi = new HammerTestApi(context.org);

    const isvHammerResult = this.hammerTestApi.makeNewHammerRequest(
      allPackageVersionIds,
      subscriberOrgIds,
      scheduledDateTime,
      preview,
      runApexTests,
      apexTestInterface
    );

    return isvHammerResult;
  }

  _validateSubscriberInfoPresent(context) {
    // subscriberorgs or subscriberfile is mandatory, but you can provide only one
    if (
      (!context.flags.subscriberorgs && !context.flags.subscriberfile) ||
      (context.flags.subscriberorgs && context.flags.subscriberfile)
    ) {
      throw SfdxError.create('salesforce-alm', 'package_hammertest_run', 'errorSubscriberRequiredFlags', []);
    }
  }

  _validateAndGetPreviewValue(context) {
    // if preview flag is included, scheduled date time must be provided
    if (context.flags.preview && !context.flags.scheduledrundatetime) {
      throw SfdxError.create('salesforce-alm', 'package_hammertest_run', 'errorPreviewDependencyFlags', []);
    } else if (context.flags.preview) {
      return context.flags.preview;
    }
    return false; // preview is false by default
  }

  _validateAndGetApexTestsValue(context) {
    if (context.flags.apextests) {
      return context.flags.apextests;
    }
    return false; // apextests is false by default
  }
  _validateAndGetApexTestsInterfaceValue(context) {
    if (context.flags.apextestinterface) {
      return context.flags.apextestinterface;
    }
    return null; // apextests is null by default
  }

  /**
   * returns a human readable message for a cli output
   * @param result - the data representing the Package Version
   * @returns {string}
   */
  getHumanSuccessMessage(result) {
    logger.debug(`isvHammerResult = ${result}`);
    if (!result) {
      return messagesHammerTestRun.getMessage('humanFailure');
    }

    if (result.status.toUpperCase() === 'REQUEST_FAILED') {
      this.logger.log(messagesHammerTestRun.getMessage('humanFailure'));
      this.logger.styledHeader(this.logger.color.blue(`Details: ${result.details}`));
    } else {
      this.logger.log(messagesHammerTestRun.getMessage('humanSuccess'));
      this.logger.styledHeader(this.logger.color.blue(`RequestId: ${result.requestId}`));
      this.logger.styledHeader(this.logger.color.blue(`Status: ${result.status}`));
      this.logger.styledHeader(this.logger.color.blue(`CreatedBy: ${result.createdBy}`));
      this.logger.styledHeader(this.logger.color.blue(`CreatedDate: ${result.createdDate}`));
      this.logger.styledHeader(this.logger.color.blue(`IsExecuteApexTests: ${result.isExecuteApexTests}`));
      this.logger.styledHeader(this.logger.color.blue(`ApexTestInterface: ${result.apexTestInterface}`));
      this.logger.styledHeader(this.logger.color.blue(`IsNextSalesforceVersion: ${result.isNextSalesforceVersion}`));
      this.logger.styledHeader(this.logger.color.blue(`LastModified: ${result.lastModified}`));
      this.logger.styledHeader(this.logger.color.blue(`LastModifiedBy: ${result.lastModifiedBy}`));
      this.logger.styledHeader(this.logger.color.blue(`ScheduledDateTime: ${result.scheduledDateTime}`));
      if (result.details) {
        this.logger.styledHeader(this.logger.color.blue(`Details: ${result.details}`));
      }
    }
    return '';
  }
}

export = HammerTestRunCommand;

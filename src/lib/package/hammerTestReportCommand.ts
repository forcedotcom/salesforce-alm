/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const { Messages } = require('@salesforce/core');

// Local
import logger = require('../core/logApi');
import HammerTestBaseCommand = require('./hammerTestBaseCommand');
import hammerTestUtils = require('./hammerTestUtils');
import HammerTestApi = require('./hammerTestApi');
import ts_types = require('@salesforce/ts-types');

Messages.importMessagesDirectory(__dirname);
const messagesHammerTestReport = Messages.loadMessages('salesforce-alm', 'package_hammertest_report');

class HammerTestReportCommand extends HammerTestBaseCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    super();
    this.logger = logger.child('package:hammertest:report');
  }

  execute(context) {
    this.hammerTestApi = new HammerTestApi(context.org);

    const requestId = context.flags.requestid;
    this.summary = context.flags.summary;
    hammerTestUtils.validateIsvHammerRequestId(requestId);

    const result = this.hammerTestApi.viewHammerTestResult(requestId);

    return result;
  }

  /**
   * returns a human readable message for a cli output
   * @param output - data representing results of Hammer Run Request
   * @returns {string}
   */
  getHumanSuccessMessage(output) {
    if (this.summary) {
      const data = output.results.map(res => ({
        subscriberOrgId: res.subscriberOrgId,
        status: res.status,
        lastModified: res.lastModified
      }));
      this._showTestReportSummary(data);
    } else {
      const data = output.results.map(res => ({
        subscriberOrgId: res.subscriberOrgId,
        status: res.status,
        lastModified: res.lastModified,
        pkgResult: res.pkgResult
      }));
      this._showTestReportInDetail(data);
    }

    return messagesHammerTestReport.getMessage('humanSuccess');
  }

  _showTestReportSummary(summaryData) {
    this.logger.table(summaryData, {
      columns: [
        { key: 'subscriberOrgId', label: 'SubscriberOrgId' },
        { key: 'status', label: 'Status' },
        { key: 'message', label: 'Message' },
        { key: 'lastModified', label: 'LastModified' }
      ]
    });
  }

  _showTestReportInDetail(data) {
    for (let i = 0; i < data.length; i++) {
      if (i !== 0) {
        this.logger.styledHeader('');
        this.logger.styledHeader('');
      }
      this.logger.styledHeader(
        this.logger.color.underline(this.logger.color.blue(`SubscriberOrgId: ${data[i].subscriberOrgId}`))
      );
      this.logger.styledHeader(this.logger.color.blue(`Status: ${data[i].status}`));
      this.logger.styledHeader(this.logger.color.blue(`LastModified: ${data[i].lastModified}`));
      this._showPkgResultTable(data[i].pkgResult);
    }
  }

  _showPkgResultTable(pkgResult) {
    for (let i = 0; i < pkgResult.length; i++) {
      this.logger.styledHeader('');
      this.logger.styledHeader(this.logger.color.blue(`PackageVersionId: ${pkgResult[i].packageVersionId}`));
      this.logger.styledHeader(this.logger.color.blue(`OrderIndex: ${pkgResult[i].index}`));
      this.logger.styledHeader(this.logger.color.blue(`Conclusion: ${ts_types.asString(pkgResult[i].conclusion)}`));
      this.logger.styledHeader(this.logger.color.blue(`Message: ${ts_types.asString(pkgResult[i].userMessage)}`));
      this._showApexTestFailuresTable(pkgResult[i].apexTestFailures);
    }
  }

  _showApexTestFailuresTable(apexTestFailures) {
    const tfData = apexTestFailures.map(req => ({
      namespace: req.namespace,
      className: req.className,
      methodName: req.methodName,
      message: req.message,
      stackTrace: req.stackTrace,
      timeTaken: req.timeTaken,
      classId: req.classId,
      canSeeAllData: req.canSeeAllData,
      apiVersion: req.apiVersion
    }));
    if (tfData.length > 0) {
      this.logger.styledHeader(this.logger.color.red(messagesHammerTestReport.getMessage('packageTestFailures')));
      this.logger.table(tfData, {
        columns: [
          { key: 'namespace', label: 'Namespace' },
          { key: 'className', label: 'ClassName' },
          { key: 'methodName', label: 'MethodName' },
          { key: 'message', label: 'Message' },
          { key: 'stackTrace', label: 'StackTrace' },
          { key: 'timeTaken', label: 'TimeTaken' },
          { key: 'classId', label: 'ClassId' },
          { key: 'canSeeAllData', label: 'CanSeeAllData' },
          { key: 'apiVersion', label: 'ApiVersion' }
        ]
      });
    } else {
      this.logger.styledHeader(this.logger.color.red(messagesHammerTestReport.getMessage('noPackageTestFailures')));
    }
  }
}

export = HammerTestReportCommand;

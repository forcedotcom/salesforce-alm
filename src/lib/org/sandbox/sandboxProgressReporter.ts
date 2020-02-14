/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SandboxProcessObject, SandboxUserAuthResponse } from './sandboxOrgApi';
import { UX } from '@salesforce/command';
import { Duration } from '@salesforce/kit';

export class SandboxProgressReporter {
  public static logSandboxProcessResult(
    ux: UX,
    processRecord: SandboxProcessObject,
    sandboxRes: SandboxUserAuthResponse
  ): void {
    if (processRecord) {
      let resultMsg = `Sandbox ${processRecord.SandboxName}(${processRecord.Id}) is ready for use.`;
      ux.log(resultMsg);

      const data = [
        { key: 'Id', value: processRecord.Id },
        { key: 'SandboxName', value: processRecord.SandboxName },
        { key: 'Status', value: processRecord.Status },
        { key: 'CopyProgress', value: processRecord.CopyProgress },
        { key: 'Description', value: processRecord.Description },
        { key: 'LicenseType', value: processRecord.LicenseType },
        { key: 'SandboxInfoId', value: processRecord.SandboxInfoId },
        { key: 'SourceId', value: processRecord.SourceId },
        { key: 'SandboxOrg', value: processRecord.SandboxOrganization },
        { key: 'Created Date', value: processRecord.CreatedDate },
        { key: 'ApexClassId', value: processRecord.ApexClassId },
        { key: 'Authorized Sandbox Username', value: sandboxRes.authUserName }
      ];

      ux.styledHeader('Sandbox Org Creation Status');
      ux.table(data, {
        columns: [
          { key: 'key', label: 'Name' },
          { key: 'value', label: 'Value' }
        ]
      });
    }
  }

  public static logSandboxProgress(
    ux: UX,
    processRecord: SandboxProcessObject,
    pollIntervalInSecond: number,
    retriesLeft: number,
    waitingOnAuth: boolean
  ) {
    let progressMsg: string;
    let waitTimeInSec: number = retriesLeft * pollIntervalInSecond;

    let waitTime: string = SandboxProgressReporter.getSecondsToHms(waitTimeInSec);
    let waitTimeMsg: string = `Sleeping ${pollIntervalInSecond} seconds. Will wait ${waitTime} more before timing out.`;
    let sandboxIdentifierMsg: string = `${processRecord.SandboxName}(${processRecord.Id})`;
    let waitingOnAuthMessage: string = waitingOnAuth ? ', waiting on JWT auth' : '';
    let completionMessage: string = `(${processRecord.CopyProgress}% completed${waitingOnAuthMessage})`;

    progressMsg = `Sandbox request ${sandboxIdentifierMsg} is ${processRecord.Status} ${completionMessage}. ${waitTimeMsg}`;
    ux.log(progressMsg);
  }

  static getSecondsToHms(waitTimeInSec: number): string {
    let h = Duration.hours(Math.floor(waitTimeInSec / 3600));
    let m = Duration.minutes(Math.floor((waitTimeInSec % 3600) / 60));
    let s = Duration.seconds(Math.floor(waitTimeInSec % 60));

    let hDisplay: string = h.hours > 0 ? h.toString() + ' ' : '';
    let mDisplay: string = m.minutes > 0 ? m.toString() + ' ' : '';
    let sDisplay: string = s.seconds > 0 ? s.toString() : '';

    return (hDisplay + mDisplay + sDisplay).trim();
  }
}

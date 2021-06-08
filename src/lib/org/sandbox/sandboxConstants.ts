/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Duration } from '@salesforce/kit';

export const SANDBOXDEF_SRC_SANDBOXNAME = 'SourceSandboxName';

export class SandboxConstants {
  static readonly DEFAULT_MAX_RETRIES: number = 0;
  static DEFAULT_POLL_INTERVAL: Duration = Duration.seconds(30);
  static readonly SANDBOX_INCOMPLETE_EXCEPTION_MESSAGE = 'INVALID_STATUS';
}

export class SandboxEventNames {
  static readonly EVENT_STATUS: string = 'status';
  static readonly EVENT_ASYNCRESULT: string = 'asyncResult';
  static readonly EVENT_RESULT: string = 'result';
  static readonly EVENT_CLIENTID_NOTSUPPORT: string = 'clientIdNotSupported';
}

export enum SandboxStatus {
  Pending = 'Pending',
  PendingRemote = 'Pending Remote Creation',
  Processing = 'Processing',
  Completed = 'Completed',
  Activating = 'Activating',
}

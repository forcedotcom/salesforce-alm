/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Duration } from '@salesforce/kit';

export const SANDBOXDEF_SRC_SANDBOXNAME: string = 'SourceSandboxName';

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
  Activating = 'Activating'
}

export enum SandboxType {
  DEVELOPER = 'DEVELOPER',
  FULL = 'FULL',
  LDPS = 'ADVANCED_DEV'
}

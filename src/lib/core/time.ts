/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Helper class to convert cli wait times between minutes and milliseconds.
 */
export class Time {
  public static readonly MILLI_IN_SECONDS: number = 1000;
  public static readonly SECONDS_IN_MINUTE: number = 60;

  public readonly minutes: number;

  constructor(minutes: number) {
    this.minutes = minutes;
  }

  get seconds(): number {
    return this.minutes * Time.SECONDS_IN_MINUTE;
  }

  get milliseconds(): number {
    return this.seconds * Time.MILLI_IN_SECONDS;
  }
}

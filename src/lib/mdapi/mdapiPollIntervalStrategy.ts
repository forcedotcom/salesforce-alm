/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const _small = [0.5];
const _medium = [0.5];
const _large = [0.5];

class MdapiPollIntervalStrategy {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  constructor(sourceElementsToUpsert, sourceElementsToDelete) {
    const totalElementsToPush = sourceElementsToUpsert.length + sourceElementsToDelete.length;
    if (totalElementsToPush <= 10) {
      this.intervals = _small;
    } else if (totalElementsToPush <= 50) {
      this.intervals = _medium;
    } else {
      this.intervals = _large;
    }
  }

  /**
   * Returns an appropriate polling interval (in milliseconds) for the given iteration.
   */
  getInterval(iteration) {
    let index = iteration - 1;
    if (index < 0) {
      index = 0;
    }
    let intervalInSeconds;
    if (index < this.intervals.length) {
      intervalInSeconds = this.intervals[index];
    } else {
      intervalInSeconds = this.intervals[this.intervals.length - 1];
    }
    return intervalInSeconds * 1000;
  }
}

export = MdapiPollIntervalStrategy;

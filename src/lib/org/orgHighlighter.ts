/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as _ from 'lodash';
import chalk, { Chalk } from 'chalk';

/**
 * Class for decorating org status and connected status in the org:list and display commands.
 */
class OrgDecorator {
  private chalk: Chalk;

  constructor(private colorEnabled: boolean = true, chalkOverride?) {
    this.chalk = chalkOverride || chalk;
  }

  /**
   * helper to decorate the org status
   * @param {object} val - org metadata
   */
  decorateStatus(val: object) {
    if (this.colorEnabled) {
      this.decorateAttribute(val, 'status', 'Active');
    }
  }

  /**
   * helper to decorate the org connectedStatus
   * @param {object} val - org metadata
   */
  decorateConnectedStatus(val) {
    if (val.connectedStatus === 'Unknown') {
      return val;
    }
    if (this.colorEnabled) {
      return this.decorateAttribute(val, 'connectedStatus', 'Connected');
    }
  }

  /**
   * Helper to decorate attributes
   * @param {object} val - object containing the value to decorate
   * @param {string} attribute - the name of the attribute to decorate
   * @param {string} greenStatus - the name of state that should report green.
   * @private
   */
  private decorateAttribute(val: object, attribute: string, greenStatus: string) {
    if (val && !_.isNil(_.get(val, attribute))) {
      switch (_.get(val, attribute)) {
        case greenStatus:
          _.set(val, attribute, this.chalk.green(_.get(val, attribute)));
          break;
        default:
          _.set(val, attribute, this.chalk.red(_.get(val, attribute)));
          break;
      }
    }
    return val;
  }
}

export = OrgDecorator;

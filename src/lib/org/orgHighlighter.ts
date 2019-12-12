/**
 * Copyright, 1999-2017, salesforce.com
 * All Rights Reserved
 * Company Confidential
 */

import * as _ from 'lodash';

/**
 * Helper to decorate attributes
 * @param {object} val - object containing the value to decorate
 * @param {string} attribute - the name of the attribute to decorate
 * @param {string} greenStatus - the name of state that should report green.
 * @private
 */
const _decorateStatus = function(val, attribute, greenStatus) {
  if (val && !_.isNil(_.get(val, attribute))) {
    switch (_.get(val, attribute)) {
      case greenStatus:
        _.set(val, attribute, this.logger.color.green(_.get(val, attribute)));
        break;
      default:
        _.set(val, attribute, this.logger.color.red(_.get(val, attribute)));
        break;
    }
  }
  return val;
};

/**
 * Class for decorating org status and connected status in the org:list and display commands.
 */
class OrgDecorator {
  public logger;

  /**
   * constructor
   * @param {object} logger - if falsely then no highlighting occurs.
   */
  constructor(logger?) {
    this.logger = logger || {
      color: { red: _val => _val, green: _val => _val }
    };
  }
  /**
   * helper to decorate the org status
   * @param {object} val - org metadata
   */
  decorateStatus(val) {
    return _decorateStatus.call(this, val, 'status', 'Active');
  }

  /**
   * helper to decorate the org connectedStatus
   * @param {object} val - org metadata
   */
  decorateConnectedStatus(val) {
    if (val.connectedStatus === 'Unknown') {
      return val;
    }
    return _decorateStatus.call(this, val, 'connectedStatus', 'Connected');
  }
}

export = OrgDecorator;

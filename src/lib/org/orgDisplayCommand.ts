/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// Thirdparty
import * as _ from 'lodash';

// Local
import logger = require('../core/logApi');
import Messages = require('../messages');
const messages = Messages();
import OrgDescribeApi = require('./orgDescribeApi');
import OrgDecorator = require('./orgHighlighter');

/**
 * Provides the user with the connection details for a specified org or the default workspace org.
 */
class OrgDisplayCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.logger = logger.child('orgDisplayCommand');
    this.describeApi = new OrgDescribeApi();
    this.orgDecorator = new OrgDecorator(this.logger.humanConsumable);
  }

  /**
   * Executes this command
   * @param context - the cli context
   * @returns {Promise}
   */
  execute(context) {
    return this.describeApi.describeOrg(context.org).then(result => {
      // If there are no flags or if there are flags but verbose is falsy
      if (_.isNil(context.flags) || !context.flags.verbose) {
        delete result.sfdxAuthUrl;
      }
      return result;
    });
  }
  /**
   * Returns a success message that's human readable.
   * @param orgDesc - the org description object returned from execute.
   */
  getHumanSuccessMessage(orgDesc) {
    this.log(messages.getMessage('displayCommandHumanSuccess'), orgDesc, [
      { key: 'key', label: 'Key' },
      { key: 'value', label: 'Value' }
    ]);

    return '';
  }

  /**
   * Log some test information to the console, but only log when json is not
   * specified. Otherwise the only output should be in json format which will
   * print to the console when the command returns on the command handler.
   * @param {string} header The header for the table OR a string if no table
   *    (object) is specified.
   * @param {object|array} data The data to display in the table. Data will be
   *    converted to an array if an object is passed in.
   * @param {array} columns An array of column information, such as key, label,
   * and formatter.
   */
  log(header, data, columns) {
    if (!this.json) {
      if (util.isNullOrUndefined(data)) {
        this.logger.log(header);
      } else {
        let rows = data;
        this.orgDecorator.decorateStatus(data);
        this.orgDecorator.decorateConnectedStatus(data);

        // Tables require arrays, so convert objects to arrays
        if (util.isObject(data) && !util.isArray(data)) {
          rows = _.chain(data)
            .map((value, key) => ({
              key: _.map(_.kebabCase(key).split('-'), _.capitalize).join(' '),
              value
            }))
            .sortBy('key')
            .value();
        }

        rows = _.filter(rows, row => !_.isNil(row.value));
        rows = _.map(rows, row => ({
          key: row.key,
          value: row.value.toString()
        }));

        this.logger.styledHeader(this.logger.color.blue(header));
        this.logger.table(rows, { columns });
      }
    }
  }
}

export = OrgDisplayCommand;

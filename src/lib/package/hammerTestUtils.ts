/*
 * Copyright, 1999-2016, salesforce.com
 * All Rights Reserved
 * Company Confidential
 */

// Node
import * as fs from 'fs';
import * as os from 'os';
import * as moment from 'moment';

const { SfdxError } = require('@salesforce/core');

const ID_REGISTRY = [
  {
    prefix: '04t',
    label: 'Subscriber Package Version Id'
  },
  {
    prefix: '00D',
    label: 'Subscriber Organization Id'
  },
  {
    prefix: '0TW',
    label: 'ISV Hammer Request Id'
  }
];

export = {
  BY_LABEL: (function() {
    const byLabels: any = {};
    ID_REGISTRY.forEach(id => {
      byLabels[id.label.replace(/ /g, '_').toUpperCase()] = id;
    });
    return byLabels;
  })(),

  _cleanUpId(label, id, errorLabelName): string {
    if (!id) {
      return '';
    }
    id = id.trim();
    if (!this.validateId(label, id)) {
      throw SfdxError.create('salesforce-alm', 'package_hammertest', errorLabelName, [id]);
    }
    return id;
  },

  validateId(idObj, value): boolean {
    if (!value || (value.length !== 15 && value.length !== 18)) {
      return false;
    }
    return Array.isArray(idObj) ? idObj.some(e => value.startsWith(e.prefix)) : value.startsWith(idObj.prefix);
  },

  parseAllPackageVersionIds(context): string[] {
    const packageVersionCsvList = context.flags.packageversionids.split(',');
    return packageVersionCsvList.map(id => this.cleanUpAllPackageVersionId(id));
  },

  parseSubscriberOrgIds(context): string[] {
    let subscriberCsvList;
    if (context.flags.subscriberorgs) {
      subscriberCsvList = context.flags.subscriberorgs.split(',');
    } else if (context.flags.subscriberfile) {
      subscriberCsvList = this.getSubscriberOrgsFromFile(context.flags.subscriberfile);
    }

    return subscriberCsvList.map(id => this.cleanUpSubscriberOrgId(id));
  },

  validateAndGetScheduledRunDateTime(scheduledDateTime: string): string {
    const format = 'YYYY-MM-DD HH:mm:ss'; // todo: this time needs to be in GMT
    if (!scheduledDateTime) {
      return moment().format(format);
    }
    if (moment(scheduledDateTime, format, true).isValid()) {
      return scheduledDateTime;
    }
    throw SfdxError.create('salesforce-alm', 'package_hammertest', 'invalidScheduledDate', [scheduledDateTime]);
  },

  validateSubscriberPackageVersionId(apvId: string): void {
    if (!this.validateId(this.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, apvId)) {
      throw SfdxError.create('salesforce-alm', 'package_hammertest', 'invalidPackageVersionId', [apvId]);
    }
  },

  validateIsvHammerRequestId(requestId: string): void {
    if (!this.validateId(this.BY_LABEL.ISV_HAMMER_REQUEST_ID, requestId)) {
      throw SfdxError.create('salesforce-alm', 'package_hammertest', 'invalidIdOrRequest', [requestId]);
    }
  },

  /**
   * Validate and clean up a given string as an allPackageVersionId
   * @param {string} allPackageVersionId
   * @returns {string}
   */
  cleanUpAllPackageVersionId(allPackageVersionId: string): string {
    return this._cleanUpId(this.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, allPackageVersionId, 'invalidPackageVersionId');
  },

  /**
   * Validate and clean up a given string as an orgId
   * @param {string} subscriberOrg
   * @returns {string}
   */
  cleanUpSubscriberOrgId(subscriberOrg: string): string {
    return this._cleanUpId(this.BY_LABEL.SUBSCRIBER_ORGANIZATION_ID, subscriberOrg, 'invalidSubscriberOrgId');
  },

  getSubscriberOrgsFromFile(subscriberFile: string): string[] {
    if (!fs.existsSync(subscriberFile)) {
      throw SfdxError.create('salesforce-alm', 'package_hammertest', 'pathDoesNotExist', [subscriberFile]);
    }
    const fileContent = fs.readFileSync(subscriberFile, 'utf8');

    if (!fileContent) {
      throw SfdxError.create('salesforce-alm', 'package_hammertest', 'emptyFile', [subscriberFile]);
    }

    return fileContent.split(os.EOL).filter(id => id.length > 0);
  }
};

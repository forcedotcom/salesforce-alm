/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import Messages = require('../messages');
const messages = Messages();
import pkgUtils = require('./packageUtils');

class PackageVersionUpdateCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  constructor() {
    this.error = null;
  }

  /**
   * Convert the list of command line options to a JSON object that can be used to update an Package2Version entity.
   *
   * @param context
   * @returns {{Id: (string|string|string), Name: (string|string), Description: (string|string), Branch: (string|string), Tag: (string|string), IsReleased: (boolean}}
   * @private
   */
  _updatePackageVersionRequestFromContext(context) {
    const values = {};

    const mapping = {
      package: 'Id',
      installationkey: 'InstallKey',
      versionname: 'Name',
      versiondescription: 'Description',
    };

    Object.keys(context.flagsConfig).forEach((flag) => {
      if (context.flags[flag]) {
        const apiName = mapping[flag] ? mapping[flag] : flag.charAt(0).toUpperCase() + flag.slice(1);
        values[apiName] = context.flags[flag];
      }
    });

    return values;
  }

  execute(context) {
    return this._execute(context).catch((err) => {
      // TODO
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  async _execute(context) {
    this.org = context.org;
    this.force = context.org.force;

    const packageVersionId = pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);

    // ID can be an 04t or 05i
    pkgUtils.validateId(
      [pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, pkgUtils.BY_LABEL.PACKAGE_VERSION_ID],
      packageVersionId
    );

    // lookup the 05i ID, if needed
    context.flags.package = await pkgUtils.getPackageVersionId(packageVersionId, this.force, this.org);

    const request = this._updatePackageVersionRequestFromContext(context);

    return this.force.toolingUpdate(this.org, 'Package2Version', request).then(async (updateResult) => {
      if (!updateResult.success) {
        throw new Error(updateResult.errors);
      }
      // Use the 04t ID for the success messgae
      updateResult.id = await pkgUtils.getSubscriberPackageVersionId(packageVersionId, this.force, this.org);
      return updateResult;
    });
  }

  getHumanSuccessMessage(result) {
    return messages.getMessage('humanSuccess', [result.id], 'package_version_update');
  }
}
export = PackageVersionUpdateCommand;

/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import * as _ from 'lodash';
import pkgUtils = require('../package/packageUtils');

import Messages = require('../messages');
const messages = Messages();

class PackageVersionPromoteCommand {
  // TODO: proper property typing
  [property: string]: any;

  constructor() {
    this.error = null;
  }

  execute(context) {
    return this._execute(context).catch(err => {
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  async _execute(context) {
    this.org = context.org;
    this.force = context.org.force;

    let packageId = pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);

    // if no alias found, set the package id as the cli arg.
    if (!packageId) {
      packageId = context.flags.package;
    }
    // ID can be 04t or 05i
    pkgUtils.validateId(
      [pkgUtils.BY_LABEL.SUBSCRIBER_PACKAGE_VERSION_ID, pkgUtils.BY_LABEL.PACKAGE_VERSION_ID],
      packageId
    );

    // lookup the 05i ID, if needed
    packageId = await pkgUtils.getPackageVersionId(packageId, this.force, this.org);

    const request: any = {};
    request.IsReleased = true;
    request.Id = packageId;

    return this.force
      .toolingUpdate(this.org, 'Package2Version', request)
      .then(async updateResult => {
        if (!updateResult.success) {
          throw new Error(updateResult.errors);
        }
        // return the 04t in the success msg
        updateResult.id = await pkgUtils.getSubscriberPackageVersionId(packageId, this.force, this.org);
        return updateResult;
      })
      .catch(err => {
        if (err.name === 'DUPLICATE_VALUE' && err.message.includes('previously released')) {
          err['message'] = messages.getMessage('previouslyReleasedMessage', [], 'package_version_promote');
          err['action'] = messages.getMessage('previouslyReleasedAction', [], 'package_version_promote');
        }
        throw err;
      });
  }

  getHumanSuccessMessage(result) {
    return messages.getMessage('humanSuccess', [result.id], 'package_version_promote');
  }
}
export = PackageVersionPromoteCommand;

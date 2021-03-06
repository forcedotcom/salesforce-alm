/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import logger = require('../core/logApi');
import Messages = require('../messages');
const messages = Messages();
import pkgUtils = require('./packageUtils');

class PackageUpdateCommand {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  constructor() {
    this.logger = logger.child('package:update');
  }

  execute(context) {
    return this._execute(context).catch((err) => {
      // TODO:
      // until package2 is GA, wrap perm-based errors w/ 'contact sfdc' action (REMOVE once package2 is GA'd)
      err = pkgUtils.massageErrorMessage(err);
      throw pkgUtils.applyErrorAction(err);
    });
  }

  _execute(context) {
    this.org = context.org;
    this.force = context.org.force;

    const packageId = pkgUtils.getPackageIdFromAlias(context.flags.package, this.force);
    pkgUtils.validateId(pkgUtils.BY_LABEL.PACKAGE_ID, packageId);

    const request: any = {};
    request.Id = packageId;
    if (context.flags.name) {
      request.Name = context.flags.name;
    }
    if (context.flags.description) {
      request.Description = context.flags.description;
    }
    if (context.flags.errornotificationusername) {
      request.PackageErrorUsername = context.flags.errornotificationusername;
    }

    return this.force.toolingUpdate(this.org, 'Package2', request).then((updateResult) => {
      if (!updateResult.success) {
        throw new Error(updateResult.errors);
      }
      return updateResult;
    });
  }

  getHumanSuccessMessage(result) {
    return messages.getMessage('humanSuccess', [result.id], 'package_update');
  }
}

export = PackageUpdateCommand;

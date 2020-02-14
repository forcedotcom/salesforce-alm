/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// Local
import logger = require('../core/logApi');
import messages = require('../messages');

const Package1VersionListApi = function(org) {
  this.releaseOrg = org;
  this.force = this.releaseOrg.force;
  this.messages = messages(this.force.config.getLocale());
  this.logger = logger.child('Package1VersionListApi');
};

/**
 * Lists package versions available in dev org. If package ID is supplied, only list versions of that package,
 *  otherwise, list all package versions
 * @param metadataPackageId: optional, if present ID of package to list versions for (starts with 033)
 * @returns Array of package version results
 */
Package1VersionListApi.prototype.list = function(metadataPackageId) {
  const selectClause =
    'SELECT Id,MetadataPackageId,Name,ReleaseState,MajorVersion,MinorVersion,PatchVersion,BuildNumber FROM MetadataPackageVersion';

  const whereClause = util.isNullOrUndefined(metadataPackageId)
    ? ''
    : ` WHERE MetadataPackageId = '${metadataPackageId}'`;

  const orderByClause = ' ORDER BY MetadataPackageId, MajorVersion, MinorVersion, PatchVersion, BuildNumber';

  const query = `${selectClause}${whereClause}${orderByClause}`;

  return this.force.toolingQuery(this.releaseOrg, query).then(queryResult => {
    const results = [];
    const records = queryResult.records;
    if (!util.isNullOrUndefined(records)) {
      for (let i = 0; i < records.length; i++) {
        const record = queryResult.records[i];
        // TODO: In 208, will add package description
        results.push({
          MetadataPackageVersionId: record.Id,
          MetadataPackageId: record.MetadataPackageId,
          Name: record.Name,
          ReleaseState: record.ReleaseState,
          Version: `${record.MajorVersion}.${record.MinorVersion}.${record.PatchVersion}`,
          BuildNumber: record.BuildNumber
        });
      }
    }
    return results;
  });
};

export = Package1VersionListApi;

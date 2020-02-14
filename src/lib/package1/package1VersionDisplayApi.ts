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

const Package1VersionDisplayApi = function(org) {
  this.releaseOrg = org;
  this.force = this.releaseOrg.force;
  this.messages = messages();
  this.logger = logger.child('Package1VersionListApi');
};

/**
 * Displays information on specified package version available in dev org.
 * @param metadataPackageVersionId: Package version ID to display information for (starts with 04t)
 * @returns Array of package version results (should be length 1)
 */
Package1VersionDisplayApi.prototype.display = function(metadataPackageVersionId) {
  const selectClause =
    'SELECT Id,MetadataPackageId,Name,ReleaseState,MajorVersion,MinorVersion,PatchVersion,BuildNumber FROM MetadataPackageVersion';

  const whereClause = ` WHERE id = '${metadataPackageVersionId}'`;

  const query = `${selectClause}${whereClause}`;

  return this.force.toolingQuery(this.releaseOrg, query).then(queryResult => {
    const results = [];
    const records = queryResult.records;
    if (!util.isNullOrUndefined(records)) {
      for (let i = 0; i < records.length; i++) {
        const record = queryResult.records[i];
        // TODO: In 208, will add package description, amongst other things.
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

export = Package1VersionDisplayApi;

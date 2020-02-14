/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Org } from '@salesforce/core/lib/org';
import { Query, QueryResult } from 'jsforce';
import { CommunityInfo } from '../defs/CommunityInfo';

/**
 * Helper services for Communities
 */
export class CommunitiesServices {
  /**
   * Get community name from the given id
   *
   * @param org - the org to query
   * @param name - the given community name
   *
   * @returns - the community id for the given name
   */
  public static async fetchCommunityInfoFromName(org: Org, name: string): Promise<CommunityInfo> {
    if (!name) {
      return Promise.resolve(undefined);
    }
    const result: QueryResult<any> = await CommunitiesServices.runQuery(
      org,
      `SELECT Id, Status FROM NETWORK WHERE NAME = '${name}'`
    );
    if (result.totalSize > 0) {
      let record = result.records[0];
      return <CommunityInfo>{
        name: name,
        id: record['Id'],
        status: record['Status']
      };
    }
  }

  public static runQuery<T>(org: Org, query: string): Query<QueryResult<T>> {
    if (!query) {
      return;
    }
    return org.getConnection().query(query);
  }
}

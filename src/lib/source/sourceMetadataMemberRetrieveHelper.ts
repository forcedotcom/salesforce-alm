/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// Thirdparty
import * as BBPromise from 'bluebird';

// Local
import MdapiPackage = require('./mdapiPackage');
import { MetadataTypeFactory } from './metadataTypeFactory';
import { ForceIgnore } from './forceIgnore';
import * as almError from '../core/almError';
import srcDevUtil = require('../core/srcDevUtil');
import logger = require('../core/logApi');
import Messages = require('../../lib/messages');
import { getRevisionFieldName } from './sourceUtil';
const messages = Messages();


/**
 * private helper to ensure the revision is a valid int.
 * @param {number} revision - the revision number
 * @returns {number} revision as a primitive integer
 * @private
 */
const _parseRevisionIntOrZero = function(revision) {
  let localRev = 0;
  if (srcDevUtil.isInt(revision)) {
    localRev = parseInt(revision);
  }

  return localRev;
};

/**
 * Helper that checks if the md item was set to obsolete in the org and returns true if so
 * @param mdApiItem
 * @returns {boolean} true - if the item is obsolete and should not be part of the md package
 * @private
 */
const _shouldExcludeFromMetadataPackage = function(mdApiItem, obsoleteNames, metadataRegistry, forceIgnore) {
  const mdFullName = mdApiItem.fullName;

  if (mdApiItem.isNameObsolete) {
    obsoleteNames.push({ fullName: mdFullName, type: mdApiItem.type });
    return true;
  }

  // check if the entity is a supported type
  if (!metadataRegistry.isSupported(mdApiItem.type)) {
    return true;
  }

  // if user wants to ignore a permissionset with fullname abc then we check if forceignore accepts abc.permissionset
  const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(mdApiItem.type, metadataRegistry);
  if (metadataType) {
    const filename = `${mdFullName}.${metadataType.getExt()}`;
    if (forceIgnore.denies(filename)) {
      return true;
    }
  }

  return false;
};

/**
 * Class used to derive changed org metadata.
 */
class SourceMetadataMemberRetrieveHelper {
  // TODO: proper property typing
  [property: string]: any;

  constructor(metadataRegistry) {
    this.metadataRegistry = metadataRegistry;
    this.scratchOrg = metadataRegistry.org;
    this.force = this.scratchOrg.force;
    this.forceIgnore = new ForceIgnore();
    this.logger = logger.child('SourceMetadataMemberRetrieveHelper');
  }

  /**
   * returns the last edit revision count on the scratch org.
   * @returns {BBPromise}
   */
  // TODO: We should be able to get this when we are querying the SourceMember initially.
  getLatestSourceRevisionCount() {
    const query = `SELECT MAX(${getRevisionFieldName()}) maxRev from SourceMember`;
    return this.force.toolingQuery(this.scratchOrg, query).then(result => {
      if (!util.isNullOrUndefined(result) && result.records.length > 0) {
        return BBPromise.resolve(result.records[0].maxRev);
      }
      return BBPromise.reject(almError('invalidResponseFromQuery', [query]));
    });
  }

  getRevisionNums(members: string[] = []): Promise<string[]> {
    if (!members.length) return BBPromise.resolve([]);
    const membersString = members.map(m => `'${m}'`).join(',');
    const query = `SELECT RevisionNum from SourceMember WHERE MemberName in (${membersString})`;
    return this.force.toolingQuery(this.scratchOrg, query).then(result => {
      if (!util.isNullOrUndefined(result) && result.records.length > 0) {
        return BBPromise.resolve(result.records.map(r => r.RevisionNum));
      }
      return BBPromise.reject(almError('invalidResponseFromQuery', [query]));
    });
  }

  getAllMemberNames(): Promise<string[]> {
    const query = `SELECT MemberName from SourceMember`;
    return this.force.toolingQuery(this.scratchOrg, query).then(result => {
      if (!util.isNullOrUndefined(result) && result.records.length > 0) {
        return BBPromise.resolve(result.records.map(r => r.MemberName));
      }
      return BBPromise.reject(almError('invalidResponseFromQuery', [query]));
    });
  }

  shouldAddMember(mdApiItem, obsoleteNames) {
    return mdApiItem !== null &&
      !_shouldExcludeFromMetadataPackage.call(
        this,
        mdApiItem,
        obsoleteNames,
        this.metadataRegistry,
        this.forceIgnore
      );
  }

  /**
   * gets all source metadata revisions from the server from <fromRevision>.
   * @param {number} fromRevision - get all changes after this revision number
   * @returns
   * "Package": {
   *   "$": {
   *     "xmlns": "http://soap.sforce.com/2006/04/metadata"
   *   },
   *   "types": [
   *     {
   *       "name": "ApexClass",
   *       "members": [...]
   *     },
   *     ...
   *   ],
   *   "version": 38
   *}
   */
  getRevisionsAsPackage(fromRevision, obsoleteNames?) {
    const localFromRevision = _parseRevisionIntOrZero(fromRevision);
    const mdPackage = new MdapiPackage();
    const revisionFieldName = getRevisionFieldName();

    const whereClause = { [revisionFieldName]: { $gt: localFromRevision } };

    return this.force
      .toolingFind(this.scratchOrg, 'SourceMember', whereClause, [
        'MemberIdOrName',
        revisionFieldName,
        'MemberType',
        'MemberName',
        'IsNameObsolete'
      ])
      .then(results => {
        const parsePromises = results.map(sourceMember => {
          const memberType = sourceMember.MemberType;
          const memberName = sourceMember.MemberName;

          if (util.isNullOrUndefined(memberType) || util.isNullOrUndefined(memberName)) {
            throw almError('fullNameIsRequired');
          }

          const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(memberType, this.metadataRegistry);
          if (metadataType) {
            return metadataType.parseSourceMemberForMetadataRetrieve(
              sourceMember.MemberName,
              sourceMember.MemberType,
              sourceMember.IsNameObsolete
            );
          } else {
            this.logger.log(messages.getMessage('metadataTypeNotSupported', [memberType, memberType]));
            return null;
          }

        });
        return BBPromise.all(parsePromises);
      })
      .then(promisedResults => {
        promisedResults.forEach(mdApiItem => {
          if (this.shouldAddMember(mdApiItem, obsoleteNames)) {
            mdPackage.addMember(mdApiItem.fullName, mdApiItem.type);
          }
        });
        return mdPackage;
      });
  }
}

export = SourceMetadataMemberRetrieveHelper;

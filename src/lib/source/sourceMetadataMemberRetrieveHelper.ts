/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import MdapiPackage = require('./mdapiPackage');
import { MetadataTypeFactory } from './metadataTypeFactory';
import { ForceIgnore } from '@salesforce/source-deploy-retrieve/lib/src/metadata-registry/forceIgnore';
import * as almError from '../core/almError';
import logger = require('../core/logApi');
import Messages = require('../../lib/messages');
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import MetadataRegistry = require('./metadataRegistry');
import { ChangeElement, RemoteSourceTrackingService } from './remoteSourceTrackingService';
import { NonDecomposedElementsIndex } from './nonDecomposedElementsIndex';
import { SfdxProject } from '@salesforce/core';
const messages = Messages();

interface MdapiPackages {
  [key: string]: MdapiPackage;
}

interface MdApiItem {
  fullName: string;
  type: string;
  isNameObsolete?: boolean;
}

/**
 * Helper that checks if the md item was set to obsolete in the org and returns true if so
 * @param mdApiItem
 * @param obsoleteNames
 * @param metadataRegistry
 * @param forceIgnore
 * @returns {boolean} true - if the item is obsolete and should not be part of the md package
 * @private
 */
const _shouldExcludeFromMetadataPackage = function(
  mdApiItem: MdApiItem,
  obsoleteNames: MdApiItem[],
  metadataRegistry: MetadataRegistry,
  forceIgnore: ForceIgnore
) {
  const mdFullName = mdApiItem.fullName;

  if (mdApiItem.isNameObsolete) {
    obsoleteNames.push({ fullName: mdFullName, type: mdApiItem.type });
    return true;
  }

  // check if the entity is a supported type
  if (!metadataRegistry.isSupported(mdApiItem.type) && !NonDecomposedElementsIndex.isSupported(mdApiItem.type)) {
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
  private swa: SourceWorkspaceAdapter;
  public readonly metadataRegistry: MetadataRegistry;
  private readonly forceIgnore: ForceIgnore;
  private logger: typeof logger;
  private readonly username: string;

  constructor(sourceWorkspaceAdapter?: SourceWorkspaceAdapter) {
    this.swa = sourceWorkspaceAdapter;
    this.metadataRegistry = sourceWorkspaceAdapter.metadataRegistry;
    this.forceIgnore = ForceIgnore.findAndCreate(SfdxProject.resolveProjectPathSync());
    this.logger = logger.child('SourceMetadataMemberRetrieveHelper');
    this.username = this.swa.options.org.name;
  }

  shouldAddMember(mdApiItem: MdApiItem, obsoleteNames: MdApiItem[]) {
    return (
      mdApiItem !== null &&
      !_shouldExcludeFromMetadataPackage.call(this, mdApiItem, obsoleteNames, this.metadataRegistry, this.forceIgnore)
    );
  }

  /**
   * gets all source metadata revisions from the server from <fromRevision>.
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
  async getRevisionsAsPackage(obsoleteNames?: MdApiItem[]): Promise<MdapiPackages> {
    const remoteSourceTrackingService: RemoteSourceTrackingService = await RemoteSourceTrackingService.getInstance({
      username: this.username
    });
    const changedElements: ChangeElement[] = await remoteSourceTrackingService.retrieveUpdates();
    const nonDecomposedElementsIndex = await NonDecomposedElementsIndex.getInstance({
      username: this.username,
      metadataRegistry: this.metadataRegistry
    });
    const relatedElements = nonDecomposedElementsIndex.getRelatedNonDecomposedElements(changedElements);
    const allElements = changedElements.concat(relatedElements);
    const parsePromises = allElements.map(sourceMember => {
      const memberType = sourceMember.type;
      const memberName = sourceMember.name;

      if (!memberType || !memberName) {
        throw almError('fullNameIsRequired');
      }

      const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(memberType, this.metadataRegistry);
      if (metadataType) {
        return metadataType.parseSourceMemberForMetadataRetrieve(
          sourceMember.name,
          sourceMember.type,
          sourceMember.deleted
        );
      } else {
        this.logger.log(messages.getMessage('metadataTypeNotSupported', [memberType, memberName]));
        return null;
      }
    });

    const promisedResults: MdApiItem[] = await Promise.all(parsePromises);
    const packages: MdapiPackages = {};
    SfdxProject.getInstance()
      .getUniquePackageNames()
      .forEach((pkg: string) => {
        packages[pkg] = new MdapiPackage();
      });

    promisedResults.forEach(mdApiItem => {
      if (!this.shouldAddMember(mdApiItem, obsoleteNames)) return;

      const pkg = this.determinePackage(mdApiItem);
      packages[pkg].addMember(mdApiItem.fullName, mdApiItem.type);
    });
    return packages;
  }

  private determinePackage(mdApiItem: MdApiItem): string {
    const sourceMemberMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
      mdApiItem.type,
      this.metadataRegistry
    );
    let fileLocation = this.swa.sourceLocations.getFilePath(
      sourceMemberMetadataType.getAggregateMetadataName(),
      mdApiItem.fullName
    );

    if (!fileLocation && sourceMemberMetadataType.hasParent()) {
      // Try to get a fileLocation using the parent fullName. We do this to match a new remote
      // field with its parent custom object location rather than assuming the default package.
      fileLocation = this.swa.sourceLocations.getFilePath(
        sourceMemberMetadataType.getAggregateMetadataName(),
        sourceMemberMetadataType.getAggregateFullNameFromSourceMemberName(mdApiItem.fullName)
      );
    }

    const defaultPackage = SfdxProject.getInstance().getDefaultPackage().name;
    if (fileLocation) {
      return SfdxProject.getInstance().getPackageNameFromPath(fileLocation) || defaultPackage;
    } else {
      return defaultPackage;
    }
  }
}

export = SourceMetadataMemberRetrieveHelper;

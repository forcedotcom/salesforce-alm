/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Local
import { ForceIgnore } from '@salesforce/source-deploy-retrieve/lib/src/metadata-registry/forceIgnore';
import { AsyncCreatable } from '@salesforce/kit';
import { Logger, SfdxProject } from '@salesforce/core';
import MetadataRegistry = require('./metadataRegistry');
import { WorkspaceFileState } from './workspaceFileState';
import { AggregateSourceElement } from './aggregateSourceElement';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { RemoteSourceTrackingService, ChangeElement } from './remoteSourceTrackingService';

export class SrcStatusApi extends AsyncCreatable<SrcStatusApi.Options> {
  public scratchOrg: any;
  public force: any;
  public swa: SourceWorkspaceAdapter;
  public remoteSourceTrackingService: RemoteSourceTrackingService;
  public locallyChangedWorkspaceElements: any[];
  public localChanges: any[];
  public remoteChanges: any[];
  public forceIgnore: any;
  private logger!: Logger;

  public constructor(options: SrcStatusApi.Options) {
    super(options);
    this.scratchOrg = options.org;
    this.force = this.scratchOrg.force;
    this.swa = options.adapter;
    this.locallyChangedWorkspaceElements = [];
    this.localChanges = [];
    this.remoteChanges = [];
    this.forceIgnore = ForceIgnore.findAndCreate(SfdxProject.resolveProjectPathSync());
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.remoteSourceTrackingService = await RemoteSourceTrackingService.getInstance({
      username: this.scratchOrg.name,
    });
    if (!this.swa) {
      const options: SourceWorkspaceAdapter.Options = {
        org: this.scratchOrg,
        metadataRegistryImpl: MetadataRegistry,
        defaultPackagePath: this.force.getConfig().getAppConfig().defaultPackagePath,
      };

      this.swa = await SourceWorkspaceAdapter.create(options);
    }
  }

  async doStatus(options): Promise<void | any[]> {
    this.populateLocalChanges(options);
    await this.populateServerChanges(options);
    return this.markConflicts(options);
  }

  private populateLocalChanges(options) {
    if (!options.local) {
      return [];
    }

    const localSourceElementsMapByPkg = this.swa.changedSourceElementsCache;
    return localSourceElementsMapByPkg.forEach((localSourceElementsMap) =>
      localSourceElementsMap.forEach((value) => {
        value.getWorkspaceElements().forEach((workspaceElement) => {
          value.validateIfDeletedWorkspaceElement(workspaceElement);
          if (options.local && !options.remote) {
            this.localChanges.push(workspaceElement.toObject());
          } else {
            // if we want to find source conflicts between the workspace and the server,
            // then pass along the locally changed workspace elements and
            // populate this.localChanges during the _markConflicts() step
            this.locallyChangedWorkspaceElements.push(workspaceElement);
          }
        });
      })
    );
  }

  // Retrieve metadata CRUD changes from the org, filtering any forceignored metadata,
  // then assign remote changes for conflict detection and status reporting.
  private async populateServerChanges(options) {
    if (!options.remote) {
      return [];
    }

    // Returns false when a changeElement matches a forceignore rule
    const forceIgnoreAllows = (changeElement: ChangeElement) => {
      const sourceMemberMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
        changeElement.type,
        this.swa.metadataRegistry
      );
      // if user wants to ignore a permissionset with fullname abc then we check if forceignore denies abc.permissionset
      if (sourceMemberMetadataType) {
        const fullName = sourceMemberMetadataType.getAggregateFullNameFromSourceMemberName(changeElement.name);
        const filename = `${fullName}.${sourceMemberMetadataType.getExt()}`;
        return this.forceIgnore.accepts(filename);
      }
      return true;
    };

    const changeElements = await this.remoteSourceTrackingService.retrieveUpdates();

    // Create an array of remote changes from the retrieved updates
    for (const changeElement of changeElements) {
      if (forceIgnoreAllows(changeElement)) {
        const remoteChange = await this.createRemoteChangeElements(changeElement);
        this.remoteChanges = [...this.remoteChanges, ...remoteChange];
      }
    }
  }

  private async createRemoteChangeElements(changeElement: ChangeElement) {
    const remoteChangeElements = [];
    const sourceMemberMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
      changeElement.type,
      this.swa.metadataRegistry
    );
    if (sourceMemberMetadataType) {
      if (sourceMemberMetadataType.trackRemoteChangeForSourceMemberName(changeElement.name)) {
        const correspondingWorkspaceElements = await this.getCorrespondingWorkspaceElements(
          changeElement,
          sourceMemberMetadataType
        );
        const state = this.getRemoteChangeState(changeElement, correspondingWorkspaceElements);
        const metadataType = sourceMemberMetadataType.getMetadataName();

        if (this.swa.metadataRegistry.isSupported(metadataType)) {
          if (
            correspondingWorkspaceElements &&
            correspondingWorkspaceElements.length > 0 &&
            !sourceMemberMetadataType.displayAggregateRemoteChangesOnly()
          ) {
            correspondingWorkspaceElements.forEach((workspaceElement) => {
              const remoteChangeElement = {
                state,
                fullName: workspaceElement.getFullName(),
                type: sourceMemberMetadataType.getDisplayNameForRemoteChange(changeElement.type),
                filePath: workspaceElement.getSourcePath(),
              };

              remoteChangeElements.push(remoteChangeElement);
            });
          } else {
            if (state !== WorkspaceFileState.DELETED) {
              const remoteChangeElement = {
                state,
                fullName: changeElement.name,
                type: sourceMemberMetadataType.getDisplayNameForRemoteChange(changeElement.type),
              };
              remoteChangeElements.push(remoteChangeElement);
            } else {
              this.logger.debug(
                `${changeElement.type}.${changeElement.name} was not locally tracked but deleted in the org.`
              );
            }
          }
        }
      }
    }

    return remoteChangeElements;
  }

  private getRemoteChangeState(changeElement: ChangeElement, correspondingLocalWorkspaceElements) {
    if (changeElement.deleted) {
      return WorkspaceFileState.DELETED;
    } else if (correspondingLocalWorkspaceElements && correspondingLocalWorkspaceElements.length > 0) {
      return WorkspaceFileState.CHANGED;
    } else {
      return WorkspaceFileState.NEW;
    }
  }

  private async getCorrespondingWorkspaceElements(changeElement: ChangeElement, sourceMemberMetadataType) {
    const allLocalAggregateElements = await this.swa.getAggregateSourceElements(false);
    if (!allLocalAggregateElements.isEmpty()) {
      if (sourceMemberMetadataType) {
        const aggregateFullName = sourceMemberMetadataType.getAggregateFullNameFromSourceMemberName(changeElement.name);
        const aggregateMetadataName = sourceMemberMetadataType.getAggregateMetadataName();
        const key = AggregateSourceElement.getKeyFromMetadataNameAndFullName(aggregateMetadataName, aggregateFullName);
        const fileLocation = this.swa.sourceLocations.getFilePath(aggregateMetadataName, changeElement.name);
        // if we cannot find an existing fileLocation, it means that the SourceMember has been deleted or the metadata
        // hasn't been retrieved from the org yet.
        if (!fileLocation) {
          this.logger.debug(
            `getCorrespondingWorkspaceElements: Did not find any existing source files for member ${changeElement.name}. Returning empty array...`
          );
          return [];
        }
        const pkgName = SfdxProject.getInstance().getPackageNameFromPath(fileLocation);
        const localAggregateSourceElement = allLocalAggregateElements.getSourceElement(pkgName, key);
        if (localAggregateSourceElement) {
          const workspaceElements = localAggregateSourceElement.getWorkspaceElements();
          if (workspaceElements.length > 0) {
            return workspaceElements.filter((workspaceElement) => {
              const workspaceElementMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
                workspaceElement.getMetadataName(),
                this.swa.metadataRegistry
              );
              return (
                workspaceElementMetadataType.sourceMemberFullNameCorrespondsWithWorkspaceFullName(
                  changeElement.name,
                  workspaceElement.getFullName()
                ) ||
                workspaceElementMetadataType.sourceMemberFullNameCorrespondsWithWorkspaceFullName(
                  `${changeElement.type}s`, // for nonDecomposedTypesWithChildrenMetadataTypes we need to check their type
                  workspaceElement.getFullName()
                )
              );
            });
          }
        }
      }
    }
    return [];
  }

  private markConflicts(options) {
    if (options.local && options.remote) {
      return this.locallyChangedWorkspaceElements.forEach((workspaceElement) => {
        // a metadata element with same name and type modified both locally and in the server is considered a conflict
        const localChange: any = {
          state: workspaceElement.getState(),
          fullName: workspaceElement.getFullName(),
          type: workspaceElement.getMetadataName(),
          filePath: workspaceElement.getSourcePath(),
          deleteSupported: workspaceElement.getDeleteSupported(),
        };

        const workspaceElementMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
          workspaceElement.getMetadataName(),
          this.swa.metadataRegistry
        );
        const remoteChanges = this.remoteChanges.filter((remoteChange) =>
          workspaceElementMetadataType.conflictDetected(
            remoteChange.type,
            remoteChange.fullName,
            workspaceElement.getFullName()
          )
        );
        if (remoteChanges && remoteChanges.length > 0) {
          localChange.isConflict = true;
          remoteChanges.forEach((remoteChange) => {
            remoteChange.isConflict = true;
          });
        }
        this.localChanges.push(localChange);
      });
    } else {
      return [];
    }
  }

  getLocalChanges() {
    return this.localChanges;
  }

  getRemoteChanges() {
    return this.remoteChanges;
  }

  getLocalConflicts() {
    const aggregateKeys = new Set();
    return this.localChanges
      .filter((item) => {
        const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(item.type, this.swa.metadataRegistry);
        if (item.isConflict && metadataType.onlyDisplayOneConflictPerAggregate()) {
          const aggregateFullName = metadataType.getAggregateFullNameFromWorkspaceFullName(item.fullName);
          const key = `${metadataType.getMetadataName()}#${aggregateFullName}`;
          if (!aggregateKeys.has(key)) {
            aggregateKeys.add(key);
            return true;
          }
          return false;
        }
        return item.isConflict;
      })
      .map((item) => {
        const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(item.type, this.swa.metadataRegistry);
        if (metadataType.onlyDisplayOneConflictPerAggregate()) {
          return {
            state: item.state,
            fullName: metadataType.getAggregateFullNameFromWorkspaceFullName(item.fullName),
            type: item.type,
            filePath: metadataType.getDisplayPathForLocalConflict(item.filePath),
            deleteSupported: item.deleteSupported,
          };
        }
        return item;
      });
  }
}

// eslint-disable-next-line no-redeclare
export namespace SrcStatusApi {
  export interface Options {
    org: any;
    adapter?: SourceWorkspaceAdapter;
  }
}

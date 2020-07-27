/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';
// Local
import MetadataRegistry = require('./metadataRegistry');
import * as sourceState from './sourceState';
import { AggregateSourceElement } from './aggregateSourceElement';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { ForceIgnore } from './forceIgnore';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { AsyncCreatable } from '@salesforce/kit';
import { Logger } from '@salesforce/core';
import { MaxRevision } from './MaxRevision';
import { SourceMember } from './SourceMember';
import { PackageInfoCache } from './packageInfoCache';

export class SrcStatusApi extends AsyncCreatable<SrcStatusApi.Options> {
  public scratchOrg: any;
  public force: any;
  public swa: SourceWorkspaceAdapter;
  public maxRevision: MaxRevision;
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
    this.forceIgnore = new ForceIgnore();
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    this.maxRevision = await MaxRevision.getInstance({ username: this.scratchOrg.name });
    if (!this.swa) {
      const options: SourceWorkspaceAdapter.Options = {
        org: this.scratchOrg,
        metadataRegistryImpl: MetadataRegistry,
        defaultPackagePath: this.force.getConfig().getAppConfig().defaultPackagePath
      };

      this.swa = await SourceWorkspaceAdapter.create(options);
    }
  }

  async doStatus(options): Promise<void | any[]> {
    this.populateLocalChanges(options);
    await this.populateServerChanges(options);
    await this.populateRemoteChangesFromFile(options);
    return this.markConflicts(options);
  }

  private async populateRemoteChangesFromFile(options) {
    if (!options.remote) {
      return;
    }
    await this.convertSourceMembersToRemoteChanges(await this.maxRevision.retrieveChangedElements());
  }

  private populateLocalChanges(options) {
    if (!options.local) {
      return [];
    }

    const localSourceElementsMapByPkg = this.swa.changedSourceElementsCache;
    return localSourceElementsMapByPkg.forEach(localSourceElementsMap => {
      return localSourceElementsMap.forEach(value => {
        value.getWorkspaceElements().forEach(workspaceElement => {
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
      });
    });
  }

  private async populateServerChanges(options) {
    if (!options.remote) {
      return [];
    }

    const maxRevisionNum = this.maxRevision.getServerMaxRevision();
    this.logger.debug(`populateServerChanges maxrevision: ${maxRevisionNum}`);
    const sourceMembers: SourceMember[] = await this.maxRevision.querySourceMembersFrom(maxRevisionNum);
    await this.convertSourceMembersToRemoteChanges(sourceMembers);

    // filter the sourcemembers from the forceignore and only store the not-ignored ones in maxRevision.json
    sourceMembers.filter(sourceMember => {
      const sourceMemberMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
        sourceMember.MemberType,
        this.swa.metadataRegistry
      );

      if (sourceMemberMetadataType) {
        sourceMember.MemberName = sourceMemberMetadataType.handleSlashesForSourceMemberName(sourceMember.MemberName);
      }

      return this.forceIgnoreSourceMember(sourceMember, sourceMemberMetadataType);
    });

    await this.maxRevision.writeSourceMembers(sourceMembers);
  }

  private async convertSourceMembersToRemoteChanges(sourceMembers: SourceMember[]) {
    let allRemoteChanges: SourceMember[] = [];
    for (const sourceMember of sourceMembers) {
      const sourceMemberMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
        sourceMember.MemberType,
        this.swa.metadataRegistry
      );
      if (sourceMemberMetadataType) {
        sourceMember.MemberName = sourceMemberMetadataType.handleSlashesForSourceMemberName(sourceMember.MemberName);
      }
      if (!this.forceIgnoreSourceMember(sourceMember, sourceMemberMetadataType)) {
        const els = await this.createRemoteChangeElementsFromSourceMember(sourceMember);
        allRemoteChanges = [...allRemoteChanges, ...els];
      }
    }

    const remoteChanges = allRemoteChanges.reduce((x: any[], y: any) => x.concat(y), []) as any[];
    this.remoteChanges = remoteChanges.filter(
      sm => !(sm.state === sourceState.DELETED && util.isNullOrUndefined(sm.filePath))
    );
  }

  private forceIgnoreSourceMember(sourceMember: SourceMember, sourceMemberMetadataType) {
    // if user wants to ignore a permissionset with fullname abc then we check if forceignore denies abc.permissionset
    if (sourceMemberMetadataType) {
      const filename = `${sourceMemberMetadataType.getAggregateFullNameFromSourceMemberName(
        sourceMember.MemberName
      )}.${sourceMemberMetadataType.getExt()}`;
      if (this.forceIgnore.denies(filename)) {
        return true;
      }
    }
    return false;
  }

  private async createRemoteChangeElementsFromSourceMember(sourceMember: SourceMember) {
    const remoteChangeElements = [];
    const sourceMemberMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
      sourceMember.MemberType,
      this.swa.metadataRegistry
    );
    if (sourceMemberMetadataType) {
      if (sourceMemberMetadataType.trackRemoteChangeForSourceMemberName(sourceMember.MemberName)) {
        const correspondingWorkspaceElements = await this.getCorrespondingWorkspaceElements(
          sourceMember,
          sourceMemberMetadataType
        );
        const state = this.getRemoteChangeState(sourceMember, correspondingWorkspaceElements);
        const metadataType = sourceMemberMetadataType.getMetadataName();

        if (this.swa.metadataRegistry.isSupported(metadataType)) {
          if (
            !util.isNullOrUndefined(correspondingWorkspaceElements) &&
            correspondingWorkspaceElements.length > 0 &&
            !sourceMemberMetadataType.displayAggregateRemoteChangesOnly()
          ) {
            correspondingWorkspaceElements.forEach(workspaceElement => {
              const remoteChangeElement = {
                state,
                fullName: workspaceElement.getFullName(),
                type: sourceMemberMetadataType.getDisplayNameForRemoteChange(sourceMember.MemberType),
                filePath: workspaceElement.getSourcePath(),
                revisionCounter: sourceMember.RevisionCounter
              };

              remoteChangeElements.push(remoteChangeElement);
            });
          } else {
            const remoteChangeElement = {
              state,
              fullName: sourceMember.MemberName,
              type: sourceMemberMetadataType.getDisplayNameForRemoteChange(sourceMember.MemberType),
              revisionCounter: sourceMember.RevisionCounter
            };
            remoteChangeElements.push(remoteChangeElement);
          }
        }
      }
    }

    return remoteChangeElements;
  }

  private getRemoteChangeState(sourceMember: SourceMember, correspondingLocalWorkspaceElements) {
    if (sourceMember.IsNameObsolete) {
      return sourceState.DELETED;
    } else if (
      !util.isNullOrUndefined(correspondingLocalWorkspaceElements) &&
      correspondingLocalWorkspaceElements.length > 0
    ) {
      return sourceState.CHANGED;
    } else {
      return sourceState.NEW;
    }
  }

  private async getCorrespondingWorkspaceElements(sourceMember: SourceMember, sourceMemberMetadataType) {
    const allLocalAggregateElements = await this.swa.getAggregateSourceElements(false);
    if (!allLocalAggregateElements.isEmpty()) {
      if (sourceMemberMetadataType) {
        const aggregateFullName = sourceMemberMetadataType.getAggregateFullNameFromSourceMemberName(
          sourceMember.MemberName
        );
        const aggregateMetadataName = sourceMemberMetadataType.getAggregateMetadataName();
        const key = AggregateSourceElement.getKeyFromMetadataNameAndFullName(aggregateMetadataName, aggregateFullName);
        const fileLocation = this.swa.sourceLocations.getFilePath(aggregateMetadataName, sourceMember.MemberName);
        // if we cannot find an existing fileLocation, it means that the SourceMember has been deleted
        if (!fileLocation) {
          this.logger.debug(
            `getCorrespondingWorkspaceElements: Did not find any existing source files for member ${sourceMember.MemberName}. Returning empty array...`
          );
          return [];
        }
        const pkgName = PackageInfoCache.getInstance().getPackageNameFromSourcePath(fileLocation);
        const localAggregateSourceElement = allLocalAggregateElements.getSourceElement(pkgName, key);
        if (!util.isNullOrUndefined(localAggregateSourceElement)) {
          const workspaceElements = localAggregateSourceElement.getWorkspaceElements();
          if (workspaceElements.length > 0) {
            return workspaceElements.filter(workspaceElement => {
              const workspaceElementMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
                workspaceElement.getMetadataName(),
                this.swa.metadataRegistry
              );
              return (
                workspaceElementMetadataType.sourceMemberFullNameCorrespondsWithWorkspaceFullName(
                  sourceMember.MemberName,
                  workspaceElement.getFullName()
                ) ||
                workspaceElementMetadataType.sourceMemberFullNameCorrespondsWithWorkspaceFullName(
                  `${sourceMember.MemberType}s`, //for nonDecomposedTypesWithChildrenMetadataTypes we need to check their type
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
      return this.locallyChangedWorkspaceElements.forEach(workspaceElement => {
        // a metadata element with same name and type modified both locally and in the server is considered a conflict
        const localChange: any = {
          state: workspaceElement.getState(),
          fullName: workspaceElement.getFullName(),
          type: workspaceElement.getMetadataName(),
          filePath: workspaceElement.getSourcePath(),
          deleteSupported: workspaceElement.getDeleteSupported()
        };

        const workspaceElementMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
          workspaceElement.getMetadataName(),
          this.swa.metadataRegistry
        );
        const remoteChanges = this.remoteChanges.filter(remoteChange =>
          workspaceElementMetadataType.conflictDetected(
            remoteChange.type,
            remoteChange.fullName,
            workspaceElement.getFullName()
          )
        );
        if (!util.isNullOrUndefined(remoteChanges) && remoteChanges.length > 0) {
          localChange.isConflict = true;
          remoteChanges.forEach(remoteChange => {
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
      .filter(item => {
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
      .map(item => {
        const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(item.type, this.swa.metadataRegistry);
        if (metadataType.onlyDisplayOneConflictPerAggregate()) {
          return {
            state: item.state,
            fullName: metadataType.getAggregateFullNameFromWorkspaceFullName(item.fullName),
            type: item.type,
            filePath: metadataType.getDisplayPathForLocalConflict(item.filePath),
            deleteSupported: item.deleteSupported
          };
        }
        return item;
      });
  }
}

export namespace SrcStatusApi {
  export interface Options {
    org: any;
    adapter?: SourceWorkspaceAdapter;
  }
}

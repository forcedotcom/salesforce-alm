/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// 3pp
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';

// Local
import { MdRetrieveApi } from '../mdapi/mdapiRetrieveApi';
import * as SourceUtil from './sourceUtil';
import * as ManifestCreateApi from './manifestCreateApi';
import SourceMetadataMemberRetrieveHelper = require('./sourceMetadataMemberRetrieveHelper');
import * as syncCommandHelper from './syncCommandHelper';
import messagesApi = require('../messages');
import MetadataRegistry = require('./metadataRegistry');
import { BundleMetadataType } from './metadataTypeImpl/bundleMetadataType';

import * as pathUtil from './sourcePathUtil';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { AggregateSourceElements } from './aggregateSourceElements';
import { AsyncCreatable } from '@salesforce/kit';
import { Lifecycle, Logger, Messages, SfdxError, SfdxProject } from '@salesforce/core';
import { SrcStatusApi } from './srcStatusApi';
import { RemoteSourceTrackingService } from './remoteSourceTrackingService';
import { WorkspaceElementObj } from './workspaceElement';
import * as util from 'util';
import { SourceLocations } from './sourceLocations';
import { SourceResult, MetadataResult } from './sourceHooks';
import path = require('path');

export class MdapiPullApi extends AsyncCreatable<MdapiPullApi.Options> {
  public smmHelper: SourceMetadataMemberRetrieveHelper;
  public remoteSourceTrackingService: RemoteSourceTrackingService;
  public obsoleteNames: any[];
  public scratchOrg: any;
  public swa: SourceWorkspaceAdapter;
  private readonly messages: any;
  private logger!: Logger;
  private force: any;

  private statusApi!: SrcStatusApi;

  public constructor(options: MdapiPullApi.Options) {
    super(options);
    this.swa = options.adapter;
    if (this.swa) {
      this.smmHelper = new SourceMetadataMemberRetrieveHelper(this.swa);
    }
    this.scratchOrg = options.org;
    this.force = this.scratchOrg.force;
    this.messages = messagesApi(this.force.config.getLocale());
    this.obsoleteNames = [];
  }

  protected async init(): Promise<void> {
    this.remoteSourceTrackingService = await RemoteSourceTrackingService.getInstance({
      username: this.scratchOrg.name
    });
    this.logger = await Logger.child(this.constructor.name);
    if (!this.swa) {
      const options: SourceWorkspaceAdapter.Options = {
        org: this.scratchOrg,
        metadataRegistryImpl: MetadataRegistry,
        defaultPackagePath: this.force.getConfig().getAppConfig().defaultPackagePath
      };

      this.swa = await SourceWorkspaceAdapter.create(options);
      this.smmHelper = new SourceMetadataMemberRetrieveHelper(this.swa);
    }
  }

  async doPull(options) {
    // Remove this when pull has been modified to support the new mdapi wait functionality;
    if (isNaN(options.wait)) {
      options.wait = this.force.config.getConfigContent().defaultSrcWaitMinutes;
    }

    await this._checkForConflicts(options);

    // if no remote changes were made, quick exit
    if (this.statusApi && !this.statusApi.getRemoteChanges().length) {
      return [];
    }

    const packages = await this.smmHelper.getRevisionsAsPackage(this.obsoleteNames);
    const results = await BBPromise.mapSeries(Object.keys(packages), async pkgName => {
      SfdxProject.getInstance().setActivePackage(pkgName);
      const pkg = packages[pkgName];
      const opts = Object.assign({}, options);
      this.logger.debug('Retrieving', pkgName);
      try {
        // Create a temp directory
        opts.retrievetargetdir = await SourceUtil.createOutputDir('pull');

        // Create a manifest (package.xml).
        const manifestOptions = Object.assign({}, opts, {
          outputdir: opts.retrievetargetdir
        });
        const manifest = await this._createPackageManifest(manifestOptions, pkg);
        this.logger.debug(util.inspect(manifest, { depth: 6 }));
        let result;
        if (manifest.empty) {
          if (this.obsoleteNames.length > 0) {
            result = { fileProperties: [], success: true, status: 'Succeeded' };
          }
        } else {
          // Get default metadata retrieve options
          const retrieveOptions = Object.assign(MdRetrieveApi.getDefaultOptions(), {
            retrievetargetdir: opts.retrievetargetdir,
            unpackaged: manifest.file,
            wait: opts.wait
          });

          // Retrieve the metadata
          result = await new MdRetrieveApi(this.scratchOrg).retrieve(retrieveOptions).catch(err => err.result);
        }
        this.logger.debug(`Retrieve result:`, result);
        // Update local metadata source.
        return await this._postRetrieve(result, opts);
      } finally {
        // Delete the output dir.
        await SourceUtil.cleanupOutputDir(opts.retrievetargetdir);
      }
    });

    return results;
  }

  async _createPackageManifest(options, pkg) {
    if (pkg.isEmpty()) {
      return BBPromise.resolve({ empty: true });
    }

    if (_.isNil(options.packageXml) || !options.debug) {
      const configSourceApiVersion = this.force.getConfig().getAppConfig().sourceApiVersion;
      const sourceApiVersion = !_.isNil(configSourceApiVersion)
        ? configSourceApiVersion
        : this.force.getConfig().getApiVersion();

      pkg.setVersion(sourceApiVersion);

      return BBPromise.resolve(
        new ManifestCreateApi(this.force).createManifestForMdapiPackage(options, pkg, this.smmHelper.metadataRegistry)
      );
    } else {
      return BBPromise.resolve({ file: options.packageXml });
    }
  }

  static _didRetrieveSucceed(result) {
    return (
      !_.isNil(result) &&
      result.success &&
      result.status === 'Succeeded' &&
      _.isNil(result.messages) &&
      !_.isNil(result.fileProperties) &&
      Array.isArray(result.fileProperties)
    );
  }

  async _postRetrieve(result, options) {
    let changedSourceElements: AggregateSourceElements;
    let inboundFiles: WorkspaceElementObj[];

    if (MdapiPullApi._didRetrieveSucceed(result)) {
      changedSourceElements = await this._syncDownSource(result, options, this.swa);
      // NOTE: Even if no updates were made, we need to update source tracking for those elements
      // E.g., we pulled metadata but it's the same locally so it's not seen as a change.
      inboundFiles = changedSourceElements
        .getAllWorkspaceElements()
        .map(workspaceElement => workspaceElement.toObject());

      await SourceLocations.nonDecomposedElementsIndex.maybeRefreshIndex(inboundFiles);
      await this.remoteSourceTrackingService.sync();
    }

    return this._processResults(result, inboundFiles);
  }

  async _syncDownSource(result, options, swa: SourceWorkspaceAdapter): Promise<AggregateSourceElements> {
    const changedSourceElements = new AggregateSourceElements();

    // Each Aura bundle has a definition file that has one of the suffixes: .app, .cmp, .design, .evt, etc.
    // In order to associate each sub-component of an aura bundle (e.g. controller, style, etc.) with
    // its parent aura definition type, we must find its parent's file properties and pass those along
    // to processMdapiFileProperty.  Similarly, for other BundleMetadataTypes.
    const bundleFileProperties = BundleMetadataType.getDefinitionProperties(
      result.fileProperties,
      this.swa.metadataRegistry
    );

    const postRetrieveHookInfo: MetadataResult = {};
    result.fileProperties.forEach(fileProperty => {
      let { fullName, fileName } = fileProperty;

      if (fileProperty.type === 'Package') {
        return;
      }
      // After retrieving, switch back to path separators (for Windows)
      fileProperty.fullName = fullName = pathUtil.replaceForwardSlashes(fullName);
      fileProperty.fileName = fileName = pathUtil.replaceForwardSlashes(fileName);
      this.swa.processMdapiFileProperty(
        changedSourceElements,
        options.retrievetargetdir,
        fileProperty,
        bundleFileProperties
      );

      if (!(typeof postRetrieveHookInfo[fullName] === 'object')) {
        postRetrieveHookInfo[fullName] = {
          mdapiFilePath: []
        };
      }

      postRetrieveHookInfo[fullName].mdapiFilePath = postRetrieveHookInfo[fullName].mdapiFilePath.concat(
        path.join(options.retrievetargetdir, fileName)
      );
    });

    // emit post retrieve event
    await Lifecycle.getInstance().emit('postretrieve', postRetrieveHookInfo);

    this.obsoleteNames.forEach(obsoleteName => {
      this.swa.handleObsoleteSource(changedSourceElements, obsoleteName.fullName, obsoleteName.type);
    });

    const sourcePromise = swa.updateSource(
      changedSourceElements,
      options.manifest,
      false /** check for duplicates **/,
      options.unsupportedMimeTypes,
      options.forceoverwrite
    );

    return sourcePromise
      .then(updatedSource => {
        // emit post source update event
        let postSourceUpdateHookInfo: SourceResult = {};
        updatedSource.forEach(sourceElementMap => {
          sourceElementMap.forEach(sourceElement => {
            const fullName = sourceElement.aggregateFullName;

            if (!postSourceUpdateHookInfo[fullName]) {
              postSourceUpdateHookInfo[fullName] = {
                workspaceElements: []
              };
            }

            const hookInfo = postSourceUpdateHookInfo[fullName];
            const newElements = hookInfo.workspaceElements.concat(
              sourceElement.workspaceElements.map(we => we.toObject())
            );

            hookInfo.workspaceElements = [...newElements];
            postSourceUpdateHookInfo[fullName] = hookInfo;
          });
        });
        Lifecycle.getInstance()
          .emit('postsourceupdate', postSourceUpdateHookInfo)
          .then(() => {});
      })
      .then(() => sourcePromise);
  }

  _processResults(result, inboundFiles: WorkspaceElementObj[]) {
    if (_.isNil(result)) {
      return;
    } else if (MdapiPullApi._didRetrieveSucceed(result)) {
      return { inboundFiles };
    } else {
      const retrieveFailed = new Error(syncCommandHelper.getRetrieveFailureMessage(result, this.messages));
      retrieveFailed.name = 'RetrieveFailed';
      throw retrieveFailed;
    }
  }

  async _checkForConflicts(options) {
    if (options.forceoverwrite) {
      // do not check for conflicts when pull --forceoverwrite
      return [];
    }
    this.statusApi = await SrcStatusApi.create({ org: this.scratchOrg, adapter: this.swa });
    return this.statusApi
      .doStatus({ local: true, remote: true }) // rely on status so that we centralize the logic
      .then(() => this.statusApi.getLocalConflicts())
      .catch(err => {
        let sfdxError = SfdxError.wrap(err);
        if (err.errorCode === 'INVALID_TYPE') {
          const messages: Messages = Messages.loadMessages('salesforce-alm', 'source_pull');
          sfdxError.message = messages.getMessage('NonScratchOrgPull');
        } else if (err.errorCode === 'INVALID_SESSION_ID') {
          sfdxError.actions = [this.messages.getMessage('invalidInstanceUrlForAccessTokenAction')];
        } else {
          sfdxError.message = err.message;
        }
        throw sfdxError;
      })
      .then(conflicts => {
        if (conflicts.length > 0) {
          const error = new Error('Conflicts found during sync down');
          error['name'] = 'SourceConflict';
          error['sourceConflictElements'] = conflicts;
          throw error;
        }
      });
  }
}

export namespace MdapiPullApi {
  export interface Options {
    adapter?: SourceWorkspaceAdapter;
    org: any;
  }
}

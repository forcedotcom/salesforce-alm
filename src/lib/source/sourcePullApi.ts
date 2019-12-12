/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// 3pp
import * as BBPromise from 'bluebird';
import * as _ from 'lodash';

// Local
import { MdRetrieveApi } from '../mdapi/mdapiRetrieveApi';
import srcDevUtil = require('../core/srcDevUtil');
import * as SourceUtil from './sourceUtil';
import * as ManifestCreateApi from './manifestCreateApi';
import SourceMetadataMemberRetrieveHelper = require('./sourceMetadataMemberRetrieveHelper');
import * as syncCommandHelper from './syncCommandHelper';
import messagesApi = require('../messages');
import MetadataRegistry = require('./metadataRegistry');
import { BundleMetadataType } from './metadataTypeImpl/bundleMetadataType';

import * as pathUtil from './sourcePathUtil';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { AsyncCreatable } from '@salesforce/kit';
import { Logger } from '@salesforce/core';
import { SrcStatusApi } from './srcStatusApi';

export class MdapiPullApi extends AsyncCreatable<MdapiPullApi.Options> {

  public smmHelper: SourceMetadataMemberRetrieveHelper;
  public maxRevisionFile: any;
  public obsoleteNames: any[];
  public scratchOrg: any;
  public swa: SourceWorkspaceAdapter;
  private messages: any;
  private logger!: Logger;
  private force: any;

  public constructor(options: MdapiPullApi.Options) {
    super(options);
    this.swa = options.adapter;
    if (this.swa) {
      this.smmHelper = new SourceMetadataMemberRetrieveHelper(this.swa.metadataRegistry);
    }
    this.scratchOrg = options.org;
    this.force = this.scratchOrg.force;
    this.maxRevisionFile = this.scratchOrg.getMaxRevision();
    this.messages = messagesApi(this.force.config.getLocale());
    this.obsoleteNames = [];
  }

  protected async init(): Promise<void> {
    this.logger = await Logger.child(this.constructor.name);
    if (!this.swa) {
      const options: SourceWorkspaceAdapter.Options = {
        org: this.scratchOrg,
        metadataRegistryImpl: MetadataRegistry,
        defaultPackagePath: this.force.getConfig().getAppConfig().defaultPackagePath
      };

      this.swa = await SourceWorkspaceAdapter.create(options);
      this.smmHelper = new SourceMetadataMemberRetrieveHelper(this.swa.metadataRegistry);
    }
  }

  async doPull(options) {
    // Remove this when pull has been modified to support the new mdapi wait functionality;
    if (isNaN(options.wait)) {
      options.wait = this.force.config.getConfigContent().defaultSrcWaitMinutes;
    }

    await this._checkForConflicts(options);
    const maxRevision = await srcDevUtil.getMaxRevision(this.maxRevisionFile.path);
    this.logger.debug(`doPull maxRevision: ${maxRevision}`);
    const pkg = await this.smmHelper.getRevisionsAsPackage(maxRevision, this.obsoleteNames);

    try {
      // Create a temp directory
      options.retrievetargetdir = await SourceUtil.createOutputDir('pull');

      // Create a manifest (package.xml).
      const manifestOptions = Object.assign({}, options, {
        outputdir: options.retrievetargetdir
      });
      const manifest = await this._createPackageManifest(manifestOptions, pkg);

      let result;
      if (manifest.empty) {
        if (this.obsoleteNames.length > 0) {
          result = { fileProperties: [], success: true, status: 'Succeeded' };
        }
      } else {
        // Get default metadata retrieve options
        const retrieveOptions = Object.assign(MdRetrieveApi.getDefaultOptions(), {
          retrievetargetdir: options.retrievetargetdir,
          unpackaged: manifest.file,
          wait: options.wait
        });

        // Retrieve the metadata
        result = await new MdRetrieveApi(this.scratchOrg).retrieve(retrieveOptions).catch(err => err.result);
      }

      // Update local metadata source.
      return await this._postRetrieve(result, options);
    } finally {
      // Delete the output dir.
      await SourceUtil.cleanupOutputDir(options.retrievetargetdir);
    }
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
    let changedSourceElements;

    if (MdapiPullApi._didRetrieveSucceed(result)) {
      changedSourceElements = await this._syncDownSource(result, options, this.swa);
      await this._updateMaxRevision();
    }

    return this._processResults(result, changedSourceElements);
  }

  async _syncDownSource(result, options, swa) {
    const changedSourceElements = new Map();

    // Each Aura bundle has a definition file that has one of the suffixes: .app, .cmp, .design, .evt, etc.
    // In order to associate each sub-component of an aura bundle (e.g. controller, style, etc.) with
    // its parent aura definition type, we must find its parent's file properties and pass those along
    // to processMdapiFileProperty.  Similarly, for other BundleMetadataTypes.
    const bundleFileProperties = BundleMetadataType.getDefinitionProperties(
      result.fileProperties,
      this.swa.metadataRegistry
    );

    result.fileProperties.forEach(fileProperty => {
      if (fileProperty.type === 'Package') {
        return;
      }
      // After retrieving, switch back to path separators (for Windows)
      fileProperty.fullName = pathUtil.replaceForwardSlashes(fileProperty.fullName);
      fileProperty.fileName = pathUtil.replaceForwardSlashes(fileProperty.fileName);
      this.swa.processMdapiFileProperty(
        changedSourceElements,
        options.retrievetargetdir,
        fileProperty,
        bundleFileProperties
      );
    });

    this.obsoleteNames.forEach(obsoleteName => {
      this.swa.handleObsoleteSource(changedSourceElements, obsoleteName.fullName, obsoleteName.type);
    });

    return swa.updateSource(
      changedSourceElements,
      this.force,
      this.scratchOrg,
      options.manifest,
      false /** check for duplicates **/,
      options.unsupportedMimeTypes
    );
  }

  _updateMaxRevision() {
    return SourceUtil.updateMaxRevision(this.scratchOrg, this.swa.metadataRegistry);
  }

  _processResults(result, changedSourceElements) {
    if (_.isNil(result)) {
      return BBPromise.resolve();
    } else if (MdapiPullApi._didRetrieveSucceed(result)) {
      const inboundFiles = [...changedSourceElements.values()]
        .reduce((allChanges, sourceElement) => allChanges.concat(sourceElement.getWorkspaceElements()), [])
        .map(workspaceElement => workspaceElement.toObject());
      return BBPromise.resolve({ inboundFiles });
    } else {
      const retrieveFailed = new Error(syncCommandHelper.getRetrieveFailureMessage(result, this.messages));
      retrieveFailed.name = 'RetrieveFailed';
      return BBPromise.reject(retrieveFailed);
    }
  }

  async _checkForConflicts(options) {
    if (options.forceoverwrite) {
      // do not check for conflicts when pull --forceoverwrite
      return [];
    }
    const statusApi = await SrcStatusApi.create({ org: this.scratchOrg, adapter: this.swa });
    return statusApi
      .doStatus({ local: true, remote: true }) // rely on status so that we centralize the logic
      .then(() => statusApi.getLocalConflicts())
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
    adapter?: SourceWorkspaceAdapter,
    org: any
  }
}

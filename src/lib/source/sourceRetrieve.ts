/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join as pathJoin } from 'path';
import { get as _get, isPlainObject as _isPlainObject } from 'lodash';
import { Logger, SfdxError, Messages } from '@salesforce/core';
import { SfdxProject } from '@salesforce/core';
import { MdRetrieveApi, MdRetrieveOptions } from '../mdapi/mdapiRetrieveApi';
import MetadataRegistry = require('./metadataRegistry');
import { createOutputDir, cleanupOutputDir, getSourceElementsFromSourcePath } from './sourceUtil';
import { toManifest, createManifest } from './manifestUtils';
import { toArray } from './parseManifestEntriesArray';
import MdapiConvertApi = require('./mdapiConvertApi');
import * as syncCommandHelper from './syncCommandHelper';
import { SourceOptions } from './types';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { AggregateSourceElements } from './aggregateSourceElements';
import { MdapiPullApi } from './sourcePullApi';
import { SourceElementsResolver } from './sourceElementsResolver';
import SourceConvertApi = require('./sourceConvertApi');

Messages.importMessagesDirectory(__dirname);

export interface SourceRetrieveOptions extends SourceOptions {
  ignorewarnings?: boolean;
  apiversion?: string;
  packagenames?: string[];
  wait?: number;
}

export interface SourceRetrieveOutput {
  inboundFiles: Array<{
    state: string;
    fullName: string;
    type: string;
    filePath: string;
  }>;
  warnings?: string[];
  packages?: Array<{
    name: string;
    path: string;
  }>;
}

/**
 * API for retrieving metadata from an org and updating a local SFDX project.
 */
export class SourceRetrieve {
  private defaultPackagePath;
  private logger: Logger;
  private projectPath: string;
  private tmpOutputDir: string;
  private swa: SourceWorkspaceAdapter;

  constructor(private org) {
    this.projectPath = org.force.config.getProjectPath();
    this.defaultPackagePath = org.config.getAppConfig().defaultPackagePath;
  }

  // Retrieves metadata from an org based on the retrieve options specified.
  public async retrieve(options: SourceRetrieveOptions): Promise<SourceRetrieveOutput> {
    this.logger = await Logger.child('SourceRetrieve');

    // Only put SWA in stateless mode when sourcepath param is used.
    const mode = options.sourcepath && SourceWorkspaceAdapter.modes.STATELESS;

    const swaOptions: SourceWorkspaceAdapter.Options = {
      org: this.org,
      metadataRegistryImpl: MetadataRegistry,
      defaultPackagePath: this.defaultPackagePath,
      fromConvert: false,
      sourceMode: mode,
      sourcePaths: options.sourcepath && options.sourcepath.split(','),
    };
    this.swa = await SourceWorkspaceAdapter.create(swaOptions);

    let results;

    try {
      this.tmpOutputDir = await createOutputDir('sourceRetrieve');
      if (options.sourcepath) {
        this.logger.info(`Retrieving metadata in sourcepath '${options.sourcepath}' from org: '${this.org.name}'`);
        results = await this.retrieveFromSourcePath(options);
      } else if (options.manifest) {
        this.logger.info(`Retrieving metadata in manifest '${options.manifest}' from org: '${this.org.name}'`);
        results = await this.retrieveFromManifest(options);
      } else if (options.packagenames) {
        this.logger.info(`Retrieving metadata in package(s) '${options.packagenames}' from org: '${this.org.name}'`);
        results = await this.retrieveFromManifest(options);
      } else if (options.metadata) {
        this.logger.info(`Retrieving metadata '${options.metadata}' from org: '${this.org.name}'`);
        results = await this.retrieveFromMetadata(options);
      }
    } finally {
      await cleanupOutputDir(this.tmpOutputDir);
      // Delete the sourcePathInfos.json for this org.  Ideally, we never create it but
      // until then, this is necessary.
      this.org.getSourcePathInfos().delete();
    }

    return results;
  }

  // Retrieve specific source paths from an org and update the project.
  private async retrieveFromSourcePath(options: SourceRetrieveOptions): Promise<SourceRetrieveOutput> {
    // Parse the sourcepath parameter for metadata files and build a map of AggregateSourceElements
    const aggregateSourceElements = await getSourceElementsFromSourcePath(options.sourcepath, this.swa);

    // Create a manifest and update the options with the manifest file.
    options.manifest = await this.createManifest(aggregateSourceElements, options, this.tmpOutputDir);

    // Now that we have a package.xml, the rest is just a retrieve using the manifest.
    return this.retrieveFromManifest(options, aggregateSourceElements);
  }

  private async retrieveFromMetadata(options: SourceRetrieveOptions): Promise<SourceRetrieveOutput> {
    // toManifest will also tack the manifest onto the options
    await toManifest(this.org, options, this.tmpOutputDir);

    // Now that we have a package.xml, the rest is just a retrieve using the manifest.
    return this.retrieveFromManifest(options);
  }

  // Retrieve metadata specified in a manifest file (package.xml) from an org and update the project.
  private async retrieveFromManifest(
    options: SourceRetrieveOptions,
    aggregateSourceElements?: AggregateSourceElements
  ): Promise<SourceRetrieveOutput> {
    const results: SourceRetrieveOutput = { inboundFiles: [], packages: [], warnings: [] };
    const project = SfdxProject.getInstance();
    const defaultPackage = project.getDefaultPackage();

    // Get AggregateSourceElements (ASEs) from the manifest so we can split into
    // multiple requests per package.
    if (!aggregateSourceElements) {
      if (options.manifest) {
        const sourceElementsResolver = new SourceElementsResolver(this.org, this.swa);
        aggregateSourceElements = await sourceElementsResolver.getSourceElementsFromManifest(options.manifest);
      } else {
        // This happens when only packages are retrieved
        aggregateSourceElements = new AggregateSourceElements();
      }

      // Always add the default package, else new things in the org may not be processed correctly.
      if (!aggregateSourceElements.has(defaultPackage.name)) {
        aggregateSourceElements.set(defaultPackage.name, null);
      }
    }

    let shouldRetrievePackages = !!options.packagenames;

    for (const [pkgName, aseMap] of aggregateSourceElements) {
      this.logger.info('retrieving package:', pkgName);
      project.setActivePackage(pkgName);
      let tmpPkgOutputDir: string;

      try {
        // Create a temp directory
        tmpPkgOutputDir = await createOutputDir('sourceRetrieve_pkg');

        let ases: AggregateSourceElements;

        // Create a new manifest for this package in the tmp dir.
        if (aseMap && options.sourcepath) {
          ases = new AggregateSourceElements().set(pkgName, aseMap);
          options.manifest = await this.createManifest(ases, options, tmpPkgOutputDir);
        }

        // Set Retrieve options for MdRetrieveApi
        const retrieveOptions: MdRetrieveOptions = Object.assign(MdRetrieveApi.getDefaultOptions(), {
          apiversion: options.apiversion,
          forceoverwrite: true, // retrieve always overwrites
          retrievetargetdir: tmpPkgOutputDir,
          unpackaged: options.manifest,
          wait: options.wait,
        });

        // Only retrieve packages once if the param was set.
        if (shouldRetrievePackages) {
          retrieveOptions.packagenames = Array.isArray(options.packagenames)
            ? options.packagenames.join()
            : options.packagenames;
          shouldRetrievePackages = false;
        }

        // Retrieve the files from the org
        const res = await new MdRetrieveApi(this.org).retrieve(retrieveOptions);

        if (options.packagenames) {
          // Convert the packages to source format and copy them to the project in their
          // own directory.  E.g. For a package named "fooPkg" and project named "myProject":
          // source would be copied to: myProject/fooPkg/
          const packageNames: string[] = retrieveOptions.packagenames.split(',');
          const projectPath = await SfdxProject.resolveProjectPath();
          const mdapiConvertApi = new MdapiConvertApi();

          // Turn off the active package directory when converting retrieved
          // packages or it will prevent proper decomposition.
          // See behavior of AggregateSourceElement.shouldIgnorePath()
          try {
            project.setActivePackage(null);
            for (const _pkgName of packageNames) {
              const destPath = pathJoin(projectPath, _pkgName);
              const pkgPath = pathJoin(retrieveOptions.retrievetargetdir, _pkgName);
              this.logger.info(`Converting metadata in package: ${pkgPath} to: ${destPath}`);
              results.packages.push({ name: _pkgName, path: destPath });
              mdapiConvertApi.root = pkgPath;
              mdapiConvertApi.outputDirectory = destPath;
              await mdapiConvertApi.convertSource(this.org);
            }
          } finally {
            project.setActivePackage(pkgName);
          }
        }

        // Convert to source format and update the local project.
        if (SourceRetrieve.isRetrieveSuccessful(res)) {
          // Only do this if unpackaged source was retrieved (i.e., a manifest was created).
          // retrieveOptions.unpackaged will be undefined when only packages were retrieved.
          if (retrieveOptions.unpackaged) {
            const mdapiPull = await MdapiPullApi.create({ org: this.org, adapter: this.swa });

            // Extracts the source from package.xml in the temp dir, creates a Map of AggregateSourceElements
            // and updates the local project with the files from the temp dir.
            const sourceElements = await mdapiPull._syncDownSource(res, retrieveOptions, this.swa);

            // Build a simple object representation of what was changed in the local project.
            const { inboundFiles, warnings } = await this.processResults(res, sourceElements);
            if (results.inboundFiles.length > 0) {
              // Could be duplicates with multiple package directories so don't add inbound files twice
              const filePaths = results.inboundFiles.map((file) => file.filePath);
              for (const inboundFile of inboundFiles) {
                if (!filePaths.includes(inboundFile.filePath)) {
                  results.inboundFiles.push(inboundFile);
                }
              }
            } else {
              results.inboundFiles = results.inboundFiles.concat(inboundFiles);
            }

            if (warnings) {
              results.warnings = results.warnings.concat(warnings);
            }
          }
        } else {
          // If fileProperties is an object, it means no results were retrieved so don't throw an error
          if (!_isPlainObject(res.fileProperties)) {
            let errMsgExtra = '';
            if (res.messages) {
              errMsgExtra = `\nDue to: ${res.messages.problem}`;
            }
            throw SfdxError.create('salesforce-alm', 'source_retrieve', 'SourceRetrieveError', [errMsgExtra]);
          }
        }
      } finally {
        await cleanupOutputDir(tmpPkgOutputDir);
      }
    }

    return results;
  }

  private async createManifest(
    aggregateSourceElements: AggregateSourceElements,
    options: SourceOptions,
    outputDirPath: string
  ): Promise<string> {
    // Convert aggregateSourceElements to an array of this format: { type: 'ApexClass', name: 'MyClass' }
    // for use by ManifestApi.createManifest().
    const mdFullPairs = SourceConvertApi.getUpdatedSourceTypeNamePairs(
      aggregateSourceElements.getAllSourceElements(),
      this.swa.metadataRegistry
    );

    // Create a manifest and update the options with the manifest file.
    const manifest = await createManifest(this.org, options, mdFullPairs, outputDirPath);
    return manifest.file;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async processResults(result, sourceElements: AggregateSourceElements) {
    const inboundFiles = [];

    sourceElements.getAllWorkspaceElements().forEach((workspaceElement) => {
      syncCommandHelper.createDisplayRows(inboundFiles, workspaceElement.toObject(), this.projectPath);
    });

    const output: SourceRetrieveOutput = { inboundFiles };

    // If there are warning messages along with successes, display them (i.e., partial success).
    if (result.messages) {
      output.warnings = toArray(result.messages);
    }
    return output;
  }

  public static isRetrieveSuccessful(result): boolean {
    return result && result.success && _get(result, 'status') === 'Succeeded' && Array.isArray(result.fileProperties);
  }
}

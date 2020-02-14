/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { get as _get, isPlainObject as _isPlainObject } from 'lodash';
import { sep as pathSep, join as pathJoin } from 'path';
import MetadataRegistry = require('./metadataRegistry');
import * as SourceUtil from './sourceUtil';
import { MdRetrieveApi, MdRetrieveOptions } from '../mdapi/mdapiRetrieveApi';
import MdapiConvertApi = require('./mdapiConvertApi');
import { Logger, SfdxError, Messages } from '@salesforce/core';
import { AggregateSourceElement } from './aggregateSourceElement';
import * as syncCommandHelper from './syncCommandHelper';
import { ManifestEntry, SourceOptions } from './types';
import { WorkspaceElement } from './workspaceElement';
import { MetadataType } from './metadataType';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { SfdxProject } from '@salesforce/core';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { MdapiPullApi } from './sourcePullApi';

Messages.importMessagesDirectory(__dirname);

export interface SourceRetrieveOptions extends SourceOptions {
  ignorewarnings?: boolean;
  apiversion?: string;
  packagenames?: string[];
  wait?: number;
}

export interface SourceRetrieveOutput {
  inboundFiles: {
    state: string;
    fullName: string;
    type: string;
    filePath: string;
  }[];
  warnings?: string[];
  packages?: {
    name: string;
    path: string;
  }[];
}

/**
 * API for retrieving metadata from an org and updating a local SFDX project.
 */
export class SourceRetrieve {
  private defaultPackagePath;
  private logger: Logger;
  private projectPath: string;
  private tmpOutputDir: string;
  private swa;

  constructor(private org) {
    this.projectPath = org.force.config.getProjectPath();
    this.defaultPackagePath = org.config.getAppConfig().defaultPackagePath;
  }

  // Retrieves metadata from an org based on the retrieve options specified.
  public async retrieve(options: SourceRetrieveOptions): Promise<SourceRetrieveOutput> {
    if (options.sourcepath) {
      //if -p passed
      const optionPath: string = options.sourcepath;
      this.org.config.getAppConfig().packageDirectories.forEach(directory => {
        //find packages in sfdx-project.json
        if (optionPath.indexOf(directory.path) !== -1) {
          //if listed package is in param path
          this.defaultPackagePath = directory.path;
        }
      });
    }
    this.logger = await Logger.child('SourceRetrieve');
    await MetadataRegistry.initializeMetadataTypeInfos(this.org);

    // Only put SWA in stateless mode when sourcepath param is used.
    const mode = options.sourcepath && SourceWorkspaceAdapter.modes.STATELESS;

    const swaOptions: SourceWorkspaceAdapter.Options = {
      org: this.org,
      metadataRegistryImpl: MetadataRegistry,
      defaultPackagePath: this.defaultPackagePath,
      fromConvert: true,
      sourceMode: mode
    };
    this.swa = await SourceWorkspaceAdapter.create(swaOptions);

    let results;

    try {
      this.tmpOutputDir = await SourceUtil.createOutputDir('sourceRetrieve');
      if (options.sourcepath) {
        this.logger.info(`Retrieving metadata in sourcepath '${options.sourcepath}' from org: '${this.org.name}'`);
        results = await this.retrieveFromSourcePath(options);
      } else if (options.manifest || options.packagenames) {
        this.logger.info(`Retrieving metadata in manifest '${options.manifest}' from org: '${this.org.name}'`);
        results = await this.retrieveFromManifest(options);
      } else if (options.metadata) {
        this.logger.info(`Retrieving metadata '${options.metadata}' from org: '${this.org.name}'`);
        results = await this.retrieveFromMetadata(options);
      }
    } finally {
      await SourceUtil.cleanupOutputDir(this.tmpOutputDir);
      // Delete the sourcePathInfos.json for this org.  Ideally, we never create it but
      // until then, this is necessary.
      this.org.getSourcePathInfos().delete();
    }

    return results;
  }

  // Retrieve specific source paths from an org and update the project.
  private async retrieveFromSourcePath(options: SourceRetrieveOptions): Promise<SourceRetrieveOutput> {
    // Parse the sourcepath parameter for metadata files and build a map of AggregateSourceElements
    const aggregateSourceElements: Map<
      string,
      AggregateSourceElement
    > = await SourceUtil.getSourceElementsFromSourcePath(options.sourcepath, this.swa);

    // Convert aggregateSourceElements to an array of this format: { type: 'ApexClass', name: 'MyClass' }
    // for use by ManifestApi.createManifest().
    const mdFullPairs = [...aggregateSourceElements.values()].map(el => ({
      type: el.getMetadataName(),
      name: el.getAggregateFullName()
    }));

    // Create a manifest and update the options with the manifest file.
    options.manifest = (await SourceUtil.createManifest(this.org, options, mdFullPairs, this.tmpOutputDir)).file;

    // Now that we have a package.xml, the rest is just a retrieve using the manifest.
    return this.retrieveFromManifest(options, aggregateSourceElements);
  }

  private async retrieveFromMetadata(options: SourceRetrieveOptions): Promise<SourceRetrieveOutput> {
    const entries: ManifestEntry[] = await SourceUtil.parseManifestEntries(options.metadata);

    // toManifest will also tack the manifest onto the options
    await SourceUtil.toManifest(this.org, options, this.tmpOutputDir);

    // Now that we have a package.xml, the rest is just a retrieve using the manifest.
    return this.retrieveFromManifest(options, null, entries);
  }

  // Retrieve metadata specified in a manifest file (package.xml) from an org and update the project.
  private async retrieveFromManifest(
    options: SourceRetrieveOptions,
    aggregateSourceElements?: Map<string, AggregateSourceElement>,
    entries?: ManifestEntry[]
  ): Promise<SourceRetrieveOutput> {
    let results: SourceRetrieveOutput = { inboundFiles: [], packages: [] };

    // Set Retrieve options for MdRetrieveApi
    const retrieveOptions: MdRetrieveOptions = Object.assign(MdRetrieveApi.getDefaultOptions(), {
      apiversion: options.apiversion,
      retrievetargetdir: this.tmpOutputDir,
      packagenames: options.packagenames,
      unpackaged: options.manifest,
      wait: options.wait
    });

    // Retrieve the files from the org
    const res = await new MdRetrieveApi(this.org).retrieve(retrieveOptions);

    if (options.packagenames) {
      // Convert the packages to source format and copy them to the project
      const packageNames: string[] = retrieveOptions.packagenames.split(',');
      const projectPath = await SfdxProject.resolveProjectPath();
      const mdapiConvertApi = new MdapiConvertApi();
      for (const pkgName of packageNames) {
        const destPath = pathJoin(projectPath, pkgName);
        const pkgPath = pathJoin(retrieveOptions.retrievetargetdir, pkgName);
        this.logger.info(`Converting metadata in package: ${pkgPath} to: ${destPath}`);
        results.packages.push({ name: pkgName, path: destPath });
        mdapiConvertApi.root = pkgPath;
        mdapiConvertApi.outputDirectory = destPath;
        await mdapiConvertApi.convertSource(this.org);
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

        let _entries = entries || (await SourceUtil.parseToManifestEntriesArray(retrieveOptions.unpackaged));

        // Build a simple object representation of what was changed in the local project.
        results = this.processResults(res, sourceElements, aggregateSourceElements, _entries);
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

    return results;
  }

  private validateAggregateFullName(source: ManifestEntry, target: ManifestEntry, delimiter: string): boolean {
    if (target.type === source.type) {
      const fullNameComponents = source.name.split(delimiter);

      return fullNameComponents && fullNameComponents.length > 0 && fullNameComponents[0] === target.name;
    }
  }

  private processResults(
    result,
    sourceElements,
    aggregateSourceElements,
    entries?: ManifestEntry[]
  ): SourceRetrieveOutput {
    const inboundFiles = [];

    /**
     * @todo We probably don't need both aggregateSourceElements and entries for filtering. We probably can rely on
     * what can be distilled from the manifest for filtering. In this case aggregateSourceElements is empty in the
     * case of the metadata scope. However for all three scope options we have a manifest to create workspace element
     * filtering.
     */
    const _aggregateSourceElements = aggregateSourceElements || this.swa.getAggregateSourceElements(false);
    // For each source element extracted from the zip (i.e., from the org) match it to entries in
    // the full map of AggregateSourceElements and create display rows for command output.
    sourceElements.forEach(sourceElement => {
      const key = AggregateSourceElement.getKeyFromMetadataNameAndFullName(
        sourceElement.getMetadataName(),
        sourceElement.getAggregateFullName()
      );
      const se = _aggregateSourceElements.get(key);

      let filteredElements: WorkspaceElement[] = se.getWorkspaceElements();
      if (!aggregateSourceElements) {
        /**
         * This tell us that if true the sourceElement matched a wildcard in the entries. Therefore all child
         * elements are not only included in the package zip but also should be included in the display.
         */
        const matchesWildCardSourceElement = !!entries.find((element: ManifestEntry) => {
          return sourceElement.getMetadataName() === element.type && element.name === '*';
        });

        // Remove all the workspace elements that don't match the scope. why?
        // If you don't and you do something like ListView:Foo__c.Foo You'll get all the members
        // of the custom object currently on disk. But what you really want is just a ListView.
        filteredElements = filteredElements.filter((workspaceElement: WorkspaceElement) => {
          const type: MetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
            workspaceElement.getMetadataName(),
            this.swa.metadataRegistry
          );
          const parent = _get(type, 'typeDefObj.parent');

          // Find a manifest entry that matches the source element itself or the elements parent.
          // If we wanted an entire CustomObject object we want to ensure all the child components are not
          // filtered out.
          //
          // Anything not found in the entries array is filtered out.
          return !!entries.find((manifestEntry: ManifestEntry): boolean => {
            if (parent && parent.metadataName === manifestEntry.type) {
              return this.validateAggregateFullName(
                {
                  name: workspaceElement.getFullName(),
                  type: parent.metadataName
                },
                manifestEntry,
                '.'
              );
            }

            if (manifestEntry.type === workspaceElement.getMetadataName()) {
              if (
                this.validateAggregateFullName(
                  {
                    name: workspaceElement.getFullName(),
                    type: workspaceElement.getMetadataName()
                  },
                  manifestEntry,
                  pathSep
                )
              ) {
                /**
                 * Case in point (-m AuraDefinitionBundle:xray )
                 * The manifest entries will contain {name='xray', type='AuraDefinitionBundle'}
                 * All the elements of the AuraDefinitionBundle will begin with the fullname 'xray'.
                 * i.e. xray/xray.css. If that's the case return true otherwise continue evaluating.
                 */
                return true;
              }
            }

            return (
              matchesWildCardSourceElement ||
              (manifestEntry.type === workspaceElement.getMetadataName() &&
                manifestEntry.name === workspaceElement.getFullName())
            );
          });
        });
      }
      // Get all WorkspaceElements for the retrieved source elements and create simple object
      // data for display within a table.
      filteredElements.forEach(workspaceElement => {
        syncCommandHelper.createDisplayRows(inboundFiles, workspaceElement.toObject(), this.projectPath);
      });
    });

    const output: SourceRetrieveOutput = { inboundFiles };

    // If there are warning messages along with successes, display them (i.e., partial success).
    if (result.messages) {
      output.warnings = SourceUtil.toArray(result.messages);
    }
    return output;
  }

  public static isRetrieveSuccessful(result): boolean {
    return result && result.success && _get(result, 'status') === 'Succeeded' && Array.isArray(result.fileProperties);
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as SourceUtil from './sourceUtil';
import { ManifestEntry } from './types';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { Logger, SfdxError } from '@salesforce/core';
import * as path from 'path';
import { AggregateSourceElements } from './aggregateSourceElements';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import MetadataRegistry = require('./metadataRegistry');
import { AggregateSourceElement } from './aggregateSourceElement';

export class SourceElementsResolver {
  private sourceWorkSpaceAdapter: SourceWorkspaceAdapter;
  private org;
  private logger: Logger;

  constructor(org, sourceWorkSpaceAdapter: SourceWorkspaceAdapter) {
    this.sourceWorkSpaceAdapter = sourceWorkSpaceAdapter;
    this.org = org;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  /**
   * Returns all AggregateSourceElements in the project that match entries
   * from a manifest.
   * @param manifestPath - path to package.xml
   * @return {Map} aggregateSourceElements
   */
  public async getSourceElementsFromManifest(manifestPath: string): Promise<AggregateSourceElements> {
    const typeNamePairs = await SourceUtil.parseToManifestEntriesArray(manifestPath);
    const sourceElements = await this.sourceWorkSpaceAdapter.getAggregateSourceElements(false);
    return this.parseTypeNamePairs(typeNamePairs, sourceElements);
  }

  /**
   * Filters all AggregateSourceElements in the project based on manifest file entries.
   * @param typeNamePairs - type name pairs from a manifest file
   * @param sourceElements - all AggregateSourceElements in the project
   * @return {Map} aggregateSoureElements
   */

  private parseTypeNamePairs(
    typeNamePairs: ManifestEntry[],
    sourceElements: AggregateSourceElements
  ): AggregateSourceElements {
    let aggregateSourceElements = new AggregateSourceElements();
    typeNamePairs.forEach((entry: ManifestEntry) => {
      let keyMetadataType = entry.type;
      const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
        keyMetadataType,
        this.sourceWorkSpaceAdapter.metadataRegistry
      );

      if (!metadataType) {
        throw SfdxError.create('salesforce-alm', 'source', 'UnsupportedType', [keyMetadataType]);
      }

      const aggregateName = metadataType.getAggregateMetadataName();
      const hasParentType = metadataType.getMetadataName() !== aggregateName;
      if (metadataType['typeDefObj'].inFolder) {
        keyMetadataType = metadataType.getBaseTypeName();
      }

      if (entry.name.includes('*')) {
        if (hasParentType) {
          // In this case we are dealing with a decomposed item, so reload using the parent name
          keyMetadataType = aggregateName;
        }

        const filterKey = keyMetadataType.split('__')[0]; // Use only the metadata key since we want all metadata names.
        this.logger.debug(`Matching source with wildcard metadata: ${filterKey}`);
        const filteredASEs = sourceElements.filterSourceElementsByKey(
          filterKey,
          { fuzzy: true } // this allows (e.g.) Document type to match DocumentFolder, which we want.
        );
        aggregateSourceElements.merge(filteredASEs);
      } else {
        //
        // We can't call SourceUtil.loadSourceElement() here because we have to match the key across
        // package directories.  E.g., a custom object can be defined in multiple package directories
        // and we need to return all matches from all package dirs based on a typeNamePair (i.e., key).
        //
        let filteredASEs: AggregateSourceElements;
        if (hasParentType) {
          const parentFullName = metadataType.getAggregateFullNameFromWorkspaceFullName(entry.name);
          const parentKey = AggregateSourceElement.getKeyFromMetadataNameAndFullName(aggregateName, parentFullName);
          this.logger.debug(`Matching source with metadata: ${parentKey}__${keyMetadataType}.${entry.name}`);
          const ase = sourceElements.findParentElement(parentKey, keyMetadataType, entry.name);
          filteredASEs = new AggregateSourceElements();
          if (ase) {
            filteredASEs.setIn(ase.packageName, ase.getKey(), ase);
          }
        } else {
          this.logger.debug(`Matching source with metadata: ${keyMetadataType}.${entry.name}`);
          filteredASEs = sourceElements.filterSourceElementsByKey(
            MetadataRegistry.getMetadataKey(keyMetadataType, entry.name),
            { fuzzy: true } // this allows (e.g.) Document type to match DocumentFolder, which we want.
          );
        }
        aggregateSourceElements.merge(filteredASEs);
      }
    });
    return aggregateSourceElements;
  }

  /**
   *
   * @param options - any{}
   * @param aggregateSourceElements - any empty array of type aggregateSoureElements
   * @param tmpOutputDir
   */

  public async getSourceElementsFromMetadata(
    options: any,
    aggregateSourceElements: AggregateSourceElements,
    tmpOutputDir?: string
  ): Promise<AggregateSourceElements> {
    tmpOutputDir = tmpOutputDir || (await SourceUtil.createOutputDir('decomposition'));
    const manifestPath: string = await SourceUtil.toManifest(this.org, options, tmpOutputDir);
    const isPathABundleError = path.extname(options.metadata).length > 0 && SourceUtil.containsMdBundle(options);

    if (isPathABundleError) {
      throw SfdxError.create('salesforce-alm', 'source', 'SourcePathInvalid', [options.metadata]);
    }

    if (manifestPath) {
      aggregateSourceElements = await this.getSourceElementsFromManifest(manifestPath);
    } else {
      throw SfdxError.create('salesforce-alm', 'source', 'failedToCreateManifest');
    }
    return aggregateSourceElements;
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as SourceUtil from './sourceUtil';
import { ManifestEntry } from './types';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { SfdxError } from '@salesforce/core';
import * as util from 'util';
import * as path from 'path';
import messages = require('../../lib/messages');
import { AggregateSourceElements } from './aggregateSourceElements';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
const message = messages();

export class SourceElementsResolver {
  private sourceWorkSpaceAdapter: SourceWorkspaceAdapter;
  private org;
  constructor(org, sourceWorkSpaceAdapter: SourceWorkspaceAdapter) {
    this.sourceWorkSpaceAdapter = sourceWorkSpaceAdapter;
    this.org = org;
  }

  /**
   *
   * @param optionsManifest - path to package.xml
   * @return {Map} aggregateSourceElements
   */
  public async getSourceElementsFromManifest(optionsManifest: any): Promise<any> {
    const typeNamePairs = await SourceUtil.parseToManifestEntriesArray(optionsManifest);
    return this.parseTypeNamePairs(typeNamePairs, await this.sourceWorkSpaceAdapter.getAggregateSourceElements(false));
  }

  /**
   * Filters the elements based on the manifest file.
   * @param typeNamePairs - type name pairs from the manifest file
   * @param sourceElements
   * @return {Map} aggregateSoureElements
   */

  private parseTypeNamePairs(
    typeNamePairs: ManifestEntry[],
    sourceElements: AggregateSourceElements
  ): AggregateSourceElements {
    let aggregateSourceElements = new AggregateSourceElements();
    typeNamePairs.forEach((entry: ManifestEntry) => {
      if (entry.name.includes('*')) {
        let keyMetadataType = entry.type;
        const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
          keyMetadataType,
          this.sourceWorkSpaceAdapter.metadataRegistry
        );

        if (!metadataType) {
          throw SfdxError.create('salesforce-alm', 'source', 'UnsupportedType', [keyMetadataType]);
        }

        if (metadataType.getMetadataName() !== metadataType.getAggregateMetadataName()) {
          // In this case we are dealing with a decomposed item, so reload using the parent name
          keyMetadataType = metadataType.getAggregateMetadataName();
        }
        sourceElements.forEach(elements => {
          const wildcards: ManifestEntry[] = [...elements.keys()]
            .filter(item => item.includes(keyMetadataType))
            .map(
              (typeAnyName: string): ManifestEntry => {
                let [mdType, ...rest] = typeAnyName.split('__');
                const mdName = rest.join('__');
                return {
                  type: mdType,
                  name: mdName
                };
              }
            );
          aggregateSourceElements.merge(this.parseTypeNamePairs(wildcards, sourceElements));
        });
      } else {
        const ase = SourceUtil.loadSourceElement(
          sourceElements,
          `${entry.type}__${entry.name}`,
          this.sourceWorkSpaceAdapter.metadataRegistry
        );
        aggregateSourceElements.setIn(ase.getPackageName(), ase.getKey(), ase);
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
  ): Promise<any> {
    tmpOutputDir = util.isNullOrUndefined(tmpOutputDir)
      ? await SourceUtil.createOutputDir('decomposition')
      : tmpOutputDir;
    const manifestPath: string = await SourceUtil.toManifest(this.org, options, tmpOutputDir);
    const isPathABundleError = path.extname(options.metadata).length > 0 && SourceUtil.containsMdBundle(options);

    if (isPathABundleError) {
      let err: any = SfdxError.create('salesforce-alm', 'source', 'SourcePathInvalid', [options.metadata]);
      const sfdxError = (SfdxError.wrap(err).message = message.getMessage('PathToBundleComponenet'));
      throw sfdxError;
    }

    if (manifestPath) {
      aggregateSourceElements = await this.getSourceElementsFromManifest(manifestPath);
    } else {
      throw SfdxError.create('salesforce-alm', 'source', 'failedToCreateManifest');
    }
    return aggregateSourceElements;
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import { fs } from '@salesforce/core';

// Local
import srcDevUtil = require('../../core/srcDevUtil');
import MetadataRegistry = require('../metadataRegistry');

import { DecompositionWorkspaceStrategy } from './decompositionWorkspaceStrategy';
import { DecompositionConfig, DecomposedSubtypeConfig } from './decompositionConfig';
import { MetadataDocumentAnnotation } from '../metadataDocument';
import { Nullable } from '@salesforce/ts-types';
import { SourceLocations } from '../sourceLocations';
import { SfdxProject } from '@salesforce/core';

/**
 * Workspace decomposition strategy where decomposed subtypes are given
 * their own directory (mostly).
 *
 * It works like this.
 * 1. If the type is not singleton each instance gets a directory with
 * the name being the full name of the aggregate entity subordinate to the
 * normal directory for that type (eg. --/objects/Obj__c).
 * 2. If the type is singleton (eg. CustomLabels) then the decomposed documents
 * are stored directly subordinate to the normal directory for that type
 * (eg. --/labels).
 * 3. When there exists more than one subtype each subtype gets its own directory
 * subordinate to that from the previous steps (eg. --/objects/Obj__c/fields).
 * 4. When there exists only a single subtype (eg. MatchingCriteria) then the decomposed
 * documents do not get a subtype-specific directory
 * (eg. --/matchingRules).
 *
 * These exceptions are intended to avoid unnatural manifestations like, eg,
 * --/matchingRules/matchingRules/myMatchingRule.rule
 */
export class FolderPerSubtypeWorkspaceDecomposition implements DecompositionWorkspaceStrategy {
  private decompositionConfig: DecompositionConfig;

  constructor(decompositionConfig: DecompositionConfig) {
    this.decompositionConfig = decompositionConfig;
  }

  getDecomposedFileName(
    annotation: MetadataDocumentAnnotation,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): string {
    return `${annotation.name}.${decomposedSubtypeConfig.ext}${MetadataRegistry.getMetadataFileExt()}`;
  }

  getContainerPath(metadataFilePath: string, ext: string): string {
    if (this.decompositionConfig.isGlobal) {
      return null;
    }
    const sourceDir = this.getDecomposedSourceDirFromMetadataFile(metadataFilePath, ext);
    const metadataFile = path.basename(metadataFilePath);
    return path.join(sourceDir, metadataFile);
  }

  findDecomposedPaths(metadataFilePath: string, ext: string): Map<DecomposedSubtypeConfig, string[]> {
    const decomposedPaths = new Map<DecomposedSubtypeConfig, string[]>();
    const project = SfdxProject.getInstance();
    const metaPkgName = project.getPackageNameFromPath(metadataFilePath);
    project.getUniquePackageNames().forEach(pkg => {
      // We have to make the metadataFilePath relative to each package in order to get
      // any decompositions that might live in a different package from the meta file
      const pkgMetadataFilePath = metadataFilePath.replace(metaPkgName, pkg);
      const fragmentDirs = this.getFragmentDirs(pkgMetadataFilePath, ext);
      for (const decomposedSubtypeConfig of fragmentDirs.keys()) {
        const dir = fragmentDirs.get(decomposedSubtypeConfig);
        if (srcDevUtil.pathExistsSync(dir)) {
          const files = FolderPerSubtypeWorkspaceDecomposition.getFragmentFilesInDir(
            dir,
            `${decomposedSubtypeConfig.ext}${MetadataRegistry.getMetadataFileExt()}`
          );
          for (const file of files) {
            if (!decomposedPaths.has(decomposedSubtypeConfig)) {
              decomposedPaths.set(decomposedSubtypeConfig, []);
            }

            if (!decomposedPaths.get(decomposedSubtypeConfig).includes(file)) {
              decomposedPaths.get(decomposedSubtypeConfig).push(file);
            }
          }
        }
      }
    });

    return decomposedPaths;
  }

  getDecomposedSubtypeDirFromMetadataFile(
    metadataFilePath: string,
    ext: string,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): string {
    let sourceDir = this.getDecomposedSourceDirFromMetadataFile(metadataFilePath, ext);
    if (this.decompositionConfig.decompositions.length > 1) {
      sourceDir = path.join(sourceDir, decomposedSubtypeConfig.defaultDirectory);
    }
    return sourceDir;
  }

  // Look for existing matching source paths in this order:
  //   1st: child key  e.g., CustomObject__MyCustomObject__c.MyCustomField__c
  //   2nd: parent key  e.g., CustomObject__MyCustomObject__c IF aggregateFullName == annotation.name
  //   3rd: parent name  e.g., MyCustomObject__c
  // If nothing found return null;
  getDecomposedSubtypeDirFromAnnotation(
    annotation: MetadataDocumentAnnotation,
    metadataType: string,
    aggregateFullName: string,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): Nullable<string> {
    const childKey = MetadataRegistry.getMetadataKey(metadataType, `${aggregateFullName}.${annotation.name}`);
    let parentKey;
    if (aggregateFullName === annotation.name) {
      parentKey = MetadataRegistry.getMetadataKey(metadataType, aggregateFullName);
    }

    const filePathsIndex = SourceLocations.filePathsIndex;
    if (filePathsIndex.has(childKey)) {
      return path.dirname(filePathsIndex.get(childKey)[0]);
    } else if (parentKey && filePathsIndex.has(parentKey)) {
      return path.dirname(filePathsIndex.get(parentKey)[0]);
    } else if (filePathsIndex.has(aggregateFullName)) {
      return path.join(
        path.dirname(filePathsIndex.get(aggregateFullName)[0]),
        decomposedSubtypeConfig.defaultDirectory
      );
    } else {
      return null;
    }
  }

  private getDecomposedSourceDirFromMetadataFile(metadataFilePath: string, ext: string): Nullable<string> {
    let sourceDir = path.dirname(metadataFilePath);
    if (!this.decompositionConfig.isGlobal) {
      const fullName = this.getFullNameFromMetadataFile(metadataFilePath, ext);
      sourceDir = path.join(sourceDir, fullName); // Account for entity-specific subdirectory
    }
    return sourceDir;
  }

  getFullNameFromMetadataFile(metadataFilePath: string, ext: string): string {
    return path.basename(metadataFilePath, `.${ext}${MetadataRegistry.getMetadataFileExt()}`);
  }

  private getFragmentDirs(metadataFilePath: string, ext: string): Map<DecomposedSubtypeConfig, string> {
    const sourceDir = this.getDecomposedSourceDirFromMetadataFile(metadataFilePath, ext);

    const fragmentDirs = new Map<DecomposedSubtypeConfig, string>();
    if (this.decompositionConfig.decompositions.length > 1) {
      for (const decomposition of this.decompositionConfig.decompositions) {
        fragmentDirs.set(decomposition, path.join(sourceDir, decomposition.defaultDirectory));
      }
    } else {
      fragmentDirs.set(this.decompositionConfig.decompositions[0], sourceDir);
    }

    return fragmentDirs;
  }

  private static getFragmentFilesInDir(dir: string, ext: string): string[] {
    const fragmentFiles = [];
    const files = fs.readdirSync(dir);
    files
      .map(file => path.join(dir, file))
      .forEach(file => {
        if (file.toLowerCase().endsWith(ext.toLowerCase())) {
          fragmentFiles.push(file);
        }
      });
    return fragmentFiles;
  }
}

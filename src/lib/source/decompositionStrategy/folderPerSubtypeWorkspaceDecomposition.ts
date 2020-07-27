/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as fs from 'fs';

// Local
import srcDevUtil = require('../../core/srcDevUtil');
import MetadataRegistry = require('../metadataRegistry');

import { DecompositionWorkspaceStrategy } from './decompositionWorkspaceStrategy';
import { DecompositionConfig, DecomposedSubtypeConfig } from './decompositionConfig';
import { MetadataDocumentAnnotation } from '../metadataDocument';
import { Nullable } from '@salesforce/ts-types';
import { SourceLocations } from '../sourceLocations';
import { PackageInfoCache } from '../packageInfoCache';

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
    const packageInfoCache = PackageInfoCache.getInstance();
    const metaPkgName = packageInfoCache.getPackageNameFromSourcePath(metadataFilePath);
    packageInfoCache.packageNames.forEach(pkg => {
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
            decomposedPaths.get(decomposedSubtypeConfig).push(file);
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

  getDecomposedSubtypeDirFromAnnotation(
    annotation: MetadataDocumentAnnotation,
    metadataType: string,
    aggregateFullName: string,
    decomposedSubtypeConfig: DecomposedSubtypeConfig
  ): Nullable<string> {
    const key =
      aggregateFullName === annotation.name
        ? MetadataRegistry.getMetadataKey(metadataType, aggregateFullName)
        : MetadataRegistry.getMetadataKey(metadataType, `${aggregateFullName}.${annotation.name}`);
    const filePathsIndex = SourceLocations.filePathsIndex;
    if (filePathsIndex.has(key)) {
      return path.dirname(filePathsIndex.get(key)[0]);
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

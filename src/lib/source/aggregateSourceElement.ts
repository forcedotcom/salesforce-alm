/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as _ from 'lodash';

import srcDevUtil = require('../core/srcDevUtil');
import * as sourceState from './sourceState';
import Messages = require('../messages');
const messages = Messages();
import MetadataRegistry = require('./metadataRegistry');

import * as almError from '../core/almError';
import { DecompositionStrategy } from './decompositionStrategy/decompositionStrategy';
import { DecompositionStrategyFactory } from './decompositionStrategy/decompositionStrategyFactory';
import { DecompositionWorkspaceStrategy } from './decompositionStrategy/decompositionWorkspaceStrategy';
import { DecompositionCommitStrategy } from './decompositionStrategy/decompositionCommitStrategy';
import { MetadataDocument, MetadataDocumentAnnotation } from './metadataDocument';
import { DecomposedSubtypeConfig } from './decompositionStrategy/decompositionConfig';
import { WorkspaceElement } from './workspaceElement';
import { ContentDecompositionStrategy } from './decompositionStrategy/contentDecompositionStrategy';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { MetadataType } from './metadataType';
import { FolderMetadataType } from './metadataTypeImpl/folderMetadataType';

import * as PathUtils from './sourcePathUtil';
import { checkForXmlParseError } from './sourceUtil';
import { SfdxError } from '@salesforce/core';

/**
 * Class used to manage top-level metadata
 * Examples of top-level metadata types include: ApexClass, CustomObject, StaticResource, etc.
 *
 * For compound metadata requiring de/recomposition, this facade is the point of entry for
 * decomposition/re-composition from other code. No client code should reference any other
 * internal implementation classes. If this class proves inadequate for future needs then it should
 * be extended and the internal implementation classes modified to support the new requirements.
 *
 * This class is agnostic wrt how the decomposition of the source metadata file is
 * performed, including the nature of the aggregated and decomposed files,  and also
 * how the decomposed files are represented in the workspace. These decisions are
 * delegated to the strategies configured in the metadata registry for the type.
 */

export class AggregateSourceElement {
  metadataType: MetadataType;
  workspaceVersion;

  decompStrategy: DecompositionStrategy;
  workspaceStrategy: DecompositionWorkspaceStrategy;
  commitStrategy: DecompositionCommitStrategy;
  contentStrategy: ContentDecompositionStrategy;

  metadataFilePath: string;
  deleted: boolean;
  metadataRegistry;
  retrievedMetadataPath: string;
  retrievedContentPaths: string[];
  aggregateFullName: string;
  isDuplicate: boolean;

  workspaceElements: WorkspaceElement[];
  pendingDeletedWorkspaceElements: WorkspaceElement[];

  /**
   * @param aggregateMetadataType - this is the type for the top-level parent metadata - e.g. ApexClass, CustomObject, etc.
   * @param aggregateFullName - this is the name of the top-level parent metadata
   * @param aggregateMetadataFilePath - this is the full file path to the top-level parent metadata
   * @param metadataRegistry
   */
  constructor(aggregateMetadataType: MetadataType, aggregateFullName, aggregateMetadataFilePath, metadataRegistry) {
    this.metadataType = aggregateMetadataType;
    this.workspaceVersion = null; // fill this in when the workspace version is known
    this.metadataRegistry = metadataRegistry; // my hope is to be able to get rid of this when typeDefs become first class
    this.aggregateFullName = aggregateFullName;
    this.metadataFilePath = aggregateMetadataFilePath;

    this.decompStrategy = DecompositionStrategyFactory.newDecompositionStrategy(
      this.metadataType.getDecompositionConfig()
    );
    this.workspaceStrategy = DecompositionStrategyFactory.newDecompositionWorkspaceStrategy(
      this.metadataType.getDecompositionConfig()
    );
    this.commitStrategy = DecompositionStrategyFactory.newDecompositionCommitStrategy(
      this.metadataType.getDecompositionConfig()
    );

    this.contentStrategy = DecompositionStrategyFactory.newContentStrategy(
      this.metadataType,
      this.metadataRegistry,
      this.workspaceVersion
    );
    this.workspaceElements = [];
    this.pendingDeletedWorkspaceElements = [];
    this.deleted = null;
  }

  getMetadataType(): MetadataType {
    return this.metadataType;
  }

  static getKeyFromMetadataNameAndFullName(aggregateMetadataName, aggregateFullName): string {
    return `${aggregateMetadataName}__${aggregateFullName}`;
  }

  getKey(): string {
    return AggregateSourceElement.getKeyFromMetadataNameAndFullName(
      this.getMetadataName(),
      this.getAggregateFullName()
    );
  }

  /**
   * Gets the metadata workspace path that would be in use if this type were not transformed.
   * The locations of associated decomposed/non-decomposed content and metadata  files can be inferred from this name.
   * @returns {string}
   */
  getMetadataFilePath(): string {
    return this.metadataFilePath;
  }

  getAggregateFullName(): string {
    return this.aggregateFullName;
  }

  getMetadataName(): string {
    return this.metadataType.getMetadataName();
  }

  /**
   * Returns all paths to workspace source files matching the given metadata type and fullName
   * @param metadataTypeName
   * @param fullNameForPath
   * @returns {string[]}
   */
  getWorkspacePathsForTypeAndFullName(metadataTypeName, fullNameForPath): string[] {
    const contentPathsForFullName = this.getContentWorkspacePathsForTypeAndFullName(metadataTypeName, fullNameForPath);
    const metadataPathsForFullName = this.getMetadataWorkspacePathsForTypeAndFullName(
      metadataTypeName,
      fullNameForPath
    );
    return contentPathsForFullName.concat(metadataPathsForFullName);
  }

  getContentWorkspacePathsForTypeAndFullName(metadataTypeName: string, fullNameForPath: string): string[] {
    // get content file paths
    const allContentPaths = this.getContentPaths(this.getMetadataFilePath());
    return allContentPaths.filter(contentPath => {
      const contentMetadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(contentPath, this.metadataRegistry);
      const fullName = contentMetadataType.getFullNameFromFilePath(contentPath);
      return fullName === fullNameForPath;
    });
  }

  getMetadataWorkspacePathsForTypeAndFullName(metadataTypeName: string, fullNameForPath: string): string[] {
    const wantedMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
      metadataTypeName,
      this.metadataRegistry
    );
    const allDecomposedPaths = this.getMetadataPaths(this.getMetadataFilePath());
    return allDecomposedPaths.filter(decomposedPath => {
      const decomposedMetadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(
        decomposedPath,
        this.metadataRegistry
      );
      if (decomposedMetadataType.constructor === wantedMetadataType.constructor) {
        const decomposedFullName = decomposedMetadataType.getFullNameFromFilePath(decomposedPath);
        return fullNameForPath === decomposedFullName;
      }
      return false;
    });
  }

  addWorkspaceElement(workspaceElement): void {
    this.workspaceElements.push(workspaceElement);
  }

  /**
   * Returns the collection of workspace elements associated with this aggregate source element
   * @returns {WorkspaceElement[]}
   */
  getWorkspaceElements(): WorkspaceElement[] {
    return this.workspaceElements;
  }

  /**
   * returns the collection of deleted workspace elements associated with this aggregate source element
   * @returns {WorkspaceElement[]}
   */
  getPendingDeletedWorkspaceElements(): WorkspaceElement[] {
    return this.pendingDeletedWorkspaceElements;
  }

  /**
   * Adds the given workspace element to a collection to be processed during commit
   * @param deletedWorkspaceElement
   */
  addPendingDeletedWorkspaceElement(deletedWorkspaceElement): void {
    this.pendingDeletedWorkspaceElements.push(deletedWorkspaceElement);
  }

  isDeleted(): boolean {
    if (!_.isNil(this.deleted)) {
      return this.deleted;
    } else {
      return this.isAggregateSourceElementDeleted();
    }
  }

  /**
   * If the workspace is in an inconsistent state, where a metadata file was deleted but not the content files,
   * or the aura bundle metadata file was deleted but not the whole bundle, then throw an error
   * @param workspaceElement
   */
  validateIfDeletedWorkspaceElement(workspaceElement): void {
    if (workspaceElement.getState() === sourceState.DELETED) {
      const contentPaths = this.metadataType.hasContent() ? this.getContentPaths(this.getMetadataFilePath()) : [];

      // If the metadata file was deleted and not the content file, throw an error
      // Or if the container path for the fine-grained item was deleted but other decomposed items exist, throw an error
      if (workspaceElement.getSourcePath() === this.getContainerPath()) {
        const allDecomposedPaths = this.getMetadataPaths(this.getMetadataFilePath());

        if ((this.metadataType.hasContent() && contentPaths.length !== 0) || allDecomposedPaths.length !== 0) {
          if (!this.decompStrategy.isComposable()) {
            throw almError('MissingMetadataFile', [workspaceElement.getSourcePath()]);
          } else {
            if (!this.getMetadataType().isStandardMember(workspaceElement.getFullName())) {
              throw almError('MissingMetadataFile', [workspaceElement.getSourcePath()]);
            }
          }
        }
      }

      this.metadataType.validateDeletedContentPath(
        workspaceElement.getSourcePath(),
        contentPaths,
        this.metadataRegistry
      );
    }
  }

  private getContainerPath(): string {
    return this.workspaceStrategy.getContainerPath(this.getMetadataFilePath(), this.metadataType.getExt());
  }

  private isAggregateSourceElementDeleted(): boolean {
    let isDeleted = false;
    this.getWorkspaceElements().forEach(workspaceElement => {
      this.validateIfDeletedWorkspaceElement(workspaceElement);
      if (workspaceElement.getState() === sourceState.DELETED) {
        const deletedPath = workspaceElement.getSourcePath();
        // Does the deleted path item match the object meta file path?
        if (deletedPath === this.getContainerPath()) {
          isDeleted = true;
          // Delete any remaining empty paths for composable entities.
          if (this.decompStrategy.isComposable()) {
            const metadataPaths: string[] = this.getMetadataPaths(this.getMetadataFilePath());
            if (!metadataPaths || metadataPaths.length === 0) {
              PathUtils.cleanEmptyDirs(path.resolve(this.getMetadataFilePath(), '..'));
            }
          }
        }

        const deletedPathIsAContentPath = this.metadataType.isContentPath(deletedPath);
        // This would be akin to deleting an apex class .cls file.
        if (deletedPathIsAContentPath) {
          const crucialContentStillExists = this.metadataType.mainContentFileExists(this.getMetadataFilePath());
          if (crucialContentStillExists) {
            isDeleted = false;
          } else {
            if (srcDevUtil.pathExistsSync(this.getMetadataFilePath())) {
              this.markForDelete();
            }
          }
        }
      }
    });
    return isDeleted;
  }

  /**
   * Flags this aggregate source element as deleted and marks all of its associated workspace elements as deleted
   */
  markForDelete(): void {
    this.deleted = true;
    const metadataPathsToDelete = this.getMetadataPaths(this.getMetadataFilePath());
    const contentPathsToDelete = this.getContentPaths(this.getMetadataFilePath());
    const allPaths = metadataPathsToDelete.concat(contentPathsToDelete);
    allPaths.forEach(deletedPath => {
      const deletedMetadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(deletedPath, this.metadataRegistry);
      const fullNameForPath = deletedMetadataType.getFullNameFromFilePath(deletedPath);
      const deleteSupported = deletedMetadataType.deleteSupported(fullNameForPath);
      const deletedWorkspaceElement = new WorkspaceElement(
        deletedMetadataType.getMetadataName(),
        fullNameForPath,
        deletedPath,
        sourceState.DELETED,
        deleteSupported
      );
      this.addPendingDeletedWorkspaceElement(deletedWorkspaceElement);
    });
  }

  /**
   * Gets the list of existing decomposed and non-decomposed metadata files for the given source metadata entity.
   *
   * @param metadataFilePath the workspace path that would be in use if this type were not transformed.
   * The locations of the actual decomposed files can be inferred from this name. This is a proxy for all
   * of decomposed files.
   * @returns {string[]} the list of existing decomposed files for the given source metadata entity
   */
  getMetadataPaths(metadataFilePath: string): string[] {
    const paths: string[] = [];

    const containerPath = this.workspaceStrategy.getContainerPath(metadataFilePath, this.metadataType.getExt());
    if (!_.isNil(containerPath) && srcDevUtil.pathExistsSync(containerPath)) {
      paths.push(containerPath);
    }

    const decompositionPaths = this.workspaceStrategy.findDecomposedPaths(metadataFilePath, this.metadataType.getExt());
    for (const decomposedSubtypeConfig of decompositionPaths.keys()) {
      for (const decompositionPath of decompositionPaths.get(decomposedSubtypeConfig)) {
        paths.push(decompositionPath);
      }
    }

    return paths;
  }

  /**
   * Gets all of the workspace paths to composed and nondecomposed content files associated with this aggregateSourceElement
   * @param metadataFilePath
   * @returns {any}
   */
  getContentPaths(metadataFilePath: string): string[] {
    if (this.metadataType.hasContent()) {
      return this.contentStrategy.getContentPaths(metadataFilePath);
    }
    return [];
  }

  /**
   * Commits changes to the workspace
   * @param manifest
   * @param unsupportedMimeTypes - the list of non-whitelisted static resource mime types
   * @returns {Array[]}
   */
  commit(manifest, unsupportedMimeTypes: string[]): [string[], string[], string[]] {
    let newPaths = [];
    let updatedPaths = [];
    let deletedPaths = [];
    let dupPaths = [];

    this.commitDeletes(deletedPaths);

    if (!_.isNil(this.retrievedMetadataPath)) {
      this.commitMetadata(newPaths, updatedPaths, deletedPaths, dupPaths, manifest);
    }

    if (this.metadataType.hasContent() && !_.isNil(this.retrievedContentPaths)) {
      this.commitContent(newPaths, updatedPaths, deletedPaths, dupPaths, unsupportedMimeTypes);
    }

    // associate committed source to sourceElement
    this.addCorrespondingWorkspaceElements(newPaths, sourceState.NEW);
    this.addCorrespondingWorkspaceElements(updatedPaths, sourceState.CHANGED);
    this.addCorrespondingWorkspaceElements(deletedPaths, sourceState.DELETED);
    this.addCorrespondingWorkspaceElements(dupPaths, sourceState.DUP);

    // adding the empty folder must come after the creation of all corresponding workspace elements
    this.addEmptyFolder();

    return [newPaths, updatedPaths, deletedPaths];
  }

  /**
   * Delete workspace elements from the workspace
   * @param deletedPaths
   */
  commitDeletes(deletedPaths) {
    this.pendingDeletedWorkspaceElements
      // Need a new array so the pendingDeletedWorkspaceElements order is not modified.
      // It's probably not needed but this could create down stream problems if the order is changed.
      .slice()
      // Map the array into array of source paths
      .map((value: WorkspaceElement) => value.getSourcePath())
      // Sort it into delete order such that /foo gets deleted after /foo/bar.txt
      .sort(PathUtils.deleteOrderComparator)
      .forEach(deletedWorkspaceElementSourcePath => {
        srcDevUtil.deleteIfExistsSync(deletedWorkspaceElementSourcePath);
        deletedPaths.push(deletedWorkspaceElementSourcePath);
      });
  }

  private commitMetadata(newPaths, updatedPaths, deletedPaths, dupPaths, manifest) {
    const [newMetaPaths, updatedMetaPaths, deletedMetaPaths, dupMetaPaths] = this.decomposeMetadata(
      this.retrievedMetadataPath,
      this.getMetadataFilePath(),
      manifest
    );
    newPaths.push(...newMetaPaths);
    updatedPaths.push(...updatedMetaPaths);
    deletedPaths.push(...deletedMetaPaths);
    dupPaths.push(...dupMetaPaths);
  }

  private commitContent(newPaths, updatedPaths, deletedPaths, dupPaths, unsupportedMimeTypes) {
    const [
      newContentPaths,
      updatedContentPaths,
      deletedContentPaths,
      dupContentPaths
    ] = this.contentStrategy.saveContent(
      this.getMetadataFilePath(),
      this.retrievedContentPaths,
      this.retrievedMetadataPath,
      this.isDuplicate,
      unsupportedMimeTypes
    );
    newPaths.push(...newContentPaths);
    updatedPaths.push(...updatedContentPaths);
    deletedPaths.push(...deletedContentPaths);
    dupPaths.push(...dupContentPaths);
  }

  private addEmptyFolder() {
    if (this.metadataType.isFolderType()) {
      const folderPath = FolderMetadataType.createEmptyFolder(
        this.getWorkspaceElements(),
        this.getMetadataFilePath(),
        this.getMetadataType().getExt()
      );
      if (folderPath) {
        this.addWorkspaceElement(
          new WorkspaceElement(this.getMetadataName(), this.aggregateFullName, folderPath, sourceState.NEW, true)
        );
      }
    }
  }

  private addCorrespondingWorkspaceElements(filePaths, state) {
    filePaths.forEach(filePath => {
      let tempFilePath = filePath;
      if (tempFilePath.endsWith('.dup')) {
        // if we are dealing with a duplicate file do all the calculations as if it wasn't a dup
        tempFilePath = tempFilePath.substring(0, tempFilePath.length - 4);
      }
      const workspaceElementMetadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(
        tempFilePath,
        this.metadataRegistry
      );
      let workspaceElementFullName = workspaceElementMetadataType.getFullNameFromFilePath(tempFilePath);
      const deleteSupported = workspaceElementMetadataType.deleteSupported(workspaceElementFullName);
      const workspaceElement = new WorkspaceElement(
        workspaceElementMetadataType.getMetadataName(),
        workspaceElementFullName,
        filePath,
        state,
        deleteSupported
      );
      this.addWorkspaceElement(workspaceElement);
    });
  }

  checkForDuplicates() {
    if (this.metadataType.entityExistsInWorkspace(this.metadataFilePath)) {
      this.isDuplicate = true;
    }
  }

  /**
   * Gets the translation objects for copying source from the workspace to the metadata API formatted directory
   * @param mdDir
   * @param tmpDir
   * @param unsupportedMimeTypes - the list of non-whitelisted static resource mime types
   * @param forceIgnore
   * @returns {Array}
   */
  getFilePathTranslations(mdDir, tmpDir, unsupportedMimeTypes?: string[], forceIgnore?) {
    let filePathTranslations = [];

    let promise;
    if (this.metadataType.hasContent()) {
      promise = Promise.resolve()
        .then(() => this.getContentPathTranslations(mdDir, unsupportedMimeTypes, forceIgnore))
        .then(contentPathTranslations => (filePathTranslations = contentPathTranslations));
    } else {
      promise = Promise.resolve();
    }

    return promise.then(() => {
      if (this.metadataType.shouldGetMetadataTranslation()) {
        const metadataPathTranslation = this.getMetadataPathTranslation(tmpDir, mdDir);
        filePathTranslations.push(metadataPathTranslation);
      }
      return filePathTranslations;
    });
  }

  private getContentPathTranslations(mdDir: string, unsupportedMimeTypes: string[], forceIgnore) {
    return this.metadataType
      .getOriginContentPathsForSourceConvert(
        this.getMetadataFilePath(),
        this.workspaceVersion,
        unsupportedMimeTypes,
        forceIgnore
      )
      .then(originContentPaths =>
        originContentPaths.map(originContentPath => {
          const mdapiContentPath = this.metadataType.getMdapiContentPathForSourceConvert(
            originContentPath,
            this.aggregateFullName,
            mdDir
          );
          if (!originContentPath && this.metadataType.hasContent()) {
            throw SfdxError.create('salesforce-alm', 'source', 'MissingComponentOrResource', [mdapiContentPath]);
          }
          return this.createTranslation(originContentPath, mdapiContentPath);
        })
      );
  }

  private getMetadataPathTranslation(tmpDir: string, mdDir: string) {
    const mdFilePath = this.getMetadataFilePath();

    // For non-decomposed metadata, use the file from the source dir. For decomposed metadata,
    // compose it to the tmpDir.
    const composedPath = this.decompStrategy.isComposable() ? this.composeMetadata(mdFilePath, tmpDir) : null;
    const workspacePathToMetadata = !_.isNil(composedPath) ? composedPath : mdFilePath;
    const mdapiMetadataPath = this.metadataType.getMdapiMetadataPath(mdFilePath, this.getAggregateFullName(), mdDir);
    return this.createTranslation(workspacePathToMetadata, mdapiMetadataPath);
  }

  /**
   *
   * @param sourcePath Source workspace filepath
   * @param mdapiPath Temporary mdapiDir filepath
   * @returns {{sourcePath: *, mdapiPath: *}}
   * @private
   */
  private createTranslation = function(sourcePath, mdapiPath) {
    return { sourcePath, mdapiPath };
  };

  /**
   * Composes a single metadata file from one or more files each representing a part of the whole.
   * It is important to understand that this does <b>not</b> have to be an mdapi xml file, even though
   * it usually will be. That determination will be driven by a type-specific configuration.
   *
   * @param metadataFilePath the workspace path that would be in use if this type were not transformed.
   * The locations of the actual decomposed files can be inferred from this name. This is a proxy for all
   * of decomposed files.
   * @param tmpDir temporary directory to hold the composed metadata file outside of the workspace.
   * @returns {string} the path of composed metadata file.
   */
  composeMetadata(metadataFilePath: string, tmpDir: string): string {
    let container;
    const containerPath = this.workspaceStrategy.getContainerPath(metadataFilePath, this.metadataType.getExt());

    if (!_.isNil(containerPath) && this.includeDecomposition(containerPath)) {
      if (!srcDevUtil.pathExistsSync(containerPath)) {
        const err = new Error();
        const metaExtIndex = containerPath.indexOf(MetadataRegistry.getMetadataFileExt());
        const pathWithoutMetaExt = containerPath.substring(0, metaExtIndex);
        if (srcDevUtil.pathExistsSync(pathWithoutMetaExt) && !this.metadataType.hasContent()) {
          err['message'] = messages.getMessage('MissingMetadataExtension', [pathWithoutMetaExt, containerPath]);
          err['name'] = 'Expected Metadata Extension';
        } else {
          err['message'] = messages.getMessage('MissingMetadataFileWithMetaExt', containerPath);
          err['name'] = 'Missing Metadata File';
        }
        throw err;
      } else {
        container = this.decompStrategy.newContainerDocument(this.metadataType.getMetadataName());
        try {
          container.setRepresentation(fs.readFileSync(containerPath, 'utf8'));
        } catch (e) {
          throw checkForXmlParseError(containerPath, e);
        }
      }
    }

    const decompositions = new Map<DecomposedSubtypeConfig, MetadataDocument[]>();
    const decompositionPaths = this.workspaceStrategy.findDecomposedPaths(metadataFilePath, this.metadataType.getExt());
    for (const decomposedSubtypeConfig of decompositionPaths.keys()) {
      for (const decompositionPath of decompositionPaths.get(decomposedSubtypeConfig)) {
        if (this.includeDecomposition(decompositionPath)) {
          const decomposition = this.decompStrategy.newDecompositionDocument(decomposedSubtypeConfig.metadataName);
          try {
            decomposition.setRepresentation(fs.readFileSync(decompositionPath, 'utf8'));
          } catch (e) {
            throw checkForXmlParseError(decompositionPath, e);
          }
          if (_.isNil(decompositions.get(decomposedSubtypeConfig))) {
            decompositions.set(decomposedSubtypeConfig, []);
          }
          decompositions.get(decomposedSubtypeConfig).push(decomposition);
        }
      }
    }

    const composed = this.decompStrategy.compose(container, decompositions);
    const composedPath = this.getComposedFilePath(tmpDir);
    srcDevUtil.ensureDirectoryExistsSync(path.dirname(composedPath));
    fs.writeFileSync(composedPath, composed.getRepresentation());

    return composedPath;
  }

  private includeDecomposition(decompositionFilePath: string): boolean {
    if (this.metadataType.getDecompositionConfig().useSparseComposition) {
      const candidateElement = this.workspaceElements.find(
        workspaceElement =>
          workspaceElement.getSourcePath() === decompositionFilePath &&
          (workspaceElement.getState() == sourceState.NEW || workspaceElement.getState() == sourceState.CHANGED)
      );
      return !_.isNil(candidateElement);
    } else {
      return true;
    }
  }

  /**
   *
   * @param sourceFilePath an aggregated file, typically an mdapi xml file
   * @param metadataFilePath the workspace path that would be in use if this type were not transformed.
   * The locations of the actual decomposed files can be inferred from this name. This is a proxy for all
   * of decomposed files.
   * @param manifest
   * @returns {[string[], string[], string[]]} a triplet containing a list of new, updated, and deleted workspace paths for the decomposed files.
   */
  private decomposeMetadata(
    sourceFilePath: string,
    metadataFilePath: string,
    manifest?
  ): [string[], string[], string[], string[]] {
    const composed = this.decompStrategy.newComposedDocument(this.metadataType.getDecompositionConfig().metadataName);
    try {
      composed.setRepresentation(fs.readFileSync(sourceFilePath, 'utf8'));
    } catch (e) {
      throw checkForXmlParseError(sourceFilePath, e);
    }

    let container: MetadataDocument;
    let decompositions: Map<DecomposedSubtypeConfig, MetadataDocument[]>;
    [container, decompositions] = this.decompStrategy.decompose(
      composed,
      this.metadataType.getAggregateFullNameFromFilePath(metadataFilePath),
      manifest,
      this.metadataType
    );

    const documents = this.getPaths(metadataFilePath, container, decompositions);
    const existingPaths = this.getMetadataPaths(metadataFilePath);

    return this.commitStrategy.commit(documents, existingPaths, this.isDuplicate);
  }

  private getComposedFilePath(tmpDir: string) {
    return this.metadataType.getAggregateMetadataPathInDir(tmpDir, this.getAggregateFullName());
  }

  private getPaths(
    metadataFilePath: string,
    container: MetadataDocument,
    decompositions: Map<DecomposedSubtypeConfig, MetadataDocument[]>
  ): Map<string, MetadataDocument> {
    const paths = new Map<string, MetadataDocument>();
    const containerPath = this.workspaceStrategy.getContainerPath(metadataFilePath, this.metadataType.getExt());
    if (!_.isNil(containerPath)) {
      if (!_.isNil(container)) {
        paths.set(containerPath, container);
      }
    }

    for (const decomposedSubtypeConfig of decompositions.keys()) {
      for (const decomposition of decompositions.get(decomposedSubtypeConfig)) {
        const sourceDir = this.workspaceStrategy.getDecomposedSubtypeDirFromMetadataFile(
          metadataFilePath,
          this.metadataType.getExt(),
          decomposedSubtypeConfig
        );
        const annotation: MetadataDocumentAnnotation = decomposition.getAnnotation();
        const fileName = this.workspaceStrategy.getDecomposedFileName(annotation, decomposedSubtypeConfig);
        const decomposedPath = path.join(sourceDir, fileName);
        paths.set(decomposedPath, decomposition);
      }
    }
    return paths;
  }
}

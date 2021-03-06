/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-unused-vars */

import { WorkspaceElement } from './workspaceElement';
import { DecompositionConfig } from './decompositionStrategy/decompositionConfig';

/**
 * Interface for the class representing the functions of a typeDef, real and virtual, in the metadataRegistry
 */
export interface MetadataType {
  getMetadataName(): string;

  getAggregateMetadataName(): string;

  /**
   * Only relevant for the EmailTemplate type (InFolderType) so it can match EmailFolder AggregateSourceElements
   * during a convert or deploy.  This will return "Email" rather than "EmailTemplate".
   */
  getBaseTypeName(): string;

  getExt(): string;

  isAddressable(): boolean;

  getDecompositionConfig(): DecompositionConfig;

  /**
   * Returns the source path for this metadata type, which is used in a changesets flow.
   * Most times this will just be the file path, but types can override to return a
   * different path. E.g., static resource files should return the corresponding static
   * resource directory.
   */
  resolveSourcePath(sourcePath: string): string;

  /**
   * Gets the fullname for the workspace element represented by the filePath
   * For a filePath to a decomposed workspace element such as CustomField, the fullName
   * would be 'CustomObjectName__c.CustomFieldName__c'
   *
   * @param filePath - the path to the file in the workspace
   * @returns {string}
   */
  getFullNameFromFilePath(filePath: string): string;

  /**
   * Gets the fullName for the aggregateSourceElement related to the given filePath
   * For a path to a decomposed type such as Custom Field, this method would return the fullName of its
   * parent object: 'CustomObjectName__c'
   *
   * @param filePath - the path to the file in the workspace
   * @returns {string}
   */
  getAggregateFullNameFromFilePath(filePath: string): string;

  /**
   * Gets the full nondecomposed metadata file path for the aggregate entity
   * For example, given a filePath to a decomposed CustomField workspace file, this method would return
   * the nondecomposed filePath to its parent CustomObject entity
   *
   * @param filePath
   * @returns {any}
   */
  getAggregateMetadataFilePathFromWorkspacePath(filePath: string): string;

  /**
   * Returns the full default aggregate (non-decomposed) metadata path for the given entity fullName
   *
   * @param fullName
   * @param defaultSrcDir - the path to the directory containing the given metadata type: in most cases, this is:
   *          <full-path-to-default-package-name>/main/default
   * @param bundleFileProperties - file properties for the Aura Definition Bundle and Lightning Component Bundle definition files
   * @returns {any}
   */
  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string;

  /**
   * Returns the aggregate (non-decomposed) metadata path for the given entity fullName
   *
   * @param {string} dirName - the path to the directory containing the given metadata type
   *      For example: for the path <workspace>/<defaultProjectPath>/main/default/classes...
   *      dirName would be: <workspace>/<defaultProjectPath>/main/default/
   * @param {string} fullName
   * @returns {string}
   */
  getAggregateMetadataPathInDir(dirName: string, fullName: string): string;

  getAggregateFullNameFromSourceMemberName(sourceMemberName: string): string;

  /**
   * Returns the aggregate fullName for the given workspace fullName
   *
   * @param {string} workspaceFullName - if a workspace element is decomposed or a child of a parent aggregate element
   * (i.e. CustomField or AuraDefinitionBundle sub-components, then the workspaceFullName will include the parent fullName
   *
   * For example: A CustomField workspace fullName might be: 'MyCustomObj__c.MyCustomField__c'
   * Its corresponding aggregate fullName would be 'MyCustomObj__c'
   *
   * @returns {string}
   */
  getAggregateFullNameFromWorkspaceFullName(workspaceFullName: string): string;

  /**
   * Returns the aggregate fullName from the mdapi retrieved fileProperty; For metadata types where we track, the
   * aggregate type as well as its subtypes, this method returns the fullName for the parent aggregate entity
   *      For example: For AuraDefinitionBundle, we get fileProperties for each bundle sub-component
   *          e.g. 'MyAuraBundle/MyAuraBundleController.js'
   *      The aggregate fullName for the above fileProperty is 'MyAuraBundle'
   *
   * @param fileProperty
   * @param {string} namespace
   * @returns {string}
   */
  getAggregateFullNameFromFileProperty(fileProperty, namespace: string): string;

  getMdapiMetadataPath(metadataFilePath: string, aggregateFullName: string, mdDir: string): string;

  hasIndividuallyAddressableChildWorkspaceElements(): boolean;

  isStandardMember(workspaceFullName: string): boolean;

  /**
   * Returns the workspace elements for source to be deleted from the workspace
   *
   * @param {string} aggregateMetadataPath
   * @returns {WorkspaceElement[]}
   */
  getWorkspaceElementsToDelete(aggregateMetadataPath: string, fileProperty): WorkspaceElement[];

  /**
   * Gets the full path to the retrieved metadata file
   *
   * @param fileProperties
   * @param {string} retrieveRoot
   * @param bundleFileProperties
   * @returns {string}
   */
  getRetrievedMetadataPath(fileProperties, retrieveRoot: string, bundleFileProperties): string;

  /**
   * Gets the full path to the retrieved content file
   *
   * @param fileProperties
   * @param {string} retrieveRoot
   * @returns {string}
   */
  getRetrievedContentPath(fileProperties, retrieveRoot: string): string;

  /**
   * Returns the location of the content file to be copied to the mdapi directory. For files that
   * are decomposed in the workspace, this method returns the location of the re-composed source
   */
  getOriginContentPathsForSourceConvert(
    metadataFilePath: string,
    workspaceVersion: string,
    unsupportedMimeTypes: string[],
    forceIgnore
  ): Promise<string[]>;

  /**
   * Gets the full path to the location in the metadata api formatted directory where the source will be copied
   *
   * @param {string} originContentPath - path to the content file in the sfdx project directory
   * @param {string} aggregateFullName
   * @param {string} mdDir
   * @returns {string}
   */
  getMdapiContentPathForSourceConvert(originContentPath: string, aggregateFullName: string, mdDir: string): string;

  isFolderType(): boolean;

  /**
   * Some metadata types have multiple content files. One of those files is the most important and
   * the its presence is required in order for the entity to remain in existence.
   *
   * @param {string} metadataFilePath
   * @returns {boolean}
   */
  mainContentFileExists(metadataFilePath: string): boolean;

  displayAggregateRemoteChangesOnly(): boolean;

  sourceMemberFullNameCorrespondsWithWorkspaceFullName(
    sourceMemberFullName: string,
    workspaceFullName: string
  ): boolean;

  conflictDetected(remoteChangeType: string, remoteChangeFullName: string, workspaceFullName: string): boolean;

  trackRemoteChangeForSourceMemberName(sourceMemberName: string): boolean;

  onlyDisplayOneConflictPerAggregate(): boolean;

  /**
   * Returns the path to be displayed in the command output
   *
   * @param {string} workspaceFilePath
   * @returns {string}
   */
  getDisplayPathForLocalConflict(workspaceFilePath: string): string;

  /**
   * Returns whether a metadata type has 1 or more content files, not just a meta.xml file.
   */
  hasContent(): boolean;

  /**
   * Returns whether a metadata type has a parent.  E.g., `CustomField` --> `CustomObject`
   */
  hasParent(): boolean;

  getAggregateFullNameFromComponentFailure(componentFailure): string;

  getAggregateFullNameFromMdapiPackagePath(mdapiPackagePath: string): string;

  /**
   * Returns the metadata name for the given source member type
   *
   * @param {string} sourceMemberType
   * @returns {string}
   */
  getDisplayNameForRemoteChange(sourceMemberType: string): string;

  /**
   * Returns true if the entity can be deleted from the scratch org
   *
   * @param {string} workspaceFullName
   * @returns {boolean}
   */
  deleteSupported(workspaceFullName: string): boolean;

  getChildMetadataTypes(): string[];

  entityExistsInWorkspace(metadataFilePath: string): boolean;

  validateDeletedContentPath(deletedContentPath: string, contentPaths: string[], metadataRegistry): void;

  isContentPath(sourcePath: string): boolean;

  getComponentFailureWorkspaceContentPath(metadataFilePath: string, workspaceContentPaths: string[]): string;

  getWorkspaceFullNameFromComponentFailure(componentFailure): string;

  componentFailureIsInMetadataFile(componentFileName: string): boolean;

  requiresIndividuallyAddressableMembersInPackage(): boolean;

  handleSlashesForSourceMemberName(sourceMemberFullName: string): string;

  getDeprecationMessage(fullName?: string): string;

  /**
   *
   * @param {string} sourceMemberName
   * @param {string} sourceMemberType
   * @param {boolean} isNameObsolete
   * @returns {any} an object containing the fullName, typeName, and isNameObsolete formatted for the
   * subsequent retrieve of the metadata
   */
  parseSourceMemberForMetadataRetrieve(
    sourceMemberName: string,
    sourceMemberType: string,
    isNameObsolete: boolean
  ): any;

  /**
   * Check if the container file for a decomposed metadata type is valid
   *
   * @param container
   * @returns {boolean}
   */
  isContainerValid(container): boolean;

  shouldGetMetadataTranslation(): boolean;

  /**
   * Returns true if the entire aggregateSourceElement should be deleted from the workspace
   */
  shouldDeleteWorkspaceAggregate(metadataType: string): boolean;

  getWorkspaceContentFilePath(metadataFilePath, retrievedContentFilePath): string;
}

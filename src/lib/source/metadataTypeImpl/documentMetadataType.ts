/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as path from 'path';
import * as _ from 'lodash';

import { WorkspaceFileState } from '../workspaceFileState';
import MetadataRegistry = require('../metadataRegistry');

import { WorkspaceElement } from '../workspaceElement';
import * as PathUtil from '../sourcePathUtil';
import { InFolderMetadataType } from './inFolderMetadataType';

export class DocumentMetadataType extends InFolderMetadataType {
  protected getMdapiFormattedMetadataFileName(metadataFilePath: string): string {
    const workspaceContentFilePath = PathUtil.getContentPathWithNonStdExtFromMetadataPath(metadataFilePath);
    const workspaceContentFileName = path.basename(workspaceContentFilePath);
    return `${workspaceContentFileName}${MetadataRegistry.getMetadataFileExt()}`;
  }

  getAggregateMetadataFilePathFromWorkspacePath(workspacePath: string): string {
    const metadataFileName = `${PathUtil.getFileName(workspacePath)}.${
      this.typeDefObj.ext
    }${MetadataRegistry.getMetadataFileExt()}`;
    return path.join(path.dirname(workspacePath), metadataFileName);
  }

  getAggregateFullNameFromFileProperty(fileProperty): string {
    return fileProperty.fullName.split('.')[0];
  }

  getWorkspaceElementsToDelete(aggregateMetadataPath: string, fileProperty): WorkspaceElement[] {
    const workspaceElementsToDelete = [];
    if (aggregateMetadataPath) {
      const fullName = this.getAggregateFullNameFromFileProperty(fileProperty);
      const existingDocumentFilePath = PathUtil.getContentPathWithNonStdExtFromMetadataPath(aggregateMetadataPath);
      const existingDocumentFileTypeExtension = path.extname(existingDocumentFilePath).replace('.', '');
      const retrievedDocumentExtension = path.extname(fileProperty.fullName).replace('.', '');

      if (existingDocumentFileTypeExtension !== retrievedDocumentExtension) {
        const deletedWorkspaceElement = new WorkspaceElement(
          this.getMetadataName(),
          fullName,
          existingDocumentFilePath,
          WorkspaceFileState.DELETED,
          true
        );
        workspaceElementsToDelete.push(deletedWorkspaceElement);
      }
    }

    return workspaceElementsToDelete;
  }

  getOriginContentPathsForSourceConvert(
    metadataFilePath: string,
    workspaceVersion: string,
    unsupportedMimeTypes: string[],
    forceIgnore
  ): Promise<string[]> {
    return Promise.resolve([PathUtil.getContentPathWithNonStdExtFromMetadataPath(metadataFilePath)]);
  }

  mainContentFileExists(metadataFilePath: string): boolean {
    const contentFilePath = PathUtil.getContentPathWithNonStdExtFromMetadataPath(metadataFilePath);
    return !_.isNil(contentFilePath);
  }

  getAggregateFullNameFromComponentFailure(componentFailure): string {
    const componentFullName = componentFailure.fullName;
    return componentFullName.substring(0, componentFullName.indexOf(path.extname(componentFullName)));
  }
}

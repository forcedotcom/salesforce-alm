/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import { DefaultMetadataType } from './defaultMetadataType';
import { getFileName, getParentDirectoryName, getPathToDir } from '../sourcePathUtil';

import MetadataRegistry = require('../metadataRegistry');

export class BotSubtypeMetadataType extends DefaultMetadataType {
  getAggregateMetadataName(): string {
    return this.typeDefObj.parent.metadataName;
  }

  getFullNameFromFilePath(filePath: string): string {
    const parentName = getParentDirectoryName(filePath);
    const fileName = getFileName(filePath);
    super.debug(() => `getFullNameFromFilePath parentName: ${parentName} fileName: ${fileName}`);
    return `${parentName}.${fileName}`;
  }

  getAggregateFullNameFromFilePath(filePath: string): string {
    super.debug(() => `getAggregateFullNameFromFilePath filePath: ${filePath}`);
    return getParentDirectoryName(filePath);
  }

  getAggregateMetadataFilePathFromWorkspacePath(filePath): string {
    const aggregateFullName = this.getAggregateFullNameFromFilePath(filePath);
    const pathToDefaultDir = getPathToDir(filePath, this.typeDefObj.parent.defaultDirectory);
    const fileName = `${aggregateFullName}.${this.typeDefObj.parent.ext}${MetadataRegistry.getMetadataFileExt()}`;
    super.debug(
      () =>
        `getAggregateMetadataFilePathFromWorkspacePath aggregateFullName: ${aggregateFullName} pathToDefaultDir: ${pathToDefaultDir} fileName: ${fileName}`
    );
    return path.join(pathToDefaultDir, fileName);
  }

  getAggregateFullNameFromSourceMemberName(sourceMemberName: string): string {
    super.debug(() => `getAggregateFullNameFromSourceMemberName: ${sourceMemberName}`);
    return sourceMemberName.split('.')[0];
  }

  getAggregateFullNameFromWorkspaceFullName(workspaceFullName: string): string {
    super.debug(() => `getAggregateFullNameFromWorkspaceFullName workspaceFullName: ${workspaceFullName}`);
    return workspaceFullName.split('.')[0];
  }

  getAggregateFullNameFromComponentFailure(componentFailure): string {
    super.debug(() => `getAggregateFullNameFromComponentFailure componentFailure: ${componentFailure}`);
    return this.getAggregateFullNameFromWorkspaceFullName(componentFailure.fullName);
  }

  getWorkspaceFullNameFromComponentFailure(componentFailure): string {
    super.debug(() => `getWorkspaceFullNameFromComponentFailure componentFailure: ${componentFailure}`);
    return componentFailure.fullName;
  }
}

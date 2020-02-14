/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import { DefaultMetadataType } from './defaultMetadataType';
import * as PathUtil from '../sourcePathUtil';
import MetadataRegistry = require('../metadataRegistry');

export class CustomObjectSubtypeMetadataType extends DefaultMetadataType {
  getAggregateMetadataName(): string {
    return this.typeDefObj.parent.metadataName;
  }

  getFullNameFromFilePath(filePath: string): string {
    const parentName = PathUtil.getGrandparentDirectoryName(filePath);
    const fileName = PathUtil.getFileName(filePath);
    return `${parentName}.${fileName}`;
  }

  getAggregateFullNameFromFilePath(filePath: string): string {
    return PathUtil.getGrandparentDirectoryName(filePath);
  }

  getAggregateMetadataFilePathFromWorkspacePath(filePath): string {
    const aggregateFullName = this.getAggregateFullNameFromFilePath(filePath);
    const pathToDefaultDir = PathUtil.getPathToDir(filePath, this.typeDefObj.parent.defaultDirectory);
    const fileName = `${aggregateFullName}.${this.typeDefObj.parent.ext}${MetadataRegistry.getMetadataFileExt()}`;
    return path.join(pathToDefaultDir, fileName);
  }

  getAggregateFullNameFromSourceMemberName(sourceMemberName: string): string {
    return sourceMemberName.split('.')[0];
  }

  getAggregateFullNameFromWorkspaceFullName(workspaceFullName: string): string {
    return workspaceFullName.split('.')[0];
  }

  getAggregateFullNameFromComponentFailure(componentFailure): string {
    return this.getAggregateFullNameFromWorkspaceFullName(componentFailure.fullName);
  }

  getWorkspaceFullNameFromComponentFailure(componentFailure): string {
    return componentFailure.fullName;
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DefaultMetadataType } from './defaultMetadataType';
import { removeParentDirFromPath, canRead } from '../sourcePathUtil';
import * as path from 'path';

export class BotMetadataType extends DefaultMetadataType {
  hasIndividuallyAddressableChildWorkspaceElements(): boolean {
    return true;
  }

  getAggregateMetadataFilePathFromWorkspacePath(filePath: string): string {
    super.debug(() => `getAggregateMetadataFilePathFromWorkspacePath filePath: ${filePath}`);
    return removeParentDirFromPath(filePath);
  }

  entityExistsInWorkspace(metadataFilePath: string): boolean {
    const aggregateFullName = this.getAggregateFullNameFromFilePath(metadataFilePath);
    super.debug(() => `entityExistsInWorkspace metadataFilePath: ${metadataFilePath}`);
    return canRead(path.join(path.dirname(metadataFilePath), aggregateFullName));
  }

  isContainerValid(container): boolean {
    const containerDataNodes = container.data.childNodes;
    const isValid = !(
      containerDataNodes &&
      containerDataNodes[0].tagName === 'xml' &&
      containerDataNodes[1].tagName == this.getMetadataName() &&
      containerDataNodes[1].childNodes.length === 0
    );
    super.debug(() => `isContainerValid isValid: ${isValid}`);
    return isValid;
  }
}

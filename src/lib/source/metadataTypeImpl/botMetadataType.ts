/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { removeParentDirFromPath, canRead } from '../sourcePathUtil';
import { DefaultMetadataType } from './defaultMetadataType';

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

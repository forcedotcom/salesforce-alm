/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import { DefaultMetadataType } from './defaultMetadataType';
import MetadataRegistry = require('../metadataRegistry');

export class Territory2ModelMetadataType extends DefaultMetadataType {
  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string {
    const fileName = `${fullName}.${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`;
    return path.join(defaultSourceDir, this.typeDefObj.defaultDirectory, fullName, fileName);
  }

  protected getPathToMdapiSourceDir(aggregateFullName: string, mdDir: string): string {
    return path.join(mdDir, this.typeDefObj.defaultDirectory, aggregateFullName);
  }

  getAggregateFullNameFromFileProperty(fileProperty, namespace: string): string {
    return path.basename(fileProperty.fileName, `.${this.typeDefObj.ext}`);
  }
}

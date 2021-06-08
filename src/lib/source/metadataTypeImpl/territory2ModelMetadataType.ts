/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

import MetadataRegistry = require('../metadataRegistry');
import { DefaultMetadataType } from './defaultMetadataType';

export class Territory2ModelMetadataType extends DefaultMetadataType {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDefaultAggregateMetadataPath(fullName: string, defaultSourceDir: string, bundleFileProperties): string {
    const fileName = `${fullName}.${this.typeDefObj.ext}${MetadataRegistry.getMetadataFileExt()}`;
    return path.join(defaultSourceDir, this.typeDefObj.defaultDirectory, fullName, fileName);
  }

  protected getPathToMdapiSourceDir(aggregateFullName: string, mdDir: string): string {
    return path.join(mdDir, this.typeDefObj.defaultDirectory, aggregateFullName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAggregateFullNameFromFileProperty(fileProperty, namespace: string): string {
    return path.basename(fileProperty.fileName, `.${this.typeDefObj.ext}`);
  }
}

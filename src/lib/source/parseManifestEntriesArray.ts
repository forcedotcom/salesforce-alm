/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxError, SfdxErrorConfig } from '@salesforce/core';
import { MdRetrieveApi } from '../mdapi/mdapiRetrieveApi';
import * as PathUtil from '../source/sourcePathUtil';
import { ManifestEntry } from './types';

/**
 * Parse the manifest file and create a list ManifestEntry objects.
 *
 * @param manifestPath {string} The filepath for the manifest
 * @returns {ManifestEntry[]} An array for ManifestEntry objects from the manifest.
 */
export const parseToManifestEntriesArray = async function (manifestPath: string): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];
  const options = {
    unpackaged: manifestPath,
  };

  return MdRetrieveApi._getPackageJson(undefined, options).then((manifestJson) => {
    toArray(manifestJson.types).forEach((type) => {
      if (!type.name) {
        const errConfig = new SfdxErrorConfig('salesforce-alm', 'source', 'IllFormattedManifest');
        errConfig.setErrorTokens(['; <name> is missing']);
        throw SfdxError.create(errConfig);
      }
      toArray(type.members).forEach((member) => {
        const _member = PathUtil.replaceForwardSlashes(member);
        entries.push({
          type: type.name,
          name: _member,
        });
      });
    });
    return entries;
  });
};

/**
 * Convert the argument into an array datatype
 *
 * @param arrayOrObjectOrUndefined
 * @returns Array
 */
export const toArray = function (arrayOrObjectOrUndefined: any) {
  if (!arrayOrObjectOrUndefined) {
    return [];
  } else if (Array.isArray(arrayOrObjectOrUndefined)) {
    return arrayOrObjectOrUndefined;
  } else {
    return [arrayOrObjectOrUndefined];
  }
};

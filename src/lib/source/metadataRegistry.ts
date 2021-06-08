/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as util from 'util';

// 3pp
import * as _ from 'lodash';

import { fs, SfdxProject } from '@salesforce/core';
import { TypeDefObj } from './typeDefObj';

interface TypeDefObjs {
  [key: string]: TypeDefObj;
}

// Constants
const METADATA_FILE_EXT = '-meta.xml';

const LWC_FOLDER_NAME = 'lwc';

const _lightningDefTypes = {
  APPLICATION: {
    defType: 'APPLICATION',
    format: 'XML',
    fileSuffix: '.app',
    hasMetadata: true,
  },
  CONTROLLER: {
    defType: 'CONTROLLER',
    format: 'JS',
    fileSuffix: 'Controller.js',
  },
  COMPONENT: {
    defType: 'COMPONENT',
    format: 'XML',
    fileSuffix: '.cmp',
    hasMetadata: true,
  },
  EVENT: {
    defType: 'EVENT',
    format: 'XML',
    fileSuffix: '.evt',
    hasMetadata: 'true',
  },
  HELPER: {
    defType: 'HELPER',
    format: 'JS',
    fileSuffix: 'Helper.js',
  },
  INTERFACE: {
    defType: 'INTERFACE',
    format: 'XML',
    fileSuffix: '.intf',
    hasMetadata: true,
  },
  RENDERER: {
    defType: 'RENDERER',
    format: 'JS',
    fileSuffix: 'Renderer.js',
  },
  STYLE: {
    defType: 'STYLE',
    format: 'CSS',
    fileSuffix: '.css',
  },
  PROVIDER: {
    defType: 'PROVIDER',
    format: 'JS',
    fileSuffix: 'Provider.js',
  },
  MODEL: {
    defType: 'MODEL',
    format: 'JS',
    fileSuffix: 'Model.js',
  },
  TESTSUITE: {
    defType: 'TESTSUITE',
    format: 'JS',
    fileSuffix: 'Test.js',
  },
  DOCUMENTATION: {
    defType: 'DOCUMENTATION',
    format: 'XML',
    fileSuffix: '.auradoc',
  },
  TOKENS: {
    defType: 'TOKENS',
    format: 'XML',
    fileSuffix: '.tokens',
    hasMetadata: true,
  },
  DESIGN: {
    defType: 'DESIGN',
    format: 'XML',
    fileSuffix: '.design',
  },
  SVG: {
    defType: 'SVG',
    format: 'SVG',
    fileSuffix: '.svg',
  },
};

const _lwcDefTypes = {
  MODULE_RESOURCE_JS: {
    defType: 'MODULE',
    format: 'JS',
    fileSuffix: '.js',
  },
  MODULE_RESOURCE_HTML: {
    defType: 'MODULE',
    format: 'HTML',
    fileSuffix: '.html',
  },
  MODULE_RESOURCE_CSS: {
    defType: 'MODULE',
    format: 'CSS',
    fileSuffix: '.css',
  },
  MODULE_RESOURCE_SVG: {
    defType: 'MODULE',
    format: 'SVG',
    fileSuffix: '.svg',
  },
  MODULE_RESOURCE_XML: {
    defType: 'MODULE',
    format: 'XML',
    fileSuffix: '.xml',
  },
};

const _waveDefTypes = {
  JSON: {
    defType: 'JSON',
    format: 'JSON',
    fileSuffix: '.json',
  },
  HTML: {
    defType: 'HTML',
    format: 'HTML',
    fileSuffix: '.html',
  },
  CSV: {
    defType: 'CSV',
    format: 'CSV',
    fileSuffix: '.csv',
  },
  XML: {
    defType: 'XML',
    format: 'XML',
    fileSuffix: '.xml',
  },
  TXT: {
    defType: 'TXT',
    format: 'TXT',
    fileSuffix: '.txt',
  },
  IMG: {
    defType: 'IMG',
    format: 'IMG',
    fileSuffix: '.img',
  },
  JPG: {
    defType: 'JPG',
    format: 'JPG',
    fileSuffix: '.jpg',
  },
  JPEG: {
    defType: 'JPEG',
    format: 'JPEG',
    fileSuffix: '.jpeg',
  },
  GIF: {
    defType: 'GIF',
    format: 'GIF',
    fileSuffix: '.gif',
  },
  PNG: {
    defType: 'PNG',
    format: 'PNG',
    fileSuffix: '.png',
  },
};

const _typeDefMatchesDecompositionExtension = function (typeDef: TypeDefObj, typeExtension: string) {
  if (
    !util.isNullOrUndefined(typeDef.decompositionConfig) &&
    !util.isNullOrUndefined(typeDef.decompositionConfig.decompositions)
  ) {
    for (const decomposition of typeDef.decompositionConfig.decompositions) {
      if (decomposition.ext.toLowerCase() === typeExtension.toLowerCase()) {
        return true;
      }
    }
  }
  return false;
};

const _typeDefMatchesExtension = function (typeDef, typeExtension, includeDecomposedSubtypes) {
  if (!util.isNullOrUndefined(typeDef.ext) && typeDef.ext.toLowerCase() === typeExtension) {
    return true;
  } else if (includeDecomposedSubtypes) {
    return _typeDefMatchesDecompositionExtension(typeDef, typeExtension);
  } else {
    return false;
  }
};

const _getDecompositionByName = function (typeDefs, value) {
  if (util.isNullOrUndefined(value)) {
    return null;
  }

  let foundDecomposition;
  Object.keys(typeDefs).forEach((key) => {
    if (!util.isNullOrUndefined(typeDefs[key].decompositionConfig)) {
      typeDefs[key].decompositionConfig.decompositions.forEach((decomposition) => {
        if (decomposition.metadataName === value) {
          foundDecomposition = decomposition;
        }
      });
    }
  });
  return util.isNullOrUndefined(foundDecomposition) ? null : foundDecomposition;
};

class MetadataRegistry {
  private readonly typeDefs: TypeDefObjs;
  private readonly typeDirectories: string[];
  private readonly lightningDefTypes;
  private readonly waveDefTypes;
  private lwcDefTypes;
  private typeDefsByExtension;
  private readonly metadataFileExt;
  private readonly projectPath: string;

  constructor() {
    this.typeDefs = this.getMetadataTypeDefs();
    this.typeDirectories = this.getTypeDirectories();
    this.lightningDefTypes = _lightningDefTypes;
    this.waveDefTypes = _waveDefTypes;
    this.lwcDefTypes = _lwcDefTypes;
    this.typeDefsByExtension = this.getTypeDefsByExtension();
    this.metadataFileExt = METADATA_FILE_EXT;
    this.projectPath = SfdxProject.resolveProjectPathSync();
  }

  isSupported(metadataName) {
    const isSupportedType = !util.isNullOrUndefined(this.getTypeDefinitionByMetadataName(metadataName));
    if (isSupportedType) {
      return true;
    }
    const decomposedSubtype = _getDecompositionByName(this.typeDefs, metadataName);
    return !util.isNullOrUndefined(decomposedSubtype) && decomposedSubtype.isAddressable;
  }

  static getMetadataFileExt() {
    return METADATA_FILE_EXT;
  }

  public getMetadataTypeDefs() {
    if (!this.typeDefs) {
      const metadataInfos = require(path.join(__dirname, '..', '..', '..', 'metadata', 'metadataTypeInfos.json')) as {
        typeDefs: TypeDefObjs;
      };
      return metadataInfos.typeDefs;
    } else {
      return this.typeDefs;
    }
  }

  /**
   * Returns a formatted key provided a metadata type and name.  This is used as a unique
   * identifier for metadata.  E.g., `ApexClass__MyClass`
   *
   * @param metadataType The metadata type. E.g., `ApexClass`
   * @param metadataName The metadata name. E.g., `MyClass`
   */
  public static getMetadataKey(metadataType: string, metadataName: string): string {
    return `${metadataType}__${metadataName}`;
  }

  // Returns list of default directories for all metadata types
  private getTypeDirectories(): string[] {
    if (util.isNullOrUndefined(this.typeDirectories)) {
      const metadataTypeInfos = this.getMetadataTypeDefs();
      return Object.values(metadataTypeInfos).map((i) => i.defaultDirectory);
    } else {
      return this.typeDirectories;
    }
  }

  private getTypeDefsByExtension() {
    const typeDefsByExtension = new Map();
    Object.keys(this.typeDefs).forEach((metadataName) => {
      const metadataTypeExtension = this.typeDefs[metadataName].ext;
      typeDefsByExtension.set(metadataTypeExtension, this.typeDefs[metadataName]);
    });
    return typeDefsByExtension;
  }

  public getLightningDefByFileName(fileName) {
    return this.lightningDefTypes[
      Object.keys(this.lightningDefTypes).find((key) => {
        const lightningDefType = this.lightningDefTypes[key];
        return fileName.endsWith(lightningDefType.fileSuffix);
      })
    ];
  }

  public getWaveDefByFileName(fileName) {
    return this.waveDefTypes[
      Object.keys(this.waveDefTypes).find((key) => {
        const waveDefType = this.waveDefTypes[key];
        return fileName.endsWith(waveDefType.fileSuffix);
      })
    ];
  }

  public getLightningDefByType(type) {
    return this.lightningDefTypes[
      Object.keys(this.lightningDefTypes).find((key) => {
        const lightningDefType = this.lightningDefTypes[key];
        return type === lightningDefType.defType;
      })
    ];
  }

  /**
   * Returns the array of typeDefs where the default directory of each typeDef matches the passed in 'name' param
   *
   * @param name
   * @returns {any[]}
   */
  public getTypeDefinitionsByDirectoryName(name) {
    const metadataNames = Object.keys(this.typeDefs).filter((key) => this.typeDefs[key].defaultDirectory === name);
    return metadataNames.map((metadataName) => this.typeDefs[metadataName]);
  }

  public getTypeDefinitionByMetadataName(metadataName: string) {
    let typeDef = this.typeDefs[metadataName];
    if (!typeDef && metadataName.endsWith('Settings')) {
      // even though there is one "Settings" in the describeMetadata response when you retrieve a setting it comes
      // down as "AccountSettings", "CaseSettings", etc. so here we account for that scenario.
      typeDef = this.typeDefs['Settings'];
    }
    if (!typeDef && metadataName.endsWith('CustomLabel')) {
      typeDef = this.typeDefs['CustomLabels'];
    }
    return typeDef;
  }

  // given file extension, return type def
  public getTypeDefinitionByFileName(filePath: string, useTrueExtType?: boolean) {
    if (util.isNullOrUndefined(filePath)) {
      return null;
    }

    let workspaceFilePath = filePath;
    if (filePath.startsWith(this.projectPath)) {
      workspaceFilePath = filePath.substring(SfdxProject.resolveProjectPathSync().length, filePath.length);
    }

    if (workspaceFilePath.includes(`${path.sep}aura${path.sep}`)) {
      return this.typeDefs.AuraDefinitionBundle;
    }

    if (workspaceFilePath.includes(`${path.sep}waveTemplates${path.sep}`)) {
      return this.typeDefs.WaveTemplateBundle;
    }

    if (workspaceFilePath.includes(`${path.sep}${this.typeDefs.ExperienceBundle.defaultDirectory}${path.sep}`)) {
      return this.typeDefs.ExperienceBundle;
    }

    if (workspaceFilePath.includes(`${path.sep}${LWC_FOLDER_NAME}${path.sep}`)) {
      return this.typeDefs.LightningComponentBundle;
    }

    if (workspaceFilePath.includes(`${path.sep}${this.typeDefs.CustomSite.defaultDirectory}${path.sep}`)) {
      return this.typeDefs.CustomSite;
    }

    // CustomObject file names are special, they are all named "object-meta.xml"
    if (path.basename(workspaceFilePath) === this.typeDefs.CustomObject.ext + this.metadataFileExt) {
      return this.typeDefs.CustomObject;
    }

    const typeDefWithNonStandardExtension = this.getTypeDefinitionByFileNameWithNonStandardExtension(workspaceFilePath);
    if (!_.isNil(typeDefWithNonStandardExtension)) {
      return typeDefWithNonStandardExtension;
    }

    if (workspaceFilePath.endsWith(this.metadataFileExt)) {
      workspaceFilePath = workspaceFilePath.substring(0, workspaceFilePath.indexOf(this.metadataFileExt));
    }
    let typeExtension = path.extname(workspaceFilePath);
    if (util.isNullOrUndefined(typeExtension)) {
      return null;
    }

    typeExtension = typeExtension.replace('.', '');

    const defs = Object.values(this.typeDefs);
    const defaultDirectory = path
      .dirname(workspaceFilePath)
      .split(path.sep)
      .find((i) => !!i && this.typeDirectories.includes(i));
    let typeDef: TypeDefObj;
    if (defaultDirectory) {
      typeDef = defs.find((def) => def.ext === typeExtension && def.defaultDirectory === defaultDirectory);
    }
    if (_.isNil(typeDef)) {
      typeDef = this.typeDefsByExtension.get(typeExtension);
    }

    if (!_.isNil(typeDef)) {
      if (!_.isNil(useTrueExtType) && useTrueExtType) {
        return typeDef;
      }

      if (!_.isNil(typeDef.parent)) {
        return typeDef.parent;
      }

      return typeDef;
    }

    return null;
  }

  // A document must be co-resident with its metadata file.
  // A file from an exploded zip static resource must be within a directory that is co-resident with its metadata file.
  private getTypeDefinitionByFileNameWithNonStandardExtension(fileName, isDirectoryPathElement?, typeDefsToCheck?) {
    const supportedTypeDefs = [this.typeDefs.Document, this.typeDefs.StaticResource];
    const candidateTypeDefs = util.isNullOrUndefined(typeDefsToCheck) ? supportedTypeDefs : typeDefsToCheck;

    let typeDef = this.getTypeDefinitionByFileNameWithCoresidentMetadataFile(fileName, candidateTypeDefs, false);
    if (util.isNullOrUndefined(typeDef) && candidateTypeDefs.includes(this.typeDefs.StaticResource)) {
      typeDef = this.getTypeDefinitionByFileNameWithCoresidentMetadataFile(
        path.dirname(fileName),
        [this.typeDefs.StaticResource],
        true
      );
    }
    if (util.isNullOrUndefined(typeDef)) {
      typeDef = this.getTypeDefinitionByFileNameMatchingDefaultDirectory(
        fileName,
        isDirectoryPathElement,
        candidateTypeDefs
      );
    }

    return typeDef;
  }

  private getTypeDefinitionByFileNameWithCoresidentMetadataFile(fileName, typeDefsToCheck, recurse) {
    const dir = path.dirname(fileName);
    if (this.isDirPathExpended(dir)) {
      return null;
    }

    const fullName = path.basename(fileName, path.extname(fileName));
    const typeDef = typeDefsToCheck.find((typeDef) =>
      fs.existsSync(path.join(dir, `${fullName}.${typeDef.ext}${this.metadataFileExt}`))
    );
    if (!util.isNullOrUndefined(typeDef)) {
      return typeDef;
    }
    return recurse ? this.getTypeDefinitionByFileNameWithCoresidentMetadataFile(dir, typeDefsToCheck, true) : null;
  }

  private getTypeDefinitionByFileNameMatchingDefaultDirectory(fileName, isDirectoryPathElement, typeDefsToCheck) {
    const dir = path.dirname(fileName);
    if (this.isDirPathExpended(dir)) {
      return null;
    }

    if (typeDefsToCheck.includes(this.typeDefs.Document) && !isDirectoryPathElement) {
      const pathElements = fileName.split(path.sep);
      if (
        pathElements.length >= 3 &&
        pathElements[pathElements.length - 3] === this.typeDefs.Document.defaultDirectory
      ) {
        return this.typeDefs.Document;
      }
    }

    if (typeDefsToCheck.includes(this.typeDefs.StaticResource)) {
      if (isDirectoryPathElement) {
        if (path.basename(fileName) === this.typeDefs.StaticResource.defaultDirectory) {
          return this.typeDefs.StaticResource;
        }
      }
      return this.getTypeDefinitionByFileNameMatchingDefaultDirectory(dir, true, [this.typeDefs.StaticResource]);
    }

    return null;
  }

  private isDirPathExpended(dir) {
    return util.isNullOrUndefined(dir) || dir === path.parse(dir).root || dir === '.';
  }

  public isValidAuraSuffix(suffix) {
    const auraTypeDefKey = Object.keys(this.lightningDefTypes).find((key) => {
      const fileSuffix = this.lightningDefTypes[key].fileSuffix;
      return fileSuffix && fileSuffix === suffix;
    });
    return !util.isNullOrUndefined(auraTypeDefKey);
  }

  private isValidWaveTemplateSuffix(suffix) {
    const wtTypeDefKey = Object.keys(this.waveDefTypes).find((key) => {
      const fileSuffix = this.waveDefTypes[key].fileSuffix;
      return fileSuffix && fileSuffix === suffix;
    });
    return !util.isNullOrUndefined(wtTypeDefKey);
  }

  public isValidLwcSuffix(suffix) {
    const lwcTypeDefKey = Object.keys(this.lwcDefTypes).find((key) => {
      const fileSuffix = this.lwcDefTypes[key].fileSuffix;
      return fileSuffix && fileSuffix === suffix;
    });
    return !util.isNullOrUndefined(lwcTypeDefKey);
  }

  public isValidMetadataExtension(ext) {
    const extWithoutPeriod = ext.replace('.', '');
    const isValidMetadataExtension = !util.isNullOrUndefined(this.typeDefsByExtension.get(extWithoutPeriod));

    return isValidMetadataExtension || this.isValidAuraSuffix(ext) || this.isValidLwcSuffix(ext);
  }

  private isValidDecompositionExtension(ext) {
    const extWithoutPeriod = ext.replace('.', '');
    const includeDecomposedSubtypes = true;
    const typeDefKey = Object.keys(this.typeDefs).find((key) =>
      _typeDefMatchesExtension(this.typeDefs[key], extWithoutPeriod, includeDecomposedSubtypes)
    );
    const typeDef = this.typeDefs[typeDefKey];
    return !util.isNullOrUndefined(typeDefKey) && typeDef.ext.toLowerCase() !== extWithoutPeriod.toLowerCase();
  }

  private isValidExperienceBundleFile(sourcePath) {
    const relativeFilePath = MetadataRegistry.splitOnDirName(
      `${this.typeDefs.ExperienceBundle.defaultDirectory}${path.sep}`,
      sourcePath
    )[1];
    const relativePathArray = relativeFilePath.split(path.sep);
    if (relativePathArray.length == 1) {
      // it should be a meta file
      const META_FILE_SUFFIX = '.site';
      return relativePathArray[0].endsWith(`${META_FILE_SUFFIX}${this.metadataFileExt}`);
    }
    // There should be 2 folders /siteName/type and the file name should have a json suffix
    return relativePathArray.length == 3 && path.extname(relativePathArray[2]).replace('.', '') === 'json';
  }

  /**
   * @param dirName - metadataObjDirName
   * @param pathToSplit - /baseDir/metadataObjDirName(ie, dirName)/bundleFiles
   *
   * This function is like pathToSplit.split(dirName). except that it splits on the last occurance of dirName
   * If there is a parent dir with the same name as metadata object dir name, then pathToSplit.split(dirName) may
   * not give desired result, so getting the last occurance of the dir name to split on and splitting based on that
   *
   * @param pathToSplit - An array with 2 elements in it. pathToSplit[0] - baseDir and pathToSplit[1] - bundleFiles
   */
  static splitOnDirName(dirName: string, pathToSplit: string): string[] {
    const dirStartIndex = pathToSplit.lastIndexOf(dirName);
    const dirEndIndex = dirStartIndex + dirName.length;
    return [pathToSplit.substring(0, dirStartIndex - 1), pathToSplit.substring(dirEndIndex)];
  }

  public isValidSourceFilePath(sourcePath) {
    let fileName = path.basename(sourcePath);
    if (fileName.endsWith(this.metadataFileExt)) {
      fileName = fileName.substring(0, fileName.indexOf(this.metadataFileExt));
    }
    const projectPath = SfdxProject.resolveProjectPathSync();
    let workspaceSourcePath = sourcePath;
    // Aura / LWC are special
    if (sourcePath.startsWith(projectPath)) {
      workspaceSourcePath = sourcePath.substring(SfdxProject.resolveProjectPathSync().length, sourcePath.length);
    }
    if (workspaceSourcePath.includes(`${path.sep}aura${path.sep}`)) {
      const cmpName = path.basename(path.dirname(sourcePath));
      const suffix = fileName.substring(cmpName.length, fileName.length);
      return this.isValidAuraSuffix(suffix);
    } else if (workspaceSourcePath.includes(`${path.sep}${LWC_FOLDER_NAME}${path.sep}`)) {
      const suffix = '.' + fileName.split('.').pop();
      return this.isValidLwcSuffix(suffix);
    } else if (workspaceSourcePath.includes(`${path.sep}waveTemplates${path.sep}`)) {
      const suffix = '.' + fileName.split('.').pop();
      return this.isValidWaveTemplateSuffix(suffix);
    } else if (
      workspaceSourcePath.includes(`${path.sep}${this.typeDefs.ExperienceBundle.defaultDirectory}${path.sep}`)
    ) {
      return this.isValidExperienceBundleFile(workspaceSourcePath);
    } else {
      const ext = path.extname(fileName);
      if (!util.isNullOrUndefined(ext) && ext.length > 0) {
        return (
          this.isValidMetadataExtension(ext) ||
          this.isValidDecompositionExtension(ext) ||
          this.getTypeDefinitionByFileNameWithNonStandardExtension(workspaceSourcePath) !== null
        );
      } else {
        return (
          this.isValidMetadataExtension(fileName) ||
          this.getTypeDefinitionByFileNameMatchingDefaultDirectory(workspaceSourcePath, false, [
            this.typeDefs.Document,
            this.typeDefs.StaticResource,
          ]) !== null
        );
      }
    }
  }

  public isCustomName(name) {
    const customNameRegex = new RegExp(/.*__.$/);
    return customNameRegex.test(name);
  }
}

export = MetadataRegistry;

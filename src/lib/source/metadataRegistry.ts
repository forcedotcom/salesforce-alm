/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';

// 3pp
import * as optional from 'optional-js';
import * as BBPromise from 'bluebird';
import * as xml2js from 'xml2js';
import * as _ from 'lodash';

// Local
import * as projectDirUtil from '../core/projectDir';
import srcDevUtil = require('../core/srcDevUtil');
import BlacklistManager = require('./blacklistManager');
import ScratchOrg = require('../core/scratchOrgApi');
const fs_readFile = BBPromise.promisify(fs.readFile);
const xml2jsParseString = BBPromise.promisify(xml2js.parseString);
import messages = require('../messages');

import { DescribeMetadataDecomposedSubtypeConfig } from './decompositionStrategy/describeMetadataDecompositionConfig';
import { DecompositionConfigFactory } from './decompositionStrategy/decompositionConfigFactory';
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
    hasMetadata: true
  },
  CONTROLLER: {
    defType: 'CONTROLLER',
    format: 'JS',
    fileSuffix: 'Controller.js'
  },
  COMPONENT: {
    defType: 'COMPONENT',
    format: 'XML',
    fileSuffix: '.cmp',
    hasMetadata: true
  },
  EVENT: {
    defType: 'EVENT',
    format: 'XML',
    fileSuffix: '.evt',
    hasMetadata: 'true'
  },
  HELPER: {
    defType: 'HELPER',
    format: 'JS',
    fileSuffix: 'Helper.js'
  },
  INTERFACE: {
    defType: 'INTERFACE',
    format: 'XML',
    fileSuffix: '.intf',
    hasMetadata: true
  },
  RENDERER: {
    defType: 'RENDERER',
    format: 'JS',
    fileSuffix: 'Renderer.js'
  },
  STYLE: {
    defType: 'STYLE',
    format: 'CSS',
    fileSuffix: '.css'
  },
  PROVIDER: {
    defType: 'PROVIDER',
    format: 'JS',
    fileSuffix: 'Provider.js'
  },
  MODEL: {
    defType: 'MODEL',
    format: 'JS',
    fileSuffix: 'Model.js'
  },
  TESTSUITE: {
    defType: 'TESTSUITE',
    format: 'JS',
    fileSuffix: 'Test.js'
  },
  DOCUMENTATION: {
    defType: 'DOCUMENTATION',
    format: 'XML',
    fileSuffix: '.auradoc'
  },
  TOKENS: {
    defType: 'TOKENS',
    format: 'XML',
    fileSuffix: '.tokens',
    hasMetadata: true
  },
  DESIGN: {
    defType: 'DESIGN',
    format: 'XML',
    fileSuffix: '.design'
  },
  SVG: {
    defType: 'SVG',
    format: 'SVG',
    fileSuffix: '.svg'
  }
};

const _lwcDefTypes = {
  MODULE_RESOURCE_JS: {
    defType: 'MODULE',
    format: 'JS',
    fileSuffix: '.js'
  },
  MODULE_RESOURCE_HTML: {
    defType: 'MODULE',
    format: 'HTML',
    fileSuffix: '.html'
  },
  MODULE_RESOURCE_CSS: {
    defType: 'MODULE',
    format: 'CSS',
    fileSuffix: '.css'
  },
  MODULE_RESOURCE_SVG: {
    defType: 'MODULE',
    format: 'SVG',
    fileSuffix: '.svg'
  },
  MODULE_RESOURCE_XML: {
    defType: 'MODULE',
    format: 'XML',
    fileSuffix: '.xml'
  }
};

const _waveDefTypes = {
  JSON: {
    defType: 'JSON',
    format: 'JSON',
    fileSuffix: '.json'
  },
  HTML: {
    defType: 'HTML',
    format: 'HTML',
    fileSuffix: '.html'
  },
  CSV: {
    defType: 'CSV',
    format: 'CSV',
    fileSuffix: '.csv'
  },
  XML: {
    defType: 'XML',
    format: 'XML',
    fileSuffix: '.xml'
  },
  TXT: {
    defType: 'TXT',
    format: 'TXT',
    fileSuffix: '.txt'
  },
  IMG: {
    defType: 'IMG',
    format: 'IMG',
    fileSuffix: '.img'
  },
  JPG: {
    defType: 'JPG',
    format: 'JPG',
    fileSuffix: '.jpg'
  },
  JPEG: {
    defType: 'JPEG',
    format: 'JPEG',
    fileSuffix: '.jpeg'
  },
  GIF: {
    defType: 'GIF',
    format: 'GIF',
    fileSuffix: '.gif'
  },
  PNG: {
    defType: 'PNG',
    format: 'PNG',
    fileSuffix: '.png'
  }
};

// Metadata types that require special handling
const _typeDefOverrides = {
  ApexComponent: {
    nameForMsgs: 'Visualforce Component',
    nameForMsgsPlural: 'Visualforce Components'
  },
  ApexPage: {
    nameForMsgs: 'Visualforce Page',
    nameForMsgsPlural: 'Visualforce Pages'
  },
  AuraDefinitionBundle: {
    nameForMsgs: 'Lightning Component Bundle',
    nameForMsgsPlural: 'Lightning Component Bundles',
    ext: 'aurabundle',
    hasContent: true
  },
  CustomPageWebLink: {
    ext: 'custompageweblink'
  },
  Document: {
    ext: 'document',
    contentIsBinary: true
  },
  EmailTemplate: {
    contentIsBinary: true,
    nameForFolder: 'Email'
  },
  LightningComponentBundle: {
    nameForMsgs: 'Lightning Component Bundle',
    nameForMsgsPlural: 'Lightning Component Bundles',
    ext: 'lightningcomponentbundle',
    hasContent: true
  },
  Report: {
    contentIsBinary: true
  },
  Dashboard: {
    contentIsBinary: true
  },
  StaticResource: {
    contentIsBinary: true
  },
  Territory2: {
    defaultDirectory: 'territories'
  },
  Territory2Rule: {
    defaultDirectory: 'rules'
  },
  WaveTemplateBundle: {
    nameForMsgs: 'Wave Template Bundle',
    nameForMsgsPlural: 'Wave Template Bundles',
    hasContent: true
  }
};

const _hasOverrides = function(metadataName) {
  return !util.isNullOrUndefined(_typeDefOverrides[metadataName]);
};

const _isWhitelistedForDecomposition = function(typeDef) {
  switch (typeDef.metadataName) {
    case 'CustomObject':
    case 'CustomObjectTranslation':
    case 'Bot':
      return true;
    default:
      return false;
  }
};

const _hasChildXmlNames = function(typeDef) {
  return !util.isNullOrUndefined(typeDef.childXmlNames) && typeDef.childXmlNames.length > 0;
};

const _augmentMetadataInfosWithDecompositions = function(typeDefs) {
  return _getMetadataWsdlJson().then(json => {
    Object.keys(typeDefs).forEach(metadataName => {
      const typeDef = typeDefs[metadataName];
      typeDef.hasVirtualSubtypes = false;
      if (typeDef.metadataName === 'SharingRules') {
        _addVirtualTypeDefs(typeDefs, typeDef, _getXmlFragmentNamesWithComplexType(typeDef, json));
      }

      if (_isWhitelistedForDecomposition(typeDef) && _hasChildXmlNames(typeDef)) {
        const complexType = _findComplexType(
          json.definitions.types['xsd:schema']['xsd:complexType'],
          typeDef.metadataName
        );
        if (!util.isNullOrUndefined(complexType)) {
          const xmlFragmentNames = _getXmlFragmentNames(complexType, typeDef.childXmlNames);
          _addMetadataDecompositions(typeDef, xmlFragmentNames);
          typeDef.decompositionConfig.isEmptyContainer = _isEmptyContainer(complexType, typeDef.childXmlNames);
          typeDef.decompositionConfig.isGlobal = globalMetadataTypes.includes(typeDef.metadataName);
          _addVirtualTypeDefs(typeDefs, typeDef, xmlFragmentNames);
        }
      }
    });
    return typeDefs;
  });
};

const TypesWithStandardMembers = ['CustomObject', 'CustomObjectTranslation', 'StandardValueSet', 'Settings'];
const TypesThatDoNotSupportDeletes = ['Settings', 'CustomObjectTranslation', 'CustomFieldTranslation'];
const globalMetadataTypes = ['CustomLabels'];

const _createMetadataInfos = function(metadataDescribeResults) {
  const metadataObjects = metadataDescribeResults.metadataObjects;
  const typeDefObjects = {};

  for (let i = 0; i < metadataObjects.length; i++) {
    const info = metadataObjects[i];
    const metadataName = info.xmlName;
    let singularMetadataName;
    if (!util.isNullOrUndefined(info.childXmlNames) && metadataName.endsWith('s')) {
      singularMetadataName = metadataName.slice(0, -1);
    } else {
      singularMetadataName = metadataName;
    }

    if (!BlacklistManager.isBlacklisted(metadataName)) {
      const hasOverride = _hasOverrides(metadataName);
      const typeDefOverride = hasOverride ? _typeDefOverrides[metadataName] : {};
      const typeDefObject = new TypeDefObj(metadataName);
      typeDefObject.ext = optional.ofNullable(typeDefOverride.ext).orElse(info.suffix);
      typeDefObject.hasContent = optional.ofNullable(typeDefOverride.hasContent).orElse(info.metaFile);
      typeDefObject.defaultDirectory = optional.ofNullable(typeDefOverride.defaultDirectory).orElse(info.directoryName);
      const nameWithSpaces = singularMetadataName.replace(/([A-Z])/g, ' $1').trim();
      typeDefObject.nameForMsgs = optional.ofNullable(typeDefOverride.nameForMsgs).orElse(nameWithSpaces);
      const pluralName = nameWithSpaces.endsWith('s') ? `${nameWithSpaces}es` : `${nameWithSpaces}s`;
      typeDefObject.nameForMsgsPlural = optional.ofNullable(typeDefOverride.nameForMsgsPlural).orElse(pluralName);
      typeDefObject.contentIsBinary = optional.ofNullable(typeDefOverride.contentIsBinary).orElse(false);

      if (!util.isNullOrUndefined(info.childXmlNames) && info.childXmlNames.length > 0) {
        typeDefObject.childXmlNames = info.childXmlNames;
      }

      if (typeDefObject.metadataName === 'CustomObjectTranslation') {
        typeDefObject.childXmlNames = ['CustomFieldTranslation'];
      }

      typeDefObject.hasStandardMembers = TypesWithStandardMembers.includes(metadataName);
      typeDefObject.deleteSupported = !TypesThatDoNotSupportDeletes.includes(metadataName);

      typeDefObjects[metadataName] = typeDefObject;

      // create the folder type for metadata types with folders
      if (info.inFolder) {
        const folderMetadataName =
          hasOverride && typeDefOverride.nameForFolder !== undefined
            ? `${typeDefOverride.nameForFolder}Folder`
            : `${metadataName}Folder`;
        const folderTypeDefObject = new TypeDefObj(folderMetadataName);
        folderTypeDefObject.ext = `${typeDefObject.ext}Folder`;
        folderTypeDefObject.hasContent = false;
        folderTypeDefObject.defaultDirectory = typeDefObject.defaultDirectory;
        folderTypeDefObject.nameForMsgs = `${typeDefObject.nameForMsgs} Folder`;
        folderTypeDefObject.nameForMsgsPlural = `${typeDefObject.nameForMsgs} Folders`;
        folderTypeDefObject.contentIsBinary = false;
        folderTypeDefObject.isAddressable = false;
        folderTypeDefObject.isSourceTracked = true;
        folderTypeDefObject.deleteSupported = true;
        typeDefObjects[folderTypeDefObject.metadataName] = folderTypeDefObject;
        typeDefObject.inFolder = true;
        typeDefObject.folderTypeDef = folderTypeDefObject;
        folderTypeDefObject.decompositionConfig = DecompositionConfigFactory.getDecompositionConfig(
          folderTypeDefObject
        );
      }
      typeDefObject.decompositionConfig = DecompositionConfigFactory.getDecompositionConfig(typeDefObject);
    }
  }
  return typeDefObjects;
};

const _getMetadataWsdlJson = function() {
  // const headers = {
  //     'content-type': 'application/x-www-form-urlencoded',
  //     'user-agent': srcDevUtil.getSfdxCLIClientId(),
  //     'cookie': true
  // };
  // return scratchOrg.force.request(scratchOrg, 'GET', '/services/wsdl/metadata', headers);
  const metadataWsdlPath = path.join(__dirname, '..', '..', '..', 'metadata', 'metadata.wsdl');
  return fs_readFile(metadataWsdlPath, 'utf8').then(wsdl => xml2jsParseString(wsdl, { explicitArray: false }));
};

const _findFragmentName = function(elements, childXmlName) {
  if (elements instanceof Array) {
    for (const element of elements) {
      if (element.$.type === `tns:${childXmlName}` && !util.isNullOrUndefined(element.$.maxOccurs)) {
        return element.$.name;
      }
    }
    return null;
  } else {
    return elements.$.name;
  }
};

const _getXmlFragmentNames = function(complexType, childXmlNames) {
  const fragmentNames = [];
  for (const childXmlName of childXmlNames) {
    fragmentNames.push(
      _findFragmentName(complexType['xsd:complexContent']['xsd:extension']['xsd:sequence']['xsd:element'], childXmlName)
    );
  }
  return fragmentNames;
};

const _findComplexType = function(complexTypes, parentXmlName) {
  for (const complexType of complexTypes) {
    if (parentXmlName === complexType.$.name) {
      return complexType;
    }
  }
  return null;
};

const _isEmptyContainer = function(complexType, childXmlNames) {
  const elements = complexType['xsd:complexContent']['xsd:extension']['xsd:sequence']['xsd:element'];
  if (elements instanceof Array) {
    return elements.length === childXmlNames.length;
  } else {
    return true;
  }
};

const _lowerFirstCap = function(s) {
  return `${s.substring(0, 1).toLowerCase()}${s.substring(1)}`;
};

const _singular = function(s) {
  if (!s.endsWith('s')) {
    return s;
  }
  const softConsonant = s.endsWith('ses') || s.endsWith('shes');
  const truncateCount = softConsonant ? 2 : 1; // I think we can safely assume English for metadata
  return s.substring(0, s.length - truncateCount);
};

const _getDecompositionExtensionFromFragmentName = function(typeDef, fragmentName) {
  let ext = _singular(_lowerFirstCap(fragmentName));
  if (typeDef.metadataName === 'CustomObjectTranslation') {
    ext = `${ext}Translation`;
  }
  return ext;
};

const _getMetadataEntityNameElement = function(typeDef, xmlFragmentName) {
  if (typeDef.metadataName === 'CustomObjectTranslation') {
    if (xmlFragmentName === 'layouts') {
      return 'layout';
    } else {
      return 'name';
    }
  }
  return 'fullName';
};

const _addMetadataDecompositions = function(typeDef, xmlFragmentNames) {
  for (let i = 0; i < typeDef.childXmlNames.length; ++i) {
    const metadataName = typeDef.childXmlNames[i];
    const xmlFragmentName = xmlFragmentNames[i];
    const decomposition = new DescribeMetadataDecomposedSubtypeConfig();
    decomposition.metadataName = metadataName;
    decomposition.metadataEntityNameElement = _getMetadataEntityNameElement(typeDef, xmlFragmentName);
    decomposition.xmlFragmentName = xmlFragmentName;
    decomposition.defaultDirectory = typeDef.isGlobal ? typeDef.defaultDirectory : xmlFragmentName;
    decomposition.ext = _getDecompositionExtensionFromFragmentName(typeDef, xmlFragmentName);
    decomposition.hasStandardMembers = metadataName === 'CustomField';
    decomposition.isAddressable = typeDef.metadataName !== 'CustomObjectTranslation';
    typeDef.decompositionConfig.decompositions.push(decomposition);
  }
};

const _addVirtualTypeDefs = function(typeDefs, parentTypeDef, xmlFragmentNames) {
  parentTypeDef.hasVirtualSubtypes = true;
  for (let i = 0; i < parentTypeDef.childXmlNames.length; ++i) {
    const metadataName = parentTypeDef.childXmlNames[i];
    if (util.isNullOrUndefined(typeDefs[metadataName])) {
      const xmlFragmentName = xmlFragmentNames[i];
      const typeDef: any = {};
      typeDef.parent = parentTypeDef;
      typeDef.metadataName = metadataName;
      typeDef.defaultDirectory = typeDef.isGlobal ? typeDef.defaultDirectory : xmlFragmentName;
      typeDef.ext = _getDecompositionExtensionFromFragmentName(typeDef.parent, xmlFragmentName);
      typeDef.hasStandardMembers = metadataName === 'CustomField';
      typeDef.hasContent = false;
      typeDef.contentIsBinary = false;
      typeDef.isAddressable = typeDef.parent.metadataName !== 'CustomObjectTranslation';
      typeDef.isSourceTracked = typeDef.parent.metadataName !== 'CustomObjectTranslation';
      typeDef.nameForMsgs = metadataName.replace(/([A-Z])/g, ' $1').trim();
      typeDef.nameForMsgsPlural = typeDef.nameForMsgs.endsWith('s')
        ? `${typeDef.nameForMsgs}es`
        : `${typeDef.nameForMsgs}s`;
      typeDef.deleteSupported = !TypesThatDoNotSupportDeletes.includes(metadataName);
      typeDefs[typeDef.metadataName] = typeDef;
    }
  }
};

const _getXmlFragmentNamesWithComplexType = function(typeDef, json) {
  const complexType = _findComplexType(json.definitions.types['xsd:schema']['xsd:complexType'], typeDef.metadataName);
  return _getXmlFragmentNames(complexType, typeDef.childXmlNames);
};

const _typeDefMatchesDecompositionExtension = function(typeDef, typeExtension) {
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

const _typeDefMatchesExtension = function(typeDef, typeExtension, includeDecomposedSubtypes) {
  if (!util.isNullOrUndefined(typeDef.ext) && typeDef.ext.toLowerCase() === typeExtension) {
    return true;
  } else if (includeDecomposedSubtypes) {
    return _typeDefMatchesDecompositionExtension(typeDef, typeExtension);
  } else {
    return false;
  }
};

const _getDecompositionByName = function(typeDefs, value) {
  if (util.isNullOrUndefined(value)) {
    return null;
  }

  let foundDecomposition;
  Object.keys(typeDefs).forEach(key => {
    if (!util.isNullOrUndefined(typeDefs[key].decompositionConfig)) {
      typeDefs[key].decompositionConfig.decompositions.forEach(decomposition => {
        if (decomposition.metadataName === value) {
          foundDecomposition = decomposition;
        }
      });
    }
  });
  return util.isNullOrUndefined(foundDecomposition) ? null : foundDecomposition;
};

class MetadataRegistry {
  private org;
  private typeDefs: TypeDefObjs;
  private typeDirectories: string[];
  private lightningDefTypes;
  private waveDefTypes;
  private lwcDefTypes;
  private typeDefsByExtension;
  private metadataFileExt;

  constructor(org) {
    this.org = org;
    this.typeDefs = this.getMetadataTypeDefs();
    this.typeDirectories = this.getTypeDirectories();
    this.lightningDefTypes = _lightningDefTypes;
    this.waveDefTypes = _waveDefTypes;
    this.lwcDefTypes = _lwcDefTypes;
    this.typeDefsByExtension = this.getTypeDefsByExtension();
    this.metadataFileExt = METADATA_FILE_EXT;
  }

  isSupported(metadataName) {
    if (BlacklistManager.isBlacklisted(metadataName)) {
      return false;
    }
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

  static initializeMetadataTypeInfos(orgApi?) {
    const scratchOrg = !util.isNullOrUndefined(orgApi) ? orgApi : new ScratchOrg();
    const force = scratchOrg.force;
    const appConfig = force.getConfig().getAppConfig();
    const sourceApiVersion = optional.ofNullable(appConfig.sourceApiVersion).orElse(force.getConfig().getApiVersion());

    // If a new org is created above, make sure we resolve the default name
    return scratchOrg
      .resolveDefaultName()
      .then(() => force.mdapiDescribe(scratchOrg, sourceApiVersion))
      .then(describeResults => _createMetadataInfos(describeResults))
      .then(typeDefs => _augmentMetadataInfosWithDecompositions(typeDefs))
      .then(typeDefs => {
        const metadataInfosFile = scratchOrg.getMetadataTypeInfos();
        metadataInfosFile.delete();

        const metadataInfos = {
          sourceApiVersion,
          typeDefs
        };
        return metadataInfosFile.write(metadataInfos);
      })
      .then(() => BBPromise.resolve())
      .catch(err => {
        if (err.message === 'Unsupported state or unable to authenticate data') {
          err['message'] = messages(force.getConfig().getLocale()).getMessage('authorizeCommandError');
        }
        if (err.name === 'NoOrgFound') {
          const locale = force.getConfig().getLocale();
          if (err.message === messages(locale).getMessage('defaultOrgNotFound')) {
            err['message'] = `${err.message}. ${messages(locale).getMessage('manifestCreateOrgRequired')}`;
          } else {
            const splitString = err.message.split(' ');
            err['name'] = 'NamedOrgNotFound';
            err['message'] = messages(locale).getMessage('namedOrgNotFound', splitString[splitString.length - 1]);
          }
        }
        return BBPromise.reject(err);
      });
  }

  handleIfSharingRuleElement(sourceElement) {
    const sharingRules = this.typeDefs.SharingRules;
    if (sharingRules.childXmlNames.indexOf(sourceElement.type) >= 0) {
      sourceElement.type = sharingRules.metadataName;
      sourceElement.fullName = sourceElement.fullName.substring(0, sourceElement.fullName.indexOf('.'));
    }
    return sourceElement;
  }

  getMetadataTypeDefs() {
    if (util.isNullOrUndefined(this.typeDefs)) {
      const metadataInfos = this.org.getMetadataTypeInfos();
      try {
        const infos = metadataInfos.read();
        return infos.typeDefs;
      } catch (error) {
        throw srcDevUtil.processReadAndParseJsonFileError(error, metadataInfos.path);
      }
    } else {
      return this.typeDefs;
    }
  }

  // Returns list of default directories for all metadata types
  getTypeDirectories(): string[] {
    if (util.isNullOrUndefined(this.typeDirectories)) {
      const metadataTypeInfos = this.getMetadataTypeDefs() as TypeDefObjs;
      return Object.values(metadataTypeInfos).map(i => i.defaultDirectory);
    } else {
      return this.typeDirectories;
    }
  }

  getTypeDefsByExtension() {
    const typeDefsByExtension = new Map();
    Object.keys(this.typeDefs).forEach(metadataName => {
      const metadataTypeExtension = this.typeDefs[metadataName].ext;
      typeDefsByExtension.set(metadataTypeExtension, this.typeDefs[metadataName]);
    });
    return typeDefsByExtension;
  }

  getLightningDefByFileName(fileName) {
    return this.lightningDefTypes[
      Object.keys(this.lightningDefTypes).find(key => {
        const lightningDefType = this.lightningDefTypes[key];
        return fileName.endsWith(lightningDefType.fileSuffix);
      })
    ];
  }

  getWaveDefByFileName(fileName) {
    return this.waveDefTypes[
      Object.keys(this.waveDefTypes).find(key => {
        const waveDefType = this.waveDefTypes[key];
        return fileName.endsWith(waveDefType.fileSuffix);
      })
    ];
  }

  getLightningDefByType(type) {
    return this.lightningDefTypes[
      Object.keys(this.lightningDefTypes).find(key => {
        const lightningDefType = this.lightningDefTypes[key];
        return type === lightningDefType.defType;
      })
    ];
  }

  /**
   * Returns the array of typeDefs where the default directory of each typeDef matches the passed in 'name' param
   * @param name
   * @returns {any[]}
   */
  getTypeDefinitionsByDirectoryName(name) {
    const metadataNames = Object.keys(this.typeDefs).filter(key => this.typeDefs[key].defaultDirectory === name);
    return metadataNames.map(metadataName => this.typeDefs[metadataName]);
  }

  getTypeDefinitionByMetadataName(metadataName) {
    let typeDef = this.typeDefs[metadataName];
    if (util.isNullOrUndefined(typeDef) && metadataName.endsWith('Settings')) {
      // even though there is one "Settings" in the describeMetadata response when you retrieve a setting it comes
      // down as "AccountSettings", "CaseSettings", etc. so here we account for that scenario.
      typeDef = this.typeDefs['Settings'];
    }
    return typeDef;
  }

  // given file extension, return type def
  getTypeDefinitionByFileName(filePath: string, useTrueExtType?: boolean) {
    if (util.isNullOrUndefined(filePath)) {
      return null;
    }

    const projectPath = projectDirUtil.getPath();

    let workspaceFilePath = filePath;
    if (filePath.startsWith(projectPath)) {
      workspaceFilePath = filePath.substring(projectDirUtil.getPath().length, filePath.length);
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
      .find(i => !!i && this.typeDirectories.includes(i));
    let typeDef: TypeDefObj;
    if (defaultDirectory)
      typeDef = defs.find(def => def.ext === typeExtension && def.defaultDirectory === defaultDirectory);
    if (_.isNil(typeDef)) typeDef = this.typeDefsByExtension.get(typeExtension);

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
    const typeDef = typeDefsToCheck.find(typeDef =>
      srcDevUtil.pathExistsSync(path.join(dir, `${fullName}.${typeDef.ext}${this.metadataFileExt}`))
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

  isValidAuraSuffix(suffix) {
    const auraTypeDefKey = Object.keys(this.lightningDefTypes).find(key => {
      const fileSuffix = this.lightningDefTypes[key].fileSuffix;
      return fileSuffix && fileSuffix === suffix;
    });
    return !util.isNullOrUndefined(auraTypeDefKey);
  }

  isValidWaveTemplateSuffix(suffix) {
    const wtTypeDefKey = Object.keys(this.waveDefTypes).find(key => {
      const fileSuffix = this.waveDefTypes[key].fileSuffix;
      return fileSuffix && fileSuffix === suffix;
    });
    return !util.isNullOrUndefined(wtTypeDefKey);
  }

  isValidLwcSuffix(suffix) {
    const lwcTypeDefKey = Object.keys(this.lwcDefTypes).find(key => {
      const fileSuffix = this.lwcDefTypes[key].fileSuffix;
      return fileSuffix && fileSuffix === suffix;
    });
    return !util.isNullOrUndefined(lwcTypeDefKey);
  }

  isValidMetadataExtension(ext) {
    const extWithoutPeriod = ext.replace('.', '');
    const isValidMetadataExtension = !util.isNullOrUndefined(this.typeDefsByExtension.get(extWithoutPeriod));

    return isValidMetadataExtension || this.isValidAuraSuffix(ext) || this.isValidLwcSuffix(ext);
  }

  isValidDecompositionExtension(ext) {
    const extWithoutPeriod = ext.replace('.', '');
    const includeDecomposedSubtypes = true;
    const typeDefKey = Object.keys(this.typeDefs).find(key =>
      _typeDefMatchesExtension(this.typeDefs[key], extWithoutPeriod, includeDecomposedSubtypes)
    );
    const typeDef = this.typeDefs[typeDefKey];
    return !util.isNullOrUndefined(typeDefKey) && typeDef.ext.toLowerCase() !== extWithoutPeriod.toLowerCase();
  }

  isValidExperienceBundleFile(sourcePath) {
    const relativeFilePath = MetadataRegistry.splitOnDirName(
      `${this.typeDefs.ExperienceBundle.defaultDirectory}${path.sep}`,
      sourcePath
    )[1];
    const relativePathArray = relativeFilePath.split(path.sep);
    if (relativePathArray.length == 1) {
      //it should be a meta file
      const META_FILE_SUFFIX = '.site';
      return relativePathArray[0].endsWith(`${META_FILE_SUFFIX}${this.metadataFileExt}`);
    }
    //There should be 2 folders /siteName/type and the file name should have a json suffix
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

  isValidSourceFilePath(sourcePath) {
    let fileName = path.basename(sourcePath);
    if (fileName.endsWith(this.metadataFileExt)) {
      fileName = fileName.substring(0, fileName.indexOf(this.metadataFileExt));
    }
    const projectPath = projectDirUtil.getPath();
    let workspaceSourcePath = sourcePath;
    // Aura / LWC are special
    if (sourcePath.startsWith(projectPath)) {
      workspaceSourcePath = sourcePath.substring(projectDirUtil.getPath().length, sourcePath.length);
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
            this.typeDefs.StaticResource
          ]) !== null
        );
      }
    }
  }

  isCustomName(name) {
    const customNameRegex = new RegExp(/.*__.$/);
    return customNameRegex.test(name);
  }
}

export = MetadataRegistry;

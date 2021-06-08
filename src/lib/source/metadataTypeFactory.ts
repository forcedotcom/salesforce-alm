/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { SfdxError } from '@salesforce/core';
import Messages = require('../../lib/messages');
import { SharingRulesMetadataType } from './metadataTypeImpl/sharingRulesMetadataType';

import { MetadataType } from './metadataType';
import { TypeDefObj } from './typeDefObj';
import { AuraDefinitionBundleMetadataType } from './metadataTypeImpl/auraDefinitionBundleMetadataType';
import { CustomObjectSubtypeMetadataType } from './metadataTypeImpl/customObjectSubtypeMetadataType';
import { DefaultMetadataType } from './metadataTypeImpl/defaultMetadataType';
import { CustomObjectTranslationSubtypeMetadataType } from './metadataTypeImpl/customObjectTranslationSubtypeMetadataType';
import { CustomObjectTranslationMetadataType } from './metadataTypeImpl/customObjectTranslationMetadataType';
import { CustomObjectMetadataType } from './metadataTypeImpl/customObjectMetadataType';
import { CustomPageWeblinkMetadataType } from './metadataTypeImpl/customPageWeblinkMetadataType';
import { DocumentMetadataType } from './metadataTypeImpl/documentMetadataType';
import { InFolderMetadataType } from './metadataTypeImpl/inFolderMetadataType';
import { FolderMetadataType } from './metadataTypeImpl/folderMetadataType';
import { LightningComponentBundleMetadataType } from './metadataTypeImpl/lightningComponentBundleMetadataType';
import { WaveTemplateBundleMetadataType } from './metadataTypeImpl/waveTemplateBundleMetadataType';
import { Territory2AndTerritory2RuleMetadataType } from './metadataTypeImpl/territory2AndTerritory2RuleMetadataType';
import { Territory2ModelMetadataType } from './metadataTypeImpl/territory2ModelMetadataType';
import { SamlSsoConfigMetadataType } from './metadataTypeImpl/samlSsoConfigMetadataType';
import { DuplicateRuleMetadataType } from './metadataTypeImpl/duplicateRuleMetadataType';
import { StaticResourceMetadataType } from './metadataTypeImpl/staticResourceMetadataType';
import { NondecomposedTypesWithChildrenMetadataType } from './metadataTypeImpl/nondecomposedTypesWithChildrenMetadataType';
import { ApexClassMetadataType } from './metadataTypeImpl/apexClassMetadataType';
import { CustomLabelsMetadataType } from './metadataTypeImpl/customLabelsMetadataType';
import { FlowDefinitionMetadataType } from './metadataTypeImpl/flowDefinitionMetadataType';
import { FlowMetadataType } from './metadataTypeImpl/flowMetadataType';
import { ExperienceBundleMetadataType } from './metadataTypeImpl/experienceBundleMetadataType';
import { BotMetadataType } from './metadataTypeImpl/botMetadataType';
import { BotSubtypeMetadataType } from './metadataTypeImpl/botSubtypeMetadataType';
import { WorkflowMetadataType } from './metadataTypeImpl/workflowMetadataType';

import MetadataRegistry = require('./metadataRegistry');

const messages = Messages();

export interface FileProperty {
  fileName: string; // e.g. classes/MyApexClass.cls
  fullName: string; // e.g. 'MyApexClass'
  type: string; // e.g. 'ApexClass'
}

export class MetadataTypeFactory {
  static getMetadataTypeFromSourcePath(sourcePath: string, metadataRegistry: MetadataRegistry): MetadataType {
    if (MetadataTypeCache.sourcePaths.has(sourcePath)) {
      return MetadataTypeCache.sourcePaths.get(sourcePath);
    }
    const typeDefObj = metadataRegistry.getTypeDefinitionByFileName(sourcePath, true);
    if (typeDefObj) {
      const mdType = MetadataTypeFactory.getMetadataTypeFromMetadataName(typeDefObj.metadataName, metadataRegistry);
      MetadataTypeCache.sourcePaths.set(sourcePath, mdType);
      return mdType;
    }
    return null;
  }

  static getMetadataTypeFromFileProperty(fileProperty: FileProperty, metadataRegistry: MetadataRegistry): MetadataType {
    const typeDefObj = MetadataTypeFactory.getTypeDefObjFromFileProperty(fileProperty, metadataRegistry);
    if (!typeDefObj) {
      const errorMessage = messages.getMessage('metadataTypeNotSupported', [fileProperty.type, fileProperty.type]);
      throw SfdxError.wrap(errorMessage);
    }
    return MetadataTypeFactory.getMetadataTypeFromMetadataName(typeDefObj.metadataName, metadataRegistry);
  }

  /**
   * @param fileProperty - the mdapi file property
   * @param metadataRegistry
   * @returns {TypeDefObj}
   */
  private static getTypeDefObjFromFileProperty(
    fileProperty: FileProperty,
    metadataRegistry: MetadataRegistry
  ): TypeDefObj {
    const fullFileName = fileProperty.fileName;
    const typeDefObj = metadataRegistry.getTypeDefinitionByMetadataName(fileProperty.type);
    if (typeDefObj && typeDefObj.inFolder) {
      const metadataType = typeDefObj.metadataName.toLowerCase();
      const normalizedFullName = path.normalize(fileProperty.fullName);
      if (!fullFileName.endsWith(metadataType) && (metadataType === 'report' || metadataType === 'dashboard')) {
        return typeDefObj.folderTypeDef;
      } else if (normalizedFullName.split(path.sep).length === 1) {
        return typeDefObj.folderTypeDef;
      }
    }
    return typeDefObj;
  }

  static getAggregateMetadataType(metadataName: string, metadataRegistry: MetadataRegistry): MetadataType {
    const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(metadataName, metadataRegistry);
    const hasParentType = metadataType.getMetadataName() !== metadataType.getAggregateMetadataName();
    if (hasParentType) {
      return MetadataTypeFactory.getMetadataTypeFromMetadataName(
        metadataType.getAggregateMetadataName(),
        metadataRegistry
      );
    }
    return metadataType;
  }

  private static getTypeDefName(metadataName: string): string {
    let typeDefName: string;
    switch (metadataName) {
      case 'LightningComponentResource':
        typeDefName = 'LightningComponentBundle';
        break;
      case 'AuraDefinition':
        typeDefName = 'AuraDefinitionBundle';
        break;
      case 'ExperienceResource':
        typeDefName = 'ExperienceBundle';
        break;
      case 'CustomLabel':
      case 'AssignmentRule':
      case 'AutoResponseRule':
      case 'EscalationRule':
      case 'MatchingRule':
        typeDefName = `${metadataName}s`;
        break;
      case 'WorkflowFieldUpdate':
      case 'WorkflowKnowledgePublish':
      case 'WorkflowTask':
      case 'WorkflowAlert':
      case 'WorkflowSend':
      case 'WorkflowOutboundMessage':
      case 'WorkflowRule':
        typeDefName = 'Workflow';
        break;
      case 'SharingOwnerRule':
      case 'SharingCriteriaRule':
      case 'SharingGuestRule':
      case 'SharingTerritoryRule':
        typeDefName = 'SharingRules';
        break;
      default:
        typeDefName = metadataName;
    }
    return typeDefName;
  }

  static getMetadataTypeFromMetadataName(metadataName: string, metadataRegistry: MetadataRegistry): MetadataType {
    if (MetadataTypeCache.metadataNames.has(metadataName)) {
      return MetadataTypeCache.metadataNames.get(metadataName);
    }
    let metadataType: MetadataType;
    const typeDefObjs = metadataRegistry.getMetadataTypeDefs();
    const typeDefName = MetadataTypeFactory.getTypeDefName(metadataName);
    if (metadataRegistry.isSupported(typeDefName)) {
      const typeDefObj = metadataRegistry.getTypeDefinitionByMetadataName(typeDefName);

      if (typeDefObj) {
        if (typeDefObj.parent) {
          switch (typeDefObj.parent.metadataName) {
            case typeDefObjs.CustomObject.metadataName:
              metadataType = new CustomObjectSubtypeMetadataType(typeDefObj);
              break;
            case typeDefObjs.CustomObjectTranslation.metadataName:
              metadataType = new CustomObjectTranslationSubtypeMetadataType(typeDefObj);
              break;
            case typeDefObjs.Bot.metadataName:
              metadataType = new BotSubtypeMetadataType(typeDefObj);
              break;
            default:
              break;
          }
        }

        if (typeDefName.endsWith('Folder')) {
          metadataType = new FolderMetadataType(typeDefObj);
        }

        if (typeDefObj.inFolder && typeDefName !== typeDefObjs.Document.metadataName) {
          metadataType = new InFolderMetadataType(typeDefObj);
        }

        if (!metadataType) {
          switch (typeDefName) {
            case typeDefObjs.ApexClass.metadataName:
              metadataType = new ApexClassMetadataType(typeDefObj);
              break;
            case typeDefObjs.CustomObject.metadataName:
              metadataType = new CustomObjectMetadataType(typeDefObj);
              break;
            case typeDefObjs.CustomObjectTranslation.metadataName:
              metadataType = new CustomObjectTranslationMetadataType(typeDefObj);
              break;
            case typeDefObjs.AuraDefinitionBundle.metadataName:
              metadataType = new AuraDefinitionBundleMetadataType(typeDefObj);
              break;
            case typeDefObjs.CustomPageWebLink.metadataName:
              metadataType = new CustomPageWeblinkMetadataType(typeDefObj);
              break;
            case typeDefObjs.Document.metadataName:
              metadataType = new DocumentMetadataType(typeDefObj);
              break;
            case typeDefObjs.LightningComponentBundle.metadataName:
              metadataType = new LightningComponentBundleMetadataType(typeDefObj);
              break;
            case typeDefObjs.WaveTemplateBundle.metadataName:
              metadataType = new WaveTemplateBundleMetadataType(typeDefObj);
              break;
            case typeDefObjs.Territory2.metadataName:
            case typeDefObjs.Territory2Rule.metadataName:
              metadataType = new Territory2AndTerritory2RuleMetadataType(typeDefObj);
              break;
            case typeDefObjs.Territory2Model.metadataName:
              metadataType = new Territory2ModelMetadataType(typeDefObj);
              break;
            case typeDefObjs.SamlSsoConfig.metadataName:
              metadataType = new SamlSsoConfigMetadataType(typeDefObj);
              break;
            case typeDefObjs.DuplicateRule.metadataName:
              metadataType = new DuplicateRuleMetadataType(typeDefObj);
              break;
            case typeDefObjs.CustomLabels.metadataName:
              metadataType = new CustomLabelsMetadataType(typeDefObj);
              break;
            case typeDefObjs.AssignmentRules.metadataName:
            case typeDefObjs.AutoResponseRules.metadataName:
            case typeDefObjs.EscalationRules.metadataName:
            case typeDefObjs.MatchingRules.metadataName:
              metadataType = new NondecomposedTypesWithChildrenMetadataType(typeDefObj);
              break;
            case typeDefObjs.Workflow.metadataName:
              metadataType = new WorkflowMetadataType(typeDefObj);
              break;
            case typeDefObjs.SharingRules.metadataName:
              metadataType = new SharingRulesMetadataType(typeDefObj);
              break;
            case typeDefObjs.StaticResource.metadataName:
              metadataType = new StaticResourceMetadataType(typeDefObj);
              break;
            case typeDefObjs.FlowDefinition.metadataName:
              metadataType = new FlowDefinitionMetadataType(typeDefObj);
              break;
            case typeDefObjs.Flow.metadataName:
              metadataType = new FlowMetadataType(typeDefObj);
              break;
            case typeDefObjs.ExperienceBundle.metadataName:
              metadataType = new ExperienceBundleMetadataType(typeDefObj);
              break;
            case typeDefObjs.Bot.metadataName:
              metadataType = new BotMetadataType(typeDefObj);
              break;
            default:
              metadataType = new DefaultMetadataType(typeDefObj);
          }
        }
      }
    }
    MetadataTypeCache.metadataNames.set(metadataName, metadataType);
    return metadataType;
  }

  static getMetadataTypeFromMdapiPackagePath(packagePath: string, metadataRegistry: MetadataRegistry): MetadataType {
    if (MetadataTypeCache.mdapiPackagePaths.has(packagePath)) {
      return MetadataTypeCache.mdapiPackagePaths.get(packagePath);
    }

    const pathElements = packagePath.split(path.sep); // ["type-dir", ["container-dir",]] "file"
    let isFolderType: boolean;
    if (pathElements.length > 1) {
      // file level (or intermediate directory for a few types)
      const type = pathElements[0];
      const file = pathElements[pathElements.length - 1];
      const possibleTypeDefs = metadataRegistry.getTypeDefinitionsByDirectoryName(type);
      let typeDef;
      if (possibleTypeDefs.length === 1) {
        typeDef = possibleTypeDefs[0];
      } else {
        const inFolderType = possibleTypeDefs.find((_typeDef) => _typeDef.inFolder);
        if (inFolderType) {
          isFolderType = inFolderType && pathElements.length === 2;
          if (isFolderType) {
            typeDef = inFolderType.folderTypeDef;
          }
          // reports nand dashboards could be nested in sub folders
          else if (type === 'reports' && !file.endsWith('report')) {
            typeDef = inFolderType.folderTypeDef;
          } else if (type === 'dashboards' && !file.endsWith('dashboard')) {
            typeDef = inFolderType.folderTypeDef;
          } else {
            typeDef = inFolderType;
          }
        } else {
          const extension = path.extname(packagePath).replace('.', '');
          const matchingTypeDef = possibleTypeDefs.find((typeDef) => typeDef.ext === extension);
          typeDef = matchingTypeDef || metadataRegistry.getTypeDefinitionByFileName(file);
        }
      }

      // Territory2 and Territory2Rule exist in the Territory2Model directory, but they are separate entities
      // so we need to reload the typeDef accordingly
      const isTerritory2Model =
        typeDef && typeDef.metadataName === metadataRegistry.getMetadataTypeDefs().Territory2Model.metadataName;
      if (isTerritory2Model && pathElements.length === 4) {
        // length of 4 signals a subtype of territory2Model
        const terrType = pathElements[2];
        if (terrType === metadataRegistry.getMetadataTypeDefs().Territory2.defaultDirectory) {
          typeDef = metadataRegistry.getMetadataTypeDefs().Territory2;
        } else {
          typeDef = metadataRegistry.getMetadataTypeDefs().Territory2Rule;
        }
      }

      const mdType = MetadataTypeFactory.getMetadataTypeFromMetadataName(typeDef.metadataName, metadataRegistry);
      MetadataTypeCache.mdapiPackagePaths.set(packagePath, mdType);
      return mdType;
    }
    return null;
  }
}

type MdTypeCacheIndex = Map<string, MetadataType>;

export class MetadataTypeCache {
  private static _sourcePaths: MdTypeCacheIndex = new Map();
  private static _metadataNames: MdTypeCacheIndex = new Map();
  private static _mdapiPackagePaths: MdTypeCacheIndex = new Map();

  public static get sourcePaths(): MdTypeCacheIndex {
    return this._sourcePaths;
  }

  public static set sourcePaths(newIndex: MdTypeCacheIndex) {
    this._sourcePaths = newIndex;
  }

  public static get metadataNames(): MdTypeCacheIndex {
    return this._metadataNames;
  }

  public static set metadataNames(newIndex: MdTypeCacheIndex) {
    this._metadataNames = newIndex;
  }

  public static get mdapiPackagePaths(): MdTypeCacheIndex {
    return this._mdapiPackagePaths;
  }

  public static set mdapiPackagePaths(newIndex: MdTypeCacheIndex) {
    this._mdapiPackagePaths = newIndex;
  }

  public static clear() {
    MetadataTypeCache.sourcePaths = new Map();
    MetadataTypeCache.metadataNames = new Map();
    MetadataTypeCache.mdapiPackagePaths = new Map();
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SharingRulesMetadataType } from './metadataTypeImpl/sharingRulesMetadataType';

import * as path from 'path';

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

export class MetadataTypeFactory {
  static getMetadataTypeFromSourcePath(sourcePath: string, metadataRegistry): MetadataType {
    const typeDefObj = metadataRegistry.getTypeDefinitionByFileName(sourcePath, true);
    if (typeDefObj) {
      return MetadataTypeFactory.getMetadataTypeFromMetadataName(typeDefObj.metadataName, metadataRegistry);
    }
    return null;
  }

  static getMetadataTypeFromFileProperty(fileProperty, metadataRegistry): MetadataType {
    const typeDefObj = MetadataTypeFactory.getTypeDefObjFromFileProperty(fileProperty, metadataRegistry);
    return MetadataTypeFactory.getMetadataTypeFromMetadataName(typeDefObj.metadataName, metadataRegistry);
  }

  /**
   * @param fileProperty - the mdapi file property
   * @param metadataRegistry
   * @returns {TypeDefObj}
   */
  private static getTypeDefObjFromFileProperty(fileProperty, metadataRegistry): TypeDefObj {
    const fullFileName = fileProperty.fileName;
    const typeDefObj = metadataRegistry.getTypeDefinitionByMetadataName(fileProperty.type);
    if (typeDefObj && typeDefObj.inFolder) {
      const metadataType = typeDefObj.metadataName.toLowerCase();
      if (!fullFileName.endsWith(metadataType) && (metadataType === 'report' || metadataType === 'dashboard')) {
        return typeDefObj.folderTypeDef;
      } else if (fileProperty.fullName.split(path.sep).length === 1) {
        return typeDefObj.folderTypeDef;
      }
    }
    return typeDefObj;
  }

  static getAggregateMetadataType(metadataName: string, metadataRegistry): MetadataType {
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
    let typeDefName;
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

  static getMetadataTypeFromMetadataName(metadataName: string, metadataRegistry): MetadataType {
    let metadataType;
    const typeDefObjs = metadataRegistry.typeDefs;
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
    return metadataType;
  }

  static getMetadataTypeFromMdapiPackagePath(packagePath: string, metadataRegistry): MetadataType {
    const pathElements = packagePath.split(path.sep); // ["type-dir", ["container-dir",]] "file"
    let isFolderType;
    if (pathElements.length > 1) {
      // file level (or intermediate directory for a few types)
      const type = pathElements[0];
      const file = pathElements[pathElements.length - 1];
      const possibleTypeDefs = metadataRegistry.getTypeDefinitionsByDirectoryName(type);
      let typeDef;
      if (possibleTypeDefs.length === 1) {
        typeDef = possibleTypeDefs[0];
      } else {
        const inFolderType = possibleTypeDefs.find(_typeDef => _typeDef.inFolder);
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
          typeDef = metadataRegistry.getTypeDefinitionByFileName(file);
        }
      }

      // Territory2 and Territory2Rule exist in the Territory2Model directory, but they are separate entities
      // so we need to reload the typeDef accordingly
      const isTerritory2Model =
        typeDef && typeDef.metadataName === metadataRegistry.typeDefs.Territory2Model.metadataName;
      if (isTerritory2Model && pathElements.length === 4) {
        // length of 4 signals a subtype of territory2Model
        const terrType = pathElements[2];
        if (terrType === metadataRegistry.typeDefs.Territory2.defaultDirectory) {
          typeDef = metadataRegistry.typeDefs.Territory2;
        } else {
          typeDef = metadataRegistry.typeDefs.Territory2Rule;
        }
      }

      return MetadataTypeFactory.getMetadataTypeFromMetadataName(typeDef.metadataName, metadataRegistry);
    }
    return null;
  }
}

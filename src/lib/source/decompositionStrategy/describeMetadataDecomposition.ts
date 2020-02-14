/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import * as path from 'path';
import * as _ from 'lodash';

import { MetadataDocument, MetadataDocumentAnnotation } from '../metadataDocument';
import { XmlMetadataDocument, XmlAttribute } from '../xmlMetadataDocument';
import {
  DescribeMetadataDecompositionConfig,
  DescribeMetadataDecomposedSubtypeConfig
} from './describeMetadataDecompositionConfig';
import { DecompositionConfig, DecomposedSubtypeConfig } from './decompositionConfig';
import { DecompositionStrategy } from './decompositionStrategy';

export class DescribeMetadataAnnotation implements MetadataDocumentAnnotation {
  name: string;
}

/**
 * Decomposition strategy driven by describeMetadata results.
 * Each childXmlName is assumed to be a subtype for decomposition.
 *
 * For this decomposition the aggregate and decomposed documents
 * are all mdapi XML. The WSDL is used (while building the decomposition
 * configuration in the metadata registry) to interpret the contents
 * of the aggregate metadata document.
 */
export class DescribeMetadataDecomposition implements DecompositionStrategy {
  decompositionConfig: DescribeMetadataDecompositionConfig;

  constructor(decompositionConfig: DecompositionConfig) {
    this.decompositionConfig = <DescribeMetadataDecompositionConfig>decompositionConfig;
  }

  newDocument(metadataName: string, xmlAttributes?: XmlAttribute[]): MetadataDocument {
    return new XmlMetadataDocument(metadataName, xmlAttributes);
  }

  newContainerDocument(metadataName: string): MetadataDocument {
    return new XmlMetadataDocument(metadataName);
  }

  newDecompositionDocument(metadataName: string): MetadataDocument {
    return new XmlMetadataDocument(metadataName);
  }

  newComposedDocument(metadataName: string): MetadataDocument {
    return new XmlMetadataDocument(metadataName);
  }

  compose(
    container: MetadataDocument,
    decompositions: Map<DecomposedSubtypeConfig, MetadataDocument[]>
  ): MetadataDocument {
    const xmlAttributes = DescribeMetadataDecomposition.getXmlAttributesFromDecomposedSource(container, decompositions);
    const composed = new XmlMetadataDocument(this.decompositionConfig.metadataName, xmlAttributes);
    if (!util.isNullOrUndefined(container)) {
      const metadataElement = DescribeMetadataDecomposition.getFirstElement(container);
      let child = metadataElement.firstChild;
      while (child !== null) {
        const node = composed.data.importNode(child, true);
        composed.data.documentElement.appendChild(node);
        child = child.nextSibling;
      }
    }

    if (!util.isNullOrUndefined(decompositions)) {
      for (const decomposedSubtypeConfig of decompositions.keys()) {
        for (const decomposition of decompositions.get(decomposedSubtypeConfig)) {
          const fragmentDoc = decomposition.data;
          const fragmentElement = composed.data.createElement(
            (<DescribeMetadataDecomposedSubtypeConfig>decomposedSubtypeConfig).xmlFragmentName
          );
          composed.data.documentElement.appendChild(fragmentElement);
          let child = fragmentDoc.documentElement.firstChild;
          while (child !== null) {
            const node = composed.data.importNode(child, true);
            fragmentElement.appendChild(node);
            child = child.nextSibling;
          }
        }
      }
    }

    return composed;
  }

  decompose(
    composed: MetadataDocument,
    name: string,
    manifest?,
    metadataType?
  ): [MetadataDocument, Map<DecomposedSubtypeConfig, MetadataDocument[]>] {
    const xmlAttributes = DescribeMetadataDecomposition.getXmlAttributes(composed);
    let container = <XmlMetadataDocument>this.newDocument(this.decompositionConfig.metadataName, xmlAttributes);
    let decompositions = new Map<DecomposedSubtypeConfig, MetadataDocument[]>();
    let child = composed.data.documentElement.firstChild;
    while (child !== null) {
      if (child.nodeType === 1) {
        const decomposedSubtypeConfig = DescribeMetadataDecomposition.findDecompositionSubtypeConfig(
          <DescribeMetadataDecomposedSubtypeConfig[]>this.decompositionConfig.decompositions,
          child.nodeName
        );
        if (!util.isNullOrUndefined(decomposedSubtypeConfig)) {
          const decomposition = new XmlMetadataDocument(decomposedSubtypeConfig.metadataName, xmlAttributes);
          let elt = child.firstChild;
          while (elt !== null) {
            if (elt.nodeType === 1) {
              DescribeMetadataDecomposition.importDocumentElementChild(decomposition.data, elt);
            }
            elt = elt.nextSibling;
          }
          const annotation = this.getAnnotation(decomposition, decomposedSubtypeConfig);
          decomposition.setAnnotation(annotation);

          if (util.isNullOrUndefined(decompositions.get(decomposedSubtypeConfig))) {
            decompositions.set(decomposedSubtypeConfig, []);
          }
          decompositions.get(decomposedSubtypeConfig).push(decomposition);
        } else {
          DescribeMetadataDecomposition.importDocumentElementChild(container.data, child);
        }
      }
      child = child.nextSibling;
    }

    /*
     * An aggregate mdapi file can be sparse, but that doesn't necessarily mean anything - either for
     * retrieve or deploy. Unfortunately it's also possible to get a dense aggregate even when very
     * specific bits have been requested (eg. when, say, a custom field was requested, but also the container
     * object by virtue of an object label change).
     * So, we use the manifest to see what's been explicitly requested from the server. Anything else
     * is not material and should be pruned from the effective decomposition.
     */
    container = this.pruneContainer(container, this.decompositionConfig.metadataName, name, manifest, metadataType);
    decompositions = this.pruneDocuments(decompositions, name, manifest);
    return [container, decompositions];
  }

  isComposable(): boolean {
    return true;
  }

  newAnnotation(): MetadataDocumentAnnotation {
    return new DescribeMetadataAnnotation();
  }

  getAnnotation(decomposition: MetadataDocument, subtypeConfig: DecomposedSubtypeConfig): MetadataDocumentAnnotation {
    const annotation = this.newAnnotation();
    annotation.name = DescribeMetadataDecomposition.getName(
      decomposition,
      (<DescribeMetadataDecomposedSubtypeConfig>subtypeConfig).metadataEntityNameElement
    );
    return annotation;
  }

  private pruneDocuments(
    decompositions: Map<DecomposedSubtypeConfig, MetadataDocument[]>,
    parentName: string,
    manifest?
  ): Map<DecomposedSubtypeConfig, MetadataDocument[]> {
    if (util.isNullOrUndefined(manifest)) {
      return decompositions;
    }

    const pruned: Map<DecomposedSubtypeConfig, MetadataDocument[]> = new Map<
      DecomposedSubtypeConfig,
      MetadataDocument[]
    >();
    decompositions.forEach((value, key) => {
      if (key.isAddressable) {
        const subtypeMembers: string[] = manifest.Package.types.reduce((members, type) => {
          if (type.name === key.metadataName) {
            return members.concat(type.members);
          } else {
            return members;
          }
        }, []);

        const docs: MetadataDocument[] = value.filter(doc => {
          const annotation = doc.getAnnotation();
          return (
            subtypeMembers.filter(subtypeMember => {
              return subtypeMember === `${parentName}.${annotation.name}`;
            }).length > 0
          );
        });
        pruned.set(key, docs);
      } else {
        pruned.set(key, value);
      }
    });
    return pruned;
  }

  private pruneContainer(
    container: XmlMetadataDocument,
    containerType: string,
    name: string,
    manifest?,
    metadataType?
  ): XmlMetadataDocument {
    if (metadataType && !metadataType.isContainerValid(container)) {
      return null;
    }

    if (util.isNullOrUndefined(manifest)) {
      return container;
    }

    const subtypeMembers: string[] = manifest.Package.types.reduce((members, type) => {
      const _getCorrespondingManifestType = containerType => {
        if (containerType.endsWith('Folder')) {
          return containerType.replace('Folder', '');
        }
        return containerType;
      };

      if (type.name === _getCorrespondingManifestType(containerType)) {
        return members.concat(type.members);
      } else {
        return members;
      }
    }, []);

    // The package.xml is using forward slashes, so replace these with path separators so the matching works on Windows
    return subtypeMembers.some(subTypeMember => subTypeMember.replace('/', path.sep) === name) ? container : null;
  }

  private static getName(decomposition: MetadataDocument, metadataEntityNameElement: string): string {
    let child = decomposition.data.documentElement.firstChild;
    while (child !== null) {
      if (child.nodeType === 1 && child.nodeName === metadataEntityNameElement) {
        return child.firstChild.nodeValue;
      }
      child = child.nextSibling;
    }
    return null;
  }

  private static importDocumentElementChild(document, child) {
    const node = document.importNode(child, true);
    document.documentElement.appendChild(node);
  }

  private static findDecompositionSubtypeConfig(
    decompositionDefs: DescribeMetadataDecomposedSubtypeConfig[],
    tag
  ): DescribeMetadataDecomposedSubtypeConfig {
    for (const decompositionDef of decompositionDefs) {
      if (decompositionDef.xmlFragmentName === tag) {
        return decompositionDef;
      }
    }
    return null;
  }

  private static getFirstElement(doc: MetadataDocument): any {
    for (let i = 0; i < doc.data.childNodes.length; ++i) {
      const child = doc.data.childNodes[i];
      if (child.nodeType === 1) {
        return child;
      }
    }
    return null;
  }

  private static getXmlAttributes(document: MetadataDocument): XmlAttribute[] {
    if (document) {
      return _.values(document.data.documentElement.attributes).map(attribute => ({
        nodeName: attribute.nodeName,
        nodeValue: attribute.nodeValue
      }));
    }
    return [];
  }

  private static getXmlAttributesFromDecomposedSource(
    container: MetadataDocument,
    decompositions: Map<DecomposedSubtypeConfig, MetadataDocument[]>
  ): XmlAttribute[] {
    if (container) {
      return DescribeMetadataDecomposition.getXmlAttributes(container);
    }

    if (decompositions.size > 0) {
      const firstDecomposition = Array.from(decompositions.values())[0][0];
      return DescribeMetadataDecomposition.getXmlAttributes(firstDecomposition);
    }

    return [];
  }
}

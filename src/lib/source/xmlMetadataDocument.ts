/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';

import { DOMParser, XMLSerializer } from 'xmldom-sfdx-encoding';
import srcDevUtil = require('../core/srcDevUtil');
import { MetadataDocument, MetadataDocumentAnnotation } from './metadataDocument';
import { SfdxError } from '@salesforce/core';
import { checkForXmlParseError } from './sourceUtil';

export type XmlLineError = { key: string; message: string };

/**
 * Class used to hold an XML metadata document.
 * This uses a unitary XML representation and DOM content.
 */
export class XmlMetadataDocument implements MetadataDocument {
  data: any;
  annotation: MetadataDocumentAnnotation;

  constructor(metadataName: string, xmlAttributes?: XmlAttribute[]) {
    if (!util.isNullOrUndefined(metadataName)) {
      this.setRepresentation(this.getOuterXml(metadataName, xmlAttributes));
    }
  }

  getRepresentation(): string {
    const pretty = true;
    return XmlMetadataDocument.serializeData(this.data, pretty);
  }

  getUnmodifiedRepresentation(): string {
    const pretty = false;
    return XmlMetadataDocument.serializeData(this.data, pretty);
  }

  setRepresentation(representation: string): void {
    const errHandlerResults: XmlLineError[] = [];
    const errHandler = (key: string, message: string) => {
      errHandlerResults.push({ key, message });
    };

    this.data = XmlMetadataDocument.parseRepresentation(representation, errHandler);
    if (errHandlerResults.length > 0) {
      const error = new SfdxError('XML parse errors reported', 'xmlParseErrorsReported');
      error.setData(errHandlerResults);
      throw error;
    }
  }

  getAnnotation(): MetadataDocumentAnnotation {
    return this.annotation;
  }

  setAnnotation(annotation: MetadataDocumentAnnotation): void {
    this.annotation = annotation;
  }

  isEquivalent(doc: MetadataDocument): boolean {
    return this.getRepresentation() === doc.getRepresentation();
  }

  isEquivalentTo(representation: string): boolean {
    const rhs: XmlMetadataDocument = new XmlMetadataDocument(null);
    try {
      rhs.setRepresentation(representation);
    } catch (e) {
      throw checkForXmlParseError(representation, e);
    }
    return this.isEquivalent(rhs);
  }

  private static getWhitespace(indent) {
    const tabSpaces = '    ';
    let whitespace = '\n';
    for (let i = 0; i < indent; ++i) {
      whitespace = whitespace + tabSpaces;
    }
    return whitespace;
  }

  private static isEmptyElement(node) {
    return node.childNodes.length === 0;
  }

  private static isSimpleElement(node) {
    const nodeTypeText = 3;
    const nodeTypeComment = 8;
    return (
      node.childNodes.length === 1 &&
      (node.firstChild.nodeType === nodeTypeText || node.firstChild.nodeType === nodeTypeComment)
    );
  }

  private static insertAfter(node, refNode) {
    if (refNode.nextSibling !== null) {
      refNode.parentNode.insertBefore(node, refNode.nextSibling);
    } else {
      refNode.parentNode.appendChild(node);
    }
  }

  private static addWhitespaceNodes(document, node, indent) {
    if (node !== null) {
      const nodeTypeElement = 1;
      if (node.nodeType === nodeTypeElement) {
        if (!XmlMetadataDocument.isEmptyElement(node) && !XmlMetadataDocument.isSimpleElement(node)) {
          node.insertBefore(document.createTextNode(XmlMetadataDocument.getWhitespace(indent + 1)), node.firstChild);
        }
        XmlMetadataDocument.insertAfter(
          document.createTextNode(XmlMetadataDocument.getWhitespace(node.nextSibling !== null ? indent : indent - 1)),
          node
        );
      }

      let child = node.firstChild;
      while (child !== null) {
        XmlMetadataDocument.addWhitespaceNodes(document, child, indent + 1);
        child = child.nextSibling;
      }
    }
  }

  private static addWhitespace(document) {
    document.insertBefore(document.createTextNode(XmlMetadataDocument.getWhitespace(0)), document.documentElement);
    XmlMetadataDocument.addWhitespaceNodes(document, document.documentElement, 0);
  }

  private static beautifyDocument(document) {
    srcDevUtil.stripWhitespace(document);
    XmlMetadataDocument.addWhitespace(document);
  }

  private static serializeData(document, pretty) {
    if (pretty) {
      XmlMetadataDocument.beautifyDocument(document);
    }
    return new XMLSerializer().serializeToString(document);
  }

  private static parseRepresentation(xml: string, errorHandler: (key: string, message: string) => void) {
    return new DOMParser({ errorHandler }).parseFromString(xml, 'application/xml');
  }

  private getOuterXml(metadataName: string, xmlAttributes: XmlAttribute[]) {
    const xmlDecl = '<?xml version="1.0" encoding="UTF-8"?>';
    const attributes = XmlMetadataDocument.getXmlAttributesString(xmlAttributes);
    const rootElement = `<${metadataName}${attributes}/>`;
    return `${xmlDecl}${rootElement}`;
  }

  private static getXmlAttributesString(xmlAttributes: XmlAttribute[]): string {
    if (xmlAttributes) {
      return xmlAttributes
        .filter(attribute => attribute.nodeName && attribute.nodeValue)
        .reduce(
          (accumulatedString, attribute) => `${accumulatedString} ${attribute.nodeName}="${attribute.nodeValue}"`,
          ''
        );
    }
    return '';
  }
}

export interface XmlAttribute {
  nodeName: string;
  nodeValue: string;
}

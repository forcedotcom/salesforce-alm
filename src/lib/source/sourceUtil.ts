/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as os from 'os';

import { isNil, get as _get } from 'lodash';
import { SfdxError, SfdxErrorConfig, fs, Logger, Messages, SfdxProject } from '@salesforce/core';
import srcDevUtil = require('../core/srcDevUtil');
import consts = require('../core/constants');
import MdapiPackage = require('../source/mdapiPackage');
import { AggregateSourceElement } from './aggregateSourceElement';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { MetadataType } from './metadataType';
import { InFolderMetadataType } from './metadataTypeImpl/inFolderMetadataType';
import { XmlLineError } from './xmlMetadataDocument';
import { NondecomposedTypesWithChildrenMetadataType } from './metadataTypeImpl/nondecomposedTypesWithChildrenMetadataType';
import { CustomLabelsMetadataType } from './metadataTypeImpl/customLabelsMetadataType';
import { SourceWorkspaceAdapter } from './sourceWorkspaceAdapter';
import { AggregateSourceElements } from './aggregateSourceElements';
import MetadataRegistry = require('./metadataRegistry');
import { RemoteSourceTrackingService } from './remoteSourceTrackingService';

Messages.importMessagesDirectory(__dirname);

/**
 * Validate the value for the 'wait' parameter and reset it as a number.
 *
 * @param flags The command parameters (aka flags)
 * @param minWaitTime The minimum allowable time to wait
 */
export const parseWaitParam = (flags: { wait?: string }, minWaitTime: number = consts.MIN_SRC_WAIT_MINUTES) => {
  if (!isNil(flags.wait)) {
    if (srcDevUtil.isInt(flags.wait)) {
      const wait = (flags.wait = parseInt(flags.wait, 10) as any); // convert to a number
      if (wait >= minWaitTime) {
        return;
      }
    }

    const errConfig = new SfdxErrorConfig('salesforce-alm', 'source', 'mdapiCliInvalidNumericParam');
    errConfig.setErrorTokens(['wait']);
    throw SfdxError.create(errConfig);
  }
};

/**
 * Validate that the org is a non-source-tracked org.
 *
 * @param orgName The username of the org for doing the source:deploy or source:retrieve
 * @param errAction The action ('push' or 'pull') to take when the org is discovered to be a source tracked org.
 */
export const validateNonSourceTrackedOrg = async (orgName: string, errAction: string) => {
  if (await srcDevUtil.isSourceTrackedOrg(orgName)) {
    const errConfig = new SfdxErrorConfig('salesforce-alm', 'source', 'SourceTrackedOrgError');
    errConfig.addAction('SourceTrackedOrgErrorAction', [errAction]);
    throw SfdxError.create(errConfig);
  }
};

/**
 * Validate that a manifest file path exists and is readable.
 *
 * @param manifestPath The path to the manifest file (package.xml)
 */
export const validateManifestPath = async (manifestPath: string) => {
  try {
    await fs.access(manifestPath, fs.constants.R_OK);
  } catch (e) {
    throw SfdxError.create('salesforce-alm', 'source', 'InvalidManifestError', [manifestPath]);
  }
};

export async function createOutputDir(cmdName: string): Promise<string> {
  const logger: Logger = await Logger.child('SourceUtil');
  const targetDir = process.env.SFDX_MDAPI_TEMP_DIR || os.tmpdir();
  const tmpOutputDir = path.join(targetDir, `sdx_${cmdName}_${Date.now()}`);
  await fs.mkdirp(tmpOutputDir, fs.DEFAULT_USER_DIR_MODE);
  logger.info(`Created output directory '${tmpOutputDir}'`);
  return tmpOutputDir;
}

export async function cleanupOutputDir(outputDir: string): Promise<void> {
  const logger: Logger = await Logger.child('SourceUtil');
  if (outputDir && !outputDir.includes(process.env.SFDX_MDAPI_TEMP_DIR)) {
    try {
      await fs.remove(outputDir);
      try {
        if (await fs.stat(`${outputDir}.zip`)) {
          await fs.unlink(`${outputDir}.zip`);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn(`Could not delete the MDAPI temporary zip file ${outputDir}.zip due to: ${err.message}`);
        }
      }
    } catch (err) {
      logger.warn(`Could not delete the outputDir '${outputDir}' due to: ${err.message}`);
    }
  } else {
    logger.warn(`Did not delete the outputDir '${outputDir}' because it was set by the user`);
  }
}

/**
 * Return the aggregate source element for the specified file
 *
 * @param {string} sourcePath the file in the workspace
 * @param sourceWorkspaceAdapter
 * @returns {AggregateSourceElement}
 */
export const getSourceElementForFile = async function (
  sourcePath: string,
  sourceWorkspaceAdapter: SourceWorkspaceAdapter,
  metadataType?: MetadataType
): Promise<AggregateSourceElement> {
  let aggregateSourceElement: AggregateSourceElement;
  const mdRegistry = sourceWorkspaceAdapter.metadataRegistry;
  const sourceElementMetadataType =
    metadataType || MetadataTypeFactory.getMetadataTypeFromSourcePath(sourcePath, mdRegistry);

  if (sourceElementMetadataType) {
    // This will build an AggregateSourceElement with only the specified WorkspaceElement
    // (child element) when the metadata type has a parent.
    const _sourcePath = _get(sourceElementMetadataType, 'typeDefObj.parent') ? sourcePath : path.dirname(sourcePath);

    const aggregateMetadataName = sourceElementMetadataType.getAggregateMetadataName();
    const aggregateFullName = sourceElementMetadataType.getAggregateFullNameFromFilePath(sourcePath);
    const key = AggregateSourceElement.getKeyFromMetadataNameAndFullName(aggregateMetadataName, aggregateFullName);

    // Get the AggregateSourceElement, which will only populate with the specified WorkspaceElement
    // when sourcePath is part of an ASE.
    const sourceElements = await sourceWorkspaceAdapter.getAggregateSourceElements(
      false,
      undefined,
      undefined,
      _sourcePath
    );
    const packageName = SfdxProject.getInstance().getPackageNameFromPath(sourcePath);
    aggregateSourceElement = loadSourceElement(sourceElements, key, mdRegistry, packageName);
  } else {
    throw SfdxError.create('salesforce-alm', 'source', 'SourcePathInvalid', [sourcePath]);
  }

  return aggregateSourceElement;
};

/**
 * Get the source elements from the source path, whether for a particular file or a directory
 */
export const getSourceElementsFromSourcePath = async function (
  optionsSourcePath: string,
  sourceWorkspaceAdapter: SourceWorkspaceAdapter
): Promise<AggregateSourceElements> {
  const aggregateSourceElements = new AggregateSourceElements();
  const mdRegistry = sourceWorkspaceAdapter.metadataRegistry;

  for (let sourcepath of optionsSourcePath.split(',')) {
    // resolve to an absolute path
    sourcepath = path.resolve(sourcepath.trim());

    // Throw an error if the source path isn't accessible.
    try {
      await fs.access(sourcepath, fs.constants.R_OK);
    } catch (e) {
      throw SfdxError.create('salesforce-alm', 'source', 'SourcePathInvalid', [sourcepath]);
    }

    // Get the MetadataType so we can resolve the path.  Some paths such as individual static
    // resources need to use a different path when getting source elements.
    const metadataType = MetadataTypeFactory.getMetadataTypeFromSourcePath(sourcepath, mdRegistry);

    if (metadataType) {
      sourcepath = metadataType.resolveSourcePath(sourcepath);
    }

    // Get a single source element or a directory of source elements and add it to the map.
    if (srcDevUtil.containsFileExt(sourcepath)) {
      const ase: AggregateSourceElement = await getSourceElementForFile(
        sourcepath,
        sourceWorkspaceAdapter,
        metadataType
      );
      const aseKey = ase.getKey();
      const pkg = ase.getPackageName();

      if (aggregateSourceElements.has(pkg)) {
        const sourceElements = aggregateSourceElements.get(pkg);
        if (sourceElements.has(aseKey)) {
          const _ase = sourceElements.get(aseKey);
          _ase.addWorkspaceElement(ase.getWorkspaceElements()[0]);
          sourceElements.set(aseKey, _ase);
        } else {
          sourceElements.set(aseKey, ase);
        }
      } else {
        aggregateSourceElements.setIn(pkg, aseKey, ase);
      }
    } else {
      const sourceElementsInPath = await getSourceElementsInPath(sourcepath, sourceWorkspaceAdapter);
      aggregateSourceElements.merge(sourceElementsInPath);
    }
  }

  return aggregateSourceElements;
};

/**
 * Return the specified aggregate source element or error if it does not exist
 *
 * @param {AggregateSourceElements} sourceElements All the source elements in the workspace
 * @param {string} key The key of the particular source element we are looking for
 * @param {string} packageName
 * @param {MetadataRegistry} metadataRegistry
 * @returns {AggregateSourceElement}
 */
export const loadSourceElement = function (
  sourceElements: AggregateSourceElements,
  key: string,
  metadataRegistry: MetadataRegistry,
  packageName?: string
): AggregateSourceElement {
  const aggregateSourceElement = packageName
    ? sourceElements.getSourceElement(packageName, key)
    : sourceElements.findSourceElementByKey(key);

  if (!aggregateSourceElement) {
    // Namespaces also contain '__' so only split on the first occurrence of '__'
    let [mdType, ...rest] = key.split('__');
    const mdName = rest.join('__');

    const metadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(mdType, metadataRegistry);
    if (!metadataType) {
      throw SfdxError.create('salesforce-alm', 'source', 'MetadataTypeDoesNotExist', [mdType]);
    }
    const hasParentType = metadataType.getMetadataName() !== metadataType.getAggregateMetadataName();
    if (hasParentType) {
      // In this case, we are dealing with a decomposed subtype, so need to check for a parent
      const parentName = metadataType.getAggregateMetadataName();
      const parentMetadataType = MetadataTypeFactory.getAggregateMetadataType(parentName, metadataRegistry);
      const parentFullName = metadataType.getAggregateFullNameFromWorkspaceFullName(mdName);
      const newKey = AggregateSourceElement.getKeyFromMetadataNameAndFullName(
        parentMetadataType.getAggregateMetadataName(),
        parentFullName
      );
      // Get the parent AggregateSourceElement with all WorkspaceElements removed
      // except for the child specified by the `key`.
      return sourceElements.findParentElement(newKey, mdType, mdName);
    } else if (metadataType instanceof InFolderMetadataType) {
      mdType = MdapiPackage.convertFolderTypeKey(mdType);
      return loadSourceElement(sourceElements, `${mdType}__${mdName}`, metadataRegistry, packageName);
    } else if (metadataType instanceof NondecomposedTypesWithChildrenMetadataType) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const mdType = metadataType.getMetadataName();
      let name = `${mdType}__${mdName.split('.')[0]}`;

      if (metadataType instanceof CustomLabelsMetadataType) {
        // for now, all CustomLabels are in CustomLabels.labels.meta-xml.
        // the key for the ASE is then CustomLabels_CustomLabels
        // it will deploy all CustomLabels, regardless of what is specified in the manifest
        name = `${mdType}__${mdType}`;
      }

      if (name === key) {
        // the name isn't changing which causes a max stack call size error,
        const errConfig = new SfdxErrorConfig('salesforce-alm', 'source_deploy', 'SourceElementDoesNotExist');
        errConfig.setErrorTokens([mdType, mdName]);
        throw SfdxError.create(errConfig);
      }

      return loadSourceElement(sourceElements, name, metadataRegistry, packageName);
    } else {
      const errConfig = new SfdxErrorConfig('salesforce-alm', 'source_deploy', 'SourceElementDoesNotExist');
      errConfig.setErrorTokens([mdType, mdName]);
      throw SfdxError.create(errConfig);
    }
  }
  return aggregateSourceElement;
};

/**
 * Return the aggregate source elements found in the provided source path
 *
 * @param {Array<string>} sourcePath The path to look for source elements in
 * @param sourceWorkspaceAdapter
 * @returns {AggregateSourceElements}
 */
export const getSourceElementsInPath = function (
  sourcePath: string,
  sourceWorkspaceAdapter: any
): Promise<AggregateSourceElements> {
  return sourceWorkspaceAdapter.getAggregateSourceElements(false, undefined, undefined, sourcePath);
};

/**
 * Used to determine if an error is the result of parsing bad XML. If so return a new parsing error.
 *
 * @param path The file path.
 * @param error The error to inspect.
 */
// eslint-disable-next-line @typescript-eslint/no-shadow
export const checkForXmlParseError = function (path: string, error: Error) {
  if (path && error instanceof SfdxError && error.name === 'xmlParseErrorsReported') {
    const data = (error.data as XmlLineError[]) || [];
    const message = `${path}:${os.EOL}${data.reduce(
      // eslint-disable-next-line @typescript-eslint/no-shadow
      (messages: string, message: XmlLineError) => `${messages}${os.EOL}${message.message}`,
      ''
    )}`;
    return SfdxError.create('salesforce-alm', 'source', 'XmlParsingError', [message]);
  }
  return error;
};

/**
 * @param options
 */
export const containsMdBundle = function (options: any): boolean {
  if (options.metadata) {
    // for retreiveFromMetadata
    return options.metadata.indexOf('Bundle') >= 0;
  } else {
    // for retrieveFromSourcepath
    for (const pair of options) {
      if (pair.type.indexOf('Bundle') >= 0) {
        return true;
      }
    }
    return false;
  }
};
/**
 * Filters the component success responses from a deploy or retrieve to exclude
 * components that do not have SourceMembers created for them in the org, such
 * as standard objects (e.g., Account) and standard fields before syncing with
 * remote source tracking.  Also modifies the fullName (e.g., MyApexClass) of
 * certain metadata types to match their corresponding SourceMember names.
 *
 * Filtering rules applied:
 *   1. Component successes without an `id` entry do not have `SourceMember`
 *      records created for them.
 *      E.g., standard objects, package.xml, CustomLabels, etc.
 *   2. In-Folder types (E.g., Documents) will have the file extension removed
 *      since the SourceMember's MemberName does not include it.
 *      E.g., "MyDocFolder/MyDoc.png" --> "MyDocFolder/MyDoc"
 *   3. Component success fullNames will be URI decoded.
 *      E.g., "Account %28Sales%29" --> "Account (Sales)"
 *
 * NOTE: Currently this is only called after a source:push.
 *
 * @param successes the component successes of a deploy/retrieve response
 * @param remoteSourceTrackingService
 * @param metadataRegistry
 */
export const updateSourceTracking = async function (
  successes: any[],
  remoteSourceTrackingService: RemoteSourceTrackingService,
  metadataRegistry: MetadataRegistry
): Promise<void> {
  const metadataTrackableElements: string[] = [];

  successes.forEach((component) => {
    // Assume only components with id's are trackable (SourceMembers are created)
    if (component.id) {
      const componentMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
        component.componentType,
        metadataRegistry
      );
      let fullName = component.fullName;
      if (componentMetadataType instanceof InFolderMetadataType && component.fileName) {
        // This removes any file extension from component.fullName
        fullName = componentMetadataType.getFullNameFromFilePath(component.fileName);
      }
      metadataTrackableElements.push(decodeURIComponent(fullName));
    }
  });

  // Sync source tracking for the trackable pushed components
  await remoteSourceTrackingService.sync(metadataTrackableElements);
};

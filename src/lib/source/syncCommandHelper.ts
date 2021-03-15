/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import * as path from 'path';
import * as _ from 'lodash';

import { WorkspaceFileState, toReadableState } from './workspaceFileState';
import { AggregateSourceElement } from './aggregateSourceElement';
import { AggregateSourceElements } from './aggregateSourceElements';
import { MetadataTypeFactory } from './metadataTypeFactory';
import { replaceForwardSlashes } from './sourcePathUtil';
import MetadataRegistry = require('./metadataRegistry');
import { Logger } from '@salesforce/core';

interface ComponentFailure {
  changed: boolean;
  componentType: string;
  created: boolean;
  createdDate: Date;
  deleted: boolean;
  fileName: string;
  fullName: string;
  problem: string;
  problemType: string;
  success: boolean;
  columnNumber?: number;
  lineNumber?: number;
}

const _createRowsForConflictStatus = function(
  rows,
  createDisplayRowData,
  outpuFileInfo,
  projectPath,
  thisSelf,
  isStatus
) {
  const row = createDisplayRowData(outpuFileInfo, thisSelf.trimParentFromPath(projectPath, outpuFileInfo.filePath));
  if (isStatus && outpuFileInfo.isConflict) {
    row.state += ' (Conflict)';
  }
  rows.push(row);
};

const _getState = function(state, deleteSupported) {
  const calcState = !!state ? state : WorkspaceFileState.DELETED;
  return !deleteSupported && calcState === WorkspaceFileState.DELETED
    ? `${toReadableState(WorkspaceFileState.DELETED)} (local file)`
    : toReadableState(calcState);
};

const _getFullNameFromDeleteFailure = function(failure) {
  /*
   * Note the weird fullName behavior in the mdapi deploy file property.
   * Fortunately we can recover the fullName from the error message text!
   */
  const noComponentFoundRegex = new RegExp(`No ${failure.componentType} named: (.+) found$`);
  const matches = noComponentFoundRegex.exec(failure.problem);
  return matches !== null ? matches[1] : null;
};

const _getSourceElement = function(
  componentFailure: ComponentFailure,
  aggregateSourceElements: AggregateSourceElements,
  metadataRegistry: MetadataRegistry
) {
  const failureMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
    componentFailure.componentType,
    metadataRegistry
  );
  if (failureMetadataType) {
    let fullName = componentFailure.fullName;
    if (fullName === 'destructiveChanges.xml') {
      fullName = _getFullNameFromDeleteFailure(componentFailure);
    } else {
      componentFailure.fileName = replaceForwardSlashes(componentFailure.fileName); // fix windows specific file separators
      fullName = failureMetadataType.getAggregateFullNameFromComponentFailure(componentFailure);
    }
    const sourceElementKey = AggregateSourceElement.getKeyFromMetadataNameAndFullName(
      failureMetadataType.getAggregateMetadataName(),
      fullName
    );
    return aggregateSourceElements.findSourceElementByKey(sourceElementKey);
  }
  return null;
};

const _parseComponentFailure = function(
  componentFailure: ComponentFailure,
  sourceElements: AggregateSourceElements,
  metadataRegistry: MetadataRegistry,
  logger: Logger
) {
  let aggregateSourceElement;
  let filePath;
  let fullName;

  try {
    // see if we can map the error to a local sourceElement
    aggregateSourceElement = _getSourceElement(componentFailure, sourceElements, metadataRegistry);

    if (!util.isNullOrUndefined(aggregateSourceElement)) {
      const componentMetadataType = MetadataTypeFactory.getMetadataTypeFromMetadataName(
        componentFailure.componentType,
        metadataRegistry
      );
      fullName = componentMetadataType.getWorkspaceFullNameFromComponentFailure(componentFailure);

      // does the error reference the -meta file or the content file?
      const componentFailureIsInMetadataFile = componentMetadataType.componentFailureIsInMetadataFile(
        componentFailure.fileName
      );
      if (componentFailureIsInMetadataFile) {
        filePath = aggregateSourceElement.getMetadataWorkspacePathsForTypeAndFullName(
          componentFailure.componentType,
          fullName
        )[0];
      } else {
        // the file we are looking for is a content file
        const matchingPaths = aggregateSourceElement.getContentWorkspacePathsForTypeAndFullName(
          componentFailure.componentType,
          fullName
        );
        if (matchingPaths.length > 0) {
          filePath = componentMetadataType.getComponentFailureWorkspaceContentPath(
            aggregateSourceElement.getMetadataFilePath(),
            matchingPaths
          );
        }
      }
      if (!filePath) {
        filePath = aggregateSourceElement.getMetadataFilePath();
      }
    } else {
      filePath = '';
    }
  } catch (e) {
    if (logger) {
      logger.debug(e);
    }
  }

  return {
    columnNumber: componentFailure.columnNumber,
    lineNumber: componentFailure.lineNumber,
    error: componentFailure.problem,
    fullName,
    type: componentFailure.componentType,
    filePath,
    problemType: componentFailure.problemType
  };
};

const self = {
  getDeployFailures(
    resp,
    aggregateSourceElements: AggregateSourceElements,
    metadataRegistry: MetadataRegistry,
    logger?: Logger
  ) {
    const deployFailures = [];

    // look into component details assemble deployment failure message
    if (resp.details && resp.details.componentFailures) {
      if (Array.isArray(resp.details.componentFailures)) {
        // Array of failures
        for (let i = 0, len = resp.details.componentFailures.length; i < len; i++) {
          const comp = resp.details.componentFailures[i];
          deployFailures.push(_parseComponentFailure(comp, aggregateSourceElements, metadataRegistry, logger));
        }
      } else {
        // Single failure
        const comp = resp.details.componentFailures;
        deployFailures.push(_parseComponentFailure(comp, aggregateSourceElements, metadataRegistry, logger));
      }
    } else if (!util.isNullOrUndefined(resp.ErrorMsg)) {
      deployFailures.push({ error: resp.ErrorMsg });
    } else {
      deployFailures.push({ error: 'Unknown' });
    }

    return deployFailures;
  },

  getFullNameFromDeleteFailure(failure) {
    return _getFullNameFromDeleteFailure(failure);
  },

  /**
   * report formatting for retrieve failures.
   * @param resp - the result of toolingRetrieve
   * @param detailProperty - the name of the property with the deploy details. Defaults to 'DeployDetails'.
   * @returns {string} represents reported deployment errors
   * @private
   */
  getRetrieveFailureMessage(resp, messages) {
    let msg = '';

    if (!util.isNullOrUndefined(resp.messages)) {
      if (resp.messages instanceof Array && resp.messages.length > 0) {
        for (let i = 0, len = resp.messages.length; i < len; ++i) {
          msg += resp.messages[i].problem;
          if (i < len - 1) {
            msg += '\n';
          }
        }
      } else {
        msg = resp.messages.problem;
      }
    } else if (!util.isNullOrUndefined(resp.errorMessage)) {
      msg = resp.errorMessage;
    } else if (util.isNullOrUndefined(resp.fileProperties) || !Array.isArray(resp.fileProperties)) {
      msg = messages.getMessage('mdapiPullCommandNoDataReturned');
    } else {
      msg = 'Unknown';
    }

    return msg;
  },

  /**
   * helper method used by the sync commands to retrieve status of a container async request.
   * @param force - the force api
   * @param api - scratch org api
   * @param sobjectId - id of the container async request
   * @param messages - L10N access obeject
   * @param callback - callback that resolves a value once the ContainerAsyncRequest is complete.
   * @param resolve - outer promise resolve function
   * @param reject - outer promise reject handler
   * @returns {Promise}
   */
  retrieveContainerStatus(force, api, sobjectId, messages, callback, resolve, reject) {
    return force.toolingRetrieve(api, 'ContainerAsyncRequest', sobjectId).then(resp => {
      switch (resp.State) {
        case 'Completed':
          return resolve(callback());
        case 'Failed': {
          const deployFailed = new Error(resp.ErrorMsg);
          deployFailed.name = 'ContainerDeployFailed';
          return reject(deployFailed);
        }
        case 'Invalidated': {
          const invalidatedError =
            // @todo re-label message
            new Error(messages.getMessage('pushCommandAsyncRequestInvalidated'));
          invalidatedError.name = 'ContainerDeployInvalidated';
          return reject(invalidatedError);
        }
        default: {
          let deployErrMsg = messages.getMessage('pushCommandAsyncRequestUnexpected');
          const respError = resp.ErrorMsg;
          if (!util.isNullOrUndefined(respError)) {
            deployErrMsg += `  ${respError}.`;
          }

          const deployError = new Error(deployErrMsg);
          deployError.name = 'ContainerDeployError';
          return reject(deployError);
        }
      }
    });
  },

  /**
   * Removes a parent path to make a relative path.
   *
   * @param parent - the parent path (usually a project directory)
   * @param elementPath - the full path that contains the parent.
   * @returns {*}
   */
  trimParentFromPath(parent, elementPath) {
    if (util.isNullOrUndefined(elementPath) || elementPath.indexOf(parent) !== 0) {
      return null;
    }

    if (util.isNullOrUndefined(parent)) {
      return null;
    }

    const trimmedParent = parent.trim();
    if (trimmedParent.length < 1) {
      return null;
    }

    let newParent = trimmedParent;
    if (!parent.endsWith(path.sep)) {
      newParent = `${trimmedParent}${path.sep}`;
    }

    const paths = elementPath.trim().split(newParent);

    const element = paths[paths.length - 1];

    // handle the case where both the parent and elementPath are the same.
    if (element === elementPath) {
      return '';
    }

    return element;
  },

  // Return table column metadata.  Changesets commands do not display state info since it doesn't apply.
  getColumnMetaInfo(messages, withoutState?) {
    const stateCol = withoutState ? [] : [{ key: 'state', label: messages.getMessage('stateTableColumn') }];
    const columns = [
      { key: 'fullName', label: messages.getMessage('fullNameTableColumn') },
      { key: 'type', label: messages.getMessage('typeTableColumn') },
      {
        key: 'filePath',
        label: messages.getMessage('workspacePathTableColumn')
      }
    ];

    return [...stateCol, ...columns];
  },

  createDeployFailureRow(rows, failure, projectPath) {
    if (!util.isNullOrUndefined(failure.filePath)) {
      if (failure.filePath === '') {
        failure.filePath = 'N/A';
      } else {
        failure.filePath = self.trimParentFromPath(projectPath, failure.filePath);
      }
    }
    const columnNumber = failure.columnNumber || 0; // sometimes we only get the line number
    if (failure.lineNumber) {
      failure.error += ` (${failure.lineNumber}:${columnNumber})`;
    }
    rows.push(failure);
  },

  createConflictRows(rows, conflictFileInfo, projectPath) {
    const _createDisplayRowData = (fileInfo, filePath) => ({
      state: 'Conflict',
      fullName: fileInfo.fullName,
      type: fileInfo.type,
      filePath
    });

    _createRowsForConflictStatus(rows, _createDisplayRowData, conflictFileInfo, projectPath, self, false);
  },

  createStatusLocalRows(rows, outputFileInfo, projectPath) {
    const _createDisplayRowData = (fileInfo, filePath) => ({
      state: `Local ${_getState(fileInfo.state, fileInfo.deleteSupported)}`,
      fullName: fileInfo.fullName,
      type: fileInfo.type,
      filePath
    });

    _createRowsForConflictStatus(rows, _createDisplayRowData, outputFileInfo, projectPath, self, true);
  },

  // displays a row based on information pulled from a SourceMember row
  createStatusRemoteRows(rows, sourceMember, projectPath) {
    const _createDisplayRowData = (sm, filePath) => ({
      state: `Remote ${toReadableState(sm.state)}`,
      fullName: sm.fullName,
      type: sm.type,
      filePath
    });
    _createRowsForConflictStatus(rows, _createDisplayRowData, sourceMember, projectPath, self, true);
  },

  createDisplayRows(rows, outputFileInfo, projectPath) {
    if (util.isNullOrUndefined(rows)) {
      const error = new Error('Row collection not specified.');
      error['name'] = 'MissingRowCollection';
      throw error;
    }

    if (util.isNullOrUndefined(outputFileInfo)) {
      const error = new Error('Output file info not found.');
      error['name'] = 'SourceElementNotFound';
      throw error;
    }

    if (util.isNullOrUndefined(projectPath)) {
      const error = new Error("Can't display row without the projectPath");
      error['name'] = 'MissingProjectPathForDisplay';
      throw error;
    }

    const _createDisplayRowData = (element, filePath) => ({
      state: _getState(element.state, element.deleteSupported),
      fullName: element.fullName,
      type: element.type,
      filePath
    });

    const filePath = outputFileInfo.filePath;
    rows.push(_createDisplayRowData(outputFileInfo, self.trimParentFromPath(projectPath, filePath)));
  }
};

export = self;

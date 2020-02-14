/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface WorkspaceElementObj {
  state: string;
  fullName: string;
  type: string;
  filePath: string;
  deleteSupported: boolean;
}

/**
 * This class represents the info for a sourcePath in the workspace
 */
export class WorkspaceElement {
  constructor(
    private metadataName: string,
    private fullName: string,
    private sourcePath: string,
    private state: string,
    private deleteSupported: boolean
  ) {}

  /**
   * Gets the name for the metadata type of the workspace element - in the case of decomposition, this would be the type for the
   * decomposed element (ex. CustomField)
   * @returns {string}
   */
  getMetadataName(): string {
    return this.metadataName;
  }

  /**
   * Gets the fullName for the workspace element - in the case of decomposition, this would be the fullName of the
   * decomposed element (ex. for CustomField this would be 'CustomObjectName__c.CustomFieldName__c'
   * @returns {string}
   */
  getFullName(): string {
    return this.fullName;
  }

  /**
   * Gets the source state of the workspace element
   * @returns {string}
   */
  getState(): string {
    return this.state;
  }

  /**
   * Set the source state of the workspace element
   * @param state
   */
  setState(state) {
    this.state = state;
  }

  /**
   * Gets the full path to the element in the workspace
   * @returns {string}
   */
  getSourcePath(): string {
    return this.sourcePath;
  }

  /**
   * Returns true if the workspace element can be deleted from the scratch org
   * @returns {boolean}
   */
  getDeleteSupported(): boolean {
    return this.deleteSupported;
  }

  /**
   * Convenience method to return a plain old javascript object (aka POJO) of the
   * properties.  Used by commands for table output.
   * @returns {WorkspaceElementObj}
   */
  toObject(): WorkspaceElementObj {
    return {
      state: this.state,
      fullName: this.fullName,
      type: this.metadataName,
      filePath: this.sourcePath,
      deleteSupported: this.deleteSupported
    };
  }
}

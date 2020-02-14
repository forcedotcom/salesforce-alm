/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as process from 'process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as mime from 'mime';
import * as AdmZip from 'adm-zip';
import srcDevUtil = require('../../core/srcDevUtil');
import * as BBPromise from 'bluebird';

import { XmlMetadataDocument } from '../xmlMetadataDocument';
import { MetadataType } from '../metadataType';
import * as PathUtil from '../sourcePathUtil';
import { checkForXmlParseError } from '../sourceUtil';
import { SfdxError } from '@salesforce/core';

const fallBackMimeTypeExtensions = require('../mimeTypes');
const mimeTypeExtensions = require('mime/types.json');

/**
 * Encapsulates logic for handling of static resources.
 *
 * Static resources differ in the following ways from default mdapi expectations:
 * 1. The file name has a normal extension reflecting the mime type (zip, jar, jpeg) rather than "resource"
 * 2. A zip or jar archive can be exploded into a directory, and will be by default on pull. Only if an
 * archive file with the resource full name exists in the resources directory will it remain zipped.
 *
 * Note that when an archive is expanded on pull no attempt is made to avoid redundant updates of unmodified files
 * (as would happen in some other metadata decompositions).
 */
export class StaticResource {
  private metadataPath: string;
  private metadataType;
  private usingGAWorkspace: boolean;
  private resourcesDir: string;
  private fullName: string;
  private mimeType: string;
  private fileExtensions: string[];
  private multiVersionHackUntilWorkspaceVersionsAreSupported: boolean;

  constructor(
    metadataPath: string,
    metadataType: MetadataType,
    workspaceVersion,
    retrievedMetadataFilePath?: string,
    unsupportedMimeTypes?: string[]
  ) {
    this.metadataPath = metadataPath;
    this.metadataType = metadataType;
    this.usingGAWorkspace = !util.isNullOrUndefined(workspaceVersion); // TODO - once we know what the version looks like
    this.resourcesDir = path.dirname(metadataPath);
    this.fullName = this.metadataType.getFullNameFromFilePath(metadataPath);
    const effectiveMetadataFilePath = util.isNullOrUndefined(retrievedMetadataFilePath)
      ? metadataPath
      : retrievedMetadataFilePath;
    this.mimeType = StaticResource.getMimeType(effectiveMetadataFilePath);
    this.fileExtensions = this.getMimeTypeExtension(unsupportedMimeTypes);
    this.multiVersionHackUntilWorkspaceVersionsAreSupported = true; // sigh
  }

  getResource(): BBPromise<string> {
    if (this.multiVersionHackUntilWorkspaceVersionsAreSupported) {
      if (this.isExplodedArchive()) {
        return StaticResource.zipDir(this.getExplodedFolderPath());
      } else if (srcDevUtil.pathExistsSync(this.getLegacyFilePath())) {
        return BBPromise.resolve(this.getLegacyFilePath());
      } else if (srcDevUtil.pathExistsSync(this.getSingleFilePathPreferExisting())) {
        return BBPromise.resolve(this.getSingleFilePathPreferExisting());
      } else {
        return BBPromise.resolve(PathUtil.getContentPathWithNonStdExtFromMetadataPath(this.metadataPath));
      }
    } else {
      if (this.usingGAWorkspace) {
        if (this.isExplodedArchive()) {
          return StaticResource.zipDir(this.getExplodedFolderPath());
        } else {
          return BBPromise.resolve(this.getSingleFilePathPreferExisting());
        }
      } else {
        return BBPromise.resolve(this.getLegacyFilePath());
      }
    }
  }

  saveResource(sourcePath: string, createDuplicates?: boolean): [string[], string[]] {
    const updatedPaths = [];
    const duplicatePaths = [];
    if (this.multiVersionHackUntilWorkspaceVersionsAreSupported) {
      if (this.isExplodedArchive()) {
        return this.expandArchive(sourcePath, createDuplicates);
      } else if (srcDevUtil.pathExistsSync(this.getLegacyFilePath())) {
        return this.handleLegacyPath(sourcePath, createDuplicates);
      } else {
        return this.handleResource(sourcePath, createDuplicates);
      }
    } else {
      if (this.usingGAWorkspace) {
        if (this.isExplodedArchive()) {
          return this.expandArchive(sourcePath, createDuplicates);
        } else {
          fs.copySync(sourcePath, this.getSingleFilePathPreferExisting());
          updatedPaths.push(this.getSingleFilePathPreferExisting());
        }
      } else {
        return this.handleResource(sourcePath, createDuplicates);
      }
    }
    return [updatedPaths, duplicatePaths];
  }

  isExplodedArchive(): boolean {
    if (this.multiVersionHackUntilWorkspaceVersionsAreSupported) {
      const singleFileArchiveExists =
        srcDevUtil.pathExistsSync(this.getSingleFilePath()) || srcDevUtil.pathExistsSync(this.getLegacyFilePath());
      return this.isArchiveMimeType() && !singleFileArchiveExists;
    } else {
      const singleFileArchiveExists = srcDevUtil.pathExistsSync(this.getSingleFilePath());
      return this.isArchiveMimeType() && !singleFileArchiveExists;
    }
  }

  getContentPaths(): string[] {
    let contentPaths: string[] = [];
    if (this.multiVersionHackUntilWorkspaceVersionsAreSupported) {
      if (this.isExplodedArchive()) {
        if (srcDevUtil.pathExistsSync(this.getExplodedFolderPath())) {
          contentPaths = contentPaths.concat(this.getFiles(this.getExplodedFolderPath()));
        }
      } else if (srcDevUtil.pathExistsSync(this.getLegacyFilePath())) {
        contentPaths.push(this.getLegacyFilePath());
      } else {
        const contentPath = this.getSingleFilePathPreferExisting();
        if (srcDevUtil.pathExistsSync(contentPath)) {
          contentPaths.push(contentPath);
        }
      }
    } else {
      if (this.usingGAWorkspace) {
        if (this.isExplodedArchive()) {
          if (srcDevUtil.pathExistsSync(this.getExplodedFolderPath())) {
            contentPaths = contentPaths.concat(this.getFiles(this.getExplodedFolderPath()));
          }
        } else {
          const contentPath = this.getSingleFilePathPreferExisting();
          if (srcDevUtil.pathExistsSync(contentPath)) {
            contentPaths.push(contentPath);
          }
        }
      } else if (srcDevUtil.pathExistsSync(this.getLegacyFilePath())) {
        contentPaths.push(this.getLegacyFilePath());
      }
    }

    return contentPaths;
  }

  static zipDir(dir: string): BBPromise<string> {
    const zipFile = path.join(os.tmpdir() || '.', `sdx_srzip_${process.hrtime()[0]}${process.hrtime()[1]}.zip`);
    return srcDevUtil.zipDir(dir, zipFile, { level: 9 });
  }

  /**
   * Get the mime type from the npm mime library file.
   * If the mime type is not supported there, use our backup manually added mime types file
   * If the mime type is not supported there, throw an error
   * @param unsupportedMimeTypes - an array of unsupported mime types for the purpose of logging
   * @returns {string[]} the mime type extension(s)
   */
  private getMimeTypeExtension(unsupportedMimeTypes?: string[]): string[] {
    let ext = mimeTypeExtensions[this.mimeType];
    if (!ext || ext.length === 0) {
      ext = fallBackMimeTypeExtensions[this.mimeType];
    }
    if (ext) {
      return ext;
    }

    if (unsupportedMimeTypes) {
      unsupportedMimeTypes.push(this.mimeType);
    }
    return [this.metadataType.getExt()];
  }

  private getFiles(file): string[] {
    let found: string[] = [];
    found.push(file);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      const nestedFiles = fs.readdirSync(file);
      nestedFiles.forEach(nestedFile => {
        const nestedPath = path.join(file, nestedFile);
        const nestedStat = fs.statSync(nestedPath);
        if (nestedStat.isDirectory()) {
          found = found.concat(this.getFiles(nestedPath));
        } else {
          found.push(nestedPath);
        }
      });
    }
    return found;
  }

  private static getMimeType(metadataPath: string): string {
    if (srcDevUtil.pathExistsSync(metadataPath)) {
      const doc = new XmlMetadataDocument('StaticResource');
      try {
        doc.setRepresentation(fs.readFileSync(metadataPath, 'utf8'));
      } catch (e) {
        throw checkForXmlParseError(metadataPath, e);
      }

      const nodeTypeElement = 1;
      let child = doc.data.documentElement.firstChild;
      while (child !== null) {
        if (child.nodeType === nodeTypeElement && child.nodeName === 'contentType') {
          return child.firstChild.nodeValue;
        }
        child = child.nextSibling;
      }
    }
    return mime.lookup(''); // this defaults to bin -- is this correct?
  }

  private getLegacyFilePath(): string {
    return path.join(this.resourcesDir, `${this.fullName}.${this.metadataType.getExt()}`);
  }

  private getSingleFilePath(ext?: string): string {
    let extension = ext;
    if (!ext) {
      const mimeLib = mime.extension(this.mimeType);
      extension = mimeLib ? mimeLib : this.getMimeTypeExtension();
    }
    return path.join(this.resourcesDir, `${this.fullName}.${extension}`);
  }

  private getSingleFilePathPreferExisting(): string {
    const ext = this.fileExtensions.find(ext => srcDevUtil.pathExistsSync(this.getSingleFilePath(ext)));
    return this.getSingleFilePath(ext);
  }

  private getExplodedFolderPath(): string {
    return path.join(this.resourcesDir, this.fullName);
  }

  private isArchiveMimeType(): boolean {
    const fallBackExtension = fallBackMimeTypeExtensions[this.mimeType];
    let isZip = false;
    if (fallBackExtension) {
      isZip = fallBackExtension[0] === 'zip';
    }
    return this.mimeType === mime.lookup('zip') || this.mimeType === mime.lookup('jar') || isZip;
  }

  private expandArchive(sourcePath: string, createDuplicates: boolean): [string[], string[]] {
    let updatedPaths = [];
    const duplicatePaths = [];

    // expand the archive into a temp directory
    const tempDir = path.join(os.tmpdir(), `sfdx_staticresource_${this.fullName}_${Date.now()}`);
    srcDevUtil.ensureDirectoryExistsSync(tempDir);
    try {
      new AdmZip(sourcePath).extractAllTo(tempDir);
    } catch (error) {
      throw SfdxError.create('salesforce-alm', 'mdapi_convert', 'AdmZipError', [sourcePath, this.mimeType, error])
        .message;
    }

    // compare exploded directories if needed
    let isUpdatingExistingStaticResource = srcDevUtil.pathExistsSync(this.getExplodedFolderPath());
    if (isUpdatingExistingStaticResource && createDuplicates) {
      this.compareExplodedDirs(tempDir, duplicatePaths, updatedPaths);
    }

    // now copy all the files in the temp dir into the workspace
    srcDevUtil.deleteDirIfExistsSync(this.getExplodedFolderPath());
    fs.copySync(tempDir, this.getExplodedFolderPath()); // override new file with existing

    // if this is a new static resource then simply report all files as changed
    if (!isUpdatingExistingStaticResource) {
      srcDevUtil.actOn(tempDir, file => {
        updatedPaths.push(file.replace(tempDir, this.getExplodedFolderPath()));
      });
    }

    return [updatedPaths, duplicatePaths];
  }

  // if an exploded directory structure exists in the workspace then loop through each new file and see if a file
  // with same name exists in the workspace. If that file exists then compare the hashes. If hashes are different
  // then create a duplicate file.
  private compareExplodedDirs(tempDir: string, duplicatePaths: string[], updatedPaths: string[]) {
    srcDevUtil.actOn(tempDir, file => {
      if (!fs.statSync(file).isDirectory()) {
        const relativePath = file.substring(file.indexOf(tempDir) + tempDir.length);
        const workspaceFile = path.join(this.getExplodedFolderPath(), relativePath);
        if (srcDevUtil.pathExistsSync(workspaceFile)) {
          if (!srcDevUtil.areFilesEqual(workspaceFile, file)) {
            // file with same name exists and contents are different
            fs.copySync(file, file + '.dup'); // copy newFile to .dup
            duplicatePaths.push(workspaceFile + '.dup'); // keep track of dups
            fs.copySync(workspaceFile, file); // override new file with existing
          }
          // if file exists and contents are the same then don't report it as updated
        } else {
          updatedPaths.push(workspaceFile); // this is a net new file
        }
      }
    });
  }

  private handleResource(sourcePath: string, createDuplicates: boolean): [string[], string[]] {
    const updatedPaths = [];
    const duplicatePaths = [];

    const destFile = this.getSingleFilePathPreferExisting();
    if (!srcDevUtil.pathExistsSync(destFile)) {
      fs.copySync(sourcePath, this.getSingleFilePathPreferExisting());
      updatedPaths.push(this.getSingleFilePathPreferExisting());
    } else if (!srcDevUtil.areFilesEqual(sourcePath, destFile) && createDuplicates) {
      fs.copySync(sourcePath, `${this.getSingleFilePathPreferExisting()}.dup`);
      duplicatePaths.push(`${this.getSingleFilePathPreferExisting()}.dup`);
    } else if (!srcDevUtil.areFilesEqual(sourcePath, destFile) && !createDuplicates) {
      // replace existing file with remote
      fs.copyFile(sourcePath, this.getSingleFilePathPreferExisting());
      duplicatePaths.push(this.getSingleFilePathPreferExisting());
    }

    return [updatedPaths, duplicatePaths];
  }

  private handleLegacyPath(sourcePath: string, createDuplicates: boolean): [string[], string[]] {
    const updatedPaths = [];
    const duplicatePaths = [];
    const legacyFilePath = this.getLegacyFilePath();

    if (createDuplicates) {
      if (!srcDevUtil.areFilesEqual(sourcePath, legacyFilePath)) {
        fs.copySync(sourcePath, legacyFilePath + '.dup');
        duplicatePaths.push(legacyFilePath + '.dup');
      }
      // if contents are equal and we are doing a mdapi:convert (createDuplicates=true) then ignore this file
    } else {
      fs.copySync(sourcePath, legacyFilePath);
      updatedPaths.push(legacyFilePath);
    }

    return [updatedPaths, duplicatePaths];
  }
}

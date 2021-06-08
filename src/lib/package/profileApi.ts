/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';

// Thirdparty
import { DOMParser, XMLSerializer } from 'xmldom-sfdx-encoding';
import { Messages } from '@salesforce/core';

// Local

Messages.importMessagesDirectory(__dirname);

const profileApiMessages = Messages.loadMessages('salesforce-alm', 'packaging');

/*
 * This class provides functions used to re-write .profiles in the workspace when creating a package2 version.
 * All profiles found in the workspaces are extracted out and then re-written to only include metadata in the profile
 * that is relevant to the source in the package directory being packaged.
 */
class ProfileApi {
  // TODO: proper property typing
  // eslint-disable-next-line no-undef
  [property: string]: any;

  constructor(org, includeUserLicenses, generateProfileInformation = false) {
    this.org = org;
    this.includeUserLicenses = includeUserLicenses;
    this.config = this.org.config;
    this.apiVersion = this.config.getApiVersion();
    this.profiles = [];
    this.generateProfileInformation = generateProfileInformation;

    this.includeUserLicenses = includeUserLicenses;

    // nodeEntities is used to determine which elements in the profile are relevant to the source being packaged.
    // name refers to the entity type name in source that the element pertains to.  As an example, a profile may
    // have an entry like the example below, which should only be added to the packaged profile if the related
    // CustomObject is in the source being packaged:
    //   <objectPermissions>
    //      <allowCreate>true</allowCreate>
    //       ...
    //      <object>MyCustomObject__c</object>
    //       ...
    //   </objectPermissions>
    //
    // For this example: nodeEntities.parentElement = objectPermissions and nodeEntities.childElement = object
    this.nodeEntities = {
      name: ['CustomObject', 'CustomField', 'Layout', 'CustomTab', 'CustomApplication', 'ApexClass'],
      parentElement: [
        'objectPermissions',
        'fieldPermissions',
        'layoutAssignments',
        'tabVisibilities',
        'applicationVisibilities',
        'classAccesses',
      ],
      childElement: ['object', 'field', 'layout', 'tab', 'application', 'apexClass'],
    };
  }

  _copyNodes(originalDom, parentElement, childElement, members, appendToNode, profileName) {
    let nodesAdded = false;

    const nodes = originalDom.getElementsByTagName(parentElement);
    if (!nodes) {
      return nodesAdded;
    }

    for (let i = 0; i < nodes.length; i++) {
      const name = nodes[i].getElementsByTagName(childElement)[0].childNodes[0].nodeValue;
      if (members.indexOf(name) >= 0) {
        // appendChild will take the passed in node (newNode) and find the parent if it exists and then remove
        // the newNode from the parent.  This causes issues with the way this is copying the nodes, so pass in a clone instead.
        const currentNode = nodes[i].cloneNode(true);
        appendToNode.appendChild(currentNode);
        nodesAdded = true;
      } else {
        // Tell the user which profile setting has been removed from the package
        if (this.generateProfileInformation) {
          let profile = this.profiles.find(({ ProfileName }) => ProfileName === profileName);
          if (profile) {
            profile.appendRemovedSetting(name);
          }
        }
      }
    }
    return nodesAdded;
  }

  _findAllProfiles(excludedDirectories = []) {
    for (let i = 0; i < excludedDirectories.length; i++) {
      excludedDirectories[i] = '**/' + excludedDirectories[i] + '/**';
    }

    return glob.sync(path.join(this.config.getProjectPath(), '**', '*.profile-meta.xml'), {
      ignore: excludedDirectories,
    });
  }

  /**
   * For any profile present in the workspace, this function generates a subset of data that only contains references
   * to items in the manifest.
   *
   * @param destPath location of new profiles
   * @param manifest
   * @param excludedDirectories Directories to not include profiles from
   */
  generateProfiles(destPath, manifest, excludedDirectories = []) {
    const excludedProfiles = [];

    const profilePaths = this._findAllProfiles(excludedDirectories);

    if (!profilePaths) {
      return excludedProfiles;
    }

    profilePaths.forEach((profilePath) => {
      const profileName = profilePath.match(/(.*profiles.)(.*)(\.profile-meta.xml)/)[2];
      const profileDom = new DOMParser().parseFromString(fs.readFileSync(profilePath, 'utf-8'));
      const newDom = new DOMParser().parseFromString(
        '<?xml version="1.0" encoding="UTF-8"?><Profile xmlns="http://soap.sforce.com/2006/04/metadata"></Profile>'
      );
      const profileNode = newDom.getElementsByTagName('Profile')[0];
      let hasNodes = false;

      manifest.Package.types.forEach((element) => {
        const name = element['name'];
        const members = element['members'];

        const idx = this.nodeEntities.name.indexOf(name[0]);
        if (idx > -1) {
          hasNodes =
            this._copyNodes(
              profileDom,
              this.nodeEntities.parentElement[idx],
              this.nodeEntities.childElement[idx],
              members,
              profileNode,
              profileName
            ) || hasNodes;
        }
      });

      // add userLicenses to the profile
      if (this.includeUserLicenses === true) {
        const userLicenses = profileDom.getElementsByTagName('userLicense');
        if (userLicenses) {
          hasNodes = true;
          for (let i = 0; i < userLicenses.length; i++) {
            const node = userLicenses[i].cloneNode(true);
            profileNode.appendChild(node);
          }
        }
      }

      const xmlSrcFile = path.basename(profilePath);
      const xmlFile = xmlSrcFile.replace(/(.*)(-meta.xml)/, '$1');
      const destFilePath = path.join(destPath, xmlFile);
      if (hasNodes) {
        const serializer = new XMLSerializer();
        fs.writeFileSync(destFilePath, serializer.serializeToString(newDom), 'utf-8');
      } else {
        // remove from manifest
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const profileName = xmlFile.replace(/(.*)(\.profile)/, '$1');
        excludedProfiles.push(profileName);
        if (this.generateProfileInformation) {
          let profile = this.profiles.find(({ ProfileName }) => ProfileName === profileName);
          if (profile) {
            profile.setIsPackaged(false);
          }
        }

        try {
          fs.unlinkSync(destFilePath);
        } catch (err) {
          // It is normal for the file to not exist if the profile is in the worskpace but not in the directory being packaged.
          if (err.code !== 'ENOENT') {
            throw err;
          }
        }
      }
    });

    return excludedProfiles;
  }

  /**
   * Filter out all profiles in the manifest and if any profiles exists in the workspace, add them to the manifest.
   *
   * @param typesArr array of objects { name[], members[] } that represent package types JSON.
   * @param excludedDirectories Direcotires not to generate profiles for
   */
  filterAndGenerateProfilesForManifest(typesArr, excludedDirectories = []) {
    const profilePaths = this._findAllProfiles(excludedDirectories);

    // Filter all profiles
    typesArr = typesArr.filter((kvp) => kvp.name[0] !== 'Profile');

    if (profilePaths) {
      const members = [];

      profilePaths.forEach((profilePath) => {
        // this assumes profile metadata is in directory "profiles"
        const profileName = profilePath.replace(/(.*profiles.)(.*)(\.profile-meta.xml)/, '$2');
        members.push(profileName);
        if (this.generateProfileInformation) {
          this.profiles.push(new ProfileInformation(profileName, profilePath, true, []));
        }
      });
      if (members.length > 0) {
        typesArr.push({ name: ['Profile'], members });
      }
    }

    return typesArr;
  }

  getProfileInformation(): ProfileInformation[] {
    return this.profiles;
  }
}

class ProfileInformation {
  ProfileName: string;
  ProfilePath: string;
  IsPackaged: boolean;
  settingsRemoved: string[];

  constructor(ProfileName: string, ProfilePath: string, IsPackaged: boolean, settingsRemoved: string[]) {
    this.ProfileName = ProfileName;
    this.ProfilePath = ProfilePath;
    this.IsPackaged = IsPackaged;
    this.settingsRemoved = settingsRemoved;
  }

  setIsPackaged(IsPackaged: boolean): void {
    this.IsPackaged = IsPackaged;
  }

  appendRemovedSetting(setting: string): void {
    this.settingsRemoved.push(setting);
  }

  logDebug(): string {
    let info = profileApiMessages.getMessage('profile_api.addProfileToPackage', [this.ProfileName, this.ProfilePath]);
    this.settingsRemoved.forEach((setting) => {
      info += '\n\t' + profileApiMessages.getMessage('profile_api.removeProfileSetting', [setting, this.ProfileName]);
    });
    if (!this.IsPackaged) {
      info += '\n\t' + profileApiMessages.getMessage('profile_api.removeProfile', [this.ProfileName]);
    }
    info += '\n';
    return info;
  }

  logInfo(): string {
    if (this.IsPackaged) {
      return profileApiMessages.getMessage('profile_api.addProfileToPackage', [this.ProfileName, this.ProfilePath]);
    } else {
      return profileApiMessages.getMessage('profile_api.profileNotIncluded', [this.ProfileName]);
    }
  }
}

export = ProfileApi;

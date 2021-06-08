/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Config from '@oclif/config';
import { Optional, Dictionary } from '@salesforce/ts-types';
import { WorkspaceElementObj } from './workspaceElement';

type HookOpts<T> = {
  Command: Config.Command.Class;
  argv: string[];
  commandId: string;
  result: Optional<T>;
};

interface SourceInfo {
  workspaceElements: WorkspaceElementObj[];
}
interface MetadataInfo {
  mdapiFilePath: string[];
}
export type MetadataSourceResult = Dictionary<SourceInfo & MetadataInfo>;
type PreDeployOpts = HookOpts<MetadataSourceResult>;
export type SourceResult = Dictionary<SourceInfo>;
type PostSourceUpdateOpts = HookOpts<SourceResult>;
export type MetadataResult = Dictionary<MetadataInfo>;
type PostRetriveOpts = HookOpts<MetadataResult>;

type DeployResult = {
  id: string;
  checkOnly: boolean;
  completedDate: string;
  createdDate: string;
  details?: DeployDetails;
  done: boolean;
  errorMessage?: string;
  errorStatusCode?: string;
  ignoreWarnings?: boolean;
  lastModifiedDate: string;
  numberComponentErrors: number;
  numberComponentsDeployed: number;
  numberComponentsTotal: number;
  numberTestErrors: number;
  numberTestsCompleted: number;
  numberTestsTotal: number;
  rollbackOnError?: boolean;
  startDate: string;
  status: string;
  success: boolean;
};
type DeployDetails = {
  componentSuccesses: DeployMessage[];
  componentFailures: DeployMessage[];
};
type DeployMessage = {
  componentType: string;
  fullName: string;
  Id: string;
  created: string;
  deleted: string;
  changed: string;
  success: string;
};
type PostDeployOpts = HookOpts<DeployResult>;

type PreRetrieveOpts = HookOpts<{ packageXmlPath: string }>;

/**
 * Extends OCLIF's Hooks interface to add types for hooks that run on sfdx source commands
 */
export interface SourceHooks extends Config.Hooks {
  predeploy: PreDeployOpts;
  postsourceupdate: PostSourceUpdateOpts;
  postdeploy: PostDeployOpts;
  postretrieve: PostRetriveOpts;
  preretrieve: PreRetrieveOpts;
}

export type SourceHook<T> = (
  this: Config.Hook.Context,
  options: T extends keyof Config.Hooks ? SourceHooks[T] : T
) => any;

// eslint-disable-next-line no-redeclare
export declare namespace SourceHook {
  export type PreDeploy = Config.Hook<SourceHooks['predeploy']>;
  export type PostSrConvert = Config.Hook<SourceHooks['postsourceupdate']>;
  export type PostDeploy = Config.Hook<SourceHooks['postdeploy']>;
  export type PostRetrieve = Config.Hook<SourceHooks['postretrieve']>;
  export type PreRetrieve = Config.Hook<SourceHooks['preretrieve']>;
}

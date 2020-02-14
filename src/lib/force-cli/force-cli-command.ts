/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Based on https://devcenter.heroku.com/articles/developing-cli-plug-ins#all-command-options
export interface Command {
  command: string;
  description: string;
  longDescription: string;
  help: string;
  requiresProject: boolean;
  default?: boolean;
  hidden?: boolean;
  needsApp?: boolean;
  needsOrg?: boolean;
  wantsOrg?: boolean;
  needsAuth?: boolean;
  flags?: Flag[];
  variableArgs?: boolean;
  args?: Arg[];
  supportsTargetUsername?: boolean;
  supportsPerfLogLevelFlag?: boolean;
  run: (context: any, doneCallback?: Function) => void;
}

interface Flag {
  name: string;
  char: string;
  hasValue?: boolean;
  hidden?: boolean;
  required?: boolean;
  description?: string;
  longDescription?: string;
}

interface Arg {
  name: string;
  optional?: boolean;
  hidden?: boolean;
}

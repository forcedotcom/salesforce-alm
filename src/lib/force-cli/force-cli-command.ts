/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

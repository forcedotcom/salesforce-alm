/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is the legacy converted command file. Ignoring code-coverage since this is generated.
// THIS SHOULD BE REMOVED WHEN CONVERTED TO EXTEND SfdxCommand
/* istanbul ignore file */

import CommandHelp from '@oclif/plugin-help/lib/command';
import { stdtermwidth } from '@oclif/plugin-help/lib/screen';
import { SfdxCommand } from '@salesforce/command';
import { sortBy } from '@salesforce/kit';
import { Dictionary, isNumber, isString } from '@salesforce/ts-types';
import { template } from 'lodash';
import Messages = require('../../../../lib/messages');
import { ToolbeltCommand } from '../../../../ToolbeltCommand';

const messages = Messages();

export class DocDisplayCommand extends ToolbeltCommand {
  public static readonly theDescription = messages.getMessage('docCommandsDisplayDescription');
  public static readonly longDescription = messages.getMessage('docCommandsDisplayDescriptionLong');
  public static readonly help = messages.getMessage('docCommandsDisplayHelp');
  public static readonly requiresProject = false;
  public static readonly hidden = true;

  public static readonly deprecated = {
    version: 48.0,
    to: 'sfdx commands'
  };

  public async run(): Promise<unknown> {
    let commands = this.config.commands;
    commands = commands.filter(c => c.id.indexOf('force') === 0);
    if (!this.flags.hidden) {
      commands = commands.filter(c => !c.hidden || c.id === 'force');
    }
    commands = sortBy(commands, 'id');

    for (const command of commands) {
      this.ux.styledHeader(command.id);
      this.ux.log(
        new CommandHelp(command, this.config, {
          maxWidth: stdtermwidth
        }).generate()
      );
      this.ux.log();
    }

    const cmds = commands.map(command => {
      const c = command.load() as unknown;
      return c as typeof SfdxCommand;
    });
    const displayCmds = cmds.map(this.convertCommandClassToDisplayObject.bind(this));

    const topics = this.config.topics
      .filter(topic => !commands.find(cmd => cmd.id === topic.name))
      .filter(topic => topic.name.match(/^force:\w+$/));

    for (const topic of topics) {
      const forceName = topic.name;
      const topicName = forceName.match(/^force:(\w+)$/)[1];
      displayCmds.push({
        mainTopic: true,
        topic: forceName,
        description: topic.description,
        longDescription: this.getLongDescription(topicName),
        hidden: true
      });
    }

    return displayCmds;
  }

  private getLongDescription(topicName: string) {
    // This was not standardized, so go through the long list of possibilities...
    try {
      return messages.getMessage('longDescription', null, topicName);
    } catch (e) {}
    try {
      return messages.getMessage('mainLongDescription', null, topicName);
    } catch (e) {}
    try {
      return messages.getMessage('mainTopicLongDescriptionHelp', null, topicName);
    } catch (e) {}
    try {
      return messages.getMessage(`${topicName}TopicLongDescription`);
    } catch (e) {}
    try {
      return messages.getMessage(`${topicName}LongDescription`);
    } catch (e) {}
    try {
      return messages.getMessage(`${topicName}TopicDescriptionLong`);
    } catch (e) {}
    try {
      return messages.getMessage(`${topicName}CliDescriptionLong`);
    } catch (e) {}
  }

  private convertCommandClassToDisplayObject(command) {
    const flags = Object.keys(command.flags).reduce((array, name) => {
      const flag = command.flags[name];
      // Remap for legacy so we don't break existing integrations
      const type = flag.kind === 'enum' ? 'string' : flag.kind;

      let min = flag.min;
      let max = flag.max;
      let defaultVal = flag.default;

      if (flag.kind === 'minutes') {
        min = flag.min && flag.min.minutes ? flag.min.minutes : flag.min;
        max = flag.max && flag.max.minutes ? flag.max.minutes : flag.max;
        defaultVal = flag.default && isNumber(flag.default.minutes) ? flag.default.minutes : flag.default;
      }

      array.push({
        name,
        char: flag.char,
        description: flag.description,
        longDescription: flag.longDescription,
        type,
        hasValue: flag.kind !== 'boolean',
        values: flag.options,
        array: flag.kind === 'array',
        // Should probably check that type is of type "minutes" but this works
        default: defaultVal,
        xor: flag.exclusive,
        min,
        max,
        // Not set on oclif if not defined. Force them to be set for legacy output support
        hidden: !!flag.hidden,
        required: !!flag.required,
        deprecated: flag.deprecated
      });
      return array;
    }, []);
    const supportsTargetUsername = command.requiresUsername || command.supportsUsername;
    const supportsTargetDevHubUsername = command.supportsDevhubUsername || command.requiresDevhubUsername;
    const orgType = supportsTargetUsername
      ? 'defaultusername'
      : supportsTargetDevHubUsername
      ? 'defaultdevhubusername'
      : undefined;
    const output: Dictionary = {
      name: command.id,
      // This weird theDescription because of handling legacy help. See ToolbeltCommand.
      description: command.theDescription || command.description,
      longDescription: command.longDescription,
      usage: this.getUsageForCommand(command),
      hidden: command.hidden,
      showProgress: command.showProgress,
      supportsTargetUsername,
      requiresUsername: command.requiresUsername,
      supportsTargetDevHubUsername,
      supportsPerfLogLevelFlag: command.supportsPerfLogLevelFlag,
      initializeMetadataRegistry: command.initializeMetadataRegistry,
      requiresProject: command.requiresProject,
      orgType,
      flags,
      args: command.args || [],
      help: command.help,
      topic: command.id
        .split(':')
        .splice(0, 2)
        .join(':'),
      command: command.id
        .split(':')
        .splice(2)
        .join(':'),
      variableArgs: !!command.varargs,
      variableArgsRequired: (command.varargs && command.varargs.required) || false
    };

    if (command.id === 'force') {
      output.namespace = 'force';
    }
    return output;
  }

  private getUsageForCommand(command) {
    let usage;
    if (isString(command.usage)) {
      usage = command.usage;
    } else if (command.usage) {
      usage = command.usage.join('\n');
    }
    return template(usage)({ command });
  }
}

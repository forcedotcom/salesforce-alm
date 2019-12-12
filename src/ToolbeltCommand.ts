/*
* Copyright (c) 2019, salesforce.com, inc.
* All rights reserved.
* Licensed under the BSD 3-Clause license.
* For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/

import { SfdxCommand, flags } from '@salesforce/command';
import {
    Dictionary,
    has,
    isArray,
    isString,
    isFunction,
    get,
    getArray,
    isPlainObject,
    getString,
    isObject
} from '@salesforce/ts-types';
import { SfdxError, SfdxProject } from '@salesforce/core';
import { set, isEmpty } from '@salesforce/kit';
import { getProcessors } from './lib/indexErrorProcessor';
import { requestPerfMetrics } from './lib/perfMetricsRequest';
import logger = require('./lib/core/logApi');
import Org = require('./lib/core/scratchOrgApi');
import srcDevUtil = require('./lib/core/srcDevUtil');
// This should use the new message framework, but it is an old legacy method so fine for now.
import Messages = require('./lib/messages');
import Output = flags.Output;
import * as path from 'path'

const messages = Messages();

export abstract class ToolbeltCommand extends SfdxCommand {
    protected static supportsPerfLogLevelFlag = false;
    protected static schema: {
        name: string,
        flag: string
    };

    public static theDescription: string;
    public static deprecated: {
        version: number,
        /**
         * Add the "Use <to> instead." messaging.
         */
        to?: string,
        /**
         * Use the default messaging but append an additional message at the end.
         */
        message?: string,
        /**
         * Override the default messaging.
         */
        messageOverride?: string
    };

    /**
     * In order to get the help property displayed during --help, we need to append it onto the description.
     * This means that all commands that extend ToolbeltCommand can't use `public static readme description = ''`.
     * To get around this, we use the `theDescription` name instead.
     *
     * When commands migrate to SfdxCommand, they should change the messages for description to include both the
     * description and the help messages.
     */
    public static get description() {
        let description = this.theDescription;
        if (this.deprecated) {
            description = `(deprecated) ${description}\n\nWARNING: ${logger.formatDeprecationWarning(this.id, this.deprecated, 'command')}`;
        }
        if (this.extraHelp) {
            description += `\n\n${this.extraHelp}`;
        }
        if (this.help) {
            description += `\n\n${this.help}`;
        }
        return description;
    }

    static get extraHelp(): string {
        let extraHelp = '';
        // It would be nice to have this in SfdxCommand, but until there is a way
        // dynamically add info to a static property without making it a getter,
        // we don't have many options here.
        if (this.requiresProject) {
          extraHelp += 'NOTE: This command must be run from within a project.';
        }
        return extraHelp;
    }

    public static get flags(): Output {
        const cmdFlags: flags.Output = super.flags;

        if (this.supportsPerfLogLevelFlag) {
            // Should this be part of SfdxCommand?
            cmdFlags['perflog'] = flags.boolean({
                description: messages.getMessage('perfLogLevelOption'),
                longDescription: messages.getMessage('perfLogLevelOptionLong')
            });
        }
        if(this.schema){
            cmdFlags['confighelp'] = flags.boolean({
                description : messages.getMessage('schemaInfoOption',this.schema.flag),
                longDescription: messages.getMessage('schemaInfoOptionLong')
            });
        }

        Object.keys(cmdFlags).forEach(flagName => {
            const flag = cmdFlags[flagName];
            if (flag.deprecated && !flag.description.startsWith('(deprecated)')) {
                flag.description = `(deprecated) ${flag.description}`;
            }
        });

        return cmdFlags;
    }
    private legacyContext?: Dictionary<any>;

    /**
     * Call to stringify parsed flags for backward compatibility.
     * Don't invoke this if you wish to use new-style parsed flags.
     */
    protected stringifyFlags(): void {
        Object.keys(this.flags).forEach(name => {
            const flag = this.flags[name];
            if (flag == null) return;
            switch (typeof this.flags[name]) {
                case 'string':
                case 'number':
                    this.flags[name] = flag + '';
                    break;
                case 'boolean':
                    break;
                case 'object':
                    if (Array.isArray(flag)) {
                        this.flags[name] = flag.join(',');
                        break;
                    } else if (flag instanceof Date) {
                        this.flags[name] = flag.toISOString();
                        break;
                        // This used to be (flag instanceof Duration) but this stopped working and I'm not sure why.
                        // I had a similar problem with SfdxError in command here:
                        // https://github.com/forcedotcom/cli-packages/pull/75
                    } else if (flag.constructor.name === 'Duration') {
                        this.flags[name] = flag.quantity + '';
                        break;
                    } else if (isFunction(flag.toString)) {
                        this.flags[name] = flag.toString();
                        break;
                    }
                    // intentional fallthrough
                default:
                    throw new SfdxError(`Unexpected value type for flag ${name}`, 'UnexpectedFlagValueType');
            }
        });
    }

    /**
     * This is a bridge to for all old cli-engine commands.
     * All new oclif commands should be refactored to NOT use
     * this method anymore, and should move the old Command classes
     * in lib that have a validate and execute method to be in the
     * actual oclif command class.
     *
     * TODO Provide instructions on how to get people to move off of execLegacyCommand
     * * Remove src/lib/path/to/*Command file and put logic in the oclif/force/path/to/command file
     * * Change getColumnData to protected static results {} // TODO more info here.
     * * Remove getHumanSuccessMessage and just put it at the end of your run command
     * * Remove getHumanErrorMessage and throw an SfdxError
     * * ...
     * @param command
     */
    protected async execLegacyCommand(command, context, stdin?) {
        // TODO: REMOVE THIS WHEN IT'S IN SfdxCommand
        // Reset process.exitCode since during testing we only soft exit.
        process.exitCode = undefined;

        if (this.statics.supportsPerfLogLevelFlag && (context.flags.perflog === true)) {
            context.org.force.setCallOptions('perfOption', 'MINIMUM');
        }

        const logger = require('./lib/core/logApi');
        logger.setHumanConsumable(!context.flags.json && !context.flags.quiet);
        context.logger = logger;

        if (isFunction(command.validate)) {
            context = await command.validate(context) || context;
        }
        try {
            const results = await command.execute(context, stdin);
            this.legacyOutput(command, results);
            return results;
        } catch (error) {
            if (isFunction(command.getHumanErrorMessage)) {
                const humanMessage = command.getHumanErrorMessage(error); 

                if (humanMessage) {
                    set(error, 'message', humanMessage);
                }
            }

            /**
             * Legacy FCT errors sometimes used a result attribute,  but newer code is using SfdxError which has a more
             * generic 'data' attribute. In determining if we need to display a table for row data we will also look in
             * error.data for row information.
             *
             * Going forward we need to deprecate result attributes in error objects.
             */
            const errorResultForTable: any[] = error.result || error.data;

            /**
             * I would think it would be better to use isArray(errorResult) and I thought about changing it. However,
             * I decided against it because isArray is slightly more narrow in type inference than isObject. Might
             * break something. Note: isObject([]) evaluates to true and ux.table takes and any[]
             */
            if (error.columns && isObject(errorResultForTable)) {
                this.ux.table(errorResultForTable, { columns: error.columns });
            }

            // TODO This might look a little different than it use to...
            // because of getErrorMessage and the ux.table while still
            // throwing. Make sure it is OK
            throw error;
        }
    }

    /**
     * returns true if a wildcard like expansion or behavior is detected
     * @param param the next parameter passed into the cli
     */
    checkIfWildcardError(param: string): boolean{
        if(param){
            return this.argv.length > 2 &&
            (this.id.includes('source:deploy') || this.id.includes('source:retrieve')) &&
            (param.indexOf('-') != 0 ) && //if wildcard param will be path, can't start with '-', but flags have to start with '-'
            (param.indexOf('"') <= param.indexOf(', ') &&
            (param.indexOf(path.sep) >= 0 ));
        }else{
            return false;
        }
    }

    /**
     * SfdxError.wrap does not keep actions, so we need to convert ourselves if using almError
     * @param err
     */
    protected async catch(err: Error) {
        // Let oclif handle exit signal errors.
        if (getString(err, 'code') === 'EEXIT') {
            throw err;
        }

        let project;
        let appConfig = {};
        try {
            project = await SfdxProject.resolve();
            appConfig = await project.resolveProjectConfig();
        } catch(noopError) {}

        // AuthInfo is a @salesforce/core centric thing. We should convert this message in core
        // which makes more sense.
        if (err.name === 'NamedOrgNotFound') {
            set(err, 'name', 'NoOrgFound');

            try {
                const username = err.message.match(/No AuthInfo found for name (.*)/)[1];
                set(err, 'message', messages.getMessage('namedOrgNotFound', username));
            } catch (err) {} // In the offcase the match fails, don't throw a random error

            // If this is a parse error then this.flags.json may not be defined.
            // So look on the argv list.
            if (this.argv.includes('--json')) {
                this.ux.warn('The error message "NoOrgFound" has been deprecated and will be removed in v46 or later.  It will become "NamedOrgNotFound".');
            }

            if (this.statics.requiresUsername) {
                return super.catch(err);
            }
        }

        try {
            let context = {};
            try {
                context = await this.resolveLegacyContext();
            } catch (e) {}
            // TODO Processors should be moved to command??
            const processors = getProcessors(appConfig, context, err);

            for (const processor of processors) {
                await processor;
            }
        } catch(newError) {
            err = newError;
        }

        if (!(err instanceof SfdxError)) {
            const sfdxErr = SfdxError.wrap(err);
            if (has(err, 'action')) {
                if (!sfdxErr.actions) { sfdxErr.actions = []; }
                if (isArray(err.action)) {
                    for (const action of err.action) {
                        if (isString(action)) {
                            sfdxErr.actions.push(action);
                        }
                    }
                } else if (isString(err.action)) {
                    sfdxErr.actions.push(err.action);
                }
            }
            const index : number = this.argv.indexOf('-p') > 0 ? this.argv.indexOf('-p') : 0;
            const param : string = this.argv[index + 2]; // should be flag
            if (this.checkIfWildcardError(param)) { //makes sure that the next arg is +2 from this and starts with - or exists
                sfdxErr.message = messages.getMessage('WildCardError');
            }
            if (has(err, 'result')) {
                sfdxErr.data = err.result;
            }
            return super.catch(sfdxErr);
        }

        return super.catch(err);
    }

    protected getJsonResultObject(result, status) {
        return ToolbeltCommand.logPerfMetrics(super.getJsonResultObject(result, status));
    }

    protected async resolveLegacyContext() {
        if (this.legacyContext) {
            return this.legacyContext;
        }

        const logger = require('./lib/core/logApi');
        logger.setHumanConsumable(!this.flags.json && !this.flags.quiet);

        this.stringifyFlags();

        const legacyArgs = [];
        Object.keys(this.args || {}).forEach(argKey => {
            const val = this.args[argKey] || '';
            legacyArgs.push(`${argKey}=${val}`);
        });

        // We need just the args, not the flags in argv as well
        const strict = this.statics.strict;
        if (!strict) {
            const { args, argv } = this.parse({
                flags: this.statics.flags,
                args: this.statics.args,
                strict
            });
            const argVals: string[] = Object.values(args);
            const varargs = argv.filter((val) => !argVals.includes(val));

            varargs.forEach(argKey => {
                legacyArgs.push(argKey);
            });
        }

        Object.keys(this.varargs || {}).forEach(argKey => {
            const val = this.varargs[argKey] || '';
            legacyArgs.push(`${argKey}=${val}`);
        });

        const context: Dictionary<any> = {
            flags: this.flags,
            args: legacyArgs,
            varargs: this.varargs
        };
        if (this.org || this.hubOrg) {
            const org = this.org || this.hubOrg;
            const username = org.getUsername();
            if (this.flags.apiversion) {
                // The legacy force gets the apiVersion for the config. We could set that on the
                // new instance we create, but anyone creating their own version of force would
                // experience a problem. Hack the envs to get it use the flag version across the board.
                process.env.SFDX_API_VERSION = this.flags.apiversion;
            }
            context.org = await Org.create(username);
        }
        this.legacyContext = context;
        set(this.legacyContext, 'command.flags', Object.values(this.ctor.flags));
        return context;
    }

    protected legacyOutput(command, obj) {
        // For tables with no results we will display a simple message "No results found"
        if (Array.isArray(obj) && obj.length < 1) {
            this.ux.log(messages.getMessage('noResultsFound'));
            return;
        }

        // If the command produces tabular output
        if (isFunction(command.getColumnData)) {
            const columnData = command.getColumnData();

            // If the output is an object we are assuming multiple table are being displayed.
            if (isPlainObject(columnData)) {
                // Each table
                for (const key of Object.keys(columnData)) {
                    const val = columnData[key];
                    const rows = get(obj, key);
                    if (isEmpty(rows)) {
                        // If the rows are empty provide a nice message and a way to customize the message.
                        let message = messages.getMessage('noResultsFound');
                        if (command.getEmptyResultMessage) {
                            const _message = command.getEmptyResultMessage(key);
                            if (_message != null) {
                                message = _message;
                            }
                        }
                        this.ux.log(message);
                    } else {
                        // One or more row s are available.
                        this.ux.table(getArray(obj, key), { columns: val });
                        // separate the table by a blank line.
                        this.ux.log();
                    }
                }
            } else {
                // Single output
                this.ux.table(obj, { columns: columnData });
            }
        } else {
            const message = command.getHumanSuccessMessage && command.getHumanSuccessMessage(obj);
            if (message != null && message !== '') {
                this.ux.log(message);
            }
        }
    }
    // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
    protected get statics(): typeof ToolbeltCommand {
        return this.constructor as typeof ToolbeltCommand;
    }

    protected static logPerfMetrics(obj) {
        if (requestPerfMetrics.length > 0) {
            obj.perfMetrics = requestPerfMetrics;
            srcDevUtil.saveGlobalConfig('apiPerformanceLog.json', requestPerfMetrics);
        }
        return obj;
    }
}

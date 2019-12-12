import * as ResponseParser from '../force-cli/force-cli-responseParser';
import * as Display from '../force-cli/force-cli-display';
import * as Error from '../force-cli/force-cli-error';
import * as Config from '../force-cli/force-cli-config';
import * as Messages from '../force-cli/force-cli-messages';
import { Connection } from 'jsforce';
import { RequestInfo } from 'jsforce';
import { ExecuteAnonymousResult } from 'jsforce';
import * as fs from 'fs';
import * as util from 'util';
import * as readline from 'readline';

const soapTemplate = `<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
		xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
		xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
		xmlns:cmd="http://soap.sforce.com/2006/08/apex"
		xmlns:apex="http://soap.sforce.com/2006/08/apex">
			<env:Header>
				<cmd:SessionHeader>
					<cmd:sessionId>%s</cmd:sessionId>
				</cmd:SessionHeader>
				%s
			</env:Header>
			<env:Body>
				<%s xmlns="http://soap.sforce.com/2006/08/apex">
				    %s
				</%s>
			</env:Body>
		</env:Envelope>`;

export class ApexExecuteCommand {
  validate(context) {}

  async execute(context): Promise<any> {
    if (context.flags.apexcodefile === undefined) {
      return await apexFromUserInput(context);
    } else if (context.flags.apexcodefile) {
      return await apexFromFile(context);
    }
    Error.exitDisplayHelp(context.command);
  }
}

/**
 * get apex code from stdin when no filepath arg provided
 * exposed for unit testing (mocked)
 */
export let apexFromUserInput = function(context: any): Promise<void> {
  Display.info(Messages.get('ApexExecTypingPrompt'));
  return new Promise<any>((resolve, reject) => {
    let readInterface = readline.createInterface(process.stdin, process.stdout);
    let apexCode = '';
    readInterface
      .on('line', function(input: string) {
        apexCode = apexCode + input + '\n';
      })
      .on('close', async function(): Promise<void> {
        try {
          const response = await execute(context, apexCode);
          resolve(handleResult(
            ResponseParser.getExecuteAnonymousResponse(response),
            ResponseParser.getDebugInfo(response),
            context.flags.json
          ));
        } catch (err) {
          reject(err);
        }
      })
      .on('error', err => reject(err));
  })
};

/**
 *  get apex code from provided file
 *  exposed for unit testing (mocked)
 *  @param {string} filepath - file containing apex code
 */
export let apexFromFile = async function(context: any): Promise<any> {
  const data = fs.readFileSync(context.flags.apexcodefile);
  const response = await execute(context, data.toString());
  return handleResult(
    ResponseParser.getExecuteAnonymousResponse(response),
    ResponseParser.getDebugInfo(response),
    context.flags.json
  );
};

/**
 * creates and sends SOAP request
 * exposed for unit testing
 * @param {string} apexCode - code to debug
 * @param {function} callback - function that accepts the xml response from the server
 */
export let execute = async function(context: any, apexCode: string): Promise<Object> {
  // fetch saved connection to send the execute request on
  const connection: Connection = await Config.getActiveConnection(context);

  // create the exec anonymous request
  const action = 'executeAnonymous';
  const debugHeader = '<apex:DebuggingHeader><apex:debugLevel>DEBUGONLY</apex:debugLevel></apex:DebuggingHeader>';
  let actionBody = '<apexcode><![CDATA[%s]]></apexcode>';
  actionBody = util.format(actionBody, apexCode);
  const postEndpoint =
    connection.instanceUrl + '/services/Soap/s/' + connection.version + '/' + connection.accessToken.split('!')[0];

  const requestHeaders = {
    'Content-Type': 'text/xml',
    soapaction: action
  };
  const request: RequestInfo = {
    method: 'POST',
    url: postEndpoint,
    body: util.format(soapTemplate, connection.accessToken, debugHeader, action, actionBody, action),
    headers: requestHeaders
  };

  const postOptions: any = {
    headers: Object.assign({}, requestHeaders)
  };

  return await connection.request(request, postOptions);
};

/**
 *  output results to user
 *  exposed for unit testing
 *  @param {ExecuteAnonymousResult} result
 *  @param {string} debugInfo
 */
export let handleResult = function(
  result: ExecuteAnonymousResult,
  debugInfo: string,
  json?: boolean
): ExecuteAnonymousResult {
  // check for compile errors
  if (result.compiled) {
    Display.success(Messages.get('ApexExecCompileSuccess'));
  } else {
    let errMsg = Messages.get('ApexExecCompileFailedErrorMessage', result.line, result.column, result.compileProblem);
    if (!json) Error.errorMessage(errMsg);
    Error.exitWithMessage(Messages.get('ApexExecCompileFailed'));
  }
  // check for runtime erorrs
  if (result.success) {
    Display.success(Messages.get('ApexExecExecutionSuccess'));
    Display.info(debugInfo);
  } else {
    if (!json && result.exceptionMessage) {
      Error.errorMessage(result.exceptionMessage);
    }
    if (!json && result.exceptionStackTrace) {
      Error.errorMessage(result.exceptionStackTrace);
    }
    Error.exitWithMessage(Messages.get('ApexExecExecutionFailure'));
  }
  return Object.assign(result, { logs: debugInfo });
};
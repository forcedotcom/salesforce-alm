/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* --------------------------------------------------------------------------------------------------------------------
 * WARNING: This file has been deprecated and should now be considered locked against further changes.  Its contents
 * have been partially or wholly superseded by functionality included in the @salesforce/core npm package, and exists
 * now to service prior uses in this repository only until they can be ported to use the new @salesforce/core library.
 *
 * If you need or want help deciding where to add new functionality or how to migrate to the new library, please
 * contact the CLI team at alm-cli@salesforce.com.
 * ----------------------------------------------------------------------------------------------------------------- */

import { Connection } from 'jsforce';

export const importScratchOrgCred = async function (context: any): Promise<Connection> {
  // Here be 🐉
  /* _getConnection only sets up the listener for a token refresh but does
   * not actually check if the token is old. Need to do a subsequent call
   * with the connection object for it to check and do a refresh.
   */
  const conn = await context.org.force._getConnection(context.org, context.org.config);
  await conn.requestGet(conn._baseUrl());
  return conn;
};

export const getActiveConnection = async function (context?: any): Promise<Connection> {
  // if (TestUtil.isIntegrationTesting()) {
  //     let loginUrl = TestUtil.getTestInstance();
  //     let username = TestUtil.getTestUsername();
  //     let password = TestUtil.getTestPassword();
  //     let connection = new Connection();
  //     connection.loginUrl = loginUrl;
  //     await connection.loginBySoap(username, password);
  //     return connection;
  // } else {
  return await importScratchOrgCred(context);
  // }
};

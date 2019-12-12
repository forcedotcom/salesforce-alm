/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Node
import * as util from 'util';

// Local
import * as ConfigApi from '../core/configApi';

// constants
const DEFAULT_COMPANY = 'Company';

/**
 * Helper method to read the namespace configured for this workspace.
 * @param configApi
 * @throws Formatting exceptions associated with reading the workspace config.
 * @returns {*} The namespace associated with the workspace.
 * @private
 */
const _getNamespace = function(configApi) {
  const apiVersion = configApi.getApiVersion();

  let namespace;

  // TODO check overrides on the command line, when implemented

  // NamespacePrefix is not available in SignupRequest until API version 37.0
  if (apiVersion >= 37) {
    namespace = configApi.getAppConfigIfInWorkspace().namespace;

    if (util.isNullOrUndefined(namespace)) {
      // no workspace
      return undefined;
    }
  }

  return namespace;
};

/**
 * Helper method to generate a unique username based on the orgType and the current time
 * @param orgType
 * @returns {*} a unique username
 * @private
 */
const _generateUsername = (orgType, company) => {
  const timestamp = Date.now();
  return `${orgType}Org${timestamp}@${company.replace(/ +/g, '')}.com`;
};

/*
 * A helper module for generating scratch org signup requests
 */
const signupRequestGenerator = {
  /**
   * Takes in a signup request and fills in the missing fields
   * @param force
   * @param signupRequest - the signupRequest passed in by the user
   * @param orgType
   */
  generateSignupRequest(masterOrg, signupRequest, orgType, nonamespace) {
    if (util.isNullOrUndefined(signupRequest.Company)) {
      signupRequest.Company = DEFAULT_COMPANY;
    }

    if (util.isNullOrUndefined(signupRequest.Username)) {
      signupRequest.Username = _generateUsername(orgType, signupRequest.Company);
    }

    // Signup ISV will return a toLower on the username in the signup request result.
    signupRequest.Username = signupRequest.Username.toLowerCase();

    const config = new ConfigApi.Config().getAppConfigIfInWorkspace();

    // SignupRequests require a field called "SignupEmail", which is stored in our configs as simply "Email"
    signupRequest.SignupEmail = signupRequest.Email;
    delete signupRequest.Email;
    if (util.isNullOrUndefined(signupRequest.SignupEmail)) {
      signupRequest.SignupEmail = config.email;
    }

    if (util.isNullOrUndefined(signupRequest.Country)) {
      signupRequest.Country = config.country;
    }

    if (util.isNullOrUndefined(signupRequest.LastName)) {
      signupRequest.LastName = config.lastName;
    }

    return masterOrg
      .getConfig()
      .then(hubConfig => {
        // Use the Hub org's client ID value, if one wasn't provided to us
        if (util.isNullOrUndefined(signupRequest.ConnectedAppConsumerKey)) {
          signupRequest.ConnectedAppConsumerKey = hubConfig.clientId;
        }
      })
      .then(() => {
        // We want the org to be added to the environment hub
        if (util.isNullOrUndefined(signupRequest.ShouldConnectToEnvHub)) {
          signupRequest.ShouldConnectToEnvHub = 'true';
        }

        // Set the namespace of the release org
        const namespace = _getNamespace(masterOrg.force.getConfig());
        if (!nonamespace && !util.isNullOrUndefined(namespace)) {
          signupRequest.NamespacePrefix = namespace;
        }

        signupRequest.SignupSource = 'AppCloud';
        signupRequest.ConnectedAppCallbackUrl = masterOrg.force.getConfig().getOauthCallbackUrl();
        return signupRequest;
      });
  }
};

export = signupRequestGenerator;

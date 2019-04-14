'use strict';
const Permissions = require('core/Permissions');
const IonError = require('core/IonError');
const Errors = require('core/errors/front-end');
const SoapService = require('../lib/impl/service/soapService');


/**
 * @param {{}} options
 * @param {Auth} options.auth
 * @param {WsAuth} options.ws
 * @param {AclProvider} options.acl
 * @constructor
 */
function WsToken(options) {
  SoapService.apply(this, [
    {
      meta: {
        messages: {
          methodOut: [{name: 'value', type: 'String'}]
        },
        operations: {
          token: {
            output: 'methodOut'
          }
        }
      }
    }
  ]);

  this.token = function (req) {
    let u = options.auth.getUser(req);
    return options.acl.checkAccess(u, 'ws:::gen-ws-token', [Permissions.USE])
      .then((ok) => {
        if (ok) {
          let id = u.id().split('@');
          return options.ws.generateToken(id[0], id[1]);
        }
        throw new IonError(Errors.ACCESS_DENIED);
      });
  };
}

WsToken.prototype = SoapService.prototype;
module.exports = WsToken;
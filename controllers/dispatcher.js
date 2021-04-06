/**
 * Created by kras on 11.11.16.
 */
'use strict';

const { di, utils: { strings } } = require('@iondv/core');
const { IonError } = require('@iondv/core');
const parseSecurity = require('../backend/parseSecurity');
const ISoapService = require('../lib/interfaces/ISoapService');
const Errors = require('../errors/backend-errors');
const __ = strings.unprefix('errors');

function fault(res, err) {
  res.set('Content-Type', 'text/xml; charset=utf-8').render('fault', err);
}

module.exports = function (req, res) {
  if (!req.is('text/xml') && !req.is('multipart/related')
    || req.is('text/xml') && typeof req.body !== 'string') {
    return res.status(400).send('Bad Request');
  }

  /**
   * @type {{metaRepo: MetaRepository, sysLog: Logger, wsAuth: WsAuth}}
   */
  let scope = di.context(req.moduleName);
  if (scope.hasOwnProperty(req.params.service)) {
    /**
     * @type {Service}
     */
    let s = scope[req.params.service];
    if (s instanceof ISoapService) {
      try {
        let authMode = scope.settings.get(req.moduleName + '.authMode') || {};
        authMode = authMode[req.params.service] || 'pwd';
        let auth;
        if (authMode !== 'none') {
          let credentials = parseSecurity(req.body, authMode === 'token' || authMode === 'oauth');
          if (!credentials) {
            return fault(res, {code: errors.ACCESS_DENIED, message: 'Access is denied', stack: ''});
          }
          if (authMode === 'oauth') {
            auth = scope.oauth.authenticate({Authorization: 'Bearer ' + credentials.token});
          } else {
            auth = scope.wsAuth.authenticate(credentials);
          }
        } else {
          auth = Promise.resolve();
        }

        auth
          .then((u) => {
            if (!u && authMode !== 'none') {
              throw new IonError(errors.ACCESS_DENIED);
            }
            if (u) {
              scope.auth.forceUser(req, u);
            }
          })
          .then(() => s.response(req))
          .then(result => res.set('Content-Type', 'text/xml; charset=utf-8').send(result))
          .catch((err) => {
            scope.sysLog.error(err);
            fault(res, {code: err.code, message: err.message, stack: err.stack});
          });
      } catch (err) {
        scope.sysLog.error(err);
        fault(res, {code: 500, message: __(Errors.HTTP_500), stack: err.stack});
      }
      return;
    }
  }
  res.status(404).send(__(Errors.HTTP_404));
};

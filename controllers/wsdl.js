/**
 * Created by kras on 11.11.16.
 */
'use strict';

const { di, utils: { strings } } = require('@iondv/core');
const ISoapService = require('../lib/interfaces/ISoapService');
const Errors = require('../errors/backend-errors');
const __ = strings.unprefix('errors');

module.exports = function (req, res) {
  /**
   * @type {{metaRepo: MetaRepository, sysLog: Logger, settings: SettingsRepository}}
   */
  const scope = di.context(req.moduleName);
  if (scope.hasOwnProperty(req.params.service)) {
    /**
     * @type {ISoapService}
     */
    const s = scope[req.params.service];
    if (s instanceof ISoapService) {
      return s.getWsdl(req)
        .then(wsdl => res.set('Content-type', 'text/xml; charset=utf-8').send(wsdl))
        .catch((err) => {
          scope.sysLog.error(err);
          res.status(500).send(__(Errors.HTTP_500));
        });
    }
  }
  res.status(404).send(__(Errors.HTTP_404));
};

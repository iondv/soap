/**
 * Created by kras on 11.11.16.
 */
'use strict';

const moduleName = require('../module-name');
const di = require('core/di');
const ISoapService = require('../lib/interfaces/ISoapService');

module.exports = function (req, res) {
    /**
     * @type {{metaRepo: MetaRepository, sysLog: Logger, settings: SettingsRepository}}
     */
    const scope = di.context(moduleName);
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
            res.status(500).send('Внутренняя ошибка сервера.');
          });
      }
    }
    res.status(404).send('Сервис с указанным именем не найден!');
  };

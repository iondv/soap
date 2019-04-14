/**
 * Created by kras on 10.11.16.
 */
'use strict';

const express = require('express');
const ejsLocals = require('ejs-locals');
const di = require('core/di');
const config = require('./config');
const moduleName = require('./module-name');
const dispatcher = require('./controllers/dispatcher');
const wsdl = require('./controllers/wsdl');
const extendDi = require('core/extendModuleDi');
const path = require('path');
const alias = require('core/scope-alias');

let app = module.exports = express(); // eslint-disable-line

app.get('/' + moduleName + '/:service.wsdl', wsdl);
app.post('/' + moduleName + '/:service', dispatcher);

app.engine('ejs', ejsLocals);
app.set('views', path.join(__dirname, '/tpl'));
app.set('view engine', 'ejs');

app._init = function () {
  /**
   * @type {{settings: SettingsRepository, auth: Auth, sessionHandler: SessionHandler}}
   */
  let rootScope = di.context('app');

  rootScope.auth.exclude('/' + moduleName + '/**');
  rootScope.sessionHandler.exclude('/' + moduleName + '/**');

  return di(
      moduleName,
      extendDi(moduleName, config.di),
      {
        module: app
      },
      'app',
      [],
      'modules/' + moduleName)
      .then(scope => alias(scope, scope.settings.get(moduleName + '.di-alias')));
};

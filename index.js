/**
 * Created by kras on 10.11.16.
 */

const express = require('express');
const ejsLocals = require('ejs-locals');
const { di } = require('@iondv/core');
const {load} = require('@iondv/i18n');
const { utils: { extendDi } } = require('@iondv/commons');
const sysMenuCheck = require('@iondv/web-rte/util/sysMenuCheck');
const alias = di.alias;
const config = require('./config');
const dispatcher = require('./controllers/dispatcher');
const wsdl = require('./controllers/wsdl');
const path = require('path');

const app = module.exports = express(); // eslint-disable-line

app.get('/:service.wsdl', wsdl);
app.post('/:service', dispatcher);

app.engine('ejs', ejsLocals);
app.set('views', path.join(__dirname, '/tpl'));
app.set('view engine', 'ejs');

app._init = function (moduleName) {
  /**
   * @type {{settings: SettingsRepository, auth: Auth, sessionHandler: SessionHandler}}
   */
  const rootScope = di.context('app');

  rootScope.auth.exclude(`/${moduleName}/**`);
  rootScope.sessionHandler.exclude(`/${moduleName}/**`);

  return di(
    moduleName,
    extendDi(moduleName, config.di),
    {module: app},
    'app')
    .then(scope => alias(scope, scope.settings.get(`${moduleName}.di-alias`)));
};

const request = require('request');
const Dom = require('xmldom').DOMParser;
const xpath = require('xpath');
const proxy = require('./CrudProxy');
const ISoapClient = require('../../interfaces/ISoapClient');
const IonError = require('core/IonError');
const Errors = require('../../../../errors/backend-errors');

/**
 * @param {{}} options
 * @param {{}} options.services
 * @param {Logger} options.log
 * @param {Number} [options.timeout]
 * @constructor
 */
function CrudSoapClient(options) {
  const services = {};

  function parseWsdl(descriptor) {
    return new Promise(((resolve, reject) => {
      let wsdl;
      let security;
      if (typeof descriptor === 'object') {
        wsdl = descriptor.wsdl;
        security = descriptor.security;
      } else if (typeof descriptor === 'string') {
        wsdl = descriptor;
      }

      if (!wsdl) {
        return resolve(null);
      }

      if (options.log) {
        options.log.info(`Загружается клиент сервиса для адреса ${wsdl}`);
      }

      let timeout = options.timeout ? options.timeout : 1000;

      request.get({url: wsdl, timeout}, (err, response, body) => {
        if (err) {
          return reject(err);
        }

        if (response.statusCode === 200) {
          try {
            const dom = new Dom();
            const doc = dom.parseFromString(body);
            const selectSrv = '/*[local-name() = \'definitions\']/*[local-name() = \'service\']';
            const services = xpath.select(selectSrv, doc);
            if (services.length > 0) {
              const meta = {};
              for (let i = 0; i < services.length; i++) {
                const service = services[i];
                const selectEp = '*[local-name() = \'port\']/*[local-name() = \'address\']/@location';
                const endPoint = xpath.select(selectEp, service)[0].value;
                const sname = service.getAttribute('name');
                if (endPoint && options.services[sname]) {
                  meta[sname] = proxy({
                    xslt: options.services[sname].xslt || descriptor.xslt,
                    endPoint,
                    security
                  }, options);
                }
              }
              return resolve(meta);
            }
            if (options.log) {
              options.log.warn(`WSDL ${wsdl} не содержит описания сервисов.`);
            }
            return resolve();
          } catch (err) {
            return reject(err);
          }
        } else {
          if (options.log) {
            options.log.warn(`Не удалось получить описание сервиса по адресу ${
              wsdl}. Код ответа ${response.statusCode}`);
          }
          return resolve(null);
        }
      });
    }));
  }

  function createService(descriptor) {
    return parseWsdl(descriptor)
      .then((proxies) => {
        proxies = proxies || {};
        for (const name in proxies) {
          if (proxies.hasOwnProperty(name)) {
            services[name] = proxies[name];
          }
        }
      });
  }

  this._service = name => services[name];

  this.init = () => {
    const _this = this;
    let constructors = Promise.resolve();
    Object.keys(options.services || {}).forEach((nm) => {
      let descriptor = options.services[nm];
      Object.keys(descriptor.events).forEach((event) => {
        descriptor.emitter.on(event, (e) => {
          const ed = descriptor.events[event];
          const srv = _this.service(ed.service);
          if (!srv) {
            throw new IonError(Errors.NO_CONNECTION, {service: ed.service});
          }
          if (typeof srv[ed.method] !== 'function') {
            throw new IonError(Errors.NO_METHOD, {method: ed.method, service: ed.service});
          }
          let d = {};
          if (typeof ed.arg === 'object') {
            for (let nm in ed.arg) {
              if (ed.arg.hasOwnProperty(nm)) {
                d[nm] = e[ed.arg[nm]];
              }
            }
          } else if (typeof args === 'string') {
            d = e[ed.arg];
          } else {
            d = e.updates || e.data || e.item;
          }
          return srv[ed.method].apply(srv, [d]);
        });
      });

      constructors = constructors.then(() => createService(descriptor));
    });
    return constructors;
  };
}

CrudSoapClient.prototype = new ISoapClient();
module.exports = CrudSoapClient;

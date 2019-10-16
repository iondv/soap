const request = require('request');
const Dom = require('xmldom').DOMParser;
const xpath = require('xpath');
const proxy = require('./CrudProxy');
const ISoapClient = require('../../interfaces/ISoapClient');

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
        options.log.info(`Load the service client for an address ${wsdl}`);
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
              options.log.warn(`WSDL ${wsdl} does not contain a description of the services.`);
            }
            return resolve();
          } catch (err) {
            return reject(err);
          }
        } else {
          if (options.log) {
            options.log.warn(`Failed to get the service description for an address ${
              wsdl}. Response code ${response.statusCode}`);
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
            throw new Error(`Client not connected to service ${ed.service}`);
          }
          if (typeof srv[ed.method] !== 'function') {
            throw new Error(`Method ${ed.method} not found in service ${service}`);
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

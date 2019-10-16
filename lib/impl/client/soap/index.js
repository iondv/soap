/**
 * Created by kras on 11.11.16.
 */
'use strict';
const EventEmitter = require('events');
const request = require('request');
const Dom = require('xmldom').DOMParser;
const xpath = require('xpath');
const proxy = require('./Proxy');
const url = require('url');
const ISoapClient = require('../../../interfaces/ISoapClient');

const XSDNS = 'http://www.w3.org/2001/XMLSchema';

// jshint maxstatements: 100, maxcomplexity: 50
/**
 * @param {{}} options
 * @param {{}} options.services
 * @param {{}} options.mappings
 * @param {Logger} options.log
 * @param {Number} [options.timeout]
 * @constructor
 */
function SoapClient(options) {
  const services = {};
  const schemaCache = {};
  const clientEvents = new EventEmitter();

  function parseName(name) {
    let pos;
    if ((pos = name.indexOf(':')) > 0) {
      return {
        prefix: name.substring(0, pos),
        name: name.substring(pos + 1)
      };
    }
    return {
      prefix: null,
      name: name
    };
  }

  function parseSchemaBody(schema, tns, namespaces) {
    let types = [];
    let simpleTypes = xpath.select('*[local-name() = \'simpleType\']', schema);

    for (let i = 0; i < simpleTypes.length; i++) {
      let t = xpath.select('*[local-name() = \'restriction\']/@base', simpleTypes[i])[0].value;
      let qnm = parseName(t);
      types.push({
        ns: tns,
        name: simpleTypes[i].getAttribute('name'),
        base: {
          ns: namespaces[qnm.prefix] || tns,
          type: qnm.name
        }
      });
    }

    let complexTypes = xpath.select('*[local-name() = \'complexType\']', schema);

    for (let i = 0; i < complexTypes.length; i++) {
      let tmp = {
        ns: tns,
        name: complexTypes[i].getAttribute('name'),
        attrs: {}
      };

      if (tns === 'http://www.w3.org/2004/08/xop/include' && tmp.name.toLowerCase() === 'include') {
        tmp.isXopRef = true;
        delete tmp.attrs;
      } else {
        let cc = xpath.select(
          '*[local-name() = \'complexContent\']/*[local-name() = \'restriction\']',
          complexTypes[i]
        );

        if (!cc.length) {
          cc = xpath.select(
            '*[local-name() = \'complexContent\']/*[local-name() = \'extension\']',
            complexTypes[i]
          );
        }

        if (cc.length > 0) {
          cc = cc[0];
          tmp.parent = cc.getAttribute('base');
          let qnm = parseName(tmp.parent);
          tmp.parent = {
            ns: namespaces[qnm.prefix] || tns,
            type: qnm.name
          };
        } else {
          cc = complexTypes[i];
        }

        let attrs = xpath.select(
          '*[local-name() = \'sequence\']' +
          '/*[local-name() = \'element\']', cc);

        let choiceAttrs = xpath.select(
          '*[local-name() = \'sequence\']' +
          '/*[local-name() = \'choice\']' +
          '/*[local-name() = \'element\']', cc);

        attrs = attrs.concat(choiceAttrs);

        for (let j = 0; j < attrs.length; j++) {
          let en = attrs[j].getAttribute('name');
          let t = attrs[j].getAttribute('type');
          if (!t.length) {
            let collEl = xpath.select(
              '*[local-name() = \'complexType\']' +
              '/*[local-name() = \'sequence\']' +
              '/*[local-name() = \'element\']', attrs[j]);
            if (collEl.length) {
              t = collEl[0].getAttribute('type') + '[]';
            }

          }
          let qnm = parseName(t);
          if (!en) {
            let ref = attrs[j].getAttribute('ref');
            if (ref) {
              qnm = parseName(ref);
              en = qnm.name;
            }
          }
          if (attrs[j].getAttribute('maxOccurs') === 'unbounded') {
            delete tmp.attrs;
            tmp.isArray = true;
            tmp.ns = namespaces[qnm.prefix] || tns;
            tmp.type = qnm.name;
          } else {
            tmp.attrs[en] = {
              ns: namespaces[qnm.prefix] || tns,
              type: qnm.name
            };
          }
        }

        let anyAttrs = xpath.select(
          '*[local-name() = \'sequence\']' +
          '/*[local-name() = \'any\']', cc);

        if (anyAttrs.length) {
          tmp.attrs['*'] = {ns: tns, type: '*'};
        }
      }

      types.push(tmp);
    }

    let elements = xpath.select('*[local-name() = \'element\']', schema);
    for (let i = 0; i < elements.length; i++) {
      let t = elements[i].getAttribute('type');
      let qnm = parseName(t);
      types.push({
        ns: tns,
        name: elements[i].getAttribute('name'),
        type: {
          ns: namespaces[qnm.prefix] || tns,
          type: qnm.name
        }
      });
    }
    return types;
  }

  function getNamespaces(element, ns) {
    let namespaces = ns || {};
    for (let i = 0; i < element.attributes.length; i++) {
      if (element.attributes[i].name.substring(0, 5) === 'xmlns') {
        namespaces[element.attributes[i].name.substring(6)] = element.attributes[i].nodeValue;
      }
    }
    return namespaces;
  }

  function parseSchema(schemaUrl, base, parent, pending) {
    return new Promise((resolve, reject) => {
      pending = pending || {};
      if (pending[schemaUrl] === true) {
        return resolve([]);
      }
      if (schemaCache[schemaUrl]) {
        return resolve(schemaCache[schemaUrl]);
      }
      request.get(
        {
          url: schemaUrl,
          timeout: options.timeout ? options.timeout : 1000
        },
        function (err, response, body) {
          if (err) {
            if (options.log) {
              options.log.warn('Failed to get xml-schema at the address ' + schemaUrl + '.');
            }
            return resolve([]);
          }
          if (response.statusCode === 200) {
            pending[schemaUrl] = true;
            let importers = Promise.resolve();
            let importedTypes = [];
            let doc, root, tns, namespaces;
            try {
              let dom = new Dom();
              doc = dom.parseFromString(body);
              let imports = xpath.select(
                '/*[local-name() = \'schema\']' +
                '/*[local-name() = \'include\' or local-name() = \'import\']', doc);
              root = xpath.select('/*[local-name() = \'schema\']', doc)[0];

              tns = root.getAttribute('targetNamespace');
              namespaces = getNamespaces(root);

              imports.forEach((im) => {
                if (im.hasAttribute('schemaLocation')) {
                  let importUrl = formSchemaUrl(im.getAttribute('schemaLocation'), base);
                  if (!parent || parent && importUrl !== parent) {
                    importers = importers
                      .then(() => parseSchema(importUrl, base, schemaUrl, pending))
                      .then((types) => {
                        importedTypes.push(...types);
                      });
                  }
                }
              });
            } catch (err) {
              return reject(err);
            }

            importers
              .then(() => {
                try {
                  importedTypes.push(...parseSchemaBody(root, tns, namespaces));
                  schemaCache[schemaUrl] = importedTypes;
                  resolve(importedTypes);
                } catch (err) {
                  reject(err);
                }
              })
              .catch(reject);
          } else {
            if (options.log) {
              options.log.warn('Failed to get xml-schema at the address ' +
                schemaUrl + '. Response code ' + response.statusCode);
            }
            resolve([]);
          }
        }
      );
    });
  }

  function parseScalar(type, glossary) {
    if (typeof type === 'string') {
      return type;
    }

    if (type.ns === XSDNS) {
      switch (type.type) {
        case 'string': return 'String';
        case 'integer': return 'Integer';
        case 'float': return 'Float';
        case 'date': return 'Date';
        case 'dateTime': return 'DateTime';
        case 'boolean': return 'Boolean';
        case 'base64Binary': return 'Base64';
        case 'hexBinary': return 'Hex';
        default: return 'String';
      }
    }

    if (glossary.hasOwnProperty(type.type)) {
      return parseScalar(glossary[type.type]);
    }

    return null;
  }

  function formSchemaUrl(schema, base) {
    if (/^https?:\/\//i.test(schema)) {
      return schema;
    }

    return base + '/' + schema;
  }

  function parseWsdl(descriptor, mapping) {
    return new Promise((resolve, reject) => {
      let wsdl, security, xop;
      if (typeof descriptor === 'object') {
        wsdl = descriptor.wsdl;
        security = descriptor.security;
        xop = descriptor.xop;
      } else if (typeof descriptor === 'string') {
        wsdl = descriptor;
      }

      if (!wsdl) {
        return resolve(null);
      }

      if (options.log) {
        options.log.info('Service client is loading for an address ' + wsdl);
      }

      let base = url.parse(wsdl);
      base = base.protocol + '//' + base.host;

      request.get(
        {
          url: wsdl,
          timeout: options.timeout ? options.timeout : 1000
        },
        function (err, response, body) {
          if (err) {
            return reject(err);
          }
          if (response.statusCode === 200) {
            try {
              let dom = new Dom();
              let doc = dom.parseFromString(body);

              let services = xpath.select(
                '/*[local-name() = \'definitions\']' +
                '/*[local-name() = \'service\']', doc);

              if (services.length > 0) {
                let includes = xpath.select(
                  '/*[local-name() = \'definitions\']' +
                  '/*[local-name() = \'types\']/*[local-name() = \'schema\']' +
                  '/*[local-name() = \'include\' or local-name() = \'import\']', doc);

                let importedTypes = [];
                let schemaParsers = Promise.resolve();
                includes.forEach((inc) => {
                  if (inc.hasAttribute('schemaLocation')) {
                    schemaParsers = schemaParsers
                      .then(() => parseSchema(formSchemaUrl(inc.getAttribute('schemaLocation'), base), base))
                      .then(types => importedTypes.push(...types));
                  }
                });

                schemaParsers
                  .then(() => {
                    try {
                      let schema = xpath.select(
                        '/*[local-name() = \'definitions\']' +
                        '/*[local-name() = \'types\']/*[local-name() = \'schema\']', doc);
                      let root = xpath.select('/*[local-name() = \'definitions\']', doc)[0];
                      let tns = root.getAttribute('targetNamespace');
                      for (let i = 0; i < schema.length; i++) {
                        let stns = schema[i].getAttribute('targetNamespace') || tns;
                        let  namespaces = getNamespaces(root);
                        namespaces = getNamespaces(schema[i], namespaces);
                        importedTypes.push(...parseSchemaBody(schema[i], stns, namespaces));
                      }

                      let meta = {};
                      let types = {};
                      let scalars = {};
                      let elements = {};
                      for (let i = 0; i < importedTypes.length; i++) {
                        if (importedTypes[i].attrs) {
                          types[importedTypes[i].name] = importedTypes[i].attrs;
                        } else if (importedTypes[i].isArray) {
                          types[importedTypes[i].name] = importedTypes[i].type + '[]';
                        } else if (importedTypes[i].base) {
                          scalars[importedTypes[i].name] = importedTypes[i].base;
                        } else if (importedTypes[i].type) {
                          elements[importedTypes[i].name] = importedTypes[i].type;
                        } else if (importedTypes[i].isXopRef) {
                          types[importedTypes[i].name] = 'XOP_REF';
                        }
                      }

                      for (let tmp in scalars) {
                        if (scalars.hasOwnProperty(tmp) && typeof scalars[tmp] !== 'string') {
                          scalars[tmp] = parseScalar(scalars[tmp], scalars);
                          if (tmp !== scalars[tmp]) {
                            types[tmp] = scalars[tmp];
                          }
                        }
                      }

                      for (let tmp in types) {
                        if (types.hasOwnProperty(tmp)) {
                          for (let nm in types[tmp]) {
                            if (types[tmp][nm].ns === XSDNS) {
                              types[tmp][nm] = parseScalar(types[tmp][nm], scalars);
                            } else if (scalars.hasOwnProperty(types[tmp][nm].type)) {
                              types[tmp][nm] = scalars[types[tmp][nm].type];
                            } else if (typeof types[tmp][nm] === 'object') {
                              types[tmp][nm] = types[tmp][nm].type;
                            }
                          }
                        }
                      }

                      let msgNodes = xpath.select('*[local-name() = \'definitions\']/*[local-name() = \'message\']', doc);
                      let messages = {};
                      for (let i = 0; i < msgNodes.length; i++) {
                        let tmp = [];
                        let msgs = xpath.select('*[local-name() = \'part\']', msgNodes[i]);
                        for (let j = 0; j < msgs.length; j++) {
                          if (msgs[j].getAttribute('element')) {
                            let t = parseName(msgs[j].getAttribute('element'));
                            if (elements.hasOwnProperty(t.name)) {
                              if (elements[t.name].ns === XSDNS) {
                                tmp.push(parseScalar(elements[t.name].type, scalars));
                              } else if (scalars.hasOwnProperty(elements[t.name].type)) {
                                tmp.push(scalars[elements[t.name].type]);
                              } else {
                                tmp.push({
                                  name: t.name,
                                  type: elements[t.name].type
                                });
                              }
                            }
                          } else if (msgs[j].getAttribute('type')) {
                            let t = parseName(msgs[j].getAttribute('type'));
                            if (scalars.hasOwnProperty(t.name)) {
                              tmp.push({
                                name: msgs[j].getAttribute('name'),
                                type: scalars[t.name]
                              });
                            } else {
                              tmp.push({
                                name: msgs[j].getAttribute('name'),
                                type: t.name
                              });
                            }
                          }
                        }
                        messages[msgNodes[i].getAttribute('name')] = tmp;
                      }

                      for (let i = 0; i < services.length; i++) {
                        let service = services[i];

                        let binding = xpath.select('*[local-name() = \'port\']/@binding', service)[0].value;
                        let pos = binding.indexOf(':');
                        if (pos > 0) {
                          binding = binding.substring(pos + 1);
                        }

                        let style = xpath.select(
                            '/*[local-name() = \'definitions\']' +
                            '/*[local-name() = \'binding\' and @name=\'' + binding + '\']' +
                            '/*[local-name() = \'binding\']/@style', doc)[0].value || 'rpc';

                        let endPoint = xpath.select(
                          '*[local-name() = \'port\']/*[local-name() = \'address\']/@location', service)[0].value;

                        let portType = xpath.select(
                          '/*[local-name() = \'definitions\']' +
                          '/*[local-name() = \'binding\' and @name=\'' + binding + '\']' +
                          '/@type', doc)[0].value;

                        pos = portType.indexOf(':');
                        if (pos > 0) {
                          portType = portType.substring(pos + 1);
                        }

                        portType = xpath.select(
                          '/*[local-name() = \'definitions\']' +
                          '/*[local-name() = \'portType\' and @name=\'' + portType + '\']', doc);

                        if (portType.length > 0) {
                          portType = portType[0];
                          let s = {
                            endPoint,
                            style,
                            types,
                            xop,
                            messages: {},
                            operations: {}
                          };

                          if (security && security.username && security.password) {
                            s.security = security;
                          }

                          let operations = xpath.select('*[local-name() = \'operation\']', portType);
                          for (let j = 0; j < operations.length; j++) {
                            let msgs = xpath.select('*', operations[j]);
                            let tmp = {};
                            tmp.action = xpath.select(
                              '/*[local-name() = \'definitions\']' +
                              '/*[local-name() = \'binding\' and @name=\'' + binding + '\']' +
                              '/*[local-name() = \'operation\' and @name=\'' +
                              operations[j].getAttribute('name') + '\']' +
                              '/*[local-name() = \'operation\']/@soapAction', doc)[0].value;
                            for (let k = 0; k < msgs.length; k++) {
                              tmp[msgs[k].localName] = parseName(msgs[k].getAttribute('message')).name;
                              if (messages.hasOwnProperty(tmp[msgs[k].localName])) {
                                s.messages[tmp[msgs[k].localName]] = messages[tmp[msgs[k].localName]];
                              }
                            }
                            s.operations[operations[j].getAttribute('name')] = tmp;
                          }

                          meta[service.getAttribute('name')] = proxy(s, mapping, options, tns);
                          if (options.log) {
                            options.log.info('Initialized service client ' + service.getAttribute('name') + ' for the address ' + wsdl);
                          }
                        } else {
                          return reject('WSDL does not contain interface descriptions.');
                        }
                      }
                      return resolve(meta);
                    } catch (err) {
                      reject(err);
                    }
                  })
                  .catch(reject);
              } else {
                if (options.log) {
                  options.log.warn('WSDL ' + wsdl + ' does not contain service descriptions.');
                }
                clientEvents.emit('failConnect', descriptor, mapping);
                return resolve();
              }
            } catch (err) {
              return reject(err);
            }
          } else {
            if (options.log) {
              options.log.warn('Failed to get the service description at the address ' +
                wsdl + '. Response code ' + response.statusCode);
            }
            clientEvents.emit('failConnect', descriptor, mapping);
            return resolve();
          }
        }
      );
    });
  }

  function createProxy(descriptor, mapping) {
    return parseWsdl(descriptor, mapping)
      .then((proxies) => {
        for (let name in proxies) {
          if (proxies.hasOwnProperty(name)) {
            services[name] = proxies[name];
          }
        }
      })
      .catch((err) => {
        if (options.interval) {
          if (options.log) {
            let wsdl;
            if (typeof descriptor === 'object') {
              wsdl = descriptor.wsdl;
            } else if (typeof descriptor === 'string') {
              wsdl = descriptor;
            }
            options.log.warn(`Could not connect at the address ${wsdl} [${err.message}]`);
          }
          clientEvents.emit('failConnect', descriptor, mapping);
        } else {
          throw err;
        }
      });
  }

  this._service = function (name) {
    return services[name];
  };

  this.init = function () {
    let constructors = Promise.resolve();
    Object.keys(options.services).forEach((nm) => {
      let map = options.mappings ? options.mappings[nm] : null;
      constructors = constructors.then(() => createProxy(options.services[nm], map));
    });
    return constructors;
  };

  if (options.interval) {
    const attempts = {};

    clientEvents.on('failConnect', (descriptor, mapping) => {
      let wsdl;
      if (typeof descriptor === 'object') {
        wsdl = descriptor.wsdl;
      } else if (typeof descriptor === 'string') {
        wsdl = descriptor;
      }
      attempts[wsdl] = attempts[wsdl] ? attempts[wsdl] + 1 : 1;
      const attempt = options.attempts ? options.attempts >= attempts[wsdl] : true;
      if (attempt) {
        setTimeout(() => {
          if (options.log) {
            options.log.info(`Re-loading service (${attempts[wsdl]}) client for the address ${wsdl}`);
          }
          createProxy(descriptor, mapping);
        }, options.interval);
      }
    });
  }
}

SoapClient.prototype = new ISoapClient();
module.exports = SoapClient;

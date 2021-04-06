const cuid = require('cuid');
const jsonxml = require('jsontoxml');
const resolvePath = require('@iondv/core').utils.system.toAbsolute;
const request = require('../lib/request');
const {xsltProcess, xml2json} = require('../../../util/xml');

/**
 * @param {String} endPoint
 * @param {String} action
 * @param {String} msg
 * @param {{}} [options]
 * @returns {Promise}
 */
function requestPromise(endPoint, action, msg, options) {
  return new Promise((resolve, reject) => {
    request(endPoint, action, msg, options, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

/**
 * @param {{}} data
 * @returns {*}
 */
function produceMessage(data) {
  if (data) {
    if (data.length === 1) {
      return data[0];
    }
    const result = [];
    for (let i = 0; i < data.length; i++) {
      result.push(data[i]);
    }
    return result;
  }
  return null;
}

/**
 * @param {String} operation
 * @param {{name: String, xslt: String}} service
 * @param {String} service.endPoint
 * @param {{}} [options]
 * @returns {Function}
 */
function operationConstructor(operation, service, options) {
  return (action, ...args) => {
    try {
      const xmlData = {};
      if (service.security) {
        xmlData.security = service.security;
        xmlData.security.token = `UsernameToken-${cuid()}`;
      }
      xmlData[operation] = produceMessage(args);
      const xmlString = jsonxml(xmlData);
      let promise = Promise.resolve(xmlString);
      promise = xsltProcess(xmlString, resolvePath(service.xslt));

      return promise
        .then(msg => requestPromise(service.endPoint, action, msg, options))
        .then(({
          body, files
        }) => {
          if (body && options.xslt) {
            return xsltProcess(body, resolvePath(options.xslt[service.name]))
              .then((xml) => {
                return {
                  xml, files
                };
              });
          }
          return {
            xml: body, files
          };
        })
        .then(({xml, files}) => xml2json(xml).then((result) => {
          return {data: result, files};
        }));
    } catch (err) {
      return Promise.reject(err);
    }
  };
}

/**
 * @param {{}} service
 * @param {String} service.endPoint
 * @param {{}} [options]
 * @returns {{}}
 */
module.exports = (service, options) => {
  return {
    create: operationConstructor('create', service, options),
    read: operationConstructor('read', service, options),
    update: operationConstructor('update', service, options),
    delete: operationConstructor('delete', service, options)
  };
};

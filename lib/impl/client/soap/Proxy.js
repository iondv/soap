/**
 * Created by kras on 15.11.16.
 */
const msgParts = require('../../../util/msgParts');
const parseSoap = require('../../../../backend/parseSoap');
const request = require('../../../util/request');
const ejs = require('ejs-locals');
const cuid = require('cuid');
const Item = require('core/interfaces/DataRepository/lib/Item');
const PropertyTypes = require('core/PropertyTypes');
const {toAbsolute} = require('core/system');
const xop = require('../../../../lib/util/xop');

// action = oper.action || (tns || endPoint) + '/' + operation

function requestSoap(service, mapping, operation, endPoint, action, msg, contentType, options, cb) {
  request(endPoint, action, msg, contentType, options, (err, result) => {
    if (err) {
      return cb(err);
    }
    try {
      let {body, files} = result;
      let resp = parseSoap(body, service, mapping, service.style, operation, 'output', files);
      return cb(null, resp);
    } catch (err) {
      return cb(err);
    }
  });
}

function fileAttrXpath(name) {
  let result = '';
  const nameParts = name.split('.');
  if (nameParts.length > 0) {
    result += '/';
    nameParts.forEach((np) => {
      result += `/*[local-name() = '${np}']`;
    });
  }
  return result;
}

function xopFiles(data, attrs, parent) {
  let result = [];
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      result.push(...xopFiles(data[i], attrs, parent));
    }
  } else if (typeof data === 'object' && data !== null) {
    Object.keys(data).forEach((nm) => {
      const name = (parent ? parent + '.' : '') + nm;
      if (attrs[name] === true) {
        result.push({
          content: data[nm],
          contentType: data[nm + 'Mime'],
          name: data[nm + 'Name'],
          xpath: fileAttrXpath(name)
        });
      } else {
        result.push(...xopFiles(data[nm], attrs, name));
      }
    });
  }
  return result;
}

function renderMessage(tplData) {
  return new Promise((resolve, reject) => {
    ejs(
      toAbsolute('modules/soap/tpl/message.ejs'),
      tplData,
      (err, msg) => {
        if (err) {
          return reject(err);
        }
        return resolve(msg);
      }
    );
  });
}

function operationConstructor(operation, service, mapping, options, tns) {
  return function () {
    let security = service.security;
    let n = arguments.length;
    if (arguments.length) {
      let la = arguments[arguments.length - 1];
      if (la && typeof la === 'object' && la.username && la.password) {
        security = la;
        n = n - 1;
      }
    }

    let operArgs = [];
    for (let i = 0; i < n; i++) {
      operArgs.push(arguments[i]);
    }
    return new Promise((resolve, reject) => {
      let oper = service.operations[operation];
      let parts = service.messages[oper.input];
      let xopAttrs = service.xop && service.xop[operation];
      let tplData = {method: operation};
      tplData.endPoint = service.endPoint;
      tplData.tns = tns;
      tplData.style = service.style;
      tplData.data = msgParts(operArgs, parts, service);
      tplData.security = false;
      if (security) {
        tplData.security = security;
        tplData.security.tokenId = 'UsernameToken-' + cuid();
      }
      tplData.settings = {};

      renderMessage(tplData)
        .then((msg) => {
          if (xopAttrs) {
            const xFiles = xopFiles(operArgs, xopAttrs);
            const xOptions = {
              contentType: 'application/soap+xml',
              action: oper.action || (tns || service.endPoint) + '/' + operation
            };
            return xop.convert(msg, xFiles, xOptions);
          }
          return {message: msg, contentType: 'text/xml; charset=utf-8'};
        })
        .then(({message, contentType}) => requestSoap(
          service,
          mapping,
          operation,
          service.endPoint,
          oper.action || (tns || service.endPoint) + '/' + operation,
          message,
          contentType,
          options,
          (err, parsed) => err ? reject(err) : resolve(parsed.attrs)
        ))
        .catch(err => reject(err));
    });
  };
}

function objectParser(service) {
  return function objectParserFunc(obj, type) {
    if (Array.isArray(obj)) {
      let arr = [];
      obj.forEach(o => arr.push(objectParserFunc(o, type)));
      return arr;
    }
    if (obj instanceof Item) {
      let cm = obj.getMetaClass();
      let t = type ? type : cm.getName();
      if (service.types && typeof service.types[t] === 'object' && service.types[t]) {
        let result = {};
        let typeObj = service.types[t];
        let props = obj.getProperties();
        Object.keys(typeObj).forEach((p) => {
          if (props[p]) {
            if (props[p].getType() === PropertyTypes.REFERENCE) {
              let refItem = obj.getAggregate(props[p].getName());
              if (refItem && typeof result[p] === 'undefined') {
                result[p] = objectParserFunc(refItem, typeObj[p]);
              }
            } else if (props[p].getType() === PropertyTypes.COLLECTION) {
              if (typeof result[p] === 'undefined') {
                result[p] = objectParserFunc(obj.getAggregates(props[p].getName()), typeObj[p]);
              }
            } else {
              result[p] = objectParserFunc(props[p].getValue(), typeObj[p]);
            }
          }
        });
        return result;
      } else if (type === 'String') {
        return obj.getItemId();
      }
      return null;
    } else if (typeof obj === 'object' && obj !== null && type &&
      service.types && typeof service.types[type] === 'object' && service.types[type]) {
      let result = {};
      let typeObj = service.types[type];
      Object.keys(typeObj).forEach((p) => {
        if (obj[p]) {
          result[p] = objectParserFunc(obj[p], typeObj[p]);
        }
      });
      return result;
    }
    return obj;
  };
}

/**
 * @param {{}} service
 * @param {String} service.endPoint
 * @param {String} service.style
 * @param {{}} service.types
 * @param {{}} service.messages
 * @param {{}} service.operations
 * @param {{}} mapping
 * @param {{}} options
 * @returns {{}}
 */
module.exports = function (service, mapping, options, tns) {
  let result = {};
  for (let method in service.operations) {
    if (service.operations.hasOwnProperty(method)) {
      result[method] = operationConstructor(method, service, mapping, options, tns);
    }
  }
  result._parse = objectParser(service, mapping, options, tns);
  return result;
};

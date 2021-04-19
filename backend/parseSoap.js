/**
 * Created by kras on 15.11.16.
 */
'use strict';
const Dom = require('xmldom').DOMParser;
const xpath = require('xpath');
const buf = Buffer.from;
const base64 = require('base64-js');
const moment = require('moment');
const { IonError } = require('@iondv/core');
const Errors = require('../errors/backend-errors');

function checkArgPath(arg, path) {
  if (arg && path) {
    if (path.indexOf(arg.localName) > -1) {
      let tags = path.split('/');
      if (tags[tags.length - 1] === arg.localName) {
        if (tags.length === 1) {
          return true;
        } else {
          return checkArgPath(arg.parentNode, tags.slice(0, -1).join('/'));
        }
      }
    }
  }
  return false;
}

function getArgMap(arg, mapping = {}) {
  if (mapping && mapping.elements) {
    let paths = Object.keys(mapping.elements);
    for (let i = 0; i < paths.length; i++) {
      if (checkArgPath(arg, paths[i])) {
        return mapping.elements[paths[i]];
      }
    }
  }
  return null;
}

function castArg(arg, typeName, types) {
  if (arg.firstChild && arg.firstChild.nodeValue) {
    switch (typeName) {
      case '*':
      case 'String':
        return arg.firstChild.nodeValue;
      case 'Integer':
        return parseInt(String(arg.firstChild.nodeValue).trim());
      case 'Float':
        return parseFloat(String(arg.firstChild.nodeValue).trim());
      case 'Date':
        return moment(String(arg.firstChild.nodeValue).trim()).toDate();
      case 'DateTime':
        return moment(String(arg.firstChild.nodeValue).trim()).toDate();
      case 'Boolean':
        return String(arg.firstChild.nodeValue).trim() === 'true';
      case 'Base64':
        return buf(base64.toByteArray(String(arg.firstChild.nodeValue).trim().replace(/\s+/gm, '')));
      case 'Hex':
        return buf(String(arg.firstChild.nodeValue).trim().replace(/\s+/gm, ''), 'hex');
      default: {
        if (types.hasOwnProperty(typeName) && typeof types[typeName] === 'string') {
          return castArg(arg, types[typeName], types);
        }
        throw new IonError(Errors.UNSUPPORTED_TYPE, {type: typeName});
      }
    }
  } else if (typeName === 'String' && arg.firstChild && arg.firstChild.nodeValue === '') {
    return '';
  }
  return null;
}

function parseArgObject(arg, typeName, meta = {}, mapping = {}, xop = {}, strict = false) {
  let type = meta.types[typeName] || {};
  let childNodes = xpath.select('*', arg);
  if (!childNodes.length) {
    return null;
  }
  let result = {};
  for (let i = 0; i < childNodes.length; i++) {
    if (type.hasOwnProperty(childNodes[i].localName) || type.hasOwnProperty('*') || typeName === '*') {
      result[childNodes[i].localName] =
        parseArg(
          childNodes[i],
          {
            type: type[childNodes[i].localName] || '*',
            name: childNodes[i].localName
          },
          meta,
          mapping,
          xop,
          strict
        );
    } else if (strict) {
      throw new IonError(Errors.WRONG_NODE, {type: typeName, name: childNodes[i].localName});
    }
  }
  return result;
}

function findNode(nodes, name) {
  if (nodes && nodes.length) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].localName === name) {
        return nodes[i];
      }
    }
  }
  return null;
}

function parseExtType(arg, extraType) {
  if (!extraType) {
    return null;
  }
  let result = {};
  Object.keys(extraType).forEach((key) => {
    let node = arg;
    let path = extraType[key];
    let tags = path.split('/');
    for (let i = 0; i < tags.length; i++) {
      if (node && tags[i]) {
        if (tags[i][0] === '@') {
          node = findNode(node.attributes, tags[i].substring(1));
          break;
        } else {
          node = findNode(node.childNodes, tags[i]);
        }
      }
    }
    result[key] = node.value;
  });
  return result;
}

function parseArg(arg, part, meta, mapping, xop, strict = false) {
  let map = getArgMap(arg, mapping);
  let typeName = map ? map.type || part : part;

  let tagName = typeName;
  if (typeof typeName === 'object') {
    tagName = typeName.name;
    typeName = typeName.type || '';
  }

  if (typeof tagName === 'string' && tagName.substring(tagName.length - 2) === '[]') {
    tagName = tagName.substring(0, tagName.length - 2);
  }

  if (typeName !== '*' && typeName !== '*[]' && arg.localName !== tagName) {
    throw new IonError(Errors.WRONG_ARG, {arg: arg.localName, tag: tagName});
  }

  let extraType = null;
  if (mapping && mapping.types && mapping.types.hasOwnProperty(typeName)) {
    extraType = mapping.types[typeName];
  }
  if (map && map.assign && Object.keys(map.assign).length) {
    extraType = extraType || {};
    Object.assign(extraType, map.assign);
  }

  if (typeName === '*') {
    let obj = Object.assign(
      parseArgObject(arg, typeName, meta, mapping, xop, strict) || {},
      parseExtType(arg, extraType) || {}
    );
    if (Object.keys(obj).length) {
      return obj;
    }
  } else if (meta.types[typeName] === 'XOP_REF') {
    let href = findNode(arg.firstChild.attributes, 'href');
    if (href) {
      if (xop.hasOwnProperty(href.nodeValue)) {
        return xop[href.nodeValue];
      }
    }
    return null;
  } else if (typeof meta.types[typeName] === 'object') {
    return Object.assign(
      parseArgObject(arg, typeName, meta, mapping, xop, strict) || {},
      parseExtType(arg, extraType) || {}
    );
  } else if (extraType) {
    return parseExtType(arg, extraType);
  }
  let type = meta.types[typeName] || typeName;
  if (typeof type === 'string' && type.substring(type.length - 2) === '[]') {
    let result = [];
    type = type.substring(0, type.length - 2);
    let childNodes = xpath.select('*', arg);
    for (let i = 0; i < childNodes.length; i++) {
      let r = parseArg(childNodes[i], type, meta, mapping, xop, strict);
      if (r !== null) {
        result.push(r);
      }
    }
    return result;
  }
  return castArg(arg, typeName, meta.types);
}

module.exports = function (body, meta, mapping, style, method, messageType, xop, strict = false) {
  let dom = new Dom({
    errorHandler: {
      error: (e) => {
        throw e;
      },
      fatalError: (e) => {
        throw e;
      }
    }
  });
  let doc = null;
  try {
    doc = dom.parseFromString(body);
  } catch (e) {
    throw new IonError(15001, {}, e);
  }
  let root = xpath.select('/*/*[local-name() = \'Body\']', doc);
  if (root.length) {
    root = root[0];
    style = meta.style || style;
    if (style === 'rpc') {
      root = xpath.select('*', root)[0];
      method = root.localName;
    } else if (style === 'document') {
      if (typeof meta.operations[method] === 'undefined') {
        for (let mn in meta.operations) {
          if (meta.operations.hasOwnProperty(mn)) {
            if (meta.operations[mn].hasOwnProperty(messageType)) {
              method = mn;
              break;
            }
          }
        }
      }
    }
    let attrs = [];

    if (
      typeof meta.operations[method] !== 'undefined' &&
      typeof meta.operations[method][messageType] !== 'undefined'
    ) {
      let parts = meta.messages[meta.operations[method][messageType]];

      let childNodes = xpath.select('*', root);
      if (parts.length > childNodes.length) {
        throw new IonError(Errors.LACK_ARGS);
      }
      if (parts.length < childNodes.length) {
        throw new IonError(Errors.WASTE_ARGS);
      }

      for (let i = 0; i < childNodes.length; i++) {
        attrs.push(parseArg(childNodes[i], parts[i], meta, mapping, xop, strict));
      }
    }
    return {
      method: method,
      attrs: attrs
    };
  } else {
    root = xpath.select('/*/*[local-name() = \'Fault\']', doc);
    if (root.length) {
      root = root[0];
      throw new IonError(
        xpath.select('*[local-name() = \'faultcode\']/text()', root, true).nodeValue,
        {},
        xpath.select('*[local-name() = \'faultstring\']/text()', root, true).nodeValue);
    }
  }
  throw new IonError(Errors.NO_BODY);
};

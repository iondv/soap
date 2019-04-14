/**
 * Created by kras on 15.11.16.
 */
'use strict';
const moment = require('moment');
const base64 = require('base64-js');

function produceAttrs(obj) {
  const result = [];
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach((name) => {
      if (name && name[0] === '@') {
        result.push({
          name: name.slice(1),
          val: obj[name]
        });
      }
    });
  }
  return result;
}

// jshint maxcomplexity: 20, maxstatements: 30
function produceResult(r, part, meta) {
  if (r === null || typeof r === 'undefined') {
    return null;
  }

  if (meta.types && typeof meta.types[part] === 'object' && meta.types[part]) {
    if (typeof r !== 'object') {
      return null;
    }

    const result = [];
    const type = meta.types[part];
    for (const nm in r) {
      if (r.hasOwnProperty(nm) && nm[0] !== '@') {
        if (type[nm]) {
          result.push({
            tag: nm,
            val: produceResult(r[nm], type[nm], meta),
            attrs: produceAttrs(r[nm])
          });
        } else {
          result.push({
            tag: nm,
            val: produceResult(r[nm], 'String', meta),
            attrs: produceAttrs(r[nm])
          });
        }
      }
    }
    return result;
  }
  if (meta.types && Array.isArray(r) && (meta.types[part] || part.substring(part.length - 2) === '[]')) {
    let t = meta.types[part] || part.substring(0, part.length - 2);
    if (t.substring(t.length - 2) === '[]') {
      t = t.substring(0, t.length - 2);
    }

    const result = [];

    for (let i = 0; i < r.length; i++) {
      result.push({
        tag: t,
        val: produceResult(r[i], t, meta),
        attrs: produceAttrs(r[i])
      });
    }

    return result.length ? result : null;
  }
  switch (part) {
    case 'Date':
      return moment(r).toISOString();
    case 'DateTime':
      return moment(r).toISOString();
    case 'Boolean':
      return r ? 'true' : 'false';
    case 'Base64':
      return base64.fromByteArray(r);
    case 'Hex':
      return r.toString('hex');
    default:
      return String(r);
  }
}

module.exports = (data, parts, meta) => {
  const res = [];
  for (let i = 0; i < data.length; i++) {
    if (i < parts.length) {
      if (data[i] !== null || typeof data[i] !== 'undefined') {
        let tag = parts[i];
        let type = parts[i];
        if (typeof parts[i] === 'object') {
          tag = parts[i].name;
          type = parts[i].type;
        }
        if (tag) {
          res.push({
            tag,
            val: produceResult(data[i], type, meta),
            attrs: produceAttrs(data[i])
          });
        }
      }
    }
  }
  return res;
};

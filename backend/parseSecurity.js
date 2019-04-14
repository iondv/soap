/**
 * Created by krasilneg on 29.07.17.
 */
'use strict';
const Dom = require('xmldom').DOMParser;
const xpath = require('xpath');
const buf = require('core/buffer');
const base64 = require('base64-js');
const moment = require('moment');

// jshint maxcomplexity: 20, maxstatements: 30
module.exports = function (body, forceToken) {
  let dom = new Dom();
  let doc = dom.parseFromString(body);
  let root = xpath.select('/*/*[local-name() = \'Header\']', doc);
  let result;
  if (root.length) {
    root = root[0];
    let username =
      xpath.select(
        '*[local-name() = \'Security\']/*[local-name() = \'UsernameToken\']/*[local-name() = \'Username\']/text()',
        root,
        true
      );

    let pwd = xpath.select(
      '*[local-name() = \'Security\']/*[local-name() = \'UsernameToken\']/*[local-name() = \'Password\']/text()',
      root,
      true
    );

    if (username || pwd) {
      result = {};
    }

    if (username) {
      result.user = username.nodeValue;
    }

    if (pwd) {
      result[forceToken ? 'token' : 'pwd'] = pwd.nodeValue;
    }
  }
  return result;
};

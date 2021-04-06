'use strict';
const http = require('http');
const https = require('https');
const url = require('url');
const xop = require('./xop');
const { IonError } = require('@iondv/core');
const Errors = require('../../errors/backend-errors');

/**
 * @param {String} endPoint
 * @param {String} action
 * @param {String} msg
 * @param {{}} [options]
 * @param {Function} cb
 */
function request(endPoint, action, msg, contentType, options, cb) {
  let urlobj = new url.URL(endPoint);
  let opts = {
    protocol: urlobj.protocol,
    host: urlobj.hostname,
    port: urlobj.port,
    path: urlobj.pathname,
    query: urlobj.query,
    method: 'POST',
    headers: {
      SOAPAction: action,
      'Content-Type': contentType || 'text/xml; charset=utf-8'
    },
    timeout: options.timeout ? parseInt(options.timeout) : 1000
  };

  try {
    let req = ((opts.protocol === 'https:') ? https : http).request(
      opts,
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redirect = response.headers.location;
          response.resume();
          return request(redirect, action, msg, contentType, options, cb);
        }

        let responseContentType = response.headers['content-type'];

        if (responseContentType.search(/multipart/i) >= 0) {
          xop.parse(response, (err, res) => {
            if (err) {
              return cb(err);
            }
            if (res && res.body) {
              return cb(null, res);
            }
            cb(new IonError(Errors.EMPTY_SOAP_MSG));
          });
        } else {
          let body = '';
          response.on('data', (chunk) => {
            body = body + chunk.toString('utf-8');
          });
          response.on('error', err => cb(err));
          response.on('end', () => {
            cb(null, {body});
          });
        }
      }
    );

    req.on('error', err => cb(err));
    req.write(msg);
    req.end();
  } catch (err) {
    cb(err);
  }
}

module.exports = request;

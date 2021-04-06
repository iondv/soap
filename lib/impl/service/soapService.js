/**
 * Created by kras on 16.11.16.
 */
const ISoapService = require('../../interfaces/ISoapService');
const ejs = require('ejs-locals');
const path = require('path');
const parseSoap = require('../../../backend/parseSoap');
const msgParts = require('../../util/msgParts');
const clone = require('clone');
const xop = require('../../../lib/util/xop');
const { IonError } = require('@iondv/core');
const Errors = require('../../../errors/backend-errors');

/**
 * @param {{}} options
 * @param {{}} [options.style]
 * @param {Boolean} [options.strictMode]
 * @param {{}} options.meta
 * @constructor
 */
function SoapService(options) {

  function parse(req, meta, style) {
    const action = path.parse(req.get('SOAPAction')).name;
    if (req.is('multipart/related')) {
      return xop.parse(req).then(({body, files}) => parseSoap(body, meta, {}, style, action, 'input', files));
    }
    return Promise.resolve(parseSoap(req.body, meta, {}, style, action, 'input'));
  }

  function render(templatePath, meta) {
    return new Promise((resolve, reject) => {
      let tplData = {};
      tplData = meta;
      tplData.settings = meta.settings || {};
      ejs(templatePath, tplData, (err, str) => err ? reject(err) : resolve(str));
    });
  }

  this._getWsdl = function (req) {
    try {
      let meta = clone(options.meta);
      meta.endPoint = req.protocol + '://' + req.get('host') + req.originalUrl.replace(/\.wsdl$/, '');
      meta.name = req.params.service;
      meta.style = options.style || 'rpc';
      return render(path.join(__dirname, '..', '..', '..', 'tpl', 'wsdl.ejs'), meta);
    } catch (err) {
      return Promise.reject(err);
    }
  };

  function produce(method, response, meta) {
    let r = response;
    if (!Array.isArray(r)) {
      r = [r];
    }
    let parts = meta.messages[meta.operations[method].output];
    return msgParts(r, parts, meta);
  }

  this._response = function (req) {
    try {
      const meta = clone(options.meta);
      const style = options.style || 'rpc';
      let method = null;
      return parse(req, meta, style)
        .then((soapRequest) => {
          soapRequest.attrs.push(req);
          method = soapRequest.method;
          if (typeof this[method] !== 'function') {
            throw new IonError(Errors.NO_METHOD, {service: req.params.service, method});
          }
          return this[soapRequest.method].apply(this, soapRequest.attrs);
        })
        .then((result) => {
          const opts = {
            endPoint: req.protocol + '://' + req.get('host') + req.originalUrl,
            tns: req.protocol + '://' + req.get('host') + req.originalUrl,
            service: req.params.service,
            security: false,
            method,
            style,
            data: produce(method, result, meta)
          };
          return render(path.join(__dirname, '..', '..', '..', 'tpl', 'message.ejs'), opts);
        });
    } catch (err) {
      return Promise.reject(err);
    }
  };
}

SoapService.prototype = new ISoapService();
module.exports = SoapService;

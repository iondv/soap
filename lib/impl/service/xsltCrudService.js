const {xsltProcess, xml2json} = require('../../../util/xml');
const jsonxml = require('jsontoxml');
const ejs = require('ejs-locals');
const resolvePath = require('@iondv/core').utils.system.toAbsolute;
const CrudService = require('../../crudService');
const ISoapService = require('../../interfaces/ISoapService');
const { IonError } = require('@iondv/core');
const Errors = require('../../../errors/backend-errors');

// jshint maxcomplexity:20, maxstatements: 40

/**
 * @param {{}} options
 * @param {DataRepository} options.dataRepo
 * @param {MetaRepository} options.metaRepo
 * @param {KeyProvider} options.keyProvider
 * @param {String} options.namespace
 * @param {String} options.className
 * @param {Boolean} options.ignoreRefUpdateErrors
 * @param {Logger} [options.log]
 * @param {{}} [options.types]
 * @param {{}} options.xslt
 * @param {{}} options.wsdl
 * @constructor
 */
function XsltCrudService(options) {

  CrudService.apply(this, [options]);

  function render(templatePath, tplData) {
    return new Promise((resolve, reject) => {
      ejs(templatePath, tplData, (err, str) => {
        if (err) {
          return reject(err);
        }
        return resolve(str);
      });
    });
  }

  function produceXml(meta, xslt) {
    const xmlString = jsonxml(meta);
    return xsltProcess(xmlString, resolvePath(xslt));
  }

  this._getWsdl = function (req) {
    try {
      let meta = {
        endPoint: req.protocol + '://' + req.get('host') + req.originalUrl.replace(/\.wsdl$/, ''),
        name: req.params.service
      };
      return render(resolvePath(options.wsdl), meta);
    } catch (err) {
      return Promise.reject(err);
    }
  };

  this._response = function (req) {
    try {
      let method;
      let promise = Promise.resolve(req.body);
      if (options.xslt) {
        promise = xsltProcess(req.body, resolvePath(options.xslt));
      }
      return promise
        .then(xml => xml2json(xml))
        .then((result) => {
          for (const mthd in result) {
            if (result.hasOwnProperty(mthd)) {
              method = mthd;
              if (['create', 'update', 'get', 'find', 'delete'].indexOf(method) < 0) {
                throw new IonError(Errors.NO_METHOD, {service: req.params.service, method: method || ''});
              }
              return this[method].apply(this, result[method]);
            }
          }
        })
        .then(resp => produceXml({[method]: resp}, options.xslt));
    } catch (err) {
      return Promise.reject(err);
    }
  };
}

XsltCrudService.prototype = new ISoapService();
module.exports = XsltCrudService;

module.exports.prepareUpdates = CrudService.prepareUpdates;
module.exports.applyCollections = CrudService.applyCollections;
module.exports.prepareFilter = CrudService.prepareFilter;

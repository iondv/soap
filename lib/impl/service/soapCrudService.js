/**
 * Created by kras on 16.11.16.
 */
const SoapService = require('./soapService');
const CrudService = require('../../util/crudService');

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
 * @param {{}} [options.style]
 * @constructor
 */
function SoapCrudService(options) {
  CrudService.apply(this, [options]);
  SoapService.apply(this, [Object.assign(options, {meta: this.getMeta()})]);
}

SoapCrudService.prototype = SoapService.prototype;
module.exports = SoapCrudService;

module.exports.prepareUpdates = CrudService.prepareUpdates;
module.exports.applyCollections = CrudService.applyCollections;
module.exports.prepareFilter = CrudService.prepareFilter;

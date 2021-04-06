/**
 * Created by kras on 16.11.16.
 */
'use strict';
const { PropertyTypes } = require('@iondv/meta-model-contracts');
const itemToSoap = require('./itemToSoap');
const transformFiles = require('./transformFiles');
const EventManager = require('@iondv/commons/lib/EventManager');
const parseType = require('./parseType');
const { FunctionCodes: F } = require('@iondv/meta-model-contracts');
const { IonError } = require('@iondv/core');
const Errors = require('../../errors/backend-errors');

/* eslint max-statements: off */


/**
 * @param {{types: {}, keyProvider: KeyProvider, dataRepo: DataRepository}} options
 * @param {{}} data
 * @param {ClassMeta} cm
 * @param {String} [id]
 * @returns {Promise}
 */
function prepareUpdates(options, data, cm, id) {
  let props = cm.getPropertyMetas();
  let obj = (options.types ? options.types[cm.getCanonicalName()] : {}) || {};

  if (!id) {
    id = options.keyProvider.keyData(cm, data);
    if (id) {
      id = options.dataRepo.wrap(cm.getCanonicalName(), id).getItemId();
    }
  }

  let savers = Promise.resolve();
  let collUpdates = {};

  function onRefSave(pn) {
    return (result) => {
      data[pn] = result.getItemId();
    };
  }

  function onCollElemSave(pn) {
    return (result) => {
      collUpdates[pn].push(result);
    };
  }

  for (let i = 0; i < props.length; i++) {
    let name = props[i].name;
    if (typeof obj[name] === 'string') {
      name = obj[name];
    }
    if (props[i].type === PropertyTypes.REFERENCE) {
      if (data[name] && typeof data[name] === 'object') {
        let tmp = data[name];
        if (props[i].backRef && id) {
          tmp[props[i].backRef] = id;
        }
        delete data[name];
        savers = savers.then(() => save(options, tmp, props[i]._refClass, onRefSave(props[i].name)));
      }
    } else if (props[i].type === PropertyTypes.COLLECTION) {
      if (data[name] && Array.isArray(data[name])) {
        let tmp = data[name];
        delete data[name];
        for (let j = 0; j < tmp.length; j++) {
          let dt = tmp[j];
          if (props[i].backRef && id) {
            dt[props[i].backRef] = id;
          }
          savers = savers.then(() => save(options, dt, props[i]._refClass, onCollElemSave(props[i].name)));
        }
        collUpdates[props[i].name] = [];
      }
    } else if (props[i].type === PropertyTypes.FILE || props[i].type === PropertyTypes.IMAGE) {
      if (data[name]) {
        let tmp = {
          name: data[name].name,
          buffer: data[name].body
        };
        delete data[name];
        data[props[i].name] = tmp;
      }
    } else if (props[i].type === PropertyTypes.FILE_LIST) {
      let tmp = data[name];
      if (Array.isArray(tmp)) {
        data[props[i].name] = [];
        for (let j = 0; j < tmp.length; j++) {
          data[props[i].name].push({
            name: tmp[j].name,
            mimeType: tmp[j].mime,
            buffer: tmp[j].body
          });
        }
      }
      delete data[name];
    } else if (data[name] && name !== props[i].name) {
      data[props[i].name] = data[name];
      delete data[name];
    }
  }

  return savers.then(() => {
    return {data: data, collections: collUpdates};
  });
}

/**
 * @param {{dataRepo: DataRepository, ignoreRefUpdateErrors: Boolean, log: Logger}} options
 * @param {{}} data
 * @param {ClassMeta} cm
 * @param {Function} [onSave]
 * @returns {Promise}
 */
function save(options, data, cm, onSave) {
  return prepareUpdates(options, data, cm)
    .then(updates =>
      options.dataRepo.saveItem(cm.getCanonicalName(), null, updates.data, null, null, {})
        .then((result) => {
          if (!result) {
            return null;
          }
          onSave(result);
          updates.collections._master = result;
          return updates.collections;
        })
    )
    .then(applyCollections(options, cm))
    .catch((err) => {
      if (options.ignoreRefUpdateErrors) {
        if (options.log) {
          options.log.warn(err.message);
        }
        return Promise.resolve();
      }
      return Promise.reject(err);
    });
}

/**
 * @param {{dataRepo: DataRepository}} options
 * @param {ClassMeta} cm
 * @returns {Function}
 */
function applyCollections(options, cm) {
  return function (updates) {
    if (!updates) {
      return Promise.resolve();
    }
    let worker = Promise.resolve();
    let props = cm.getPropertyMetas();
    props.forEach((prop) => {
      if (prop.type === PropertyTypes.COLLECTION && Array.isArray(updates[prop.name])) {
        worker = worker.then(() => options.dataRepo.put(updates._master, prop.name, updates[prop.name]));
      }
    });

    return worker.then(() => updates._master);
  };
}

function getPropertyName(nm, obj) {
  if (obj) {
    if (Object.values(obj).indexOf(nm) > -1) {
      for (let n in obj) {
        if (obj.hasOwnProperty(n) && obj[n] === nm) {
          return n;
        }
      }
    }
  }
  return nm;
}

/**
 * @param {{types: {}, keyProvider: KeyProvider, dataRepo: DataRepository}} options
 * @param {ClassMeta} cm
 * @param {{}} data
 * @return {Promise}
 */
function prepareFilter(options, cm, data) {
  let result = [];
  let fetchers = Promise.resolve();
  if (!data) {
    return Promise.resolve(null);
  }
  let obj = (options.types ? options.types[cm.getCanonicalName()] : {}) || {};
  try {
    Object.keys(data).forEach((nm) => {
      if (data.hasOwnProperty(nm)) {
        let pName = getPropertyName(nm, obj);
        let p = cm.getPropertyMeta(pName);
        if (p) {
          if (p.type === PropertyTypes.REFERENCE) {
            if (typeof data[nm] === 'object') {
              let rid = options.keyProvider.keyData(p._refClass, data[nm]);
              rid = options.dataRepo.wrap(p._refClass.getCanonicalName(), rid).getItemId();
              if (rid) {
                result.push({[F.EQUAL]: ['$' + pName, rid]});
              } else {
                fetchers = fetchers.then(() =>
                  options.dataRepo
                    .getList(p._refClass.getCanonicalName(), {filter: prepareFilter(options, p._refClass, data[nm])})
                    .then((list) => {
                      if (list.length) {
                        result.push({[F.EQUAL]: ['$' + pName, list[0].getItemId()]});
                      }
                    })
                );
              }
            }
          } else if (p.type !== PropertyTypes.COLLECTION) {
            result.push({[F.EQUAL]: ['$' + pName, data[nm]]});
          }
        }
      }
    });
  } catch (err) {
    return Promise.reject(err);
  }
  return fetchers.then(() => result.length === 1 ? result[0] : {[F.AND]: result});
}

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
 * @constructor
 */
function Crud(options) {
  EventManager.apply(this);
  var meta = null;

  /**
   * @param {ClassMeta} cm
   */
  function createTypes(cm) {
    let result = {};
    parseType(cm, result, true, options);
    result.File = {
      name: 'String',
      mime: 'String',
      body: 'Base64',
      url: 'String'
    };
    result.Result = {
      result: 'String'
    };
    result[cm.getName() + 'List'] = cm.getName() + '[]';
    result[cm.getName() + 'Query'] = {};
    result[cm.getName() + 'Query'][cm.getName()] = cm.getName();
    result[cm.getName() + 'Query'].offset = 'Integer';
    result[cm.getName() + 'Query'].count = 'Integer';
    result[cm.getName() + 'Query'].sort = cm.getName() + 'Sorting';
    result[cm.getName() + 'Query'].total = 'Boolean';
    return result;
  }

  this.getMeta = function () {
    if (!meta) {
      let cm = options.metaRepo.getMeta(options.className, null, options.namespace);
      meta = {
        types: createTypes(cm),
        messages: {
          data: [cm.getName()],
          query: [cm.getName() + 'Query'],
          list: [cm.getName() + 'List', {name: 'total', type: 'Integer'}],
          result: ['Result']
        },
        operations: {
          create: {
            input: 'data',
            output: 'data'
          },
          get: {
            input: 'data',
            output: 'data'
          },
          find: {
            input: 'query',
            output: 'list'
          },
          update: {
            input: 'data',
            output: 'data'
          },
          delete: {
            input: 'data',
            output: 'result'
          }
        }
      };
    }
    return meta;
  };

  this.create = function (data) {
    try {
      let cm = options.metaRepo.getMeta(options.className, null, options.namespace);
      return this.trigger({type: cm.getCanonicalName() + '.preCreate.soap', data: data})
        .then((event) => {
          let d = event.results && event.results[0] ? event.results[0] : data;
          return prepareUpdates(options, d, cm);
        })
        .then(updates =>
          options.dataRepo.createItem(cm.getCanonicalName(), updates.data)
            .then((result) => {
              updates.collections._master = result;
              return updates.collections;
            })
        )
        .then(applyCollections(options, cm))
        .then(result => options.dataRepo.getItem(cm.getCanonicalName(), result.getItemId()))
        .then(result => transformFiles(itemToSoap(result, options.types)));
    } catch (err) {
      return Promise.reject(err);
    }
  };

  this.update = function (data) {
    try {
      let cm = options.metaRepo.getMeta(options.className, null, options.namespace);
      let id = options.keyProvider.keyData(cm, data);
      if (!id) {
        throw new IonError(Errors.NO_ID);
      }
      id = options.dataRepo.wrap(cm.getCanonicalName(), id).getItemId();
      return this.trigger({type: cm.getCanonicalName() + '.preUpdate.soap', data: data}).then((event) => {
          let d = event.results && event.results[0] ? event.results[0] : data;
          return prepareUpdates(options, d, cm, id);
        })
        .then(updates => options.dataRepo.editItem(cm.getCanonicalName(), id, updates.data)
          .then((result) => {
            updates.collections._master = result;
            return updates.collections;
          })
        )
        .then(applyCollections(options, cm))
        .then(result => options.dataRepo.getItem(cm.getCanonicalName(), result.getItemId()))
        .then(result => transformFiles(itemToSoap(result, options.types)));
    } catch (err) {
      return Promise.reject(err);
    }
  };

  this.get = function (data) {
    try {
      let cm = options.metaRepo.getMeta(options.className, null, options.namespace);
      let id = options.keyProvider.keyData(cm, data);
      id = options.dataRepo.wrap(cm.getCanonicalName(), id).getItemId();
      if (!id) {
        return Promise.resolve(null);
      }
      return options.dataRepo.getItem(cm.getCanonicalName(), id)
        .then(result => transformFiles(itemToSoap(result, options.types)));
    } catch (err) {
      return Promise.reject(err);
    }
  };

  this.find = function (data) {
    try {
      let cm = options.metaRepo.getMeta(options.className, null, options.namespace);
      return prepareFilter(options, cm, data[cm.getName()])
        .then((f) => {
          let opts = {
            filter: f
          };
          if (data.offset) {
            opts.offset = data.offset;
          }
          if (data.count) {
            opts.count = data.count;
          }
          if (data.sort) {
            opts.sort = data.sort;
          }
          if (data.total) {
            opts.countTotal = data.total;
          }
          return options.dataRepo.getList(cm.getCanonicalName(), opts);
        }).then((result) => {
          let r = [];
          for (let i = 0; i < result.length; i++) {
            r.push(transformFiles(itemToSoap(result[i], options.types)));
          }
          r = [r];
          if (result.total) {
            r.push(result.total);
          }
          return r;
        });
    } catch (err) {
      return Promise.reject(err);
    }
  };

  this.delete = function (data) {
    try {
      let cm = options.metaRepo.getMeta(options.className, null, options.namespace);
      let id = options.keyProvider.keyData(cm, data);
      id = options.dataRepo.wrap(cm.getCanonicalName(), id).getItemId();
      if (!id) {
        throw new IonError(Errors.NO_ID);
      }
      return options.dataRepo.deleteItem(cm.getCanonicalName(), id)
        .then(() => {
          return {result: 'success'};
        });
    } catch (err) {
      return Promise.reject(err);
    }
  };
}

module.exports = Crud;

module.exports.prepareUpdates = prepareUpdates;
module.exports.applyCollections = applyCollections;
module.exports.prepareFilter = prepareFilter;

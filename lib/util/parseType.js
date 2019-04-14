/**
 * Created by kalias_90 on 10.05.18.
 */

const PropertyTypes = require('core/PropertyTypes');

/**
 * @param {ClassMeta} cm
 * @param {{}} types
 * @param {Boolean} addSorting
 * @param {{types: {}}} options
 */
function parseType(cm, types, addSorting, options) {
  if (!types.hasOwnProperty(cm.getName())) {
    let result = {};
    let sorting = {};
    types[cm.getName()] = result;
    if (addSorting) {
      types[cm.getName() + 'Sorting'] = sorting;
    }
    let props = cm.getPropertyMetas();
    let obj = (options.types ? options.types[cm.getCanonicalName()] : {}) || {};
    for (let i = 0; i < props.length; i++) {
      let name = props[i].name;
      if (typeof obj[name] === 'string') {
        name = obj[name];
      }
      if (name === '__class' || name === '__classTitle' || obj[name] === false) {
        continue;
      }
      if (addSorting) {
        sorting[name] = 'Integer';
      }
      switch (props[i].type) {
        case PropertyTypes.REFERENCE:
          parseType(props[i]._refClass, types, false, options);
          result[name] = props[i]._refClass.getName();
          break;
        case PropertyTypes.COLLECTION:
          parseType(props[i]._refClass, types, false, options);
          result[name] = props[i]._refClass.getName() + '[]';
          break;
        case PropertyTypes.DATETIME:
          result[name] = 'DateTime';
          break;
        case PropertyTypes.INT:
          result[name] = 'Integer';
          break;
        case PropertyTypes.REAL:
        case PropertyTypes.DECIMAL:
          result[name] = 'Float';
          break;
        case PropertyTypes.BOOLEAN:
          result[name] = 'Boolean';
          break;
        case PropertyTypes.FILE:
        case PropertyTypes.IMAGE:
          result[name] = 'File';
          break;
        case PropertyTypes.FILE_LIST:
          result[name] = 'File[]';
          break;
        default:
          result[name] = 'String';
          break;
      }
    }
  }
}

module.exports = parseType;
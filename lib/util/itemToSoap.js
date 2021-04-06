'use strict';

const { PropertyTypes } = require('@iondv/meta-model-contracts');
const{ data: { Item } } = require('@iondv/meta-model-contracts');
const { util: { normalize } } = require('@iondv/meta-model-contracts');

function itemToSoap(data, types) {
  types = types || {};
  if (Array.isArray(data)) {
    let result = [];
    for (let i = 0; i < data.length; i++) {
      result.push(itemToSoap(data[i], types));
    }
    return result;
  }

  if (data instanceof Item) {
    let cn = data.getClassName();
    if (!types[cn]) {
      return normalize(data, null, {greedy: true, skipSystemAttrs: true});
    }
    let item = {};
    let props = data.getProperties();
    let obj = types[cn] || {};

    for (let nm in props) {
      if (props.hasOwnProperty(nm) && obj[nm]) {
        let p = props[nm];
        if ((p.getName() === '__class' || p.getName() === '__classTitle' || obj[nm] === false)) {
          continue;
        }
        let pName = p.getName();
        if (typeof obj[nm] === 'string') {
          pName = obj[nm];
        }

        if (p.getType() === PropertyTypes.REFERENCE) {
          let refItem = data.getAggregate(p.getName());
          if (refItem && typeof item[p.getName()] === 'undefined') {
            item[pName] = itemToSoap(refItem, types);
          }
        } else if (p.getType() === PropertyTypes.COLLECTION) {
          if (typeof item[p.getName()] === 'undefined') {
            item[pName] = itemToSoap(data.getAggregates(p.getName()), types);
          }
        } else {
          item[pName] = p.getValue();
        }
      }
    }
    return item;
  }
  return null;
}

module.exports = itemToSoap;

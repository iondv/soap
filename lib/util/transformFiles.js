/**
 * Created by kalias_90 on 10.05.18.
 */

const StoredFile = require('core/interfaces/ResourceStorage/lib/StoredFile');

module.exports = function transformFiles(data) {
  for (let nm in data) {
    if (data.hasOwnProperty(nm)) {
      if (data[nm] instanceof StoredFile) {
        data[nm] = {
          name: data[nm].name,
          url: data[nm].link,
          mime: data[nm].options.mimeType
        };
      } else if (typeof data[nm] === 'object' && data[nm]) {
        transformFiles(data[nm]);
      }
    }
  }
  return data;
};

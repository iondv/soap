const path = require('path');
const ejs = require('ejs-locals');

function renderMessage(tplData) {
  return new Promise((resolve, reject) => {
    ejs(
      path.resolve(path.join(__dirname, '..', 'tpl'), 'message.ejs'),
      tplData,
      (err, msg) => {
        if (err) {
          return reject(err);
        }
        return resolve(msg);
      }
    );
  });
}

module.exports = renderMessage;

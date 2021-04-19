const cuid = require('cuid');
const pump = require('pump');
const Dom = require('xmldom').DOMParser;
const xpath = require('xpath');
const multipart = require('./multipart');
const { IonError } = require('@iondv/core');
const Errors = require('../../errors/backend-errors');
const buf = Buffer.from;

/**
* @param {String|Buffer|Stream} data
* @returns {Promise.<String>}
* @private
*/
function getContents(data) {
  return new Promise((resolve, reject) => {
    if (data && typeof data.pipe === 'function') {
      let result = buf([]);
      data
        .on('data', (chunk) => {
          result = Buffer.concat([result, chunk]);
        })
        .on('end', () => resolve(result.toString()))
        .on('error', reject);
    } else if (Buffer.isBuffer(data)) {
      return resolve(data.toString());
    } else {
      return resolve(data);
    }
  });
}

/**
* @param {{id: String, encoding: String, name: String, contentType: String, body: String}[]} parts
* @param {String} boundary
* @returns {String}
* @private
*/
function buildMultipart(parts, boundary) {
  let result = '';
  if (Array.isArray(parts) && parts.length > 0) {
    const mimeBoundary = `--${boundary}\r\n`;
    parts.forEach((part) => {
      result += mimeBoundary;
      result += `Content-ID: <${part.id}>\r\n`;
      result += `Content-Transfer-Encoding: ${part.encoding}\r\n`;
      if (part.attachment) {
        result += `Content-Disposition: attachment; name="${part.name}"\r\n`;
      }
      result += `Content-Type: ${part.contentType}\r\n\r\n`;
      result += part.body;
      result += '\r\n';
    });
    result += `--${boundary}--`;
  }
  return result;
}

/**
* @param {String} xmlMessage
* @param {{name: String, xpath: String, contetType: String, content: String|Buffer|Stream}[]} files
* @param {{}} [options]
* @param {String} [options.action]
* @param {String} [options.boundary]
* @param {String} [options.contentType]
* @returns {Promise.<{message: String, contentType: String}>}
* @public
*/
function convert(xmlMessage, files, options) {
  options = options || {};
  const boundary = options.boundary || `bnd${cuid()}`;
  const contentType = options.contentType || 'text/xml';

  let resultContentType = 'multipart/related;';
  resultContentType += 'type="application/xop+xml";';
  resultContentType += 'start="<part0>";';
  resultContentType += `boundary="${boundary}";`;
  resultContentType += `start-info="${contentType}"`;
  if (options.action) {
    resultContentType += `;action="${options.action}"`;
  }

  const parts = [{
    id: 'part0',
    contentType: `application/xop+xml;charset=utf-8;type="${contentType}"`,
    encoding: '8bit'
  }];

  const dom = new Dom();
  let doc;
  try {
    doc = dom.parseFromString(xmlMessage);
  } catch (err) {
    return Promise.reject(new IonError(null, {}, err));
  }

  let filePromises = Promise.resolve();

  if (Array.isArray(files) && files.length > 0) {
    files.forEach((file, i) => {
      if (!file || !file.xpath) {
        return;
      }

      const selection = xpath.select(file.xpath, doc)[0];
      if (!selection) {
        return;
      }

      const id = `part${i + 1}`;
      if (selection.firstChild) {
        selection.removeChild(selection.firstChild);
      }
      selection.appendChild(doc.createElement('xop:Include'));
      selection.firstChild.setAttribute('xmlns:xop', 'http://www.w3.org/2004/08/xop/include');
      selection.firstChild.setAttribute('href', `cid:${id}`);

      filePromises = filePromises.then(() => getContents(file.content))
        .then((content) => {
          parts.push({
            id,
            name: file.name || id,
            contentType: file.contentType || 'application/octet-stream',
            body: content,
            encoding: 'binary',
            attachment: true
          });
        });
    });
  }

  parts[0].body = doc.toString();

  return filePromises
    .then(() => buildMultipart(parts, boundary))
    .then((msg) => {
      return {message: msg, contentType: resultContentType};
    });
}

exports.convert = convert;

/**
* @param {Request|Response} ctx
* @param {Function} cb
* @private
*/
function parse(ctx, cb) {
  let body = '';
  let files = {};

  let contentType = ctx.headers['content-type'];
  let match = contentType.match(/;\s*boundary="?([^";]+)"?;?/i);

  let stream = multipart(ctx.headers, {boundary: match[1]}, (name, part) => {
    if (!part.isAttachment) {
      part.on('data', (chunk) => {
        body = body + chunk.toString('utf-8');
      });
    } else {
      let cid = part.contentId.substring(1, part.contentId.length - 1);
      files[cid] = {
        fileName: part.fileName,
        contents: buf([])
      };
      part.on('data', (chunk) => {
        files[cid].contents = Buffer.concat([files[cid].contents, chunk]);
      });
    }
  });

  pump(ctx, stream, (err) => {
    if (err) {
      return cb(err);
    }
    if (body) {
      return cb(null, {body, files});
    }
    cb(new IonError(Errors.EMPTY_SOAP_MSG));
  });
}

/**
* @param {Request|Response} ctx
* @param {Function} [cb]
* @returns {Promise|undefined}
* @public
*/
exports.parse = function (ctx, cb) {
  if (typeof cb !== 'function') {
    return new Promise((resolve, reject) => {
      parse(ctx, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      });
    });
  }
  return parse(ctx, cb);
};

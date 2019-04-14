'use strict';
const assert = require('assert');
const xtend = require('xtend');
const pez = require('./pez');

module.exports = downloadMultipart;

// Download a multipart request
// (obj, [obj], fn) -> transformStream
function downloadMultipart(headers, opts, handle) {
  if (!handle) {
    handle = opts;
    opts = {};
  }

  assert.equal(typeof headers, 'object', 'multipart-stream: headers should be an object');
  assert.equal(typeof opts, 'object', 'multipart-stream: opts should be an object');
  assert.equal(typeof handle, 'function', 'multipart-stream: handle should be a function');

  let match = headers['content-type'].match(/^([^/\s]+\/[^\s;]+);?/i);
  let mime = match[1];
  match = headers['content-type'].match(/;\s*boundary="?([^";]+)"?;?/i);
  let boundary = match[1];

  opts = xtend({mime, boundary}, opts);
  let dispenser = new pez.Dispenser(opts);

  dispenser.on('part', function (part) {
    let encoding = part.headers['content-transfer-encoding'];
    encoding = (encoding) ? encoding.toLowerCase() : '7bit';

    handle(part.name, part, part.filename, encoding, part.headers['content-type']);
  });

  return dispenser;
}

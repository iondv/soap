const {parseString} = require('xml2js');
const {readFile} = require('core/util/read');
const {xmlParse} = require('xslt-processor');
const xslt = require('xslt-processor').xsltProcess;

/**
 * @param {String} xml
 * @returns {Promise}
 */
function xml2json(xml) {
  return new Promise((resolve, reject) => {
    parseString(xml, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

exports.xml2json = xml2json;

/**
 * @param {String} xmlString
 * @param {String} xsltPath
 * @returns {Promise}
 */
function xsltProcess(xmlString, xsltPath) {
  return readFile(xsltPath)
    .then((xsltString) => {
      const xmls = xmlParse(xmlString);
      const xslts = xmlParse(xsltString);
      return xslt(xmls, xslts);
    });
}

exports.xsltProcess = xsltProcess;

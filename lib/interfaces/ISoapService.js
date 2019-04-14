/**
 * @constructor
 */
function ISoapService() {
  /*
   * @param {{}} req
   * @param {{}} res
   * @returns {Promise}
   */
  this.getWsdl = function (req, res) {
    return this._getWsdl(req, res);
  };

  /*
   * @param {{}} req
   * @param {{}} res
   * @returns {Promise}
   */
  this.response = function (req, res) {
    return this._response(req, res);
  };

}

module.exports = ISoapService;

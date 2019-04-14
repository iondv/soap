/**
 * @constructor
 */
function ISoapClient() {

  /**
   * @param {String} name
   * @returns {{}}
   */
  this.service = function (name) {
    return this._service(name);
  };

}

module.exports = ISoapClient;

'use strict';

var Fines = require('../fines/controller'),
    Token = require('../libs/tokens');

module.exports = function (app) {

    app.route('/fines')
        .get(Token.verify, Fines.getFineInfo)
        .post(Token.verify, Fines.payForm);

    app.route('/pay')
        .get(Token.verify, Fines.makePayment)
        .post(Token.verify, Fines.makePayment);

    app.route('/api/status/:api')
        .post(Fines.apiStatus);
};
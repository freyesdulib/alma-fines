'use strict';

var _ = require('lodash'),
    Async = require('async'),
    cc = require('../libs/validatecc'),
    Email = require('../libs/email'),
    moment = require('moment'),
    config = require('../config/config'),
    Service = require('../fines/service'),
    Model = require('../fines/model'),
    logger = require('../libs/log4');

exports.getFineInfo = function (req, res) {

    var idhash = req.query.id,
        token = req.query.t,
        id = new Buffer(idhash, 'base64').toString('ascii');

    Async.waterfall([

        function (callback) {

            Service.getUser(id, function (data) {

                if (data.success !== undefined && data.success === false) {

                    logger.module().debug('ERROR: Unable to get user information.');

                    return res.render('error', {
                        message: data.message
                    });

                } else {
                    callback(false, data);
                }

            });
        },
        function (user, callback) {

            Service.getFines(id, function (data) {

                var userFines = {};

                if (data.success !== undefined && data.success === false) {

                    logger.module().debug('ERROR: Unable to get user fines.');

                    return res.render('error', {
                        message: data.message
                    });

                } else if (data === false) {

                    userFines.user = user;
                    userFines.fines = data;
                    callback(false, userFines);

                } else {

                    userFines.user = user;
                    userFines.fines = data;
                    callback(false, userFines);
                }
            });
        },
        function (userFines) {

            var data = {},
                fines = [];

            data.id = idhash;
            data.token = token;
            data.primaryId = userFines.user.primaryId;
            data.firstName = userFines.user.firstName;
            data.middleName = userFines.user.middleName;
            data.lastName = userFines.user.lastName;
            data.email = userFines.user.email;
            data.url = config.primoUrl;

            if (userFines.fines === false) {
                data.fineTotal = 0;
                data.fines = fines;
            } else {
                data.fineTotal = userFines.fines.fineTotal;
                data.fines = userFines.fines.fineInfo;
            }

            res.render('fines', data);
        }
    ]);
};

exports.payForm = function (req, res) {

    if (!_.isEmpty(req.body)) {

        var idhash = req.query.id,
            token = req.query.t,
            fines = req.body;

        res.render('pay', {
            id: idhash,
            token: token,
            fines: fines,
            errors: ''
        });

    } else {
        res.renderStatic('session', {
            url: config.primoUrl
        });
    }
};

exports.makePayment = function (req, res) {

    if (_.isEmpty(req.body)) {
        logger.module().debug('Error: A POST request without CC data has been sent.');
        return res.renderStatic('error');
    }

    var idhash = req.query.id,
        token = req.query.t,
        id = new Buffer(idhash, 'base64').toString('ascii'),
        result = cc.validate(req.body);

    // validate form
    if (result.isValid === false) {

        logger.module().debug('INFO: Form validation errors generated.');

        res.render('pay', {
            id: idhash,
            token: token,
            fines: req.body,
            errors: result.errors
        });

        return false;
    }

    var payment = req.body,
        fines = {},
        prop;

    for (prop in payment) {
        if (!isNaN(prop)) {
            fines[prop] = payment[prop];
        }
    }

    payment.fines = fines;

    /* Payment to authorize.net occurs here */
    function payFines(callback) {

        Service.payFines(payment, function (transactionResult) {

            if (transactionResult.result_code === 'Ok' && transactionResult.auth_code !== '000000') {
                logger.module().debug('INFO: Authorize.net payment successful.');
                callback(false, transactionResult);
                return false;
            } else {
                logger.module().debug('ERROR: An unknown transaction error has occurred while making request to authorize.net.');
                callback(false, transactionResult);
                return false;
            }
        });
    }

    function saveTransactionInfo (data, callback) {

        /* collect response from authorize.net and save to local DB */
        var username = payment.email.split('@');

        data.uid = id;
        data.token = token;
        data.username = username[0];

        Model.save(data, function (result) {
            data.saved = result;
            callback(false, data);
            return false;
        });
    }

    function closeAlmaFines (data, callback) {

        if (data.result_code !== 'Ok' || data.auth_code === '000000') {
            logger.module().debug('ERROR: Transaction error: payment not made. Fines will not be closed in Alma');
            Model.update(data);
            data.alma_fine_closed = false;
            callback(false, data);
            return false;
        } else {

            // close out fines in Alma
            var fineArr = [];
            var fines = JSON.parse(data.fines);

            for (var prop in fines) {
                var fineObj = {};
                fineObj.alma_fine_id = prop;
                fineObj.alma_fine_amount = fines[prop];
                fineObj.uid = data.uid;
                fineObj.trans_id = data.trans_id;
                fineArr.push(fineObj);
            }

            // throttle api calls
            var timer = setInterval(function () {

                if (fineArr.length === 0) {
                    clearInterval(timer);
                    Model.update(data);
                    callback(false, data);
                    return false;
                }

                var fine = fineArr.pop();

                Service.closeAlmaFines(fine, function (result) {

                    if (result.success !== undefined && result.success.error === true || result.fee.status === undefined) {
                        logger.module().debug('ERROR: User: ' + data.uid + ' Alma Error: ' + result);
                        return false;
                    }

                    if (result.fee.status[0]._ === 'CLOSED') {
                        logger.module().debug('INFO: User: ' + data.uid + ' Alma fine id: ' + result.fee.id[0] + ' - (' + result.fee.status[0]._ + ')');
                    } else {
                        logger.module().debug('ERROR: User: ' + data.uid + ' Alma fine id: ' + result.fee.id[0] + ' - Unable to close fine');
                    }
                });

            }, 250);
        }
    }

    Async.waterfall([
        payFines,
        saveTransactionInfo,
        closeAlmaFines
    ], function (error, data) {

        if (error) {
            logger.module().debug('ERROR: async : ' + error);
            throw error;
        }

        logger.module().debug('INFO: Payment proccess complete. Result = ' + data.result_code);

        /*  TODO: unable to send email via DU mail server
        var reciept = {};
        reciept.id = data.uid;
        reciept.username = data.username;
        reciept.fines = JSON.parse(data.fines);
        reciept.amount = data.amount_paid;
        reciept.transid = data.trans_id;
        reciept.account = data.account_type + ' ' + data.account_number;
        reciept.code = data.result_code;
        reciept.date = moment(data.time_stamp).format('MMMM Do YYYY, h:mm:ss');

        try {
            Email.sendEmail(reciept);
        } catch (e) {
            logger.module().debug('ERROR: ' + e);
        }
        */

    });
};

exports.status = function (req, res) {

    var token = req.query.t,
        uid = new Buffer(req.query.uid, 'base64').toString('ascii');

    Model.get(token, uid, function (data) {

        res.status(200).send({
            content_type: {'Content-Type': 'application/json'},
            status: data[0].status,
            result_code: data[0].result_code,
            amount_paid: data[0].amount_paid,
            message: 'payment status.'
        });
    });
};

exports.apiStatus = function (req, res) {

    var api = req.params.api;

    Service.apiStatus(api, function (response) {
        if (response === 200) {
            res.sendStatus(response);
        } else {
            res.sendStatus(response);
        }
    });
};
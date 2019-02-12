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

            if (transactionResult.result_code === 'Ok' && transactionResult.response_code == '1') { // approved
                logger.module().debug('INFO: Authorize.net payment successful.');
                transactionResult.status = 1;
                callback(false, transactionResult);
                return false;
            } else if (transactionResult.response_code == '2') { // declined
                logger.module().debug('ERROR: CC has been declined');
                transactionResult.amount_paid = '0.00';
                transactionResult.status = 0;
                callback(false, transactionResult);
                return false;
            } else if (transactionResult.response_code == '3') {  // error
                logger.module().debug('ERROR: An unknown transaction error occurred.');
                transactionResult.amount_paid = '0.00';
                transactionResult.status = 0;
                callback(false, transactionResult);
                return false;
            } else if (transactionResult.response_code == '4') {  // held for review
                logger.module().debug('INFO: CC transaction held for review.');
                transactionResult.amount_paid = '0.00';
                transactionResult.status = 0;
                callback(false, transactionResult);
                return false;
            }
        });
    }

    function saveUserInfo (data, callback) {

        /* collect response from authorize.net and save to local DB */
        var username = payment.email.split('@');

        data.uid = id;
        data.token = token;
        data.username = username[0];
        callback(false, data);

    }

    function closeAlmaFines (data, callback) {

        if (data.response_code !== '1' && data.error_message !== undefined) {

            logger.module().debug('ERROR: Transaction error: payment not made. Fines will not be closed in Alma');
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

            }, 300);
        }
    }

    Async.waterfall([
        payFines,
        saveUserInfo,
        closeAlmaFines
    ], function (error, data) {

        if (error) {
            logger.module().debug('ERROR: async : ' + error);
            throw error;
        }

        var id = new Buffer(data.uid).toString('base64'),
            t = data.token,
            status = data.status;

        Model.save(data, function (result) {
            logger.module().debug('INFO: Payment proccess complete. Result = ' + data.result_code);
            res.redirect('/fines?t=' + t + '&id=' + id + '&status=' + status);
            return false;
        });

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
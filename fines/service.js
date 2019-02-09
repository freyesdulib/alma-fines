'use strict';

var request = require('request'),
    xml2js = require('xml2js'),
    moment = require('moment'),
    authorize = require('../libs/authorizenet'),
    logger = require('../libs/log4'),
    config = require('../config/config'),
    parser = new xml2js.Parser();

exports.getUser = function (id, callback) {

    var url = config.almaApiUrl + '/users/' + encodeURIComponent(id) + '?';
    url += encodeURIComponent('user_id_type') + '=' + encodeURIComponent('all_unique') + '&';
    url += encodeURIComponent('view') + '=' + encodeURIComponent('full') + '&';
    url += encodeURIComponent('expand') + '=' + encodeURIComponent('none') + '&';
    url += encodeURIComponent('apikey') + '=' + encodeURIComponent(config.almaApiKey);

    request({
        url: url,
        method: 'GET'
    }, function (err, response, xml) {

        if (err) {

            logger.module().debug('ERROR: Unable to get user information. ' + err);

            var errorObj = {
                status: 500,
                success: false,
                message: 'There was a problem retrieving user information.'
            };

            callback(errorObj);
        }

        if (response.statusCode === 200) {

            var userObj = {};
            parser.parseString(xml, function (err, json) {

                if (err) {
                    logger.module().debug('ERROR: Unable to get user information. ' + err);
                    callback(err);
                }

                userObj.primaryId = json.user.primary_id[0];
                userObj.firstName = json.user.first_name[0];
                userObj.middleName = json.user.middle_name[0];
                userObj.lastName = json.user.last_name[0];
                userObj.email = json.user.contact_info[0].emails[0].email[0].email_address[0];
            });

            callback(userObj);

        } else {

            logger.module().debug('ERROR: Unable to get user information.');

            var apiErrorObj = {
                status: 400,
                success: false,
                message: 'Unable to get user information.'
            };

            callback(apiErrorObj);
        }
    });
};

exports.getFines = function (id, callback) {

    var url = config.almaApiUrl + '/users/' + encodeURIComponent(id) + '/fees?';
    url += encodeURIComponent('user_id_type') + '=' + encodeURIComponent('all_unique') + '&';
    url += encodeURIComponent('status') + '=' + encodeURIComponent('ACTIVE') + '&';
    url += encodeURIComponent('apikey') + '=' + encodeURIComponent(config.almaApiKey);

    request({
        url: url,
        method: 'GET'
    }, function (err, response, xml) {

        if (err) {

            logger.module().debug('ERROR: There was a problem retrieving fine information.' + err);

            var errorObj = {
                status: 500,
                success: false,
                message: 'There was a problem retrieving fine information.'
            };

            callback(errorObj);
        }

        if (response.statusCode === 200) {

            var fineObj = {};

            parser.parseString(xml, function (err, json) {

                if (err) {
                    logger.module().debug('ERROR: Unable to parse XML response from Alma.');
                    callback(err);
                }

                if (json.fees.$.total_record_count === '0') {
                    callback(false);
                    return;
                }

                var fineInfo = {},
                    finesArr = [];

                fineObj.fineTotal = parseFloat(json.fees.$.total_sum).toFixed(2);

                json.fees.fee.forEach(function (value) {

                    if (value.title !== undefined) {
                        var title = value.title[0];
                    }

                    if (value.barcode !== undefined) {
                        var barcode = value.barcode[0]._;
                    }

                    fineInfo.feeid = value.id[0];
                    fineInfo.date = moment(value.creation_time[0]).format('MM/DD/YYYY');
                    fineInfo.title = title;
                    fineInfo.barcode = barcode;
                    fineInfo.type = value.type[0].$.desc;
                    fineInfo.status = value.status[0].$.desc;
                    fineInfo.balance = parseFloat(value.balance[0]).toFixed(2);
                    finesArr.push(fineInfo);
                    fineInfo = {};
                });

                fineObj.fineInfo = finesArr;
                finesArr = [];
                callback(fineObj);
            });

        } else {

            logger.module().debug('ERROR: Unable to get user information.');

            var apiErrorObj = {
                status: 400,
                success: false,
                message: 'There was a problem retrieving fine information.'
            };

            callback(apiErrorObj);
        }
    });
};

exports.payFines = function (payment, callback) {

    authorize.authCaptureTransaction(payment, function (transactionObj) {
        logger.module().debug('INFO: Authorize and Capture request made to authorize.net.');
        callback(transactionObj);
    });
};

exports.closeAlmaFines = function (fine, callback) {

    var ALMA_API_KEY = process.env.ALMA_API_KEY;
    var ALMA_API_URL = process.env.ALMA_API_URL;
    var url = ALMA_API_URL + '/users/' + encodeURIComponent(fine.uid) + '/fees/' + fine.alma_fine_id + '?';
    url += encodeURIComponent('user_id_type') + '=' + encodeURIComponent('all_unique') + '&';
    url += encodeURIComponent('op') + '=' + encodeURIComponent('pay') + '&';
    url += encodeURIComponent('amount') + '=' + encodeURIComponent(fine.alma_fine_amount) + '&';
    url += encodeURIComponent('method') + '=' + encodeURIComponent('ONLINE') + '&';
    url += encodeURIComponent('external_transaction_id') + '=' + encodeURIComponent(fine.trans_id) + '&';
    url += encodeURIComponent('apikey') + '=' + encodeURIComponent(ALMA_API_KEY);

    request({
        url: url,
        headers: {'Content-Type': 'application/xml'},
        method: 'POST'
    }, function (err, response, xml) {

        if (err) {

            logger.module().debug('ERROR: Request error when attempting to close Alma fine. ' + err);

            var errorObj = {
                status: 500,
                success: false,
                message: 'There was a problem retrieving ILS payment information.'
            };

            callback(errorObj);
        }

        if (response.statusCode === 200) {

            parser.parseString(xml, function (err, json) {

                if (err) {
                    logger.module().debug('ERROR: Unable to parse XML containing Alma fines info. ' + err);
                    callback(err);
                    return false;
                }

                callback(json);
            });

        } else {

            logger.module().debug('ERROR: Unable to close Alma fine.');

            var apiErrorObj = {
                status: 400,
                success: false,
                message: 'Unable to close Alma fine.',
                error: xml
            };

            callback(apiErrorObj);
        }
    });
};

exports.apiStatus = function (api, callback) {

    if (api === 'alma') {

        var url = config.almaApiUrl + '/users/operation/test?';
        url += encodeURIComponent('apikey') + '=' + encodeURIComponent(config.almaApiKey);

        request({
            url: url,
            method: 'GET'
        }, function (err, response, xml) {

            if (err) {
                logger.module().debug('ERROR: Unable to ping Alma.');
                callback(500);
            }

            if (response.statusCode === 200) {
                callback(response.statusCode);
            } else {
                callback(400);
            }
        });

    } else if (api === 'authorize') {

        var transactionRequest = '';
            transactionRequest += '<authenticateTestRequest xmlns="AnetApi/xml/v1/schema/AnetApiSchema.xsd">';
            transactionRequest += '<merchantAuthentication>';
            transactionRequest += '<name>' + config.authorizeNetId + '</name>';
            transactionRequest += '<transactionKey>' + config.authorizeNetKey + '</transactionKey>';
            transactionRequest += '</merchantAuthentication>';
            transactionRequest += '</authenticateTestRequest>';

        request.post({
                url: config.authorizeNetApiUrl,
                body : transactionRequest,
                headers: {
                    'Content-Type': 'text/xml'
                }
            },
            function (err, response, xml) {

                if (err) {
                    logger.module().debug('ERROR: Unable to ping Authorize.net.');
                    callback(500);
                }

                parser.parseString(xml, function (err, json) {

                    if (err) {
                        logger.module().debug('ERROR: Unable to parse Authorize.net XML response.');
                        callback(500);
                    }

                    if (json.html !== undefined) {
                        logger.module().debug('ERROR: Authorize.net XML response error.');
                        callback(500);
                        return false;
                    } else {
                        if (json.authenticateTestResponse.messages[0].resultCode[0] !== undefined && json.authenticateTestResponse.messages[0].resultCode[0] === 'Ok') {
                            callback(200);
                        } else {
                            logger.module().debug('ERROR: Authorize.net XML response error.');
                            callback(500);
                        }
                    }
                });
            }
        );
    }
};
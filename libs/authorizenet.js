var request = require('request'),
    xml2js = require('xml2js'),
    config = require('../config/config'),
    logger = require('../libs/log4'),
    parser = new xml2js.Parser();

exports.authCaptureTransaction = function (payment, callback) {

    var transactionRequest = constructTransaction(payment);

    request.post(
        {url: config.authorizeNetApiUrl,
            body : transactionRequest,
            headers: {'Content-Type': 'text/xml'}
        },
        function (err, response, xml) {

            if (err) {

                logger.module().debug('ERROR: request to authorize.net failed. ' + err);

                var xmlErrorObj = {
                    status: 500,
                    success: false,
                    message: err
                };

                callback(xmlErrorObj);
            }

            parser.parseString(xml, function (err, json) {

                if (err) {

                    logger.module().debug('ERROR: unable to parse authorize.net XML response. ' + err);

                    var jsonErrorObj = {
                        status: 500,
                        success: false,
                        message: err
                    };

                    callback(jsonErrorObj);
                }

                if (json.html !== undefined) {

                    logger.module().debug('ERROR: authorize.net response is not XML.');

                    var htmlErrorObj = {
                        status: 500,
                        success: false,
                        message: 'ERROR: authorize.net response is not XML.'
                    };

                    callback(htmlErrorObj);
                    return false;
                }

                var transactionObj = {};
                transactionObj.result_code = json.createTransactionResponse.messages[0].resultCode[0];
                transactionObj.response_code = json.createTransactionResponse.transactionResponse[0].responseCode[0];
                transactionObj.fines = JSON.stringify(payment.fines);
                transactionObj.amount_paid = payment.fineTotal;

                if (transactionObj.result_code === 'Ok' && transactionObj.response_code === '1') {

                    transactionObj.ref_id = json.createTransactionResponse.refId[0];

                    json.createTransactionResponse.transactionResponse.forEach(function (field) {
                        transactionObj.auth_code = field.authCode[0];
                        transactionObj.trans_id = field.transId[0];
                        transactionObj.trans_hash = field.transHash[0];
                        transactionObj.account_number = field.accountNumber[0];
                        transactionObj.account_type = field.accountType[0];
                    });

                    callback(transactionObj);

                } else if (transactionObj.result_code === 'Error' || transactionObj.response_code !== '1') {

                    transactionObj.error_message =  json.createTransactionResponse.transactionResponse[0].errors[0].error[0].errorText[0];

                    json.createTransactionResponse.transactionResponse.forEach(function (field) {
                        transactionObj.auth_code = field.authCode[0];
                        transactionObj.trans_id = field.transId[0];
                        transactionObj.trans_hash = field.transHash[0];
                        transactionObj.account_number = field.accountNumber[0];
                        transactionObj.account_type = field.accountType[0];
                    });

                    callback(transactionObj);

                } else {

                    logger.module().debug('ERROR: authorize.net unknown error occurred.');

                    var apiErrorObj = {
                        status: 500,
                        success: false,
                        message: 'ERROR: authorize.net unknown error occurred.'
                    };

                    callback(apiErrorObj);
                }
            });
        }
    );
};

var merchantAuthentication = function () {

    var merchantAuthentication = '<merchantAuthentication>';
    merchantAuthentication += '<name>' + config.authorizeNetId + '</name>';
    merchantAuthentication += '<transactionKey>' + config.authorizeNetKey + '</transactionKey>';
    merchantAuthentication += '</merchantAuthentication>';
    return merchantAuthentication;
};

var constructTransaction = function (payment) {

    var transactionRequest = '<createTransactionRequest xmlns="AnetApi/xml/v1/schema/AnetApiSchema.xsd">';
    transactionRequest += merchantAuthentication();
    transactionRequest += '<refId>dulib-' + Math.round((new Date()).getTime() / 1000) + '</refId>';
    transactionRequest += '<transactionRequest>';
    transactionRequest += '<transactionType>authCaptureTransaction</transactionType>';
    transactionRequest += '<amount>' + payment.fineTotal + '</amount>';
    transactionRequest += '<payment>';
    transactionRequest += '<creditCard>';
    transactionRequest += '<cardNumber>' + payment.cardNumber + '</cardNumber>';
    transactionRequest += '<expirationDate>' + payment.expiryMonth + payment.expiryYear + '</expirationDate>';
    transactionRequest += '<cardCode>' + payment.cvv + '</cardCode>';
    transactionRequest += '</creditCard>';
    transactionRequest += '</payment>';
    transactionRequest += '<billTo>';
    transactionRequest += '<firstName>' + payment.firstName + '</firstName>';
    transactionRequest += '<lastName>' + payment.lastName + '</lastName>';
    transactionRequest += '<address>' + payment.address + '</address>';
    transactionRequest += '<city>' + payment.city + '</city>';
    transactionRequest += '<state>' + payment.state + '</state>';
    transactionRequest += '<zip>' + payment.zip + '</zip>';
    transactionRequest += '</billTo>';
    transactionRequest += '</transactionRequest>';
    transactionRequest += '</createTransactionRequest>';

    return transactionRequest;
};

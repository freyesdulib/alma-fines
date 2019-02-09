'use strict';

var validator = require('validator');

exports.validate = function (paymentInfo) {

    var payment = {};
    payment.firstName = validator.trim(paymentInfo.firstName);
    payment.lastName = validator.trim(paymentInfo.lastName);
    payment.address = validator.trim(paymentInfo.address);
    payment.city = validator.trim(paymentInfo.city);
    payment.state = validator.trim(paymentInfo.state);
    payment.zip = validator.trim(paymentInfo.zip);
    payment.email = validator.trim(paymentInfo.email);
    payment.cardNumber = validator.trim(paymentInfo.cardNumber);
    payment.expiryMonth = validator.trim(paymentInfo.expiryMonth);
    payment.expiryYear = validator.trim(paymentInfo.expiryYear);
    payment.cvv = validator.trim(paymentInfo.cvv);
    payment.fineTotal = validator.trim(paymentInfo.fineTotal);

    var errors = {},
        errorObj = {},
        isValid = true;

    // check if field is empty
    for (var prop in payment) {
        if (payment[prop].length === 0) {
            errors[prop] = {'message': [prop + ' is required.']};
            isValid = false;
        }
    }

    // check if field is numeric
    for (var prop in payment) {
        if (prop === 'cardNumber' || prop === 'expiryMonth' || prop === 'expiryYear' || prop === 'cvv') {
            if (!validator.isNumeric(payment[prop])) {
                errors[prop] = {'message': [prop + ' requires a numeric value.']};
                isValid = false;
            }
        }
    }

    // check for valid email
    if (!validator.isEmail(payment.email)) {
        errors.email = {'message': ['a valid email address is required.']};
        isValid = false;
    }

    if (isValid === false) {
        errorObj.errors = errors;
        errorObj.isValid = false;
    } else {
        errorObj.isValid = true;
    }

    return errorObj;
};
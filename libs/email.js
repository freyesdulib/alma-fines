'use strict';

var nodemailer = require('nodemailer'),
    config = require('../config/config'),
    logger = require('../libs/log4');

exports.sendEmail = function (paymentInfo) {

    var message = '',
        transporter,
        mailOptions;

    message += '========= GENERAL INFORMATION =========\r\n';
    message += 'Merchant : DU - LIBRARIES\r\n';
    message += 'Date/Time : ' + paymentInfo.date + '\r\n';
    message += '========= ORDER INFORMATION =========\r\n';
    message += 'Description : Fines & Fees\r\n';
    message += 'Amount : $' + paymentInfo.amount + '\r\n';
    message += 'Payment Method: ' + paymentInfo.account + '\r\n';
    message += 'Transaction ID: ' + paymentInfo.transid + '\r\n';
    message += '\r\n\r\n\r\nUniversity of Denver - University Libraries';

    transporter = nodemailer.createTransport('smtp://' + config.smtp);

    mailOptions = {
        from: config.fromEmail,
        to: paymentInfo.username + '@du.edu',
        subject: config.emailSubject,
        text: message
    };

    transporter.sendMail(mailOptions, function (err, info) {

        if (err) {
            logger.module().debug('ERROR: Unable to send email. ' + err);
        }

        logger.module().debug('Message sent: ' + info.response);
    });
};
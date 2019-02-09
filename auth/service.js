'use strict';

var request = require('request'),
    config = require('../config/config'),
    logger = require('../libs/log4');

exports.authenticate = function (username, password, callback) {

    request.post({
            url: config.ldap, form: {
                username: username,
                password: password
            }
        },
        function (err, headers, response) {

            if (err) {

                logger.module().debug('ERROR: Unable authenticate user.');

                var errorObj = {
                    status: 500,
                    success: false,
                    message: 'ERROR: Unable authenticate user.'
                };

                callback(errorObj);
            }

            var responseObj = JSON.parse(response);
            callback(responseObj);
        });
};


exports.almaAuthenticate = function (username, password, callback) {

    var url = config.almaApiUrl + '/users/' + encodeURIComponent(username) + '?';
    url += encodeURIComponent('user_id_type') + '=' + encodeURIComponent('all_unique') + '&';
    url += encodeURIComponent('op') + '=' + encodeURIComponent('auth') + '&';
    url += encodeURIComponent('password') + '=' + encodeURIComponent(password) + '&';
    url += encodeURIComponent('apikey') + '=' + encodeURIComponent(config.almaApiKey);

    request({
        url: url,
        headers: {'Content-Type': 'application/xml'},
        method: 'POST'
    }, function (err, response, xml) {

        if (err) {

            logger.module().debug('ERROR: Unable to authenticate user via Alma. ' + err);

            var errorObj = {
                status: 500,
                success: false,
                message: 'ERROR: Unable to authenticate user via Alma. ' + err
            };

            callback(errorObj);
        }

        if (response.statusCode === 204) {
            callback({auth: true});
        } else {
            callback({auth: false});
        }
    });
};

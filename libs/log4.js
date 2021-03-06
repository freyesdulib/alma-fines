'use strict';

var log4js = require('log4js');

log4js.configure({
    appenders: {
        out: { type: 'stdout' },
        app: { type: 'dateFile', filename: './logs/fines.log', compress: true }
    },
    categories: {
        default: { appenders: [ 'out', 'app' ], level: 'debug' }
    }
});

exports.module = function () {
    return log4js.getLogger();
};
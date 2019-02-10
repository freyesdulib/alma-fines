var db = require('../config/db')(),
    logger = require('../libs/log4');

exports.save = function (transaction, callback) {

    db('transactions')
        .insert(transaction)
        .then(function (data) {
            callback(true);
            return null;
        })
        .catch(function (err) {
            logger.module().debug('ERROR: (database error) Unable to save ' + transaction.trans_id + ' transaction data.');
            callback(false);
        });
};
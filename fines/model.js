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

exports.update = function (data) {

    db('transactions')
        .where({
            uid: data.uid,
            trans_hash: data.trans_hash,
            token: data.token
        })
        .update({
            status: 1
        })
        .then(function (data) {
            return null;
        })
        .catch(function (error) {
            logger.module().debug('ERROR: (database error) Unable to update transaction status. ' + error);
            throw error;
        });
};

exports.get = function (token, uid, callback) {

    db('transactions')
        .where({
            token: token,
            uid: uid,
            status: 1
        })
        .whereRaw('DATE(time_stamp) = CURRENT_DATE')
        .orderBy('time_stamp', 'desc')
        .limit(1)
        .select('*')
        .then(function (data) {
            callback(data);
            return null;
        })
        .catch(function (err) {
            logger.module().debug('ERROR: (database error) Unable to retrieve transaction data.');
            callback(err);
        });
};
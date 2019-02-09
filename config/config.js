'use strict';

module.exports = {
    ldap: process.env.LDAP_URL,
    tokenSecret: process.env.TOKEN_SECRET,
    tokenAlgo: process.env.TOKEN_ALGO,
    tokenExpires: process.env.TOKEN_EXPIRES,
    almaApiKey: process.env.ALMA_API_KEY,
    almaApiUrl: process.env.ALMA_API_URL,
    authorizeNetId: process.env.AUTHORIZENET_ID,
    authorizeNetKey: process.env.AUTHORIZENET_KEY,
    authorizeNetApiUrl: process.env.AUTHORIZENET_API_URL,
    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
    primoUrl: process.env.PRIMO_URL,
    smtp: process.env.SMTP,
    fromEmail: process.env.FROM_EMAIL,
    emailSubject: process.env.SUBJECT
};
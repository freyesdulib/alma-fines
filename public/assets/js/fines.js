'use strict';

var fines = {

    checkApis: function () {

        var authorize = 'https://' + document.domain + '/api/status/authorize',
            alma = 'https://' + document.domain + '/api/status/alma',
            urls = [authorize, alma],
            request = new XMLHttpRequest();

        urls.forEach(function (url) {

            request.open('POST', url);
            request.onload = function () {

                if (request.status !== 200) {
                    $('form').hide();
                    $('#apiMessage').html('The Fines & Fees payment system is currently unavailable.  We\'re sorry for the inconvenience.   Please try again later.');
                }
            };

            request.send(null);
        });
    },
    saveBalance: function (userBalance) {
        sessionStorage.removeItem('userBalance');
        sessionStorage.setItem('userBalance', userBalance);
    },
    disableButton: function (id, text) {

        $('#' + id).click(function () {

            $(this).prop('disabled', true);
            $(this).empty().append(text);
            $(this).parents('form').submit();
        });
    },
    pay: function (id, token, uid) {

        $('#' + id).click(function () {

            $(this).prop('disabled', true);
            $('#cancel').hide();
            $(this).empty().append('Processing Payment...');
            $(this).parents('form').submit();
        });
    },
    checkStatus: function () {

        var query = window.location.search.split('='),
            status = query[query.length-1];

        if (status === '1') {
            $('#message').html('<div class="alert alert-success"><i class="fa fa-check-circle"></i> Payment was successful.</div>');

            setTimeout(function () {
                $('#message').empty();
                window.location.href = location.protocol + '//' + document.domain + ':' + location.port + '/login';
            }, 10000);

        } else if (status === '0') {
            $('#message').html('<div class="alert alert-danger"><i class="fa fa-exclamation-triangle"></i> Payment failed.</div>');

            setTimeout(function () {
                $('#message').empty();
            }, 5000);
        }
    },
    cancel: function () {
        $('#cancel').click(function () {
            $(this).prop('disabled', true);
            $(this).empty().append('Cancelling...');
        });
    },
    getBalance: function () {
        return sessionStorage.getItem('userBalance');
    },
    calculateBalance: function () {

        $('input[type="checkbox"]').on('click', function () {

            var total = fines.getBalance(),
                castTotal,
                newTotal,
                balance,
                fine = parseFloat($(this).val()),
                isChecked = $(this).is(':checked');

            total = JSON.parse(total);
            castTotal = parseFloat(total.total);

            if (isChecked) {
                newTotal = (castTotal + fine);
            } else {
                newTotal = (castTotal - fine);
            }

            balance = {
                total: parseFloat(newTotal).toFixed(2)
            };

            if (balance.total === '0.00') {
                var message = '<div class="alert alert-danger"><strong>You must select at least one fine to pay.</strong></div>';
                $('#payOnline').prop('disabled', true);
                $('#message').css('color', 'red').html(message);
            } else {
                $('#payOnline').prop('disabled', false);
                $('#message').html('');
            }

            fines.saveBalance(JSON.stringify(balance));
            $('#balance').html('$' + balance.total);
            $('#fineTotal').val(balance.total);
        });
    }
};
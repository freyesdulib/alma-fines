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

            // check payment status
            var timer = setInterval(function () {

                $.ajax({
                    url: location.protocol + '//' + document.domain + ':' + location.port + '/status?t=' + token + '&uid=' + uid,
                    type: 'get',
                    dataType: 'json',
                    cache: false
                }).done(function (data) {

                    if (data.length === 0) {
                        return false;
                    }

                    if (data.status === 1 && data.result_code == 'Ok') {

                        clearInterval(timer);

                        $('#paymentForm').html('<div class="alert alert-success"><i class="fa fa-check-circle"></i> Payment was successful. Amount paid: ($' + data.amount_paid + ')   One moment please...</div>');

                         setTimeout(function () {
                         window.location = location.protocol + '//' + document.domain + ':' + location.port + '/fines' + window.location.search;
                         }, 5000);

                        window.scrollTo(0, 0);

                        return false;

                    } else if (data.status === 1 && data.result_code == 'Error') {

                        clearInterval(timer);

                        $('#paymentForm').html('<div class="alert alert-danger"><i class="fa fa-exclamation-triangle"></i> Payment failed.  One moment please...</div>');

                         setTimeout(function () {
                         window.location = location.protocol + '//' + document.domain + ':' + location.port + '/fines' + window.location.search;
                         }, 3000);

                        window.scrollTo(0, 0);

                        return false;
                    }

                }).fail(function (jqXHR, textStatus) {

                    $('#paymentForm').html('<div class="alert alert-danger">Payment process failed.  We\'re sorry for the inconvenience.  One moment please...</div>');

                    setTimeout(function () {
                        window.location = location.protocol + '//' + document.domain + ':' + location.port + '/fines' + window.location.search;
                    }, 3000);

                });

            }, 1000);
        });
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
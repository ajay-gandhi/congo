'use strict';

/**
 * Given a question, answers it
 */

// NPM modules
var rp            = require('request-promise'),
    WolframClient = require('node-wolfram');

var Wolfram = new WolframClient(require('./tokens.json').wolfram);

module.exports.ask = function (message, cb) {
  message = message.toLowerCase();

  Wolfram.query(message, function (err, result) {
    if (err) {
      cb('Couldn\'t get info :(');
      return;
    } else {

      if (!result.queryresult.pod) {
        cb('I don\'t understand');
        return;
      }

      for (var p = 0; p < result.queryresult.pod.length; p++) {
        var pod = result.queryresult.pod[p];

        // Only return primary pod
        if (pod.$.primary === 'true') {
          cb(pod.subpod[0].plaintext[0]);
          return;
        }
      }
    }
  });
}

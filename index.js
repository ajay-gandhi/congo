'use strict';

// NPM modules
var voicejs = require('voice.js'),
    text    = require('textbelt'),
    Promise = require('es6-promise').Promise,
    fs      = require('fs');

// Local modules
var congo = require('./congo');

var client = new voicejs.Client({
  email:    process.argv[2] || 'congo.meatballs@gmail.com',
  password: process.argv[3] || 'password',
  tokens:   require('./tokens.json')
});

var log_filename = './received_messages';
var recd_q = {},
    sent_a = {};

/**
 * Gets all unread messages from inbox
 *
 * @return {Promise} to an array of question objects
 *   {phone_number, id, timestamp, last_message}
 */
var get_questions = function () {
  return new Promise (function (resolve) {
    // Get all conversations, not including spam. 
    client.get('unread', { limit: Infinity }, function (err, response, data) {
      if (err) return console.trace(err);

      if (!data ||
          !data.conversations_response ||
          !data.conversations_response.conversationgroup)
        return;

      var convos = data.conversations_response.conversationgroup;

      // Record each unread for log
      convos.forEach(function (convo, index) {
        var time = new Date(convo.conversation.conversation_time);

        var log = time.toISOString().replace(/[ZT]/g,' ').substr(0,16) +
          ' from ' + convo.call[0].phone_number + ': ' +
          convo.conversation.message_text.slice(-1)[0];

        recd_q[convo.conversation.id] = log;
      });
      
      console.log(convos.length +  ' conversations retrieved');
      
      var questions = convos.map(function (convo) {
        return {
          phone_number: convo.call[0].phone_number,
          id:           convo.conversation.id,
          timestamp:    new Date(convo.conversation.conversation_time),
          last_message: convo.conversation.message_text.slice(-1)[0]
        }
      });

      resolve(questions);
    });
  });
}

/**
 * Asks congo for the answer to a question.
 * @param  {Object} question {phone_number, id, timestamp, last_message}
 * @return {Promise}         to {phone_number, id, message}
 */
var answer = function (question) {
  return new Promise(function (resolve) {
    congo.ask(question.last_message, function (ans) {
      // Record answer for log
      sent_a[question.id] = ans;

      resolve({
        phone_number: question.phone_number,
        id:           question.id,
        message:      ans
      })
    })
  });
}

var text_opts = {
  fromName: 'Congo',
  fromAddr: 'congo@me.com',
  region:   'us',
  subject:  '/'
}

/**
 * Sends answer objects, and marks the conversations as read.
 *
 * @param  {Object} ans {phone_number, id, message}
 *
 * @return {Promise}    to nothing lol.
 */
var send = function (ans) {
  return new Promise(function (resolve) {

    var done = {
      id:   ans.id,
      read: true
    }

    // Remove +1
    var pn = ans.phone_number;
    if (pn.charAt(0) === '+') pn = pn.slice(2);

    text.sendText(pn, ans.message, text_opts, function (err) {
      if (err) return console.trace(err);

      // Set as read
      client.set('mark', done, resolve);
    });

  });
}


var main = function () {

  // Get incoming unread messages
  get_questions().then(function (questions) {
    // Handle messages
    return Promise.all(questions.map(answer));
  })
  .then(function (answers) {
    // Send messages
    return Promise.all(answers.map(send));
  })
  .then(function () {

    // Reduce recorded QA
    var write_log = Object.keys(recd_q).reduce(function(acc, id) {
      return acc + recd_q[id] + '\nAnswer: ' + sent_a[id] + '\n\n';
    }, '');

    // Write
    fs.appendFile(log_filename, write_log, function (err) {
      if (err) console.trace('Error writing to log', err);
    });

    // Clear
    recd_q = {};
    sent_a = {};

  })
  .catch(console.trace);

  // Do this every 5s
  setTimeout(main.bind(this), 5000);
}

main();
console.log('Started.');

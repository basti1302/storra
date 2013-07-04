'use strict';

var winston = require('winston')

var logger = new (winston.Logger)({
  transports: [
    new winston.transports.Console({
      colorize: true,
      level: 'debug',
      timestamp: true
    }),
    new winston.transports.File({
      filename: 'log/storra.log',
      level: 'debug'
    })
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      colorize: true,
      level: 'debug',
      timestamp: true
    }),
    new winston.transports.File({
      filename: 'log/storra-exceptions.log'
    })
  ]
})

module.exports = logger

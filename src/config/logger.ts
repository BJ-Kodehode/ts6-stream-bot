import winston from 'winston';

export function createLogger(level = 'info'): winston.Logger {
  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...rest }) => {
        const extra = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
        return `${timestamp} ${level}: ${message}${extra}`;
      })
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: 'bot.log',
        format:   winston.format.uncolorize(),
      }),
    ],
  });
}

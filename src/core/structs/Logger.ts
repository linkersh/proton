import winston from "winston";
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, json, errors, colorize } = format;

const formatter = printf(({ level, message, timestamp, stack }) => {
  if (stack) {
    return `${timestamp} ${level}: ${message} - ${stack}`;
  } else {
    return `${timestamp} ${level}: ${message}`;
  }
});

let logger = null;
if (process.env.NODE_ENV === "dev") {
  logger = createLogger({
    format: combine(
      colorize(),
      timestamp({ format: "HH:mm:ss" }),
      // colorize(),
      errors({ stack: true }),
      formatter
    ),
    transports: [new transports.Console()],
    levels: {
      emerg: 0,
      fatal: 0,
      trace: 7,
      alert: 1,
      crit: 2,
      error: 3,
      warn: 4,
      notice: 5,
      info: 6,
      debug: 7,
    },
    level: "debug",
  });
} else if (process.env.NODE_ENV === "prod") {
  logger = createLogger({
    format: combine(timestamp(), errors({ stack: true }), json()),
    transports: [
      new transports.Console(),
      new transports.File({ filename: "logs/errors.log", level: "error" }),
    ],
    levels: {
      emerg: 0,
      fatal: 0,
      trace: 7,
      alert: 1,
      crit: 2,
      error: 3,
      warn: 4,
      notice: 5,
      info: 6,
      debug: 7,
    },
    level: "info",
  });
}
if (logger !== null) {
  logger.child = function () {
    return this;
  };
}
export default logger as winston.Logger;

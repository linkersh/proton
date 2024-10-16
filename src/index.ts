import logger from "./core/structs/Logger";
import Timer from "./utils/Timer";
import { ProtonClient } from "./core/client/ProtonClient";
import { client as mongoClient } from "./core/database/DBClient";
import { config } from "./Config";

const run = async () => {
  const timer = new Timer();
  timer.start();

  await mongoClient.connect();
  const timeDb = timer.stop();
  logger.info(`Connected to database in: ${timeDb.toFixed(4)}ms`);

  const client = new ProtonClient(config.secret.token, config.clientOptions);

  timer.start();
  await client.loadEvents();
  const timeEvents = timer.stop();

  timer.start();
  await client.loadModules();
  const timeModules = timer.stop();

  client.loadLegacyCommands();
  client.loadFonts();

  logger.info(`Loaded events in: ${timeEvents.toFixed(4)}ms`);
  logger.info(`Loaded modules in: ${timeModules.toFixed(4)}ms`);

  timer.start();
  client.changeStreams.listenCommandConfigs();
  client.changeStreams.listenGuildConfigs();
  client.changeStreams.listenStarboardMsgs();
  client.changeStreams.listenReactionRoles();
  const timeChangeStreams = timer.stop();
  logger.info(`Loaded change streams in: ${timeChangeStreams.toFixed(4)}ms`);

  client.connect();
};

if (!process.env.NODE_ENV) {
  process.stderr.write("NODE_ENV is unset\n");
  process.exitCode = 1;
} else {
  run();
}

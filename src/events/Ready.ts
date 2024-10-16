import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";

export default new ClientEvent("ready", (client) => {
  logger.info("Client Connected");
  client.loadCommands();
});

import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";

export default new ClientEvent("error", (client, err) => {
  logger.error(err);
});

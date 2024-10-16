import { CommandInteraction, Constants } from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";

export default class Ping extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "ping";
  description = "Ping command!!";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [];
  guildID = null;
  handler(interaction: CommandInteraction) {
    const shard = this.client.shards.get(0);
    if (shard !== undefined) {
      interaction
        .createMessage(`${shard.latency}ms!`)
        .catch((err) => logger.error("command: ping: failed to respond to interaction", err));
    } else {
      interaction
        .createMessage(`Unknown shard`)
        .catch((err) => logger.error("command: ping: failed to respond to interaction", err));
    }
  }
}

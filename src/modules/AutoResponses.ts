import { GuildTextableChannel, Message } from "eris";
import { AutoResponseTypes } from "../Constants";
import { ProtonClient } from "../core/client/ProtonClient";
import { GuildConfig } from "../core/database/models/GuildConfig";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";

export default class AutoResponses extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "AutoResponses");
  }

  handleMessage(message: Message<GuildTextableChannel>, config: GuildConfig) {
    if (message.content.length < 3 || !config.responses) {
      return false;
    }
    if (!message.channel.permissionsOf(this.client.user.id)?.has("sendMessages")) {
      return false;
    }

    const content = message.content.toLowerCase();
    const response = config.responses.find((res) => {
      if (res.type === AutoResponseTypes.STARTS) {
        if (content.startsWith(res.keyword)) {
          return true;
        }
      } else if (res.type === AutoResponseTypes.ENDS) {
        if (content.endsWith(res.keyword)) {
          return true;
        }
      } else if (res.type === AutoResponseTypes.CONTAINS) {
        if (content.includes(res.keyword)) {
          return true;
        }
      }
    });
    if (!response) {
      return false;
    }
    if (response.content.length > 0) {
      message.channel
        .createMessage(response.content)
        .catch((err) =>
          logger.error(`auto responses: failed to create auto response message`, err)
        );
      return true;
    }
    return false;
  }
}

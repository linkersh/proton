import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import ReactionRoles from "../modules/ReactionRoles";
import type Starboard from "../modules/Starboard";

export default new ClientEvent("messageReactionRemove", (client, message, emoji, userID) => {
  if (!message.guildID) {
    return;
  }
  const starboard = client.modules.get("Starboard") as Starboard | undefined;
  if (!starboard) {
    logger.warn("messageReactionRemove: starboard module not found!");
  } else {
    starboard.messageReactionRemove(message, emoji, userID);
  }

  const reactionRoles = client.modules.get("ReactionRoles") as ReactionRoles | undefined;
  if (!reactionRoles) {
    logger.warn("messageReactionRemove: reaction roles module not found!");
  } else {
    reactionRoles.messageReactionRemove(message, emoji, userID);
  }
});

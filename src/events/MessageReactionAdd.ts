import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import ReactionRoles from "../modules/ReactionRoles";
import type Starboard from "../modules/Starboard";

export default new ClientEvent("messageReactionAdd", (client, message, emoji, reactor) => {
  if (!message.guildID) {
    return;
  }
  if (!("user" in reactor)) {
    return;
  }
  const starboard = client.modules.get("Starboard") as Starboard | undefined;
  if (!starboard) {
    logger.warn("messageReactionAdd: starboard module not found!");
  } else {
    starboard.messageReactionAdd(message, emoji, reactor);
  }

  const reactionRoles = client.modules.get("ReactionRoles") as ReactionRoles | undefined;
  if (!reactionRoles) {
    logger.warn("messageReactionAdd: reaction roles module not found!");
  } else {
    reactionRoles.messageReactionAdd(message, emoji, reactor);
  }
});

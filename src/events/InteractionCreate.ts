import { Constants, ModalSubmitInteraction, User } from "eris";
import { getTag } from "../utils/Util";
import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import ButtonHandler from "../modules/ButtonHandler";
import Tag from "../commands/Tag";
import LevelConfig from "../commands/LevelConfig";
import ModalHandler from "../modules/ModalHandler";

export default new ClientEvent("interactionCreate", async (client, interaction) => {
  if (interaction.type === Constants.InteractionTypes.MESSAGE_COMPONENT) {
    const listeners = client.componentListeners.get(interaction.message.id);
    if (listeners !== undefined) {
      let called = false;
      for (let x = 0; x < listeners.length; x++) {
        listeners[x](interaction);
        called = true;
      }
      if (called) {
        return;
      }
    }
    if (interaction.data.component_type === Constants.ComponentTypes.BUTTON) {
      const buttonHandler = client.modules.get("ButtonHandler") as ButtonHandler | undefined;
      if (buttonHandler) {
        buttonHandler.onclick(interaction);
      } else {
        logger.warn("interaction create: button handler module not found");
      }
    }
  } else if (interaction.type === Constants.InteractionTypes.APPLICATION_COMMAND) {
    const command = client.commands.get(interaction.data.name);
    if (command !== undefined) {
      const user = (interaction.member ? interaction.member.user : interaction.user) as User;
      logger.info(`${getTag(user)} (${user.id}) executed command ${command.name} `);
      Promise.resolve(command.handler(interaction)).catch((err) => {
        logger.error(`command: ${command.name}`, err);
      });
    }
  } else if (interaction.type === Constants.InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE) {
    const command = client.commands.get(interaction.data.name);
    if (command && command.autoCompleteHandler !== undefined) {
      Promise.resolve(command.autoCompleteHandler(interaction)).catch((err) => {
        logger.error(`command: auto complete`, err);
      });
    }
  } else {
    try {
      switch ((interaction as ModalSubmitInteraction).data.custom_id) {
        case "tag_create":
          await Promise.resolve(
            (client.commands.get("tag") as Tag).createModalHandler(interaction as never)
          );
          break;
        case "tag_update":
          await Promise.resolve(
            (client.commands.get("tag") as Tag).updateModalHandler(interaction as never)
          );
          break;
        case "level_msg":
          await Promise.resolve(
            (client.commands.get("level-config") as LevelConfig).levelMsgModal(interaction as never)
          );
          break;
        default: {
          (client.modules.get("ModalHandler") as ModalHandler | undefined)?.onSubmit(interaction);
          break;
        }
      }
    } catch (err) {
      logger.error(`failed to execite modal dialog handler:`, err);
    }
  }
});

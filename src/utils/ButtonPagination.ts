import { AdvancedMessageContent, Constants, TextableChannel } from "eris";
import { ProtonClient } from "../core/client/ProtonClient.js";
import { ComponentListener } from "./ComponentListener.js";
const baseComponents = [
  {
    type: Constants.ComponentTypes.BUTTON,
    style: Constants.ButtonStyles.SECONDARY,
    emoji: {
      id: "898165831089930241",
      name: "ArrowPrevious",
    },
    custom_id: "button_pagination_back",
    disabled: false,
  },
  {
    type: Constants.ComponentTypes.BUTTON,
    style: Constants.ButtonStyles.SECONDARY,
    emoji: {
      id: "898165705235656724",
      name: "ArrowNext",
    },
    custom_id: "button_pagination_forward",
    disabled: false,
  },
  {
    type: Constants.ComponentTypes.BUTTON,
    style: Constants.ButtonStyles.PRIMARY,
    custom_id: "button_pagination_delete",
    emoji: {
      id: "898165656644628520",
      name: "stop",
    },
    disabled: false,
  },
];
class ButtonPagination {
  constructor(messages: AdvancedMessageContent[], userID: string) {
    if (!Array.isArray(messages)) {
      throw new TypeError("Messages needs to be an array!");
    }
    this.messages = messages;
    this.page = 1;
    this.listener = null;
    this.userID = userID;
  }
  messages: AdvancedMessageContent[];
  page: number;
  listener: ComponentListener | null;
  userID: string;

  getComponents() {
    const components = baseComponents.slice();
    if (this.page === 1) {
      components[0].disabled = true;
    } else {
      components[0].disabled = false;
    }
    if (this.page === this.messages.length) {
      components[1].disabled = true;
    } else {
      components[1].disabled = false;
    }
    return [{ type: Constants.ComponentTypes.ACTION_ROW, components: components }];
  }
  getData() {
    const newMessage = this.messages[this.page - 1];
    const data: AdvancedMessageContent = { components: this.getComponents() };
    if (newMessage.embeds) {
      data["embeds"] = newMessage.embeds;
    }
    if (newMessage.content) {
      data["content"] = newMessage.content;
    }
    if (newMessage.flags) {
      data["flags"] = newMessage.flags;
    }
    if (newMessage.allowedMentions) {
      data["allowedMentions"] = newMessage.allowedMentions;
    }
    return data;
  }
  async create(channel: TextableChannel) {
    return new Promise((resolve, reject) => {
      const content = this.messages[0];
      content.components = this.getComponents();
      channel
        .createMessage(content)
        .then((paginationMsg) => {
          this.listener = new ComponentListener(channel.client as ProtonClient, paginationMsg, {
            expireAfter: 60_000,
            repeatTimeout: true,
            userID: this.userID,
            componentTypes: [2],
          });
          this.listener.on("interactionCreate", (interaction) => {
            switch (interaction.data.custom_id) {
              case baseComponents[0].custom_id: {
                if (this.page > 1) {
                  this.page--;
                }
                interaction.editParent(this.getData()).catch(() => null);
                break;
              }
              case baseComponents[1].custom_id: {
                if (this.page < this.messages.length) {
                  this.page++;
                }
                interaction.editParent(this.getData()).catch(() => null);
                break;
              }
              case baseComponents[2].custom_id: {
                interaction.message.delete().catch(() => null);
                break;
              }
            }
          });
          resolve(undefined);
        })
        .catch(reject);
    });
  }
}
export default ButtonPagination;

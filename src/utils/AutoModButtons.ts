import {
  CommandInteraction,
  ComponentInteraction,
  Constants,
  GuildTextableChannel,
  Message,
} from "eris";
import { AutomodActions } from "../Constants";
import { ProtonClient } from "../core/client/ProtonClient";
import logger from "../core/structs/Logger";
import { ComponentListener } from "./ComponentListener";

const calculatorButtons = [
  {
    type: Constants.ComponentTypes.ACTION_ROW,
    components: [
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "1",
        custom_id: "automod_actions_calc_1",
        disabled: false,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "2",
        custom_id: "automod_actions_calc_2",
        disabled: false,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "3",
        custom_id: "automod_actions_calc_3",
        disabled: false,
      },
    ],
  },
  {
    type: Constants.ComponentTypes.ACTION_ROW,
    components: [
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "4",
        custom_id: "automod_actions_calc_4",
        disabled: false,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "5",
        custom_id: "automod_actions_calc_5",
        disabled: false,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "6",
        custom_id: "automod_actions_calc_6",
        disabled: false,
      },
    ],
  },
  {
    type: Constants.ComponentTypes.ACTION_ROW,
    components: [
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "7",
        custom_id: "automod_actions_calc_7",
        disabled: false,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "8",
        custom_id: "automod_actions_calc_8",
        disabled: false,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "9",
        custom_id: "automod_actions_calc_9",
        disabled: false,
      },
    ],
  },
  {
    type: Constants.ComponentTypes.ACTION_ROW,
    components: [
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SUCCESS,
        label: "Done",
        custom_id: "automod_actions_calc_done",
        disabled: false,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "0",
        custom_id: "automod_actions_calc_0",
        disabled: false,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.DANGER,
        label: "Exit",
        custom_id: "automod_actions_calc_cancel",
        disabled: false,
      },
    ],
  },
];
const muteButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Mute",
  custom_id: "automod_actions_btn_mute",
  disabled: false,
};
const banButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Ban",
  custom_id: "automod_actions_btn_ban",
  disabled: false,
};
const kickButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Kick",
  custom_id: "automod_actions_btn_kick",
  disabled: false,
};
const warnButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Warn",
  custom_id: "automod_actions_btn_warn",
  disabled: false,
};
const deleteMsgButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Delete Messages",
  custom_id: "automod_actions_btn_delete_msg",
  disabled: false,
};
const timeoutButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Timeout User",
  custom_id: "automod_actions_btn_timeout_user",
  disabled: true,
};
const calcButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.PRIMARY,
  label: "Punishment Duration",
  custom_id: "automod_actions_btn_duration",
  disabled: false,
};
const cancelButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.DANGER,
  label: "Cancel",
  custom_id: "automod_actions_btn_cancel",
  disabled: false,
};

const doneButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SUCCESS,
  label: "Save",
  custom_id: "automod_actions_btn_done",
  disabled: true,
};

export type DoneFunction = (data: {
  duration: number;
  actions: number;
  interaction: ComponentInteraction;
}) => void;

export const createActionButtons = async (
  message: Message<GuildTextableChannel>,
  done: DoneFunction
) => {
  const activeRow1 = [muteButton, banButton, kickButton, warnButton, deleteMsgButton];
  const activeRow2 = [timeoutButton, doneButton, cancelButton, calcButton];
  let msg: Message;
  let actions = 0;
  let totalCalc = "";

  const format = () => {
    const duration = parseInt(totalCalc);
    const actionArray = [];
    if (actions & AutomodActions.BAN) {
      if (duration) {
        actionArray.push(`Temp-ban for **${duration.toLocaleString()}** minutes`);
      } else {
        actionArray.push("Ban");
      }
    }
    if (actions & AutomodActions.KICK) {
      actionArray.push("Kick");
    }
    if (actions & AutomodActions.MUTE) {
      if (duration && !(actions & AutomodActions.BAN)) {
        actionArray.push(`Temp-mute for **${duration.toLocaleString()}** minutes`);
      } else {
        actionArray.push("Mute");
      }
    } else if (actions & AutomodActions.TIMEOUT) {
      actionArray.push(`Timeout user for **${duration.toLocaleString()}** minutes`);
    }
    if (actions & AutomodActions.WARN) {
      actionArray.push("Warn");
    }
    if (actions & AutomodActions.DELETE_MESSAGE) {
      actionArray.push("Delete Message");
    }
    return `**Notes:**\n- You can only use "Timeout User" if you have setup punishment duration.\n- You can not use mute & timeout actions together.\n**Actions:** ${
      actionArray.join(" and ") || "none"
    }`;
  };
  try {
    msg = await message.channel.createMessage({
      content: format(),
      components: [
        { type: 1, components: activeRow1 },
        { type: 1, components: activeRow2 },
      ],
    });
  } catch (err) {
    logger.warn("module: AutoMod UX: CreateActionButtons: failed to action selection menu", err);
    return;
  }
  const listener = new ComponentListener(message.channel.client as ProtonClient, msg, {
    expireAfter: 30_000,
    repeatTimeout: true,
    userID: message.author.id,
    componentTypes: [2],
  });

  listener.on("interactionCreate", (interaction) => {
    if (interaction.data.custom_id === "automod_actions_btn_cancel") {
      msg.delete().catch(() => null);
      listener.stop("canceled");
      return;
    }
    if (interaction.data.custom_id === "automod_actions_btn_duration") {
      totalCalc = "";
      interaction
        .editParent({
          content: `The duration is in minutes, press buttons according to the count in minutes you want to punish the member for.\nTotal: 0`,
          components: calculatorButtons,
        })
        .catch(() => null);
      return;
    }
    if (interaction.data.custom_id === "automod_actions_btn_done") {
      listener.stop("done");
      done({
        duration: parseInt(totalCalc),
        actions: actions,
        interaction: interaction,
      });
      return;
    }
    if (interaction.data.custom_id === "automod_actions_calc_done") {
      const toIntTotal = Number(totalCalc);
      if (Number.isInteger(toIntTotal) && toIntTotal > 0 && !(actions & AutomodActions.MUTE)) {
        activeRow2[0].disabled = false;
      } else {
        activeRow2[0].disabled = true;
      }
      interaction.editParent({
        content: `${format()}`,
        components: [
          { type: 1, components: activeRow1 },
          { type: 1, components: activeRow2 },
        ],
      });
      return;
    }
    if (interaction.data.custom_id === "automod_actions_calc_cancel") {
      totalCalc = "";
      interaction
        .editParent({
          content: `${format()}`,
          components: [
            { type: 1, components: activeRow1 },
            { type: 1, components: activeRow2 },
          ],
        })
        .catch(() => null);
      return;
    }
    if (interaction.data.custom_id.startsWith("automod_actions_calc")) {
      totalCalc += interaction.data.custom_id[interaction.data.custom_id.length - 1];
      interaction
        .editParent({
          content: `The duration is in minutes, press buttons according to the count in minutes you want to punish the member for.\nTotal: ${totalCalc}`,
        })
        .catch(() => null);
      return;
    }
    if (interaction.data.custom_id === "automod_actions_btn_kick") {
      if (actions & AutomodActions.KICK) {
        actions &= ~AutomodActions.KICK;
      } else {
        actions |= AutomodActions.KICK;
      }
    }
    if (interaction.data.custom_id === "automod_actions_btn_ban") {
      if (actions & AutomodActions.BAN) {
        actions &= ~AutomodActions.BAN;
      } else {
        actions |= AutomodActions.BAN;
      }
    }
    if (interaction.data.custom_id === "automod_actions_btn_mute") {
      if (actions & AutomodActions.MUTE) {
        actions &= ~AutomodActions.MUTE;
        activeRow2[0].disabled = false;
      } else {
        actions |= AutomodActions.MUTE;
        activeRow2[0].disabled = true;
      }
    }
    if (interaction.data.custom_id === "automod_actions_btn_warn") {
      if (actions & AutomodActions.WARN) {
        actions &= ~AutomodActions.WARN;
      } else {
        actions |= AutomodActions.WARN;
      }
    }
    if (interaction.data.custom_id === "automod_actions_btn_delete_msg") {
      if (actions & AutomodActions.DELETE_MESSAGE) {
        actions &= ~AutomodActions.DELETE_MESSAGE;
      } else {
        actions |= AutomodActions.DELETE_MESSAGE;
      }
    }
    if (interaction.data.custom_id === "automod_actions_btn_timeout_user") {
      const toIntTotal = Number(totalCalc);
      if (!Number.isInteger(toIntTotal) || toIntTotal < 1) {
        activeRow2[0].disabled = true;
        interaction.editParent({
          content: `${format()}`,
          components: [
            { type: 1, components: activeRow1 },
            { type: 1, components: activeRow2 },
          ],
        });
        return;
      }
      if (actions & AutomodActions.TIMEOUT) {
        actions &= ~AutomodActions.TIMEOUT;
        activeRow1[0].disabled = false;
      } else {
        activeRow1[0].disabled = true;
        actions |= AutomodActions.TIMEOUT;
      }
    }
    if (actions > 0) {
      activeRow2[1].disabled = false;
    } else {
      activeRow2[1].disabled = true;
    }
    interaction
      .editParent({
        content: `${format()}`,
        components: [
          { type: 1, components: activeRow1 },
          { type: 1, components: activeRow2 },
        ],
      })
      .catch(() => null);
  });
  listener.on("stop", (reason) => {
    if (reason === "timeout") {
      const actionRow1 = (msg.components && msg.components[0].components) ?? [];
      const actionRow2 = (msg.components && msg.components[1].components) ?? [];
      msg
        .edit({
          content: "You took too long!",
          components: [
            {
              type: 1,
              components: actionRow1.map((comp) => {
                comp.disabled = true;
                return comp;
              }),
            },
            {
              type: 1,
              components: actionRow2.map((comp) => {
                comp.disabled = true;
                return comp;
              }),
            },
          ],
        })
        .catch(() => null);
    }
  });
};

export const createActionButtonsInteraction = async (
  interaction: CommandInteraction<GuildTextableChannel>,
  done: DoneFunction
) => {
  if (!interaction.member) {
    throw new Error("Cannot use createActionButtonsInteraction outside of guild interactions.");
  }

  const activeRow1 = [muteButton, banButton, kickButton, warnButton, deleteMsgButton];
  const activeRow2 = [timeoutButton, doneButton, cancelButton, calcButton];
  let actions = 0;
  let msg: Message;
  let totalCalc = "";

  const format = () => {
    const duration = parseInt(totalCalc);
    const actionArray = [];
    if (actions & AutomodActions.BAN) {
      if (duration) {
        actionArray.push(`Temp-ban for **${duration.toLocaleString()}** minutes`);
      } else {
        actionArray.push("Ban");
      }
    }
    if (actions & AutomodActions.KICK) {
      actionArray.push("Kick");
    }
    if (actions & AutomodActions.MUTE) {
      if (duration && !(actions & AutomodActions.BAN)) {
        actionArray.push(`Temp-mute for **${duration.toLocaleString()}** minutes`);
      } else {
        actionArray.push("Mute");
      }
    } else if (actions & AutomodActions.TIMEOUT) {
      actionArray.push(`Timeout user for **${duration.toLocaleString()}** minutes`);
    }
    if (actions & AutomodActions.WARN) {
      actionArray.push("Warn");
    }
    if (actions & AutomodActions.DELETE_MESSAGE) {
      actionArray.push("Delete Message");
    }
    return `**Notes:**\n- You can only use "Timeout User" if you have setup punishment duration.\n- You can not use mute & timeout actions together.\n**Actions:** ${
      actionArray.join(" and ") || "none"
    }`;
  };
  try {
    msg = await interaction.editOriginalMessage({
      content: format(),
      components: [
        { type: 1, components: activeRow1 },
        { type: 1, components: activeRow2 },
      ],
    });
  } catch (err) {
    logger.warn("module: AutoMod UX: CreateActionButtons: failed to action selection menu", err);
    return;
  }
  const listener = new ComponentListener(interaction.channel.client as ProtonClient, msg, {
    expireAfter: 30_000,
    repeatTimeout: true,
    userID: interaction.member.id,
    componentTypes: [2],
  });

  listener.on("interactionCreate", (inter) => {
    if (inter.data.custom_id === "automod_actions_btn_cancel") {
      inter.deleteOriginalMessage().catch(() => null);
      listener.stop("canceled");
      return;
    }
    if (inter.data.custom_id === "automod_actions_btn_duration") {
      totalCalc = "";
      inter
        .editParent({
          content: `The duration is in minutes, press buttons according to the count in minutes you want to punish the member for.\nTotal: 0`,
          components: calculatorButtons,
        })
        .catch(() => null);
      return;
    }
    if (inter.data.custom_id === "automod_actions_btn_done") {
      listener.stop("done");
      done({
        duration: parseInt(totalCalc),
        actions: actions,
        interaction: inter,
      });
      return;
    }
    if (inter.data.custom_id === "automod_actions_calc_done") {
      const toIntTotal = Number(totalCalc);
      if (Number.isInteger(toIntTotal) && toIntTotal > 0 && !(actions & AutomodActions.MUTE)) {
        activeRow2[0].disabled = false;
      } else {
        activeRow2[0].disabled = true;
      }
      inter.editParent({
        content: `${format()}`,
        components: [
          { type: 1, components: activeRow1 },
          { type: 1, components: activeRow2 },
        ],
      });
      return;
    }
    if (inter.data.custom_id === "automod_actions_calc_cancel") {
      totalCalc = "";
      inter
        .editParent({
          content: `${format()}`,
          components: [
            { type: 1, components: activeRow1 },
            { type: 1, components: activeRow2 },
          ],
        })
        .catch(() => null);
      return;
    }
    if (inter.data.custom_id.startsWith("automod_actions_calc")) {
      totalCalc += inter.data.custom_id[inter.data.custom_id.length - 1];
      inter
        .editParent({
          content: `The duration is in minutes, press buttons according to the count in minutes you want to punish the member for.\nTotal: ${totalCalc}`,
        })
        .catch(() => null);
      return;
    }
    if (inter.data.custom_id === "automod_actions_btn_kick") {
      if (actions & AutomodActions.KICK) {
        actions &= ~AutomodActions.KICK;
      } else {
        actions |= AutomodActions.KICK;
      }
    }
    if (inter.data.custom_id === "automod_actions_btn_ban") {
      if (actions & AutomodActions.BAN) {
        actions &= ~AutomodActions.BAN;
      } else {
        actions |= AutomodActions.BAN;
      }
    }
    if (inter.data.custom_id === "automod_actions_btn_mute") {
      if (actions & AutomodActions.MUTE) {
        actions &= ~AutomodActions.MUTE;
        activeRow2[0].disabled = false;
      } else {
        actions |= AutomodActions.MUTE;
        activeRow2[0].disabled = true;
      }
    }
    if (inter.data.custom_id === "automod_actions_btn_warn") {
      if (actions & AutomodActions.WARN) {
        actions &= ~AutomodActions.WARN;
      } else {
        actions |= AutomodActions.WARN;
      }
    }
    if (inter.data.custom_id === "automod_actions_btn_delete_msg") {
      if (actions & AutomodActions.DELETE_MESSAGE) {
        actions &= ~AutomodActions.DELETE_MESSAGE;
      } else {
        actions |= AutomodActions.DELETE_MESSAGE;
      }
    }
    if (inter.data.custom_id === "automod_actions_btn_timeout_user") {
      const toIntTotal = Number(totalCalc);
      if (!Number.isInteger(toIntTotal) || toIntTotal < 1) {
        activeRow2[0].disabled = true;
        inter.editParent({
          content: `${format()}`,
          components: [
            { type: 1, components: activeRow1 },
            { type: 1, components: activeRow2 },
          ],
        });
        return;
      }
      if (actions & AutomodActions.TIMEOUT) {
        actions &= ~AutomodActions.TIMEOUT;
        activeRow1[0].disabled = false;
      } else {
        activeRow1[0].disabled = true;
        actions |= AutomodActions.TIMEOUT;
      }
    }
    if (actions > 0) {
      activeRow2[1].disabled = false;
    } else {
      activeRow2[1].disabled = true;
    }
    inter
      .editParent({
        content: `${format()}`,
        components: [
          { type: 1, components: activeRow1 },
          { type: 1, components: activeRow2 },
        ],
      })
      .catch(() => null);
  });
  listener.on("stop", (reason) => {
    if (reason === "timeout") {
      const actionRow1 = (msg.components && msg.components[0].components) ?? [];
      const actionRow2 = (msg.components && msg.components[1].components) ?? [];
      interaction
        .editOriginalMessage({
          content: "You took too long!",
          components: [
            {
              type: 1,
              components: actionRow1.map((comp) => {
                comp.disabled = true;
                return comp;
              }),
            },
            {
              type: 1,
              components: actionRow2.map((comp) => {
                comp.disabled = true;
                return comp;
              }),
            },
          ],
        })
        .catch(() => null);
    }
  });
};

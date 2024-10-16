import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { CustomEmojis } from "../../Constants";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";

class Links extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "links",
      description: "Prevent members from spamming links, or sending links at all.",
      usage: "<max links/seconds>",
      commands: [
        {
          name: "whitelist",
          desc: "Whitelist a link, the bot will flag all non-whitelisted links.",
          usage: "<add|remove> <link>",
        },
        {
          name: "blacklist",
          desc: "Blacklist a link, the bot will flag all blacklisted links.",
          usage: "<add|remove> <link>",
        },
        {
          name: "list",
          desc: "See the whitelisted & blacklisted links.",
          usage: "",
        },
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
      aliases: ["linkspam"],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const split = args[0]?.split("/");
    if (!split || split.length < 2) {
      return this.errorMessage(
        message,
        "Specify a valid threshold like: `<max links/per seconds>`."
      );
    }
    const maxLinks = parseInt(split[0]);
    const seconds = parseInt(split[1]);
    if (isNaN(maxLinks) || isNaN(seconds)) {
      return this.errorMessage(message, "Max links and seconds must be a number and above 0.");
    }
    if (maxLinks < 0 || seconds < 1) {
      return this.errorMessage(
        message,
        "Seconds needs to be above 0 and max links need to be above or equal to 0."
      );
    }
    const links = {
      max_links: maxLinks,
      seconds: seconds,
      actions: 0,
      duration: 0,
    };
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      links.actions = actions;
      links.duration = duration * 60000;
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "automod.links": links,
          },
        }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated link spam module.`,
        components: [],
      });
    });
  }
  whitelist({ message, args, config }: ExecuteArgs) {
    if (config.automod && config.automod.badlinks?.length) {
      return this.errorMessage(
        message,
        `You have some blacklisted links. You can't have blacklisted and whitelisted links.`
      );
    }
    const lower = args[0]?.toLowerCase();
    if (lower === "add") {
      let url: URL;
      try {
        url = new URL(args[1]);
      } catch {
        if (args[1] && args[1].length > 0) {
          return this.errorMessage(message, `"${args[1]}" is not a valid URL.`);
        } else {
          return this.errorMessage(message, `You need to specify a valid URL.`);
        }
      }
      const hostname = url.hostname;
      if (hostname.startsWith(`${url.protocol}://%2A`)) {
        hostname.replace("%2A", "*");
      }
      collections.guildconfigs
        .updateOne(
          { _id: message.guildID },
          {
            $addToSet: {
              "automod.goodlinks": `${url.protocol}//${hostname}`,
            },
          }
        )
        .then(() => {
          let msg = `Whitelisted url: \`${url.protocol}//${hostname}\``;
          if (hostname.includes("*")) {
            msg += "\n**Note:** Sub-domains of this links will also be flagged!";
          }
          this.successMessage(message, msg);
        });
    } else if (lower === "remove") {
      let url: URL;
      try {
        url = new URL(args[1]);
      } catch {
        if (args[1] && args[1].length > 0) {
          return this.errorMessage(message, `"${args[1]}" is not a valid URL.`);
        } else {
          return this.errorMessage(message, `You need to specify a valid URL.`);
        }
      }
      const hostname = url.hostname;
      if (hostname.startsWith(`${url.protocol}://%2A`)) {
        hostname.replace("%2A", "*");
      }
      collections.guildconfigs
        .updateOne(
          { _id: message.guildID },
          {
            $pull: {
              "automod.goodlinks": `${url.protocol}//${hostname}`,
            },
          }
        )
        .then(() => {
          this.successMessage(
            message,
            `Removed url: \`${url.protocol}//${hostname}\` from whitelist.`
          );
        });
    } else {
      return this.errorMessage(message, "Please specify a valid option `add` or `remove`.");
    }
  }
  blacklist({ message, args, config }: ExecuteArgs) {
    if (config.automod && config.automod.goodlinks?.length) {
      return this.errorMessage(
        message,
        `You have some whitelisted links. You can't have blacklisted and whitelisted links.`
      );
    }
    const lower = args[0]?.toLowerCase();
    if (lower === "add") {
      let url: URL;
      try {
        url = new URL(args[1]);
      } catch {
        if (args[1] && args[1].length > 0) {
          return this.errorMessage(message, `"${args[1]}" is not a valid URL.`);
        } else {
          return this.errorMessage(message, `You need to specify a valid URL.`);
        }
      }
      const hostname = url.hostname;
      if (hostname.startsWith(`${url.protocol}://%2A`)) {
        hostname.replace("%2A", "*");
      }
      collections.guildconfigs
        .updateOne(
          { _id: message.guildID },
          {
            $addToSet: {
              "automod.badlinks": `${url.protocol}//${hostname}`,
            },
          }
        )
        .then(() => {
          let msg = `Blacklisted url: \`${url}\``;
          if (hostname.includes("*")) {
            msg += "\n**Note:** Sub-domains of this links will also be flagged!";
          }
          this.successMessage(message, msg);
        });
    } else if (lower === "remove") {
      let url: URL;
      try {
        url = new URL(args[1]);
      } catch {
        if (args[1] && args[1].length > 0) {
          return this.errorMessage(message, `"${args[1]}" is not a valid URL.`);
        } else {
          return this.errorMessage(message, `You need to specify a valid URL.`);
        }
      }
      const hostname = url.hostname;
      if (hostname.startsWith(`${url.protocol}://%2A`)) {
        hostname.replace("%2A", "*");
      }
      collections.guildconfigs
        .updateOne(
          { _id: message.guildID },
          { $pull: { "automod.badlinks": `${url.protocol}//${hostname}` } }
        )
        .then(() => {
          this.successMessage(
            message,
            `Removed url: \`${url.protocol}//${hostname}\` from blacklist.`
          );
        });
    } else {
      return this.errorMessage(message, "Please specify a valid option `add` or `remove`.");
    }
  }
  list({ message, config }: ExecuteArgs) {
    if (!config.automod) {
      return this.errorMessage(message, `There are no whitelisted/blacklisted links.`);
    }
    const badlinks = config.automod.badlinks || [];
    const goodlinks = config.automod.goodlinks || [];
    if (badlinks.length === 0 && goodlinks.length === 0) {
      return this.errorMessage(message, `There are no whitelisted/blacklisted links.`);
    }
    const goodLinksFormat = goodlinks.join(", ");
    const badLinksFormat = badlinks.join(", ");
    if (badLinksFormat.length > 1024 || badLinksFormat.length > 1024) {
      return message.channel.createMessage("", {
        file: `Whitelisted links: ${goodLinksFormat || "none"}\n\nBlacklisted links: ${
          badLinksFormat || "none"
        }`,
        name: "message.txt",
      });
    }

    return message.channel.createMessage({
      embeds: [
        new EmbedBuilder()
          .title("Whitelisted & blacklisted links")
          .field("Whitelisted links:", `${goodlinks.join(", ") || "None"}`)
          .field("Blacklisted links:", `${badlinks.join(", ") || "None"}`)
          .color("theme")
          .build(),
      ],
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.links": "" } }
    );
    this.successMessage(message, "Disabled the links automod.");
  }
}
export default Links;

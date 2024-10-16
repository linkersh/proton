import { AutoResponseTypes } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";
class Response extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "response",
      description:
        "Create responses that will trigger when a user includes a keyword in their message.",
      usage: "",
      aliases: ["autoresponse", "responses"],
      commands: [
        {
          name: "create",
          desc: "Create a new auto-response.",
          usage: "<contains|startsWith|endsWith> <keyword> | <response>",
        },
        {
          name: "delete",
          desc: "Delete a auto-response",
          usage: "<keyword>",
        },
        {
          name: "list",
          desc: "List all responses",
          usage: "",
        },
      ],
      category: "config",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async create({ message, args, config }: ExecuteArgs) {
    if (config.responses && config.responses.length >= 50) {
      return this.errorMessage(message, "You can't create more than 50 responses.");
    }
    const iType = args[0]?.toLowerCase();
    let type = null;
    if (iType === "startswith") {
      type = AutoResponseTypes.STARTS;
    } else if (iType === "endswith") {
      type = AutoResponseTypes.ENDS;
    } else if (iType === "contains") {
      type = AutoResponseTypes.CONTAINS;
    }
    if (!type) {
      return this.errorMessage(
        message,
        `Please use a type from these: ${Object.keys(AutoResponseTypes)
          .map((x) => `\`${x}\``)
          .join(",")}`
      );
    }
    const slicedArgs = args.slice(1).join(" ");
    const split = slicedArgs.indexOf("|");
    const keyword = slicedArgs.slice(0, split).trimEnd();
    if (split < 0 || !keyword) {
      return this.errorMessage(
        message,
        "You need to specify a keyword using this syntax: `name here | response here`"
      );
    }
    if (keyword.length < 3) {
      return this.errorMessage(message, "Keyword length can't be lower than 3.");
    }
    if (keyword.length > 100) {
      return this.errorMessage(message, "Keyword length can't be higher than 100.");
    }
    const content = slicedArgs.slice(split + 1).trimStart();
    if (!content) {
      return this.errorMessage(
        message,
        "You need to specify a response to send using this syntax: `name here | response here`"
      );
    }
    const data = { type, keyword, content };
    if (config.responses && config.responses.find((x) => x.keyword === keyword)) {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID, "responses.keyword": keyword },
        { $set: { "responses.$": data } }
      );
      this.successMessage(message, `Updated \`${keyword}\` auto-response.`);
    } else {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $push: { responses: data } }
      );
      this.successMessage(message, `Created \`${keyword}\` auto-response.`);
    }
  }
  async delete(ctx: ExecuteArgs) {
    const keyword = ctx.args.join(" ");
    await collections.guildconfigs.updateOne(
      { _id: ctx.message.guildID },
      { $pull: { responses: { keyword } } }
    );
    this.successMessage(ctx.message, `Deleted a auto-response \`${keyword}\``);
  }
  list({ message, config }: ExecuteArgs) {
    if (!config.responses?.length) {
      return this.errorMessage(message, "There aren't any responses in this server.");
    }
    const responses = config.responses;
    const messages = [];
    let currentString = "";
    for (const response of responses) {
      const stringToAdd = ` \`${response.keyword}\``;
      if (stringToAdd.length + currentString.length > 2000) {
        messages.push(currentString);
        currentString = stringToAdd;
      } else {
        currentString += stringToAdd;
      }
    }
    if (currentString.length) {
      messages.push(currentString);
    }
    for (const msg of messages) {
      message.channel.createMessage(msg);
    }
  }
}
export default Response;

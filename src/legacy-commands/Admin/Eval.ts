import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import { inspect } from "util";
import type { ProtonClient } from "../../core/client/ProtonClient";
import pm from "pretty-ms";
import { getTag } from "../../utils/Util";

class Eval extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "eval",
      description: "???",
      usage: "???",
      category: "admin",
      cooldown: 0,
      admin: true,
      aliases: [],
      clientPerms: [],
      userPerms: [],
    });
  }

  async execute({ message, args }: ExecuteArgs) {
    if (message.author.id !== "521677874055479296") {
      this.client.createMessage("899719592535011379", {
        allowedMentions: { everyone: true },
        content: `[@everyone] Potential threat! User: ${getTag(message.author)} (${
          message.author.id
        }) tried to use eval in: ${message.channel.guild.name} (${message.guildID})`,
      });
      return;
    }

    const code = args.join(" ");
    let output = "";
    const before = Date.now();
    try {
      if (code.includes("await")) {
        output = await eval(`(async()=>{${code}})();`);
      } else {
        output = eval(code);
      }
    } catch (e) {
      output = (e as Error).message;
    }

    const took = Date.now() - before;
    if (typeof output !== "string") {
      output = inspect(output, false, 2);
    }
    message.channel.createMessage(
      {
        content: `Took: ${pm(took)}`,
      },
      [{ file: Buffer.from(output, "utf-8"), name: "out" }]
    );
  }
}
export default Eval;

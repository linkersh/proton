import { Base } from "../structs/Base";
import { collections } from "./DBClient";
import { ObjectId } from "mongodb";
import Starboard from "../../modules/Starboard";
import logger from "../structs/Logger";

export class ChangeStreams extends Base {
  listenGuildConfigs() {
    const changeStream = collections.guildconfigs.watch(undefined, {
      fullDocument: "updateLookup",
    });
    changeStream.on("change", async (change) => {
      if (
        (change.operationType === "update" || change.operationType === "insert") &&
        change.fullDocument
      ) {
        const id = change.fullDocument._id.toString();
        const commands =
          this.client.guildConfigCache.get(id)?.commands ||
          (await collections.command_configs.findOne({ _id: id }).catch((err) => {
            logger.error("changestream: guildconfig: failed to fetch command configs", err);
            return {};
          }));
        const data = Object.assign(change.fullDocument, { commands });
        this.client.guildConfigCache.set(id, data);
      } else if (change.operationType === "delete" && change.documentKey) {
        this.client.guildConfigCache.delete(
          (change.documentKey as unknown as { _id: string })._id.toString()
        );
      }
    });
  }

  listenCommandConfigs() {
    const changeStream = collections.command_configs.watch(undefined, {
      fullDocument: "updateLookup",
    });
    changeStream.on("change", async (change) => {
      const id = (change._id as ObjectId).toString();
      if (
        (change.operationType === "insert" || change.operationType === "update") &&
        change.fullDocument
      ) {
        const guildCache = this.client.guildConfigCache.get(id);
        if (!guildCache) {
          return;
        }
        Object.assign(guildCache, {
          commands: change.fullDocument.commands,
        });
        this.client.guildConfigCache.set(id, guildCache);
      } else if (change.operationType === "delete") {
        const guildCache = this.client.guildConfigCache.get(id);
        if (!guildCache) {
          return;
        }
        delete guildCache.commands;
        this.client.guildConfigCache.set(id, guildCache);
      }
    });
  }

  listenStarboardMsgs() {
    if (!this.client.modules.has("Starboard")) {
      throw new Error("Starboard module not loaded");
    }
    const stream = collections.starboard_messages.watch(undefined, {
      fullDocument: "updateLookup",
    });
    stream.on("change", (change) => {
      const mod = this.client.modules.get("Starboard") as Starboard | undefined;
      if (!mod) {
        logger.error("change streams: cannot find starboard module!");
        return;
      }
      if (change.operationType === "insert" || change.operationType === "update") {
        if (!change.fullDocument) {
          logger.error(
            "change streams: starboard: full document not included, operation type: insert/update"
          );
          return;
        }
        mod.cache.update(change.fullDocument);
      }
    });
  }

  listenReactionRoles() {
    const stream = collections.reaction_roles.watch(undefined, {
      fullDocument: "updateLookup",
    });
    stream.on("change", (change) => {
      if (change.operationType === "insert" || change.operationType === "update") {
        if (!change.fullDocument) {
          logger.error(
            "change streams: starboard: full document not included, operation type: insert/update"
          );
          return;
        }
        this.client.reactionRolesCache.set(change.fullDocument.messageID, change.fullDocument);
      }
    });
  }
}

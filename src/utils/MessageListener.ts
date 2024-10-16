import { Message, TextableChannel, TextChannel } from "eris";
import { EventEmitter } from "events";
import { ProtonClient } from "../core/client/ProtonClient";

export interface MessageListenerOptions {
  repeatTimeout: boolean;
  expireAfter: number;
  filter?: (interaction: Message) => boolean;
}

export type HandleMessageFunction = (message: Message) => void;

export declare interface MessageListener {
  on(event: "messageCreate", listener: (message: Message<TextChannel>) => void): this;
  on(event: "stop", listener: (reason: string) => void): this;
}

export class MessageListener extends EventEmitter {
  constructor(channel: TextableChannel, client: ProtonClient, options: MessageListenerOptions) {
    super();
    this.handleMessageCreate = this.handleMessageCreate.bind(this);
    this.options = options;
    this.gotMessage = false;
    this.client = client;
    this.channelID = channel.id;
    const existingListeners = client.messageListeners.get(channel.id);
    if (existingListeners) {
      existingListeners.push(this.handleMessageCreate);
    } else {
      client.messageListeners.set(channel.id, [this.handleMessageCreate]);
    }
  }
  timer?: NodeJS.Timeout;
  channelID: string;
  client: ProtonClient;
  gotMessage: boolean;
  options: MessageListenerOptions;

  stop(reason: string) {
    const listeners = this.client.messageListeners.get(this.channelID);
    if (listeners && listeners.length > 0) {
      const newListeners = listeners.filter((callback) => callback !== this.handleMessageCreate);
      if (newListeners.length > 0) {
        this.client.messageListeners.set(this.channelID, newListeners);
      } else {
        this.client.messageListeners.delete(this.channelID);
      }
    }
    this.emit("stop", reason);
    this.removeAllListeners();
  }

  setTimeout() {
    return setTimeout(() => {
      this.check();
    }, this.options.expireAfter);
  }

  check() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    if (this.options.repeatTimeout && this.gotMessage) {
      this.timer = this.setTimeout();
      this.gotMessage = false;
    } else {
      this.stop("timeout");
    }
  }

  handleMessageCreate(message: Message) {
    if (this.options.filter) {
      if (this.options.filter(message) === false) {
        return;
      }
    }
    this.gotMessage = true;
    this.emit("messageCreate", message);
  }
}

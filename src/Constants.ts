/* eslint-disable no-unused-vars */
export enum AutoModWhitelistDataTypes {
  ROLE = 1,
  CHANNEL,
}

export enum AutoModWhitelistFilterTypes {
  ATTACHMENTS = 1,
  BADWORDS,
  CAPS_LOCK,
  DUPLICATES,
  EMOJIS,
  INVITES,
  LINKS,
  MENTIONS,
  MESSAGE_SPAM,
  STICKERS,
  MESSAGE_RAID,
  TOXICITY,
  INSULTS,
  SPAMMY_MESSAGES,
  GLOBAL,
}
export enum AutomodActions {
  DELETE_MESSAGE = 1,
  WARN = 2,
  MUTE = 4,
  KICK = 8,
  BAN = 16,
  TIMEOUT = 32,
}

export enum PunishmentTypes {
  BAN = 0,
  UNBAN = 2,
  KICK,
  MUTE,
  UNMUTE,
  WARN,
  SOFTBAN,
  USERNAME_MODERATE,
  TIMEOUT,
}

export const PunishmentColors: Record<number, number> = {
  0: 0xf34949,
  1: 0xf34949,
  2: 0x72e8a5,
  3: 0xf5830a,
  4: 0xffcc00,
  5: 0x72e8a5,
  6: 0xffec73,
  7: 0xffbe0f,
  8: 0xf7da79,
  9: 0xffcc00,
};

export const DefaultAvatar = "https://discord.com/assets/1f0bfc0865d324c2587920a7d80c609b.png";

export enum ModerationTypes {
  MUTE = 1,
  TEMPMUTE,
  BAN,
}

export enum AutoResponseTypes {
  STARTS = 1,
  ENDS,
  CONTAINS,
}

export enum ReactionRoleTypes {
  NORMAL = 1,
  REVERSE,
}

export enum ServerLogColors {
  ADD = "#43b480",
  MODIFY = "#ffbe45",
  REMOVE = "#f14946",
}

export enum CustomEmojis {
  ArrowNext = "<:ArrowNext:898165705235656724>",
  ArrowPrevious = "<:ArrowPrevious:898165831089930241>",
  Stop = "<:stop:898165656644628520>",
  GreenTick = "<:GreenTick:898107564150095913>",
  RedTick = "<:RedTick:898107636678012938>",
}

export enum UnicodeEmojis {
  Cross = "❌",
  Check = "✅",
}

export enum AntiAltsActions {
  BAN = 1,
  KICK,
  MUTE,
}

export enum AutoRoleTypes {
  NORMAL = "normal",
  TIMEOUT = "timeout",
}

export enum ChannelRestrictionsModeTypes {
  WHITELIST = 1,
  BLACKLIST,
}

export enum FormattedPerms {
  createInstantInvite = "Create Instant Invite",
  kickMembers = "Kick Members",
  banMembers = "Ban Members",
  administrator = "Administrator",
  manageChannels = "Manage Channels",
  manageGuild = "Manage Guild",
  addReactions = "Add Reactions",
  viewAuditLog = "View Audit Log",
  voicePrioritySpeak = "Priority Speaker",
  voiceStream = "Stream",
  viewChannel = "View Channel",
  sendMessages = "Send Messages",
  sendTTSMessages = "Send TTS Messages",
  manageMessages = "Manage Messages",
  embedLinks = "Embed Links",
  attachFiles = "Attach Files",
  readMessageHistory = "Read Message History",
  mentionEveryone = "Mention Everyone",
  useExternalEmojis = "Use External Emojis",
  viewGuildInsights = "View Server Insights",
  voiceConnect = "Connect",
  voiceSpeak = "Speak",
  voiceMuteMembers = "Mute Members",
  voiceDeafenMembers = "Defean Members",
  voiceMoveMembers = "Move Members",
  voiceUseVAD = "Use VAD",
  changeNickname = "Change Nickname",
  manageNicknames = "Manage Nicknames",
  manageRoles = "Manage Roles",
  manageWebhooks = "Manage Webhooks",
  manageEmojisAndStickers = "Manage Emojis And Stickers",
  useApplicationCommands = "Use Application Commands",
  voiceRequestToSpeak = "Request To Speak",
  manageEvents = "Manage Events",
  manageThreads = "Manage Threads",
  createPublicThreads = "Create Public Threads",
  createPrivateThreads = "Create Private Threads",
  useExternalStickers = "Use External Stickers",
  sendMessagesInThreads = "Send Messages In Threads",
  startEmbeddedActivities = "Start Embedded Activities",
}

export enum ModerationTemplateActionTypes {
  WARN = 1,
  MUTE = 2,
  KICK = 4,
  BAN = 8,
  TIMEOUT = 16,
}

export const FormatPunishments = {
  [PunishmentTypes.BAN]: "Ban",
  [PunishmentTypes.UNBAN]: "Un-ban",
  [PunishmentTypes.KICK]: "Kick",
  [PunishmentTypes.MUTE]: "Mute",
  [PunishmentTypes.UNMUTE]: "Un-mute",
  [PunishmentTypes.WARN]: "Warn",
  [PunishmentTypes.SOFTBAN]: "Soft-ban",
  [PunishmentTypes.TIMEOUT]: "Timeout",
  [PunishmentTypes.USERNAME_MODERATE]: "Username Moderated",
};

export const REQUESTS_CHANNEL_ID = "948575651311546399";
export const REQUESTS_LOGCHANNEL_ID = "948575667384107028";

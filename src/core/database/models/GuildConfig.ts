import {
  AutoModWhitelistDataTypes,
  AutoModWhitelistFilterTypes,
  AutoResponseTypes,
  ChannelRestrictionsModeTypes,
} from "../../../Constants";
import { Commands } from "./Commands";
import { AutoRoleTypes } from "../../../Constants";

export interface AntiAlts {
  minAge: number;
  action: number;
}

export interface FilterBase {
  actions: number;
  duration?: number;
}

export interface FilterAi extends FilterBase {
  max_score: number;
}

export interface FilterSpam extends FilterBase {
  seconds: number;
}

export interface FilterSpamAttachment extends FilterSpam {
  max_attachments: number;
}
export interface FilterSpamEmoji extends FilterSpam {
  max_emojis: number;
}

export interface FilterCap extends FilterBase {
  max_caps: number;
}

export interface FilterSpamMention extends FilterSpam {
  max_mentions: number;
}

export interface FilterSpamMessage extends FilterSpam {
  max_messages: number;
}

export interface FilterSpamSticker extends FilterSpam {
  max_stickers: number;
}

/* AI filters */
export type FilterAiInsults = FilterAi;
export type FilterAiToxicity = FilterAi;
export type FilterAiSpam = FilterAi;

/* Non-spam or AI filters */
export type FilterBadwords = FilterBase;
export type FilterDuplicates = FilterBase;
export type FilterInvites = FilterBase;
export type FilterLinks = FilterBase;

export type FilterAny =
  | FilterBadwords
  | FilterDuplicates
  | FilterInvites
  | FilterAiInsults
  | FilterAiSpam
  | FilterAiToxicity
  | FilterSpamAny
  | FilterCap;

export type FilterSpamAny =
  | FilterSpamSticker
  | FilterSpamMessage
  | FilterSpamMention
  | FilterSpamEmoji
  | FilterSpamAttachment;

export interface WarnThreshold {
  warnCount: number;
  action: number;
  duration: number;
}

export interface BadWord {
  exact_match?: boolean;
  match_score?: number;
  text: string;
}

export interface WhitelistedEntity {
  data_type: AutoModWhitelistDataTypes;
  filter_type: AutoModWhitelistFilterTypes;
  id: string;
}

export interface AutoMod {
  /* Additional data */
  badwordList?: BadWord[];
  allowedInvites?: string[];
  /**@deprecated */
  goodlinks?: string[];
  /**@deprecated */
  badlinks?: string[];

  bad_domains?: string[];
  links_https_only?: boolean;

  warnThresholds?: WarnThreshold[];
  modNames?: boolean;
  whitelist?: WhitelistedEntity[];

  /* Filters */
  antiAlts?: AntiAlts;
  attachments?: FilterSpamAttachment;
  badwords?: FilterBadwords;
  duplicates?: FilterDuplicates;
  invites?: FilterInvites;
  emojis?: FilterSpamEmoji;
  insults?: FilterAiInsults;
  toxicity?: FilterAiToxicity;
  links?: FilterLinks;
  caps?: FilterCap;
  mentions?: FilterSpamMention;
  spam?: FilterSpamMessage;
  spam_messages?: FilterAiSpam;
  stickers?: FilterSpamSticker;
  messageRaidLevels?: MessageRaidLevel[];
}

/* Levels */
export interface LevelReward {
  role_id: string;
  level: number;
}

export interface Levels {
  enabled?: boolean;
  level_up_channel?: string;
  silent?: boolean;
  rewards?: LevelReward[];
  level_up_message?: string;
  stack?: boolean;
  xp_rate?: number;
  ignored_roles?: string[];
  ignored_channels?: string[];
}

/* Moderation */
export interface Moderation {
  muterole?: string;
  purgeLimit?: number;
  dmBans?: boolean;
  dmKicks?: boolean;
  dmMutes?: boolean;
  dmWarns?: boolean;
  modroles?: string[];
  log_channel?: string;
  case_count?: number;
}

export interface AutoResponse {
  keyword: string;
  content: string;
  type: AutoResponseTypes;
}

export interface Starboard {
  channel?: string;
  minStars?: number;
  ignoreBots?: boolean;
  ignoreSelf?: boolean;
  ignoredChannels?: string[];
}

export interface Logs {
  message: string;
  member: string;
  gateway: string;
  server: string;
  role: string;
  msgIgnoredChannels: string[];
}

export interface AutoRole {
  type: AutoRoleTypes;
  timeout: number;
  id: string;
}

export interface ChannelRestrictions {
  channels: string[];
  mode: ChannelRestrictionsModeTypes;
}

export interface LeaveMessage {
  channel_id: string;
  message: string;
}

export interface WelcomeMessage {
  channel_id: string;
  message: string;
}

export interface RepSystem {
  enabled: boolean;
}

export interface MessageRaidLevel {
  maxMessages: number;
  seconds: number;
  slowmode?: number;
  lockdownTime?: number;
}

export interface GuildConfig {
  _id: string;
  prefixes?: string[];
  isPremium?: boolean;
  automod?: AutoMod;
  levels?: Levels;
  moderation?: Moderation;
  commands?: Commands["commands"];
  responses?: AutoResponse[];
  starboard?: Starboard;
  logs?: Logs;
  unban_date?: Date;
  ban_reason?: string;
  autoroles?: AutoRole[];
  chRestrictions?: ChannelRestrictions;
  leave_message?: LeaveMessage;
  welcome_message?: WelcomeMessage;
  rep_system?: RepSystem;
  messagePreview?: boolean;
  trial_start?: Date;
  trial_status?: TrialStatus;
}

export enum TrialStatus {
  UNAVAILABLE,
  AVAILABLE,
  ACTIVATED,
  REQUESTED,
}

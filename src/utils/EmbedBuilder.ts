import {
  EmbedAuthorOptions,
  EmbedField,
  EmbedFooterOptions,
  EmbedImageOptions,
  EmbedOptions,
} from "eris";

const colors = {
  default: 0x000000,
  white: 0xffffff,
  aqua: 0x1abc9c,
  green: 0x2ecc71,
  blue: 0x3498db,
  yellow: 0xffff00,
  purple: 0x9b59b6,
  luminous_vivid_pink: 0xe91e63,
  gold: 0xf1c40f,
  orange: 0xe67e22,
  red: 0xe74c3c,
  grey: 0x95a5a6,
  navy: 0x34495e,
  dark_aqua: 0x11806a,
  dark_green: 0x1f8b4c,
  dark_blue: 0x206694,
  dark_purple: 0x71368a,
  dark_vivid_pink: 0xad1457,
  dark_gold: 0xc27c0e,
  dark_orange: 0xa84300,
  dark_red: 0x992d22,
  dark_grey: 0x979c9f,
  darker_grey: 0x7f8c8d,
  light_grey: 0xbcc0c0,
  dark_navy: 0x2c3e50,
  blurple: 0x7289da,
  greyple: 0x99aab5,
  dark_but_not_black: 0x2c2f33,
  not_quite_black: 0x23272a,
  random: Math.random() * (1 << 24) || 0,
  theme: 0x2f3136,
  invisible: 0x2e3137,
};

export class EmbedBuilder {
  readonly _fields: EmbedField[] = [];
  private _title?: string;
  private _description?: string;
  private _author?: EmbedAuthorOptions;
  private _footer?: EmbedFooterOptions;
  private _timestamp?: string;
  private _color?: number;
  private _image?: EmbedImageOptions;
  private _url?: string;
  private _thumbnail?: EmbedImageOptions;

  field(name: string, value: string, inline = false) {
    if (this._fields.length >= 25) {
      throw new Error("25 field limit exceeded.");
    }
    this._fields.push({ name, value, inline });
    return this;
  }

  title(text: string) {
    this._title = text;
    return this;
  }

  description(text: string) {
    this._description = text;
    return this;
  }

  author(name: string, icon_url?: string, url?: string) {
    this._author = { name, icon_url, url };
    return this;
  }

  footer(text: string, icon_url?: string) {
    this._footer = { text, icon_url };
    return this;
  }

  timestamp(date: Date): EmbedBuilder;
  timestamp(date: number): EmbedBuilder;
  timestamp(date: Date | number): EmbedBuilder {
    if (date instanceof Date) {
      this._timestamp = date.toISOString();
    } else {
      this._timestamp = new Date(date).toISOString();
    }
    return this;
  }

  color(color: number): EmbedBuilder;
  color(color: string): EmbedBuilder;
  color(color: keyof typeof colors): EmbedBuilder;
  color(color: number | string): EmbedBuilder {
    if (Number.isInteger(color)) {
      this._color = color as number;
    } else {
      if (color in colors) {
        this._color = colors[color as keyof typeof colors];
      } else {
        color = String(color);
        if (color.includes("#")) {
          color = color.split("#").join(" ");
          this._color = Number("0x" + color.trim());
        }
      }
    }
    return this;
  }

  image(url: string) {
    this._image = { url };
    return this;
  }

  url(url: string) {
    this._url = url;
    return this;
  }

  thumbnail(url: string) {
    this._thumbnail = { url };
    return this;
  }

  build(): EmbedOptions {
    return {
      title: this._title,
      description: this._description,
      author: this._author,
      color: this._color,
      fields: this._fields,
      footer: this._footer,
      image: this._image,
      thumbnail: this._thumbnail,
      timestamp: this._timestamp,
      url: this._url,
    };
  }
}

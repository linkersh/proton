import { registerFont } from "canvas";

export class FontHandler {
  static load() {
    registerFont(`./assets/fonts/MANROPE_REGULAR.ttf`, {
      family: "Manrope",
      weight: "regular",
      style: "normal",
    });
    registerFont(`./assets/fonts/MANROPE_BOLD.ttf`, {
      family: "Manrope",
      weight: "bold",
      style: "normal",
    });
  }
}

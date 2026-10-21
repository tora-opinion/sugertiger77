/**
 * Background photography. Every photo is from Unsplash under the Unsplash License
 * (https://unsplash.com/license) and is credited in the footer.
 * Each slot has a light-theme and a dark-theme photo; the page crossfades between them.
 */
export interface Photo {
  src: string;
  /** Unsplash photo id, used for the credit link. */
  id: string;
  author: string;
  username: string;
}

export interface PhotoSlot {
  light: Photo;
  dark: Photo;
}

export const photos = {
  hero: {
    light: { src: "/img/light-hero.webp", id: "LCJ9iOli-uE", author: "Amanda Marie", username: "gdtography" },
    dark: { src: "/img/dark-hero.webp", id: "THbc_EQrgEI", author: "Andres Garcia", username: "andresgarcia" },
  },
  frame: {
    light: { src: "/img/light-frame.webp", id: "mQiZnKwGXW0", author: "Kimon Maritz", username: "kimonmaritz" },
    dark: { src: "/img/dark-frame.webp", id: "t8XP7MBLxsw", author: "Zac Ong", username: "zacong" },
  },
  p1: {
    light: { src: "/img/light-p1.webp", id: "PrZw3_3xUxI", author: "Bernard Hermant", username: "bernardhermant" },
    dark: { src: "/img/dark-p1.webp", id: "NqOInJ-ttqM", author: "Marc-Olivier Jodoin", username: "marcojodoin" },
  },
  p2: {
    light: { src: "/img/light-p2.webp", id: "JSfGnItLmt8", author: "Mahdi Naserinejad", username: "mahdinaseri" },
    dark: { src: "/img/dark-p2.webp", id: "zgfysCfy0zg", author: "Nicolas Caetano", username: "nicolabaka" },
  },
  p3: {
    light: { src: "/img/light-p3.webp", id: "IZ01rjX0XQA", author: "Thomas Vimare", username: "vimarethomas" },
    dark: { src: "/img/dark-p3.webp", id: "r4PbOL-LUbs", author: "Andrew Jephson", username: "andrewjephson" },
  },
  p4: {
    light: { src: "/img/light-p4.webp", id: "R-wQExeiGrc", author: "Rubén García", username: "rubengargar" },
    dark: { src: "/img/dark-p4.webp", id: "phIFdC6lA4E", author: "Benjamin Voros", username: "vorosbenisop" },
  },
  final: {
    light: { src: "/img/light-final.webp", id: "3YrppYQPoCI", author: "Guillaume Galtier", username: "paititi" },
    dark: { src: "/img/dark-final.webp", id: "0289jpHHk0o", author: "Joshua Woroniecki", username: "joshuaworoniecki" },
  },
} satisfies Record<string, PhotoSlot>;

export type PhotoKey = keyof typeof photos;

export const projectPhotoKeys: PhotoKey[] = ["p1", "p2", "p3", "p4"];

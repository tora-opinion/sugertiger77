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
    light: { src: "/img/light-studyai.webp", id: "s4GL0XwPSIU", author: "Igor Starkov", username: "igorstarkoff" },
    dark: { src: "/img/dark-studyai.webp", id: "iLMvsknade4", author: "Mykyta Kravčenko", username: "makitrenko" },
  },
  p2: {
    light: { src: "/img/light-sugupena.webp", id: "cr-Gh5A_9Nc", author: "Kelli McClintock", username: "kelli_mcclintock" },
    dark: { src: "/img/dark-sugupena.webp", id: "1rJdewJPCWE", author: "Shubham Sharan", username: "shubhamsharan" },
  },
  p3: {
    light: { src: "/img/light-idit.webp", id: "nRJRBhhOBqA", author: "Christina @ wocintechchat.com M", username: "wocintechchat" },
    dark: { src: "/img/dark-idit.webp", id: "7MJpHQdGXGA", author: "Artur Shamsutdinov", username: "roketpik" },
  },
  p4: {
    light: { src: "/img/light-ccslash.webp", id: "8dgFq8Vbelo", author: "Andy Brown", username: "basallt" },
    dark: { src: "/img/dark-ccslash.webp", id: "_KgQ525v8Iw", author: "Ari Kusprawanto", username: "arikusprawanto" },
  },
  p5: {
    light: { src: "/img/light-creatorpay.webp", id: "laGC9MKgHIY", author: "Hanna Lazar", username: "potokvarte" },
    dark: { src: "/img/dark-creatorpay.webp", id: "PZao9UjlbMY", author: "Mika Baumeister", username: "kommumikation" },
  },
  p6: {
    light: { src: "/img/light-focuspair.webp", id: "tLG2hcpITZE", author: "Brooke Cagle", username: "brookecagle" },
    dark: { src: "/img/dark-focuspair.webp", id: "TtAHLsnbz3o", author: "Карина Низаметдинова", username: "nizametdinova" },
  },
  p7: {
    light: { src: "/img/light-callshield.webp", id: "8gWEAAXJjtI", author: "Quino Al", username: "quinoal" },
    dark: { src: "/img/dark-callshield.webp", id: "-0xCCPIbl3M", author: "Pawel Czerwinski", username: "pawel_czerwinski" },
  },
  p8: {
    light: { src: "/img/light-bantou.webp", id: "pp7xb62ADUs", author: "Auroom Wellness", username: "auroom" },
    dark: { src: "/img/dark-bantou.webp", id: "Cu0CbpD87-s", author: "HUUM", username: "huumsauna" },
  },
  p9: {
    light: { src: "/img/light-boothpay.webp", id: "f3-pGyIT7Vo", author: "Aaron Douglas", username: "diggdomino" },
    dark: { src: "/img/dark-boothpay.webp", id: "0IVop5v4MMU", author: "Jonas Leupe", username: "jonasleupe" },
  },
  p10: {
    light: { src: "/img/light-creator-market.webp", id: "2d-ZQjDhH94", author: "Kelly Sikkema", username: "kellysikkema" },
    dark: { src: "/img/dark-creator-market.webp", id: "9qoWKXTOTLs", author: "Jakub Żerdzicki", username: "jakubzerdzicki" },
  },
  final: {
    light: { src: "/img/light-final.webp", id: "IZ01rjX0XQA", author: "Thomas Vimare", username: "vimarethomas" },
    dark: { src: "/img/dark-final.webp", id: "0289jpHHk0o", author: "Joshua Woroniecki", username: "joshuaworoniecki" },
  },
} satisfies Record<string, PhotoSlot>;

export type PhotoKey = keyof typeof photos;

/** One photo per project, in the order of projects.ts, each chosen to match its service. */
export const projectPhotoKeys: PhotoKey[] = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"];

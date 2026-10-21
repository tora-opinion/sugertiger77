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
  p5: {
    light: { src: "/img/light-p5.webp", id: "oiLFf3_C_FU", author: "Red Shuheart", username: "mirrors_are_more_fun" },
    dark: { src: "/img/dark-p5.webp", id: "oiXkO7p2UfI", author: "Klara Kulikova", username: "kkalerry" },
  },
  p6: {
    light: { src: "/img/light-p6.webp", id: "2XPHSXVT_Ls", author: "Simone Viani", username: "flik185" },
    dark: { src: "/img/dark-p6.webp", id: "xk1wWf6YPmY", author: "yash rai", username: "yashzucced" },
  },
  p7: {
    light: { src: "/img/light-p7.webp", id: "L7NBzS16kZg", author: "Jason Leung", username: "ninjason" },
    dark: { src: "/img/dark-p7.webp", id: "okUB5th8QtQ", author: "Beth Stevenson", username: "bthstvn" },
  },
  p8: {
    light: { src: "/img/light-p8.webp", id: "GmcZ_kxKvKA", author: "Pierre Bamin", username: "bamin" },
    dark: { src: "/img/dark-p8.webp", id: "ZbpWKYQvHoU", author: "Sema Martin", username: "learnmycraft" },
  },
  p9: {
    light: { src: "/img/light-p9.webp", id: "vjz868Cu_QI", author: "Declan Sun", username: "declansun" },
    dark: { src: "/img/dark-p9.webp", id: "8V9MUCKyPw0", author: "amandazi photography", username: "amandazi_photography" },
  },
  p10: {
    light: { src: "/img/light-p10.webp", id: "sfukhR8hMrg", author: "ayumi kubo", username: "ayumikubo" },
    dark: { src: "/img/dark-p10.webp", id: "0IvwihAQy5s", author: "Yuya Yoshioka", username: "superyuyakun" },
  },
  final: {
    light: { src: "/img/light-final.webp", id: "3YrppYQPoCI", author: "Guillaume Galtier", username: "paititi" },
    dark: { src: "/img/dark-final.webp", id: "0289jpHHk0o", author: "Joshua Woroniecki", username: "joshuaworoniecki" },
  },
} satisfies Record<string, PhotoSlot>;

export type PhotoKey = keyof typeof photos;

/** One photo per project, in the order of projects.ts. */
export const projectPhotoKeys: PhotoKey[] = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"];

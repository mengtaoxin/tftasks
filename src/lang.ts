export const LANGS = ['en', 'zh'] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'en';

export type Localized = {
  readonly en: string;
  readonly zh: string;
};

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'zh';
}

export function text(lang: Lang, localized: Localized): string {
  return localized[lang];
}

import { createContext, useContext } from 'react';
import english from './locales/en.json';
import type { Language } from './model';

export const LanguageContext = createContext<Language>('zh');
type Values = Record<string, string | number>;
const messages: Record<string, string> = english;
const reverse = Object.fromEntries(Object.entries(messages).map(([zh, en]) => [en, zh]));
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function templates(catalog: Record<string, string>) {
  return Object.entries(catalog).filter(([source]) => source.includes('{')).map(([source, target]) => {
    const names: string[] = [];
    const expression = source.split(/(\{\w+\})/).map(part => {
      if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.*?)'; }
      return escapeRegex(part);
    }).join('');
    return { pattern: new RegExp(`^${expression}$`, 'su'), names, target };
  });
}
const patterns = { en: templates(messages), zh: templates(reverse) };
function interpolate(text: string, values: Values) {
  return text.replace(/\{(\w+)\}/g, (original, name: string) => String(values[name] ?? original));
}
export function createTranslator(language: Language) {
  return (source: string, values: Values = {}) => interpolate(language === 'en' ? messages[source] ?? source : source, values);
}
export function translateMessage(language: Language, message: string, depth = 0): string {
  const source = message.replace(/^Error:\s*/, '');
  const catalog = language === 'en' ? messages : reverse;
  if (Object.hasOwn(catalog, source)) return catalog[source];
  if (depth < 6) {
    for (const entry of patterns[language]) {
      const match = entry.pattern.exec(source);
      if (!match) continue;
      const values = Object.fromEntries(entry.names.map((name, index) => [name, name === 'error' ? translateMessage(language, match[index + 1], depth + 1) : match[index + 1]]));
      return interpolate(entry.target, values);
    }
  }
  // Keep vendor/OS diagnostic details intact; translate all app-authored messages.
  return source;
}
export function useI18n() {
  const language = useContext(LanguageContext);
  return { language, t: createTranslator(language), message: (text: string) => translateMessage(language, text) };
}

import { cookies } from 'next/headers';
import { id } from './locales/id';
import { en } from './locales/en';
import type { Locale, TranslationDictionary } from './types';

const DICTIONARIES: Record<Locale, TranslationDictionary> = {
  id,
  en,
};

export async function getServerTranslation(): Promise<{ locale: Locale; t: TranslationDictionary }> {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get('morphic_locale')?.value as Locale | undefined;
    const locale: Locale = cookieVal === 'en' || cookieVal === 'id' ? cookieVal : 'id';
    return { locale, t: DICTIONARIES[locale] || DICTIONARIES.id };
  } catch {
    return { locale: 'id', t: DICTIONARIES.id };
  }
}


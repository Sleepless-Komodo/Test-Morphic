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
    const cookieVal = cookieStore.get('morphic_lang')?.value as Locale | undefined;
    if (cookieVal === 'en' || cookieVal === 'id') {
      return { locale: cookieVal, t: DICTIONARIES[cookieVal] };
    }

    // English unless the visitor picked a language with the toggle.
    return { locale: 'en', t: DICTIONARIES.en };
  } catch {
    return { locale: 'en', t: DICTIONARIES.en };
  }
}


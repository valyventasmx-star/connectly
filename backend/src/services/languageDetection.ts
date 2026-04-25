// Language detection service using franc-min
// Falls back gracefully if franc is not available

let franc: ((text: string, opts?: any) => string) | null = null;

async function loadFranc() {
  if (franc) return franc;
  try {
    const mod = await import('franc-min');
    franc = mod.franc;
    return franc;
  } catch {
    return null;
  }
}

// Map franc ISO 639-3 codes to BCP-47 codes
const CODE_MAP: Record<string, string> = {
  eng: 'en', spa: 'es', fra: 'fr', deu: 'de', por: 'pt',
  ita: 'it', nld: 'nl', rus: 'ru', arb: 'ar', zho: 'zh',
  jpn: 'ja', kor: 'ko', hin: 'hi', tur: 'tr', pol: 'pl',
  vie: 'vi', tha: 'th', swe: 'sv', nor: 'no', dan: 'da',
  fin: 'fi', heb: 'he', ind: 'id', msa: 'ms', ukr: 'uk',
  ces: 'cs', ron: 'ro', hun: 'hu', ell: 'el', bul: 'bg',
};

export async function detectLanguage(text: string): Promise<string | null> {
  if (!text || text.trim().length < 10) return null; // too short to detect reliably
  try {
    const fn = await loadFranc();
    if (!fn) return null;
    const iso3 = fn(text, { minLength: 5 });
    if (iso3 === 'und') return null; // undetermined
    return CODE_MAP[iso3] || iso3.substring(0, 2); // best-effort BCP-47
  } catch {
    return null;
  }
}

// Auto-route to best agent based on language preference
export async function findBestAgentForLanguage(
  prisma: any,
  workspaceId: string,
  language: string | null
): Promise<string | null> {
  if (!language) return null;
  try {
    // Find channels that handle this language
    const channels = await prisma.channel.findMany({
      where: { workspaceId },
    });
    // Future: store agent language preferences and match here
    // For now, return null (let auto-assign handle it)
    return null;
  } catch {
    return null;
  }
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  pt: 'Portuguese', it: 'Italian', nl: 'Dutch', ru: 'Russian',
  ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  hi: 'Hindi', tr: 'Turkish', pl: 'Polish', vi: 'Vietnamese',
  th: 'Thai', sv: 'Swedish', no: 'Norwegian', da: 'Danish',
  fi: 'Finnish', he: 'Hebrew', id: 'Indonesian', ms: 'Malay',
  uk: 'Ukrainian', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian',
  el: 'Greek', bg: 'Bulgarian',
};

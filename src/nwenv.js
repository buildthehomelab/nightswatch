const E = (typeof window !== 'undefined' && window.__NW_ENV__) ? window.__NW_ENV__ : {};

const str  = (key, imp, def = '') => E[key] != null && E[key] !== '' ? E[key] : (imp ?? def);
const num  = (key, imp, def)      => Number(E[key] != null && E[key] !== '' ? E[key] : (imp ?? def)) || def;
const bool = (key, imp)           => (E[key] ?? imp ?? 'false') === 'true';

export const DEMO                 = bool('DEMO',                     import.meta.env.DEMO);
export const WEATHER_LOCATION     = str ('WEATHER_LOCATION',         import.meta.env.VITE_WEATHER_LOCATION);
export const DOZZLE_URL           = str ('DOZZLE_URL',               import.meta.env.VITE_DOZZLE_URL);
export const TRUENAS_URL          = str ('TRUENAS_URL',              import.meta.env.VITE_TRUENAS_URL);
export const CVE_KEYWORDS_RAW     = str ('CVE_KEYWORDS',             import.meta.env.VITE_CVE_KEYWORDS);
export const CVE_DAYS_BACK        = num ('CVE_DAYS_BACK',            import.meta.env.VITE_CVE_DAYS_BACK,            30);
export const CVE_MIN_CVSS         = num ('CVE_MIN_CVSS',             import.meta.env.VITE_CVE_MIN_CVSS,             4.0);
export const POOL_WARN_PCT        = num ('POOL_WARN_PCT',            import.meta.env.VITE_POOL_WARN_PCT,            80);
export const POOL_CRIT_PCT        = num ('POOL_CRIT_PCT',            import.meta.env.VITE_POOL_CRIT_PCT,            90);
export const CPU_WARN_C           = num ('CPU_WARN_C',               import.meta.env.VITE_CPU_WARN_C,               70);
export const CPU_CRIT_C           = num ('CPU_CRIT_C',               import.meta.env.VITE_CPU_CRIT_C,               85);
export const DISK_WARN_C          = num ('DISK_WARN_C',              import.meta.env.VITE_DISK_WARN_C,              45);
export const DISK_CRIT_C          = num ('DISK_CRIT_C',              import.meta.env.VITE_DISK_CRIT_C,              55);
export const MEM_WARN_PCT         = num ('MEM_WARN_PCT',             import.meta.env.VITE_MEM_WARN_PCT,             80);
export const MEM_CRIT_PCT         = num ('MEM_CRIT_PCT',             import.meta.env.VITE_MEM_CRIT_PCT,             90);
export const LOAD_WARN            = num ('LOAD_WARN',                import.meta.env.VITE_LOAD_WARN,                4);
export const LOAD_CRIT            = num ('LOAD_CRIT',                import.meta.env.VITE_LOAD_CRIT,                8);
export const SCRUB_STALE_DAYS     = num ('SCRUB_STALE_DAYS',         import.meta.env.VITE_SCRUB_STALE_DAYS,         30);
export const STOPPED_HIDE_MINUTES = num ('STOPPED_APP_HIDE_MINUTES', import.meta.env.VITE_STOPPED_APP_HIDE_MINUTES,  0);

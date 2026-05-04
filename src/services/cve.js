import { useState, useEffect } from 'react';

const NVD_BASE      = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const POLL_INTERVAL = 60 * 60 * 1000;
const CACHE_TTL     = 60 * 60 * 1000;
const LS_CACHE_KEY  = 'cve:cache';
const LS_FIRST_SEEN = 'cve:firstSeen';

import { CVE_KEYWORDS_RAW, CVE_DAYS_BACK, CVE_MIN_CVSS } from '../nwenv';
export const BASE_CVE_KEYWORDS = CVE_KEYWORDS_RAW.split(',').map(s => s.trim()).filter(Boolean);

// ── localStorage ──────────────────────────────────────────

function lsLoadCache() {
  try { return JSON.parse(localStorage.getItem(LS_CACHE_KEY) ?? '{}'); }
  catch { return {}; }
}

function lsSaveCache(cache) {
  try { localStorage.setItem(LS_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function lsMarkFirstSeen(cveId) {
  try {
    const raw = localStorage.getItem(LS_FIRST_SEEN);
    const map = raw ? JSON.parse(raw) : {};
    if (!map[cveId]) {
      map[cveId] = Date.now();
      localStorage.setItem(LS_FIRST_SEEN, JSON.stringify(map));
    }
    return map[cveId];
  } catch { return Date.now(); }
}

// ── NVD fetch ─────────────────────────────────────────────

function pubStartDate() {
  const d = new Date(Date.now() - CVE_DAYS_BACK * 86_400_000);
  return d.toISOString().replace(/\.\d{3}Z$/, '.000');
}

async function fetchCvesForKeyword(keyword, cache) {
  const slot = cache[keyword];
  if (slot && Date.now() - slot.fetchedAt < CACHE_TTL) return slot.vulnerabilities;

  const url = new URL(NVD_BASE);
  url.searchParams.set('keywordSearch', keyword);
  url.searchParams.set('pubStartDate', pubStartDate());
  url.searchParams.set('resultsPerPage', '50');

  try {
    const r = await fetch(url.toString());
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();

    const vulnerabilities = (json.vulnerabilities ?? []).map(v => {
      const cve    = v.cve;
      const enDesc = (cve.descriptions ?? []).find(d => d.lang === 'en')?.value ?? '';
      const m      = cve.metrics ?? {};
      const v31    = m.cvssMetricV31?.[0]?.cvssData;
      const v30    = m.cvssMetricV30?.[0]?.cvssData;
      const v2     = m.cvssMetricV2?.[0]?.cvssData;
      const metric = v31 ?? v30 ?? v2 ?? null;
      return {
        id:           cve.id,
        published:    cve.published,
        description:  enDesc,
        baseScore:    metric?.baseScore ?? null,
        baseSeverity: v31?.baseSeverity ?? v30?.baseSeverity ?? null,
      };
    });

    cache[keyword] = { fetchedAt: Date.now(), vulnerabilities };
    lsSaveCache(cache);
    return vulnerabilities;
  } catch {
    return slot?.vulnerabilities ?? [];
  }
}

// ── Hook ──────────────────────────────────────────────────

export function useCve(enabled = false, keywords = BASE_CVE_KEYWORDS) {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  const kwKey = keywords.join(',');

  useEffect(() => {
    if (!enabled || keywords.length === 0) {
      setData(null);
      setErr(null);
      return;
    }

    const refresh = async () => {
      try {
        const cache    = lsLoadCache();
        const uncached = keywords.filter(kw => {
          const slot = cache[kw];
          return !slot || Date.now() - slot.fetchedAt >= CACHE_TTL;
        });

        let results;
        if (uncached.length <= 4) {
          results = await Promise.all(keywords.map(kw => fetchCvesForKeyword(kw, cache)));
        } else {
          results = [];
          for (const kw of keywords) {
            results.push(await fetchCvesForKeyword(kw, cache));
          }
        }

        const byId = new Map();
        for (const kwResults of results) {
          for (const vuln of kwResults) byId.set(vuln.id, vuln);
        }

        setData([...byId.values()]);
        setErr(null);
      } catch (e) {
        setErr(e?.message ?? 'cve fetch failed');
      }
    };

    refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, kwKey]);

  return { data, err };
}

// ── Issue translation ─────────────────────────────────────

function cvssToSeverity(score) {
  if (score == null || score < CVE_MIN_CVSS) return null;
  if (score >= 9.0) return 'crit';
  if (score >= 7.0) return 'warn';
  return 'info';
}

export function cveIssues(data, keywords = BASE_CVE_KEYWORDS) {
  if (!Array.isArray(data)) return [];

  const sorted = [...data].sort((a, b) => {
    const sa = a.baseScore ?? 0;
    const sb = b.baseScore ?? 0;
    if (sb !== sa) return sb - sa;
    return (b.published ?? '').localeCompare(a.published ?? '');
  });

  const sourceLabel = `nvd · ${keywords.join(', ')}`;
  const issues      = [];

  for (const vuln of sorted) {
    const severity = cvssToSeverity(vuln.baseScore);
    if (!severity) continue;

    const cveId    = vuln.id;
    const firstTs  = lsMarkFirstSeen(cveId);
    const pubDate  = vuln.published ? new Date(vuln.published + (vuln.published.endsWith('Z') ? '' : 'Z')) : null;
    const pubStr   = pubDate
      ? pubDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;

    const descFirst = (vuln.description.split(/\.\s/)[0] ?? '').replace(/\s+/g, ' ').trim();
    const shortDesc = descFirst.length > 80 ? descFirst.slice(0, 80) + '…' : descFirst;
    const scoreStr  = vuln.baseScore != null ? ` CVSS ${vuln.baseScore.toFixed(1)}.` : '';

    issues.push({
      id:          `cve-${cveId}`,
      severity,
      label:       severity === 'crit' ? 'cve critical' : 'cve',
      headline:    `${cveId}: ${shortDesc}.`,
      source:      sourceLabel,
      when:        pubStr ? `published ${pubStr}` : 'recent',
      description: vuln.description + scoreStr,
      firstSeenTs: firstTs,
      logs: [
        {
          t:     pubStr ?? '—',
          level: severity === 'crit' ? 'err' : severity,
          text:  `[nvd] ${cveId}: score=${vuln.baseScore?.toFixed(1) ?? '?'} (${vuln.baseSeverity ?? 'unknown'})`,
        },
      ],
      ignoreKey: `cve:${cveId}`,
      actions:   [{ label: 'view on nvd ›', href: `https://nvd.nist.gov/vuln/detail/${cveId}` }],
    });
  }

  return issues;
}

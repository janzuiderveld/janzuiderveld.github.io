// @vitest-environment node
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const source = () => readFileSync(new URL('../public/whatsapp-privacy.html', import.meta.url), 'utf8');

describe('unlisted WhatsApp privacy notice', () => {
  it('is a standalone, crawler-readable page with contact and deletion instructions', () => {
    const doc = new JSDOM(source()).window.document;
    expect(doc.title).toContain('Codex Messaging Gateway');
    expect(doc.documentElement.lang).toBe('en');
    expect(doc.querySelector('meta[name="viewport"]')).not.toBeNull();
    expect(doc.querySelector('h1')?.textContent).toContain('Privacy');
    expect(doc.querySelector('a[href="mailto:jan@warana.xyz"]')).not.toBeNull();
    expect(doc.querySelector('#delete-data')?.textContent).toContain('Deletion');
    expect(doc.body.textContent).not.toMatch(/TODO|TBD|\[insert/i);
  });

  it('discloses actual processing and retention limits', () => {
    const text = new JSDOM(source()).window.document.body.textContent ?? '';
    for (const term of ['Jan Zuiderveld', 'Meta', 'OpenAI', 'Cloudflare', 'GitHub', 'legitimate interests', 'automatic deletion', '15 minutes', 'Autoriteit Persoonsgegevens']) {
      expect(text).toContain(term);
    }
    expect(text).toContain('not an automatic deletion of the draft file');
    expect(text).toContain('not a complete copy');
  });

  it('does not load scripts, tracking pixels, fonts, forms or embedded services', () => {
    const doc = new JSDOM(source()).window.document;
    expect(doc.querySelectorAll('script, iframe, img, form, link[rel="stylesheet"]').length).toBe(0);
    expect(source()).not.toMatch(/@import|url\(/i);
    expect(doc.querySelector('meta[name="robots"][content*="nofollow"]')).toBeNull();
  });

  it('keeps contact links readable through Cloudflare without JavaScript', () => {
    const protectedLinks = source().match(/<!--email_off--><a href="mailto:[^"]+">jan@warana\.xyz<\/a><!--\/email_off-->/g);
    expect(protectedLinks).toHaveLength(2);
  });

  it('is not added to the site navigation', () => {
    for (const file of ['pages/HomePage.tsx', 'pages/AboutPage.tsx', 'App.tsx']) {
      expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toContain('whatsapp-privacy');
    }
  });
});

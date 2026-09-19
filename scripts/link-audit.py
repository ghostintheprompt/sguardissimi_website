#!/usr/bin/env python3
"""Crawl the LIVE site and check every link, image, video and poster on every page.

    python3 scripts/link-audit.py                      # https://sguardissimi.com
    python3 scripts/link-audit.py https://example.com

Reads /sitemap.xml plus the homepage, fetches each page, extracts every href/src/poster/
og:image, and checks each unique URL once. Media and internal URLs must return 200/206.
External URLs that answer 401/403/429/999 are reported as "blocked" (bot walls), not broken;
404/410/5xx/DNS failures are broken.
"""
import re, sys, ssl, urllib.request, urllib.error, urllib.parse
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://sguardissimi.com').rstrip('/')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
HOST = urllib.parse.urlparse(BASE).netloc
MEDIA_HOSTS = {'photos.sguardissimi.com', 'video.sguardissimi.com'}
BLOCKED = {401, 403, 405, 406, 429, 999}
ctx = ssl.create_default_context()


def get(url, ranged=False, method='GET', timeout=40):
    req = urllib.request.Request(url, method=method, headers={'User-Agent': UA, **({'Range': 'bytes=0-1023'} if ranged else {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.status, r.read(400000) if method == 'GET' and not ranged else b''
    except urllib.error.HTTPError as e:
        return e.code, b''
    except Exception as e:
        return f'ERR {type(e).__name__}', b''


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.found = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for k in ('href', 'src', 'poster'):
            if a.get(k): self.found.append((tag, k, a[k]))
        if tag == 'meta' and a.get('content', '').startswith('http') and (a.get('property') or a.get('name') or '').lower() in ('og:image', 'twitter:image'):
            self.found.append((tag, 'content', a['content']))
        if tag == 'link' and a.get('href'):
            pass


def page_urls():
    urls = {BASE + '/'}
    st, body = get(BASE + '/sitemap.xml')
    if st == 200:
        urls |= set(re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', body.decode('utf-8', 'ignore')))
    return sorted(urls)


def extract(page):
    st, body = get(page)
    if st != 200:
        return page, st, []
    p = Links(); p.feed(body.decode('utf-8', 'ignore'))
    out = []
    for tag, k, v in p.found:
        v = v.strip()
        if v.startswith(('mailto:', 'tel:', 'javascript:', 'data:', '#')): continue
        u = urllib.parse.urljoin(page, v).split('#')[0]
        if u.startswith('http'): out.append(u)
    return page, st, out


def check(url):
    host = urllib.parse.urlparse(url).netloc
    if host in MEDIA_HOSTS:
        st, _ = get(url, ranged=True); ok = st in (200, 206); kind = 'media'
    elif host == HOST or host == 'www.' + HOST:
        st, _ = get(url, ranged=True); ok = st in (200, 206); kind = 'internal'
    else:
        st, _ = get(url, method='HEAD', timeout=25)
        if st != 200 and not (isinstance(st, int) and 200 <= st < 400):
            st, _ = get(url, ranged=True, timeout=25)
        kind = 'external'
        ok = isinstance(st, int) and (200 <= st < 400)
        if not ok and st in BLOCKED: kind = 'external-blocked'
    return url, kind, st, ok


pages = page_urls()
print(f'pages to crawl: {len(pages)} (base {BASE})')
with ThreadPoolExecutor(12) as ex: crawled = list(ex.map(extract, pages))
bad_pages = [(p, s) for p, s, _ in crawled if s != 200]
refs = {}
for p, s, urls in crawled:
    for u in urls: refs.setdefault(u, set()).add(p)
print(f'unique URLs referenced: {len(refs)}')
with ThreadPoolExecutor(16) as ex: results = list(ex.map(check, refs))

tally = {}
for u, kind, st, ok in results: tally.setdefault((kind, 'ok' if ok else 'FAIL'), 0); tally[(kind, 'ok' if ok else 'FAIL')] += 1
print('\ntally:')
for k, v in sorted(tally.items()): print(f'  {k[0]:17s} {k[1]:5s} {v}')
print(f'\npages that did not return 200: {bad_pages or "none"}')
fails = [(u, kind, st) for u, kind, st, ok in results if not ok and kind != 'external-blocked']
print(f'\nBROKEN ({len(fails)}):')
for u, kind, st in sorted(fails)[:60]:
    print(f'  [{kind}] {st}  {u}\n      on: {sorted(refs[u])[:2]}')
blocked = [(u, st) for u, kind, st, ok in results if kind == 'external-blocked']
if blocked:
    print(f'\nexternal sites that block bots (not counted as broken, {len(blocked)}):')
    for u, st in sorted(blocked)[:20]: print(f'  {st}  {u}')
sys.exit(1 if fails or bad_pages else 0)

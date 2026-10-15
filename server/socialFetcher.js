const https = require('https');
const http = require('http');

function fetchRawHtml(targetUrl, customHeaders = {}) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.request(
        parsed,
        {
          method: 'GET',
          headers: {
            'User-Agent':
              customHeaders['User-Agent'] ||
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            ...customHeaders
          },
          timeout: 8000
        },
        (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            let nextUrl = res.headers.location;
            if (!nextUrl.startsWith('http')) {
              nextUrl = new URL(nextUrl, targetUrl).toString();
            }
            return fetchRawHtml(nextUrl, customHeaders).then(resolve);
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            resolve(data);
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve('');
      });

      req.on('error', () => resolve(''));
      req.end();
    } catch (e) {
      resolve('');
    }
  });
}

function extractMeta(html) {
  if (!html) return {};
  const meta = {};

  const mTitle = html.match(/(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)["']/i) ||
                 html.match(/content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:title|twitter:title)["']/i);
  if (mTitle) meta.title = decodeHtmlEntities(mTitle[1]);

  const mImage = html.match(/(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/i) ||
                 html.match(/content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["']/i);
  if (mImage) meta.image = mImage[1].replace(/&amp;/g, '&');

  return meta;
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#064;/g, '@')
    .replace(/&#x2022;/g, '•')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// 1. YouTube Profile & Reach Fetcher
async function fetchYoutubeProfile(input) {
  let cleanHandle = input.trim();
  const urlMatch = cleanHandle.match(/(?:youtube\.com|youtu\.be)\/(?:@|c\/|channel\/)?([a-zA-Z0-9_.-]+)/i);
  if (urlMatch) cleanHandle = urlMatch[1];
  cleanHandle = cleanHandle.replace(/^@/, '');

  const profileUrl = `https://www.youtube.com/@${cleanHandle}`;
  const html = await fetchRawHtml(profileUrl);
  const meta = extractMeta(html);

  let realName = meta.title || '';
  if (realName) {
    realName = realName.replace(/\s*-\s*YouTube$/i, '').trim();
  }

  // Extract high-res avatar from YouTube HTML
  let avatarUrl = meta.image || null;
  const avatarMatch = html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
  if (avatarMatch && avatarMatch[1]) {
    avatarUrl = avatarMatch[1].replace(/=s\d+[^"]*/, '=s800-c-k-c0x00ffffff-no-rj');
  }
  if (!avatarUrl) {
    avatarUrl = `https://unavatar.io/youtube/@${cleanHandle}`;
  }

  // Extract subscriber count from channel HTML
  let subscribers = null;
  const cleanHtml = html.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');

  // 1. Check metadataParts (e.g. newer channel layouts)
  const metaPartsMatch = cleanHtml.match(/"metadataParts":\[\{"text":\{"content":"([^"]*?subscribers?)"/i);
  if (metaPartsMatch && metaPartsMatch[1]) {
    subscribers = metaPartsMatch[1];
  }

  // 2. Check subtitle with channel info
  if (!subscribers) {
    const subContentMatch = cleanHtml.match(/"subtitle":\{"content":"[^"]*?([0-9.]+\s*[KMBkmb]?\s*(?:million|thousand|crore|lakh)?\s*subscribers)[^"]*"/i);
    if (subContentMatch && subContentMatch[1]) {
      subscribers = subContentMatch[1];
    }
  }

  // 3. Check subscriberCountText
  if (!subscribers) {
    const subMatch = cleanHtml.match(/"subscriberCountText":\{[^}]*"label":\s*"([^"]+)"/);
    if (subMatch) {
      subscribers = subMatch[1];
    } else {
      const simpleMatch = cleanHtml.match(/"subscriberCountText":\{[^}]*"simpleText":\s*"([^"]+)"/);
      if (simpleMatch) subscribers = simpleMatch[1];
    }
  }

  // 4. Check handle followed by subscribers
  if (!subscribers) {
    const handleMatch = cleanHtml.match(new RegExp("@" + cleanHandle + "[^\\n]{0,80}?\\s*([0-9.]+\\s*[KMBkmb]?\\s*(?:million|thousand|crore|lakh)?\\s*subscribers)", "i"));
    if (handleMatch && handleMatch[1]) {
      subscribers = handleMatch[1];
    }
  }

  // 5. Fallback general subscriber text
  if (!subscribers) {
    const fallback = cleanHtml.match(/([0-9.]+\s*[KMBkmb]?\s*(?:million|thousand|crore|lakh)?\\s*subscribers)/i);
    if (fallback) subscribers = fallback[1];
  }

  return {
    platform: 'youtube',
    handle: cleanHandle,
    name: realName || cleanHandle.replace(/[_.-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    avatarUrl,
    subscribers,
    followers: subscribers,
    sourceUrl: profileUrl
  };
}

// 2. Twitter / X Profile & Reach Fetcher (via fast fxtwitter API + HTML fallback)
async function fetchTwitterProfile(input) {
  let cleanHandle = input.trim();
  const urlMatch = cleanHandle.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i);
  if (urlMatch) cleanHandle = urlMatch[1];
  cleanHandle = cleanHandle.replace(/^@/, '');

  const profileUrl = `https://x.com/${cleanHandle}`;

  // Try fxtwitter public API first (returns exact name, followers, and avatar)
  try {
    const fxHtml = await fetchRawHtml(`https://api.fxtwitter.com/${cleanHandle}`, { 'User-Agent': 'Mozilla/5.0' });
    if (fxHtml) {
      const fxData = JSON.parse(fxHtml);
      if (fxData && fxData.code === 200 && fxData.user) {
        const u = fxData.user;
        let formattedFollowers = null;
        if (typeof u.followers === 'number') {
          if (u.followers >= 1000000) {
            formattedFollowers = (u.followers / 1000000).toFixed(2) + 'M followers';
          } else if (u.followers >= 1000) {
            formattedFollowers = (u.followers / 1000).toFixed(1) + 'K followers';
          } else {
            formattedFollowers = u.followers + ' followers';
          }
        }
        let highResAvatar = u.avatar_url || `https://unavatar.io/x/${cleanHandle}`;
        if (highResAvatar && highResAvatar.includes('_normal.')) {
          highResAvatar = highResAvatar.replace('_normal.', '_400x400.');
        }

        return {
          platform: 'x',
          handle: cleanHandle,
          name: u.name || cleanHandle,
          avatarUrl: highResAvatar,
          followers: formattedFollowers,
          subscribers: formattedFollowers,
          sourceUrl: profileUrl
        };
      }
    }
  } catch (e) {}

  // Fallback to HTML meta
  const html = await fetchRawHtml(profileUrl);
  const meta = extractMeta(html);

  let realName = meta.title || '';
  if (realName) {
    realName = realName.replace(/\s*\(\s*@.*?\)\s*(\/|\|)?\s*(X|Twitter)$/i, '').trim();
  }

  return {
    platform: 'x',
    handle: cleanHandle,
    name: realName || cleanHandle.replace(/[_.-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    avatarUrl: meta.image || `https://unavatar.io/x/${cleanHandle}`,
    followers: null,
    subscribers: null,
    sourceUrl: profileUrl
  };
}

// 3. Instagram Profile & Reach Fetcher (Extracts exact live Profile Pic & Followers)
async function fetchInstagramProfile(input) {
  let cleanHandle = input.trim();
  const urlMatch = cleanHandle.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
  if (urlMatch) cleanHandle = urlMatch[1];
  cleanHandle = cleanHandle.replace(/^@/, '').replace(/\/+$/, '');

  const embedUrl = `https://www.instagram.com/${cleanHandle}/embed/`;
  const profileUrl = `https://www.instagram.com/${cleanHandle}/`;

  let avatarUrl = null;
  let followers = null;

  try {
    const embedHtml = await fetchRawHtml(embedUrl, { 'User-Agent': 'Mozilla/5.0' });

    if (embedHtml) {
      // Direct extraction of profile_pic_url from Instagram embed JS object
      const idx = embedHtml.indexOf('profile_pic_url');
      if (idx !== -1) {
        const httpIdx = embedHtml.indexOf('http', idx);
        if (httpIdx !== -1) {
          const endQuote = embedHtml.indexOf('\\"', httpIdx);
          const plainQuote = embedHtml.indexOf('"', httpIdx);
          let endIdx = endQuote;
          if (endIdx === -1 || (plainQuote !== -1 && plainQuote < endIdx)) endIdx = plainQuote;
          if (endIdx !== -1 && endIdx > httpIdx) {
            const rawUrl = embedHtml.substring(httpIdx, endIdx);
            avatarUrl = rawUrl
              .replace(/\\\\\//g, '/')
              .replace(/\\\//g, '/')
              .replace(/\\\\/g, '')
              .replace(/\\u0025/g, '%')
              .replace(/\\+$/, '');
          }
        }
      }

      // Check followers count
      const followersMatch = embedHtml.match(/edge_followed_by\\*"\s*:\s*\{\\*"\s*count\\*"\s*:\s*([0-9]+)/);
      if (followersMatch) {
        const count = parseInt(followersMatch[1], 10);
        if (!isNaN(count)) {
          if (count >= 1000000) {
            followers = (count / 1000000).toFixed(1) + 'M followers';
          } else if (count >= 1000) {
            followers = (count / 1000).toFixed(1) + 'K followers';
          } else {
            followers = count + ' followers';
          }
        }
      }
    }
  } catch (err) {
    console.error('Instagram embed fetch error:', err);
  }

  // Format a clean display name
  const formattedName = cleanHandle
    .replace(/[_.]+/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    platform: 'instagram',
    handle: cleanHandle,
    name: formattedName,
    avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formattedName)}&background=E1306C&color=ffffff&size=512&bold=true&font-size=0.38`,
    followers,
    sourceUrl: profileUrl
  };
}

// Master Unified Auto-Fetch Function
async function autoFetchSocialProfile(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  const raw = inputUrl.trim();

  if (/youtube\.com|youtu\.be/i.test(raw)) {
    return await fetchYoutubeProfile(raw);
  } else if (/x\.com|twitter\.com/i.test(raw)) {
    return await fetchTwitterProfile(raw);
  } else if (/instagram\.com/i.test(raw)) {
    return await fetchInstagramProfile(raw);
  }

  return null;
}

module.exports = {
  fetchYoutubeProfile,
  fetchTwitterProfile,
  fetchInstagramProfile,
  autoFetchSocialProfile
};

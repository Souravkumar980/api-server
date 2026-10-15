const https = require('https');
const http = require('http');

const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si',
  'https://invidious.flokinet.to',
  'https://inv.tux.pizza',
  'https://invidious.nerdvpn.de'
];

function fetchJsonWithFallback(path, timeout = 6000) {
  return new Promise(async (resolve) => {
    for (const base of INVIDIOUS_INSTANCES) {
      const fullUrl = `${base}${path}`;
      try {
        const data = await new Promise((res, rej) => {
          const req = https.get(
            fullUrl,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout
            },
            (response) => {
              if (response.statusCode !== 200) {
                return rej(new Error(`Status ${response.statusCode}`));
              }
              let body = '';
              response.on('data', (c) => (body += c));
              response.on('end', () => {
                try {
                  res(JSON.parse(body));
                } catch (e) {
                  rej(e);
                }
              });
            }
          );
          req.on('timeout', () => {
            req.destroy();
            rej(new Error('Timeout'));
          });
          req.on('error', rej);
        });

        if (data) {
          return resolve(data);
        }
      } catch (err) {
        // Try next instance
      }
    }
    resolve(null);
  });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '3:30';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function extractYoutubeVideoId(input) {
  if (!input) return null;
  const str = input.trim();
  // Standard full URL, short URL, embed, or 11-char ID
  const m1 = str.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (m1) return m1[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
}

function extractYoutubePlaylistId(input) {
  if (!input) return null;
  const str = input.trim();
  const m = str.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
  if (m) return m[1];
  if (/^PL[a-zA-Z0-9_-]+$/i.test(str)) return str;
  return null;
}

// High quality standard definition YouTube thumbnail (480x360 HQ)
function getHighQualityThumbnail(videoId) {
  if (!videoId) return '';
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// 1. Search YouTube videos via Invidious
async function searchInvidiousVideos(query, limit = 15) {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  // If user pasted a direct video URL or ID, resolve it directly
  const directVid = extractYoutubeVideoId(cleanQ);
  if (directVid) {
    const details = await resolveSingleVideo(directVid);
    if (details) return [details];
  }

  const json = await fetchJsonWithFallback(`/api/v1/search?q=${encodeURIComponent(cleanQ)}&type=video`);
  if (!Array.isArray(json)) return [];

  return json.slice(0, limit).map((v) => ({
    videoId: v.videoId,
    title: v.title || 'Untitled Song',
    author: v.author || 'Unknown Artist',
    thumbnailUrl: getHighQualityThumbnail(v.videoId),
    lengthSeconds: v.lengthSeconds || 210,
    duration: formatDuration(v.lengthSeconds)
  }));
}

// 2. Fetch single video details
async function resolveSingleVideo(videoId) {
  // Try video details endpoint
  const data = await fetchJsonWithFallback(`/api/v1/videos/${videoId}`);
  if (data && data.videoId) {
    return {
      videoId: data.videoId,
      title: data.title || 'Nationalist Track',
      author: data.author || 'Artist',
      thumbnailUrl: getHighQualityThumbnail(data.videoId),
      lengthSeconds: data.lengthSeconds || 210,
      duration: formatDuration(data.lengthSeconds)
    };
  }

  // Fallback to minimal info with YouTube high quality standard thumbnail
  return {
    videoId,
    title: `Track (${videoId})`,
    author: 'YouTube',
    thumbnailUrl: getHighQualityThumbnail(videoId),
    lengthSeconds: 210,
    duration: '3:30'
  };
}

// 3. Resolve Video or Playlist URL
async function resolveUrlOrPlaylist(urlInput) {
  if (!urlInput) return { type: 'error', message: 'URL is required' };
  const str = urlInput.trim();

  // Check playlist first
  const listId = extractYoutubePlaylistId(str);
  if (listId) {
    const pData = await fetchJsonWithFallback(`/api/v1/playlists/${listId}`);
    if (pData && Array.isArray(pData.videos)) {
      const tracks = pData.videos.map((v) => ({
        videoId: v.videoId,
        title: v.title || 'Untitled Video',
        author: v.author || pData.author || 'YouTube Artist',
        thumbnailUrl: getHighQualityThumbnail(v.videoId),
        lengthSeconds: v.lengthSeconds || 210,
        duration: formatDuration(v.lengthSeconds)
      }));

      return {
        type: 'playlist',
        playlistId: listId,
        title: pData.title || 'YouTube Playlist',
        totalVideos: tracks.length,
        tracks
      };
    }
  }

  // Check single video
  const vidId = extractYoutubeVideoId(str);
  if (vidId) {
    const video = await resolveSingleVideo(vidId);
    return {
      type: 'video',
      tracks: [video]
    };
  }

  return { type: 'error', message: 'Could not identify valid YouTube Video or Playlist from URL.' };
}

module.exports = {
  searchInvidiousVideos,
  resolveSingleVideo,
  resolveUrlOrPlaylist,
  extractYoutubeVideoId,
  extractYoutubePlaylistId,
  formatDuration
};

// filter.mjs — 从 Guovin/iptv-api 拉源，筛选出雷鸟电视用的精简直播列表
// 保留：CCTV 全套 + 湖南广电全套 + 浙江卫视
// 策略：每个频道收集所有镜像，并发探活选最快可用的一条
import { writeFile } from 'node:fs/promises';

const SOURCES = [
  'https://cdn.jsdmirror.com/gh/Guovin/iptv-api@gd/output/result.m3u',
  'https://fastly.jsdelivr.net/gh/Guovin/iptv-api@gd/output/result.m3u',
];

const KEEP_EXACT = new Set([
  '湖南卫视', '湖南都市', '湖南经视', '湖南电视剧', '湖南电影',
  '湖南爱晚', '湖南教育', '湖南娱乐', '湖南国际', '湖南公共',
  '金鹰纪实', '金鹰卡通', '快乐垂钓',
  '浙江卫视',
]);

function isCctv(name) {
  return /^CCTV[-\s]?\d/i.test(name);
}

function normalizeName(raw) {
  let n = raw.trim();
  n = n.replace(/[\s_\-]*(高清|标清|1080[Pp]?|720[Pp]?|HD|FHD|4K|60帧|直播|频道)$/g, '');
  n = n.replace(/^CCTV\s?(\d)/i, (_, d) => `CCTV-${d}`);
  return n.trim();
}

async function fetchM3u() {
  for (const url of SOURCES) {
    try {
      console.error('fetch:', url);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) { console.error('  fail:', e.message); }
  }
  throw new Error('所有源都拉取失败');
}

function parseM3u(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const line of lines) {
    if (/^#EXTINF/.test(line)) {
      const name = line.replace(/^#EXTINF[^,]*,/, '').trim();
      const group = (line.match(/group-title="([^"]*)"/) || [])[1] || '';
      const logo = (line.match(/tvg-logo="([^"]*)"/) || [])[1] || '';
      cur = { name, group, logo, url: '' };
    } else if (/^https?:/.test(line) && cur) {
      cur.url = line.trim();
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

async function probeUrl(url, timeout = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  const s = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    const ms = Date.now() - s;
    return { ok: res.ok, ms, status: res.status };
  } catch (e) {
    return { ok: false, ms: Date.now() - s, err: e.message };
  } finally { clearTimeout(t); }
}

async function main() {
  const text = await fetchM3u();
  const all = parseM3u(text);
  console.error('上游频道条数:', all.length);

  // 按归一化名分组
  const groups = new Map();
  for (const ch of all) {
    const canon = normalizeName(ch.name);
    const keep = isCctv(canon) || KEEP_EXACT.has(canon);
    if (!keep) continue;
    if (!groups.has(canon)) groups.set(canon, []);
    groups.get(canon).push(ch);
  }
  console.error('候选频道:', groups.size);

  // 对每个频道的所有镜像并发探活，选最快可用的
  const final = [];
  for (const [canon, mirrors] of groups) {
    const probes = await Promise.all(mirrors.map((m) => probeUrl(m.url).then((r) => ({ ...m, ...r }))));
    const working = probes.filter((p) => p.ok).sort((a, b) => a.ms - b.ms);
    if (working.length > 0) {
      final.push({ ...working[0], canon });
      console.error(`  ✓ ${canon}: 选镜像(${working[0].ms}ms, ${working.length}/${mirrors.length} 可用)`);
    } else {
      final.push({ ...mirrors[0], canon });
      console.error(`  ✗ ${canon}: 无可用镜像，保留第一条`);
    }
  }

  // 排序
  const cctvNum = (n) => {
    const m = n.match(/CCTV-(\d+)(\+)?/i);
    if (!m) return 999;
    return parseInt(m[1], 10) * 10 + (m[2] === '+' ? 1 : 0);
  };
  final.sort((a, b) => {
    const ac = isCctv(a.canon), bc = isCctv(b.canon);
    if (ac && bc) return cctvNum(a.canon) - cctvNum(b.canon);
    if (ac) return -1;
    if (bc) return 1;
    if (a.canon.startsWith('湖南') && !b.canon.startsWith('湖南')) return -1;
    if (!a.canon.startsWith('湖南') && b.canon.startsWith('湖南')) return 1;
    return a.canon.localeCompare(b.canon, 'zh');
  });

  const header = [
    '#EXTM3U',
    `#雷鸟电视精简直播源 — 更新时间: ${new Date().toISOString()}`,
  ].join('\n');
  const body = final.map((c) => {
    const logo = c.logo ? ` tvg-logo="${c.logo}"` : '';
    return `#EXTINF:-1 group-title="${c.group || '直播'}"${logo},${c.canon}\n${c.url}`;
  }).join('\n');

  await writeFile('lite.m3u', header + '\n' + body + '\n', 'utf8');
  const okCount = final.filter((c) => c.ok).length;
  console.error(`\n=== 完成: ${okCount}/${final.length} 频道可用，已写入 lite.m3u ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });

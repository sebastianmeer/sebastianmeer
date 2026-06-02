import fs from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const dataPath = path.join(distDir, 'galaga-data.json');
const data = JSON.parse((await fs.readFile(dataPath, 'utf8')).replace(/^\uFEFF/, ''));

const width = 1360;
const height = 360;

const grid = {
  x: 40,
  y: 102,
  cell: 20,
  gap: 2,
};

const step = grid.cell + grid.gap;
const pixel = 2;
const sprite = 16;
const rows = 7;

const alienSprites = {
  drone: [
    '00111100',
    '01111110',
    '11111111',
    '11011011',
    '11111111',
    '01100110',
    '11000011',
    '10000001',
  ],
  wing: [
    '00111100',
    '01111110',
    '11111111',
    '11100111',
    '11111111',
    '01111110',
    '01011010',
    '10000001',
  ],
  ace: [
    '01111110',
    '11111111',
    '11111111',
    '11100111',
    '11111111',
    '11000011',
    '01111110',
    '00100100',
  ],
  boss: [
    '11111111',
    '11111111',
    '11100111',
    '11111111',
    '11111111',
    '10111101',
    '01111110',
    '00111100',
  ],
  player: [
    '00011000',
    '00111100',
    '01111110',
    '11111111',
    '11011011',
    '11100111',
    '01111110',
    '00100100',
  ],
  shot: [
    '1',
    '1',
    '1',
    '1',
  ],
};

const formatNumber = new Intl.NumberFormat('en-US');

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function makeRng(seed) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getPalette(dark) {
  return dark
    ? {
        skyA: '#02040b',
        skyB: '#07101f',
        glowA: '#63f4ff',
        glowB: '#ff4bd8',
        line: 'rgba(99, 244, 255, 0.26)',
        panel: 'rgba(3, 7, 16, 0.74)',
        panelLine: 'rgba(99, 244, 255, 0.22)',
        text: '#f3fbff',
        muted: '#a8c3de',
        grid: 'rgba(142, 182, 224, 0.13)',
        cell0: 'rgba(10, 20, 34, 0.78)',
        cellBorder: 'rgba(109, 236, 255, 0.16)',
        strip: 'rgba(4, 10, 22, 0.9)',
        ship: '#ffd54a',
        shipGlow: 'rgba(255, 213, 74, 0.32)',
        playfieldTop: '#132033',
        playfieldBottom: '#0a1120',
        active: ['#58f7ff', '#48e4ff', '#86ff8f', '#ffd55b', '#ff7871'],
      }
    : {
        skyA: '#04080f',
        skyB: '#111f35',
        glowA: '#77f8ff',
        glowB: '#ff69d6',
        line: 'rgba(119, 248, 255, 0.2)',
        panel: 'rgba(10, 18, 34, 0.68)',
        panelLine: 'rgba(119, 248, 255, 0.22)',
        text: '#f7fcff',
        muted: '#c0d7ea',
        grid: 'rgba(163, 198, 229, 0.13)',
        cell0: 'rgba(15, 26, 44, 0.72)',
        cellBorder: 'rgba(121, 242, 255, 0.16)',
        strip: 'rgba(13, 21, 38, 0.8)',
        ship: '#ffde68',
        shipGlow: 'rgba(255, 222, 104, 0.28)',
        playfieldTop: '#18253f',
        playfieldBottom: '#0e1727',
        active: ['#78f8ff', '#5fe0ff', '#8eff8f', '#ffd768', '#ff8c7c'],
      };
}

function buildStarfield(seed, count, palette, twinkle = true) {
  const rng = makeRng(seed);
  const stars = [];
  for (let index = 0; index < count; index += 1) {
    const x = 10 + Math.round(rng() * (width - 20));
    const y = 10 + Math.round(rng() * (height - 20));
    const radius = index % 7 === 0 ? 1.8 : index % 4 === 0 ? 1.15 : 0.75;
    const opacity = 0.16 + rng() * 0.46;
    const dur = (4 + rng() * 6).toFixed(1);
    const delay = (rng() * 4).toFixed(1);
    const twinkleMarkup = twinkle
      ? `
        <animate attributeName="opacity" values="${opacity.toFixed(2)};${(opacity * 0.45).toFixed(2)};${opacity.toFixed(2)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />`
      : '';

    stars.push(`
      <circle cx="${x}" cy="${y}" r="${radius.toFixed(2)}" fill="${palette.text}" opacity="${opacity.toFixed(2)}">
        ${twinkleMarkup.trim()}
      </circle>`);
  }
  return stars.join('\n');
}

function drawMatrix(x, y, matrix, fill, opacity = 1) {
  const rects = [];
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (matrix[row][col] !== '1') continue;
      rects.push(
        `<rect x="${(x + col * pixel).toFixed(1)}" y="${(y + row * pixel).toFixed(1)}" width="${pixel}" height="${pixel}" fill="${fill}" opacity="${opacity}" shape-rendering="crispEdges" />`,
      );
    }
  }
  return rects.join('\n');
}

function spriteTypeForCount(count) {
  if (count >= 4) return 'boss';
  if (count === 3) return 'ace';
  if (count === 2) return 'wing';
  return 'drone';
}

function rowOffsetForWeek(index) {
  const band = index % 8;
  if (band < 2) return 0;
  if (band < 4) return 1;
  if (band < 6) return 2;
  return 3;
}

function renderAlienCell(day, x, y, palette, weekIndex, rowIndex) {
  const level = Math.max(0, Math.min(4, day.contributionCount));
  const fill = level === 0 ? palette.cell0 : palette.active[level];
  const spriteFill = level === 0 ? palette.cell0 : fill;
  const spriteGlow = level === 0 ? 'transparent' : fill;
  const type = level === 0 ? 'drone' : spriteTypeForCount(level);
  const phase = ((weekIndex * 7) + rowIndex) % 6;
  const delay = (phase * 0.35).toFixed(2);
  const bob = rowIndex % 2 === 0 ? 1.8 : 2.3;
  const drift = 1.5 + (weekIndex % 4) * 0.7;
  const hover = level === 0 ? 0 : 1;

  return `
    <g transform="translate(${x},${y})">
      <rect width="${grid.cell}" height="${grid.cell}" rx="4" fill="${palette.cell0}" stroke="${palette.cellBorder}" stroke-width="0.9" />
      ${level > 0 ? `<animateTransform attributeName="transform" type="translate" values="0,0; 0,-${bob}; 0,0" dur="${(3.2 + drift / 2).toFixed(1)}s" begin="${delay}s" repeatCount="indefinite" />` : ''}
      ${level > 0 ? `<animate attributeName="opacity" values="1;0.78;1" dur="${(2.6 + phase * 0.15).toFixed(1)}s" begin="${delay}s" repeatCount="indefinite" />` : ''}
      ${level > 0 ? `<rect x="4" y="4" width="${grid.cell - 8}" height="${grid.cell - 8}" rx="3" fill="${spriteGlow}" opacity="0.18" />` : ''}
      ${level > 0 ? drawMatrix(6, 6, alienSprites[type], spriteFill, 1) : ''}
      ${level > 0 ? `<rect x="${grid.cell / 2 - 1}" y="${grid.cell / 2 - 1}" width="2" height="2" fill="${palette.text}" opacity="0.9" />` : ''}
    </g>`;
}

function computeStats(weeks) {
  const days = weeks.flatMap((week) => week.contributionDays);
  const ordered = days.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  let currentStreak = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (ordered[index].contributionCount === 0) break;
    currentStreak += 1;
  }

  let bestStreak = 0;
  let run = 0;
  for (const day of ordered) {
    if (day.contributionCount > 0) {
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }

  return {
    activeDays: ordered.filter((day) => day.contributionCount > 0).length,
    currentStreak,
    bestStreak,
  };
}

function monthMarkers(weeks) {
  const markers = [];
  let lastMonth = -1;

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const firstDay = weeks[weekIndex].contributionDays[0];
    const month = new Date(`${firstDay.date}T00:00:00Z`).getUTCMonth();
    if (month !== lastMonth) {
      const label = new Date(`${firstDay.date}T00:00:00Z`).toLocaleString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      }).toUpperCase();
      markers.push({ x: grid.x + weekIndex * step, label });
      lastMonth = month;
    }
  }

  return markers;
}

function weekdayLabels(palette) {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return labels
    .map((label, index) => {
      const y = grid.y + index * step + 14;
      return `<text x="10" y="${y}" fill="${palette.muted}" font-size="10" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700">${label}</text>`;
    })
    .join('\n');
}

function renderTitleBar(stats, palette) {
  return `
    <g>
      <rect x="26" y="20" width="1308" height="56" rx="18" fill="${palette.panel}" stroke="${palette.panelLine}" stroke-width="1.1" />
      <text x="46" y="52" fill="${palette.text}" font-size="20" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="900" letter-spacing="2">GALAGA CONTRIBUTION FLEET</text>
      <text x="378" y="51" fill="${palette.muted}" font-size="11.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">${escapeXml(formatNumber.format(data.totalContributions || 0))} TOTAL CONTRIBUTIONS</text>
      <text x="735" y="51" fill="${palette.muted}" font-size="11.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">${escapeXml(formatNumber.format(stats.activeDays))} ACTIVE DAYS</text>
      <text x="1030" y="51" fill="${palette.muted}" font-size="11.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">STREAK ${escapeXml(formatNumber.format(stats.currentStreak))} / BEST ${escapeXml(formatNumber.format(stats.bestStreak))}</text>
    </g>`;
}

function renderFooter(stats, palette) {
  const score = stats.bestStreak * 100 + stats.currentStreak * 20 + stats.activeDays;
  return `
    <g>
      <rect x="26" y="312" width="1308" height="26" rx="13" fill="${palette.strip}" stroke="${palette.panelLine}" stroke-width="1" />
      <text x="46" y="329" fill="${palette.text}" font-size="11.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="800" letter-spacing="1.2">POWER LEVEL ${escapeXml(formatNumber.format(Math.max(stats.currentStreak, stats.bestStreak)))}</text>
      <text x="318" y="329" fill="${palette.muted}" font-size="10.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">WAVE ${escapeXml(formatNumber.format(stats.activeDays))}</text>
      <text x="500" y="329" fill="${palette.muted}" font-size="10.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">GALAGA MODE ENABLED</text>
      <text x="1122" y="329" fill="${palette.muted}" font-size="10.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">SCORE ${escapeXml(formatNumber.format(score))}</text>
    </g>`;
}

function renderPlayer(palette) {
  return `
    <g transform="translate(1120,252)">
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; -36,0; 36,0; 0,0" dur="7.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.88;1" dur="2.2s" repeatCount="indefinite" />
        ${drawMatrix(0, 0, alienSprites.player, palette.ship, 1)}
      </g>
      <rect x="6" y="18" width="4" height="44" rx="2" fill="${palette.shipGlow}" opacity="0.85">
        <animate attributeName="height" values="10;58;10" dur="1.35s" repeatCount="indefinite" />
        <animate attributeName="y" values="20; -14; 20" dur="1.35s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0.95;0.35" dur="1.35s" repeatCount="indefinite" />
      </rect>
    </g>`;
}

function renderEnemySquad(palette) {
  const drones = [];
  for (let i = 0; i < 6; i += 1) {
    const x = 980 + i * 46;
    const y = 150 + (i % 2) * 10;
    drones.push(`
      <g transform="translate(${x},${y})">
        <animateTransform attributeName="transform" type="translate" values="${x},${y}; ${x - 18},${y - 6}; ${x},${y}; ${x + 18},${y - 6}; ${x},${y}" dur="${5 + i * 0.4}s" repeatCount="indefinite" />
        ${drawMatrix(0, 0, alienSprites.wing, palette.active[(i % palette.active.length)], 1)}
      </g>`);
  }
  return drones.join('\n');
}

function renderFleet(weeks, palette) {
  const left = grid.x;
  const top = grid.y;
  const columns = weeks.length;
  const fleetWidth = columns * step;
  const fleetHeight = rows * step;

  const cells = weeks
    .map((week, weekIndex) =>
      week.contributionDays
        .map((day, rowIndex) => {
          const x = left + weekIndex * step;
          const y = top + rowIndex * step;
          return renderAlienCell(day, x, y, palette, weekIndex, rowIndex);
        })
        .join('\n'),
    )
    .join('\n');

  return `
    <g>
      <rect x="${left - 10}" y="${top - 10}" width="${fleetWidth + 20}" height="${fleetHeight + 20}" rx="22" fill="rgba(8, 14, 28, 0.42)" stroke="${palette.line}" stroke-width="1" />
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 10,-2; 0,0; -10,2; 0,0" dur="9s" repeatCount="indefinite" />
        ${cells}
      </g>
    </g>`;
}

function renderSvg(dark) {
  const palette = getPalette(dark);
  const stats = computeStats(data.weeks);
  const markers = monthMarkers(data.weeks);
  const starfield = buildStarfield(dark ? 920 : 420, dark ? 96 : 82, palette, true);

  const monthLabels = markers
    .map((marker) => `<text x="${marker.x}" y="${grid.y - 14}" fill="${palette.muted}" font-size="10.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">${marker.label}</text>`)
    .join('\n');

  const scanlines = Array.from({ length: 18 }, (_, index) => {
    const y = 86 + index * 12;
    return `<rect x="0" y="${y}" width="1360" height="2" fill="#ffffff" opacity="${index % 2 === 0 ? '0.04' : '0.02'}" />`;
  }).join('\n');

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animated Galaga style contribution graph">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.skyA}" />
      <stop offset="100%" stop-color="${palette.skyB}" />
    </linearGradient>
    <linearGradient id="frame" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${palette.glowA}" />
      <stop offset="45%" stop-color="${palette.glowB}" />
      <stop offset="100%" stop-color="${palette.glowA}" />
    </linearGradient>
    <linearGradient id="playfield" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${palette.playfieldTop}" stop-opacity="0.94" />
      <stop offset="100%" stop-color="${palette.playfieldBottom}" stop-opacity="0.94" />
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="18" y="18" width="1324" height="324" rx="30" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
  <rect x="22" y="22" width="1316" height="316" rx="28" fill="none" stroke="${palette.line}" stroke-width="10" opacity="0.8" />
  <rect x="22" y="22" width="1316" height="316" rx="28" fill="none" stroke="url(#frame)" stroke-width="2.4" filter="url(#glow)" />
  <rect x="32" y="92" width="1296" height="200" rx="24" fill="url(#playfield)" stroke="${palette.line}" stroke-width="1" />
  ${starfield}
  ${scanlines}
  <rect x="34" y="104" width="1292" height="176" rx="20" fill="none" stroke="${palette.grid}" stroke-width="1" />
  ${renderTitleBar(stats, palette)}
  ${monthLabels}
  ${weekdayLabels(palette)}
  ${renderFleet(data.weeks, palette)}
  ${renderEnemySquad(palette)}
  ${renderPlayer(palette)}
  ${renderFooter(stats, palette)}
</svg>
`.trimStart();
}

await fs.mkdir(distDir, { recursive: true });
await fs.writeFile(path.join(distDir, 'galaga-contribution-graph.svg'), renderSvg(false));
await fs.writeFile(path.join(distDir, 'galaga-contribution-graph-dark.svg'), renderSvg(true));

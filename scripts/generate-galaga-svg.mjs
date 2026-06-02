import fs from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const dataPath = path.join(distDir, 'galaga-data.json');
const data = JSON.parse((await fs.readFile(dataPath, 'utf8')).replace(/^\uFEFF/, ''));

const width = 1166;
const height = 240;
const grid = {
  x: 28,
  y: 66,
  cell: 16,
  gap: 1,
};
const step = grid.cell + grid.gap;
const pixel = 2;
const sprite = 14;

const alienSprites = {
  drone: [
    '0011100',
    '0111110',
    '1111111',
    '1101011',
    '1111111',
    '0110110',
    '1100011',
  ],
  wing: [
    '0011100',
    '1111111',
    '1101011',
    '1111111',
    '0111110',
    '0101101',
    '1000011',
  ],
  ace: [
    '0111110',
    '1111111',
    '1110111',
    '1111111',
    '1100011',
    '0111110',
    '0101101',
  ],
  boss: [
    '1111111',
    '1111111',
    '1101011',
    '1111111',
    '1111111',
    '1011101',
    '0111110',
  ],
  player: [
    '0001000',
    '0011110',
    '0111111',
    '1111111',
    '1101111',
    '1110011',
    '0111110',
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
        skyA: '#03050f',
        skyB: '#081223',
        glowA: '#56f0ff',
        glowB: '#ff4ccf',
        line: 'rgba(116, 228, 255, 0.28)',
        panel: 'rgba(4, 9, 20, 0.78)',
        panelLine: 'rgba(116, 228, 255, 0.28)',
        text: '#f2fbff',
        muted: '#9cbad4',
        grid: 'rgba(140, 181, 220, 0.16)',
        cell0: 'rgba(12, 22, 40, 0.78)',
        cellBorder: 'rgba(118, 246, 255, 0.18)',
        shadow: 'rgba(0, 0, 0, 0.35)',
        strip: 'rgba(4, 11, 24, 0.88)',
        ship: '#ffcf4a',
        shipGlow: 'rgba(255, 207, 74, 0.35)',
        playfieldTop: '#141e32',
        playfieldBottom: '#0d121e',
        active: ['#66f7ff', '#4de3ff', '#86ff88', '#ffd75c', '#ff7a6e'],
      }
    : {
        skyA: '#050913',
        skyB: '#13243b',
        glowA: '#7af7ff',
        glowB: '#ff6ad5',
        line: 'rgba(122, 247, 255, 0.22)',
        panel: 'rgba(12, 20, 36, 0.70)',
        panelLine: 'rgba(122, 247, 255, 0.24)',
        text: '#f7fcff',
        muted: '#bdd5ea',
        grid: 'rgba(161, 196, 228, 0.16)',
        cell0: 'rgba(16, 26, 45, 0.70)',
        cellBorder: 'rgba(122, 247, 255, 0.18)',
        shadow: 'rgba(0, 0, 0, 0.24)',
        strip: 'rgba(14, 22, 40, 0.76)',
        ship: '#ffdd62',
        shipGlow: 'rgba(255, 221, 98, 0.28)',
        playfieldTop: '#192743',
        playfieldBottom: '#0f1726',
        active: ['#7ef9ff', '#59dfff', '#8cff88', '#ffd86a', '#ff8a78'],
      };
}

function buildStarfield(seed, count, palette) {
  const rng = makeRng(seed);
  const stars = [];
  for (let index = 0; index < count; index += 1) {
    const x = 12 + Math.round(rng() * (width - 24));
    const y = 10 + Math.round(rng() * (height - 24));
    const radius = index % 7 === 0 ? 1.8 : index % 4 === 0 ? 1.2 : 0.8;
    const opacity = 0.18 + rng() * 0.45;
    stars.push(`<circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="${palette.text}" opacity="${opacity.toFixed(2)}" />`);
  }
  return stars.join('\n    ');
}

function drawMatrix(x, y, matrix, fill, opacity = 1) {
  const rects = [];
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (matrix[row][col] !== '1') {
        continue;
      }
      rects.push(
        `<rect x="${(x + col * pixel).toFixed(1)}" y="${(y + row * pixel).toFixed(1)}" width="${pixel}" height="${pixel}" fill="${fill}" opacity="${opacity}" shape-rendering="crispEdges" />`,
      );
    }
  }
  return rects.join('\n    ');
}

function drawSprite(x, y, type, fill, glow) {
  const base = drawMatrix(x, y, alienSprites[type], fill, 1);
  const halo = `<rect x="${(x - 1).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="${sprite + 2}" height="${sprite + 2}" rx="2" fill="${glow}" opacity="0.35" />`;
  return `${halo}\n    ${base}`;
}

function renderCell(x, y, count, palette) {
  const level = Math.max(0, Math.min(4, count));
  const fill = level === 0 ? palette.cell0 : palette.active[level];
  const glow = level === 0 ? 'transparent' : palette.active[level];
  const type = level === 0 ? 'drone' : level === 1 ? 'drone' : level === 2 ? 'wing' : level === 3 ? 'ace' : 'boss';
  const spriteX = x + 1;
  const spriteY = y + 1;

  return `
    <g>
      <rect x="${x}" y="${y}" width="${grid.cell}" height="${grid.cell}" rx="3" fill="${palette.cell0}" stroke="${palette.cellBorder}" stroke-width="0.8" />
      ${level === 0 ? '' : drawSprite(spriteX, spriteY, type, fill, glow)}
      ${level > 0 ? `<rect x="${x + 5}" y="${y + 5}" width="2" height="2" fill="${palette.text}" opacity="0.85" />` : ''}
    </g>`;
}

function computeStats(weeks) {
  const days = weeks.flatMap((week) => week.contributionDays);
  const ordered = days.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  let currentStreak = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (ordered[index].contributionCount === 0) {
      break;
    }
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
    const week = weeks[weekIndex];
    for (let dayIndex = 0; dayIndex < week.contributionDays.length; dayIndex += 1) {
      const day = week.contributionDays[dayIndex];
      const date = new Date(`${day.date}T00:00:00Z`);
      const month = date.getUTCMonth();

      if (month !== lastMonth) {
        const label = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
        const x = grid.x + weekIndex * step;
        markers.push({ x, label });
        lastMonth = month;
      }

      break;
    }
  }

  return markers;
}

function weekdayLabels(palette) {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return labels
    .map((label, index) => {
      const y = grid.y + index * step + 11;
      return `<text x="8" y="${y}" fill="${palette.muted}" font-size="9" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700">${label}</text>`;
    })
    .join('\n    ');
}

function headerPanel(stats, palette) {
  const total = formatNumber.format(Number(data.totalContributions || 0));
  return `
    <g>
      <rect x="18" y="14" width="1130" height="40" rx="14" fill="${palette.panel}" stroke="${palette.panelLine}" stroke-width="1" />
      <text x="34" y="39" fill="${palette.text}" font-size="15" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="800" letter-spacing="1.6">GALAGA CONTRIBUTION FLEET</text>
      <text x="334" y="39" fill="${palette.muted}" font-size="10.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">${escapeXml(total)} TOTAL CONTRIBUTIONS</text>
      <text x="710" y="39" fill="${palette.muted}" font-size="10.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">${escapeXml(formatNumber.format(stats.activeDays))} ACTIVE DAYS</text>
      <text x="925" y="39" fill="${palette.muted}" font-size="10.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">STREAK ${escapeXml(formatNumber.format(stats.currentStreak))} / BEST ${escapeXml(formatNumber.format(stats.bestStreak))}</text>
    </g>`;
}

function footerPanel(stats, palette) {
  return `
    <g>
      <rect x="18" y="200" width="1130" height="24" rx="12" fill="${palette.strip}" stroke="${palette.panelLine}" stroke-width="1" />
      <text x="34" y="216" fill="${palette.text}" font-size="10.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="800" letter-spacing="1.1">POWER LEVEL ${escapeXml(formatNumber.format(Math.max(stats.currentStreak, stats.bestStreak)))}</text>
      <text x="312" y="216" fill="${palette.muted}" font-size="10" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">WAVE ${escapeXml(formatNumber.format(stats.activeDays))}</text>
      <text x="468" y="216" fill="${palette.muted}" font-size="10" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">GALAGA MODE ENABLED</text>
      <text x="940" y="216" fill="${palette.muted}" font-size="10" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">SCORE ${escapeXml(formatNumber.format(stats.bestStreak * 100 + stats.currentStreak * 10))}</text>
    </g>`;
}

function renderSvg(dark) {
  const palette = getPalette(dark);
  const stats = computeStats(data.weeks);
  const markers = monthMarkers(data.weeks);
  const starfield = buildStarfield(dark ? 908 : 412, dark ? 84 : 72, palette);

  const gridCells = data.weeks
    .map((week, weekIndex) =>
      week.contributionDays
        .map((day, dayIndex) => {
          const x = grid.x + weekIndex * step;
          const y = grid.y + dayIndex * step;
          return renderCell(x, y, day.contributionCount, palette);
        })
        .join('\n    '),
    )
    .join('\n    ');

  const monthLabels = markers
    .map(
      (marker) =>
        `<text x="${marker.x}" y="${grid.y - 12}" fill="${palette.muted}" font-size="9.5" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">${marker.label}</text>`,
    )
    .join('\n    ');

  const fleetBand = `
    <rect x="18" y="60" width="1130" height="136" rx="18" fill="url(#playfield)" stroke="${palette.line}" stroke-width="1" />
    <rect x="32" y="74" width="1102" height="108" rx="14" fill="none" stroke="${palette.grid}" stroke-width="1" />
  `;

  const scanlines = `
    <g opacity="0.10">
      <rect x="0" y="0" width="1166" height="4" fill="#ffffff" />
      <rect x="0" y="8" width="1166" height="2" fill="#ffffff" />
      <rect x="0" y="16" width="1166" height="2" fill="#ffffff" />
      <rect x="0" y="24" width="1166" height="2" fill="#ffffff" />
    </g>
  `;

  const playerShip = `
    <g transform="translate(1044,170)">
      ${drawSprite(0, 0, 'player', palette.ship, palette.shipGlow)}
    </g>
  `;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Galaga style contribution graph">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.skyA}" />
      <stop offset="100%" stop-color="${palette.skyB}" />
    </linearGradient>
    <linearGradient id="frame" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${palette.glowA}" />
      <stop offset="50%" stop-color="${palette.glowB}" />
      <stop offset="100%" stop-color="${palette.glowA}" />
    </linearGradient>
    <linearGradient id="playfield" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${palette.playfieldTop}" stop-opacity="0.95" />
      <stop offset="100%" stop-color="${palette.playfieldBottom}" stop-opacity="0.92" />
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="10" y="10" width="1146" height="220" rx="24" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
  <rect x="12" y="12" width="1142" height="216" rx="22" fill="none" stroke="${palette.line}" stroke-width="10" opacity="0.8" />
  <rect x="12" y="12" width="1142" height="216" rx="22" fill="none" stroke="url(#frame)" stroke-width="2.2" filter="url(#glow)" />
  ${starfield}
  ${scanlines}
  ${fleetBand}
  ${headerPanel(stats, palette)}
  ${monthLabels}
  ${weekdayLabels(palette)}
  ${gridCells}
  ${playerShip}
  ${footerPanel(stats, palette)}
</svg>
`.trimStart();
}

await fs.mkdir(distDir, { recursive: true });
await fs.writeFile(path.join(distDir, 'galaga-contribution-graph.svg'), renderSvg(false));
await fs.writeFile(path.join(distDir, 'galaga-contribution-graph-dark.svg'), renderSvg(true));

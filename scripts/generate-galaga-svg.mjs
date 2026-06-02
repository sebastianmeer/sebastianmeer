import fs from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const dataPath = path.join(distDir, 'galaga-data.json');
const data = JSON.parse((await fs.readFile(dataPath, 'utf8')).replace(/^\uFEFF/, ''));

const width = 2060;
const height = 640;
const waveCount = 7;
const cycleSeconds = 28;
const rows = 7;

const grid = {
  x: 88,
  y: 212,
  cell: 28,
  gap: 5,
};

const step = grid.cell + grid.gap;
const pixel = 2;
const sprite = 16;

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
  laser: [
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

function palette(dark) {
  return dark
    ? {
        skyA: '#010208',
        skyB: '#07101d',
        glowA: '#59f1ff',
        glowB: '#ff46d8',
        line: 'rgba(89, 241, 255, 0.22)',
        panel: 'rgba(3, 7, 18, 0.74)',
        panelLine: 'rgba(89, 241, 255, 0.22)',
        text: '#f5fbff',
        muted: '#9eb9d3',
        grid: 'rgba(146, 187, 226, 0.14)',
        cell0: 'rgba(11, 21, 36, 0.82)',
        cellBorder: 'rgba(109, 236, 255, 0.16)',
        strip: 'rgba(6, 12, 25, 0.88)',
        ship: '#ffd54a',
        shipGlow: 'rgba(255, 213, 74, 0.36)',
        laser: '#78f8ff',
        explosion: '#ffab52',
        playfieldTop: '#132032',
        playfieldBottom: '#09111d',
        active: ['#59f1ff', '#47dfff', '#8cff8a', '#ffd55a', '#ff7770'],
      }
    : {
        skyA: '#03050b',
        skyB: '#111e34',
        glowA: '#77f8ff',
        glowB: '#ff67d5',
        line: 'rgba(119, 248, 255, 0.2)',
        panel: 'rgba(12, 20, 38, 0.68)',
        panelLine: 'rgba(119, 248, 255, 0.2)',
        text: '#f7fcff',
        muted: '#c2d7ea',
        grid: 'rgba(166, 199, 230, 0.14)',
        cell0: 'rgba(15, 26, 44, 0.74)',
        cellBorder: 'rgba(121, 242, 255, 0.16)',
        strip: 'rgba(15, 22, 40, 0.8)',
        ship: '#ffe06b',
        shipGlow: 'rgba(255, 224, 107, 0.28)',
        laser: '#7af8ff',
        explosion: '#ffb35e',
        playfieldTop: '#18233b',
        playfieldBottom: '#0d1627',
        active: ['#77f8ff', '#62e0ff', '#8eff8f', '#ffd86b', '#ff8a7b'],
      };
}

function buildStarfield(seed, count, p) {
  const rng = makeRng(seed);
  const stars = [];
  for (let index = 0; index < count; index += 1) {
    const x = 10 + Math.round(rng() * (width - 20));
    const y = 12 + Math.round(rng() * (height - 24));
    const radius = index % 7 === 0 ? 1.85 : index % 4 === 0 ? 1.1 : 0.72;
    const opacity = 0.14 + rng() * 0.48;
    const dur = (4.5 + rng() * 5.5).toFixed(1);
    const delay = (rng() * 4.0).toFixed(1);
    stars.push(`
      <circle cx="${x}" cy="${y}" r="${radius.toFixed(2)}" fill="${p.text}" opacity="${opacity.toFixed(2)}">
        <animate attributeName="opacity" values="${opacity.toFixed(2)};${(opacity * 0.45).toFixed(2)};${opacity.toFixed(2)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
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

function waveForWeek(index, totalWeeks) {
  const normalized = totalWeeks <= 1 ? 0 : index / (totalWeeks - 1);
  return Math.min(waveCount - 1, Math.floor(normalized * waveCount));
}

function waveStart(waveIndex) {
  return waveIndex / waveCount;
}

function waveHit(waveIndex) {
  return Math.min(0.92, waveStart(waveIndex) + 0.04);
}

function waveEnd(waveIndex) {
  return Math.min(0.985, waveStart(waveIndex) + 0.12);
}

function waveCenterX(waveIndex) {
  const playfieldWidth = width - 2 * grid.x;
  return grid.x + playfieldWidth * ((waveIndex + 0.5) / waveCount);
}

function renderCell(day, x, y, p, weekIndex, totalWeeks, rowIndex) {
  const level = Math.max(0, Math.min(4, day.contributionCount));
  const waveIndex = waveForWeek(weekIndex, totalWeeks);
  const start = waveStart(waveIndex);
  const hit = waveHit(waveIndex);
  const end = waveEnd(waveIndex);
  const type = level === 0 ? 'drone' : spriteTypeForCount(level);
  const cellFill = level === 0 ? p.cell0 : p.active[level];
  const glowFill = level === 0 ? 'transparent' : p.active[level];
  const hitStrength = Math.max(0.7, level / 4);
  const seed = `${weekIndex}-${rowIndex}`;
  const bob = 1.6 + ((weekIndex + rowIndex) % 3) * 0.35;

  return `
    <g transform="translate(${x},${y})">
      <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${start.toFixed(3)};${hit.toFixed(3)};${end.toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-${bob.toFixed(2)}; 0,0" dur="${(2.4 + (level * 0.18)).toFixed(1)}s" begin="${(rowIndex * 0.24 + weekIndex * 0.04).toFixed(2)}s" repeatCount="indefinite" />
        <rect width="${grid.cell}" height="${grid.cell}" rx="5" fill="${p.cell0}" stroke="${p.cellBorder}" stroke-width="0.9" />
        ${level > 0 ? `<rect x="2" y="2" width="${grid.cell - 4}" height="${grid.cell - 4}" rx="4" fill="url(#cell-glow-${seed})" opacity="${(0.18 + hitStrength * 0.12).toFixed(2)}" />` : ''}
        ${level > 0 ? drawMatrix(5, 5, alienSprites[type], cellFill, 1) : ''}
        ${level > 0 ? `<rect x="${grid.cell / 2 - 1}" y="${grid.cell / 2 - 1}" width="2" height="2" fill="${p.text}" opacity="0.9" />` : ''}
        ${level > 0 ? `
          <g transform="translate(${grid.cell / 2},${grid.cell / 2})" opacity="0">
            <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${start.toFixed(3)};${hit.toFixed(3)};${Math.min(0.99, hit + 0.07).toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="scale" values="0.2;1.4;0.2" keyTimes="0;0.5;1" dur="0.8s" begin="${hit.toFixed(3)}s" repeatCount="indefinite" />
            <circle r="2.2" fill="${p.explosion}" />
            <circle r="6" fill="none" stroke="${p.explosion}" stroke-width="1.5" opacity="0.9" />
            <path d="M 0 -8 L 0 -2 M 0 2 L 0 8 M -8 0 L -2 0 M 2 0 L 8 0" stroke="${p.explosion}" stroke-width="1.4" stroke-linecap="round" />
          </g>` : ''}
      </g>
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
    const date = new Date(`${firstDay.date}T00:00:00Z`);
    const month = date.getUTCMonth();
    if (month !== lastMonth) {
      markers.push({
        x: grid.x + weekIndex * step,
        label: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
      });
      lastMonth = month;
    }
  }

  return markers;
}

function weekdayLabels(p) {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    .map((label, index) => {
      const y = grid.y + index * step + 18;
      return `<text x="26" y="${y}" fill="${p.muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700">${label}</text>`;
    })
    .join('\n');
}

function renderTitleBar(stats, p) {
  return `
    <g>
      <rect x="34" y="24" width="1992" height="72" rx="20" fill="${p.panel}" stroke="${p.panelLine}" stroke-width="1.1" />
      <text x="60" y="60" fill="${p.text}" font-size="23" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="900" letter-spacing="2.6">GALAGA CONTRIBUTION FLEET</text>
      <text x="474" y="59" fill="${p.muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">${escapeXml(formatNumber.format(data.totalContributions || 0))} TOTAL CONTRIBUTIONS</text>
      <text x="938" y="59" fill="${p.muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">${escapeXml(formatNumber.format(stats.activeDays))} ACTIVE DAYS</text>
      <text x="1452" y="59" fill="${p.muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">STREAK ${escapeXml(formatNumber.format(stats.currentStreak))} / BEST ${escapeXml(formatNumber.format(stats.bestStreak))}</text>
    </g>`;
}

function renderFooter(stats, p) {
  const score = stats.bestStreak * 100 + stats.currentStreak * 20 + stats.activeDays;
  return `
    <g>
      <rect x="34" y="580" width="1992" height="30" rx="15" fill="${p.strip}" stroke="${p.panelLine}" stroke-width="1" />
      <text x="58" y="600" fill="${p.text}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="800" letter-spacing="1.2">POWER LEVEL ${escapeXml(formatNumber.format(Math.max(stats.currentStreak, stats.bestStreak)))}</text>
      <text x="430" y="600" fill="${p.muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">WAVE ${escapeXml(formatNumber.format(stats.activeDays))}</text>
      <text x="680" y="600" fill="${p.muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">GALAGA MODE ENABLED</text>
      <text x="1848" y="600" fill="${p.muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">SCORE ${escapeXml(formatNumber.format(score))}</text>
    </g>`;
}

function renderShip(p, stats) {
  const playfieldWidth = width - 2 * grid.x;
  const points = [];
  const yBase = 530;
  for (let waveIndex = 0; waveIndex < waveCount; waveIndex += 1) {
    const x = grid.x + playfieldWidth * ((waveIndex + 0.5) / waveCount);
    const y = yBase + (waveIndex % 2 === 0 ? 0 : -22);
    points.push(`${x.toFixed(0)},${y.toFixed(0)}`);
  }
  points.push(points[0]);

  const keyTimes = Array.from({ length: points.length }, (_, index) =>
    (index / (points.length - 1)).toFixed(3),
  ).join(';');

  const shipDuration = `${cycleSeconds}s`;

  return `
    <g>
      <animateTransform attributeName="transform" type="translate" values="${points.join('; ')}" keyTimes="${keyTimes}" dur="${shipDuration}" repeatCount="indefinite" />
      <g filter="url(#shipGlow)">
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-2; 2; -2" dur="2.2s" repeatCount="indefinite" />
          <g transform="translate(-28,-16) scale(3.2)">
            ${drawMatrix(0, 0, alienSprites.player, p.ship, 1)}
            <polygon points="6,16 10,8 14,16" fill="${p.shipGlow}" opacity="0.8" />
            <rect x="4" y="15" width="8" height="4" rx="2" fill="${p.text}" opacity="0.55" />
            <rect x="5" y="18" width="6" height="4" rx="1.5" fill="${p.shipGlow}" opacity="0.5" />
          </g>
          <circle cx="0" cy="10" r="5" fill="${p.shipGlow}" opacity="0">
            <animate attributeName="opacity" values="0;0;0.95;0.2;0" keyTimes="0;0.04;0.08;0.14;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
            <animate attributeName="r" values="1;1;8;18;1" keyTimes="0;0.04;0.08;0.14;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
          </circle>
          <g transform="translate(0, 22)">
            <rect x="-2.5" y="0" width="5" height="126" rx="2.5" fill="${p.laser}" opacity="0">
              <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.03;0.06;0.1;0.14;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
              <animate attributeName="height" values="0;0;126;146;0;0" keyTimes="0;0.03;0.06;0.1;0.14;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
              <animate attributeName="y" values="0;0;-126;-146;0;0" keyTimes="0;0.03;0.06;0.1;0.14;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
            </rect>
            <rect x="-10" y="-2" width="20" height="12" rx="6" fill="${p.laser}" opacity="0.18">
              <animate attributeName="opacity" values="0;0;0.4;0.24;0" keyTimes="0;0.03;0.06;0.1;0.16;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
            </rect>
          </g>
        </g>
      </g>
    </g>`;
}

function renderBeams(p) {
  const playfieldWidth = width - 2 * grid.x;
  const beams = [];
  for (let waveIndex = 0; waveIndex < waveCount; waveIndex += 1) {
    const x = grid.x + playfieldWidth * ((waveIndex + 0.5) / waveCount);
    const start = waveStart(waveIndex);
    const hit = waveHit(waveIndex);
    const end = waveEnd(waveIndex);
    const top = 132;
    const beamHeight = 336;
    beams.push(`
      <g>
        <rect x="${(x - 10).toFixed(1)}" y="${top}" width="20" height="${beamHeight}" rx="8" fill="${p.laser}" opacity="0">
          <animate attributeName="opacity" values="0;0;0.12;0.95;0.18;0;0" keyTimes="0;${start.toFixed(3)};${Math.max(start + 0.015, hit - 0.02).toFixed(3)};${hit.toFixed(3)};${end.toFixed(3)};${Math.min(0.99, end + 0.08).toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="scale" values="0.55,0.2; 1,1; 1.3,1; 0.65,0.2" keyTimes="0;0.15;0.5;1" dur="0.38s" begin="${hit.toFixed(3)}s" repeatCount="indefinite" />
        </rect>
        <rect x="${(x - 4).toFixed(1)}" y="${top}" width="8" height="${beamHeight}" rx="4" fill="#ffffff" opacity="0">
          <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${start.toFixed(3)};${hit.toFixed(3)};${end.toFixed(3)};${Math.min(0.99, end + 0.08).toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
          <animate attributeName="height" values="0;0;336;358;0;0" keyTimes="0;${start.toFixed(3)};${hit.toFixed(3)};${end.toFixed(3)};${Math.min(0.99, end + 0.08).toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
          <animate attributeName="y" values="${(top + beamHeight).toFixed(0)};${(top + beamHeight).toFixed(0)};${top};${(top - 14).toFixed(0)};${(top + beamHeight).toFixed(0)};${(top + beamHeight).toFixed(0)}" keyTimes="0;${start.toFixed(3)};${hit.toFixed(3)};${end.toFixed(3)};${Math.min(0.99, end + 0.08).toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
        </rect>
        <circle cx="${x.toFixed(1)}" cy="${top - 8}" r="5" fill="${p.explosion}" opacity="0">
          <animate attributeName="opacity" values="0;0;1;0.2;0" keyTimes="0;${start.toFixed(3)};${hit.toFixed(3)};${Math.min(0.99, hit + 0.04).toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
          <animate attributeName="r" values="0;0;7;14;0" keyTimes="0;${start.toFixed(3)};${hit.toFixed(3)};${Math.min(0.99, hit + 0.04).toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
        </circle>
      </g>`);
  }
  return beams.join('\n');
}

function renderFleet(weeks, p) {
  const cells = weeks
    .map((week, weekIndex) =>
      week.contributionDays
        .map((day, rowIndex) => {
          const x = grid.x + weekIndex * step;
          const y = grid.y + rowIndex * step;
          return renderCell(day, x, y, p, weekIndex, weeks.length, rowIndex);
        })
        .join('\n'),
    )
    .join('\n');

  return `
    <g>
      <rect x="${grid.x - 14}" y="${grid.y - 14}" width="${weeks.length * step + 28}" height="${rows * step + 28}" rx="26" fill="rgba(8, 14, 28, 0.42)" stroke="${p.line}" stroke-width="1" />
      <rect x="${grid.x - 4}" y="${grid.y - 4}" width="${weeks.length * step + 8}" height="${rows * step + 8}" rx="20" fill="none" stroke="${p.grid}" stroke-width="1" />
      ${cells}
    </g>`;
}

function renderSvg(dark) {
  const p = palette(dark);
  const stats = computeStats(data.weeks);
  const markers = monthMarkers(data.weeks);
  const starfield = buildStarfield(dark ? 1200 : 520, dark ? 132 : 110, p);
  const gridWidth = data.weeks.length * step;
  const horizon = grid.y - 18;

  const monthLabels = markers
    .map((marker) => `<text x="${marker.x}" y="${grid.y - 20}" fill="${p.muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">${marker.label}</text>`)
    .join('\n');

  const scanlines = Array.from({ length: 28 }, (_, index) => {
    const y = 114 + index * 17;
    return `<rect x="0" y="${y}" width="${width}" height="2" fill="#ffffff" opacity="${index % 2 === 0 ? '0.045' : '0.022'}" />`;
  }).join('\n');

  const edgeFog = `
    <ellipse cx="${width / 2}" cy="112" rx="${width * 0.42}" ry="28" fill="url(#frame)" opacity="0.12" filter="url(#softGlow)" />
    <ellipse cx="${width / 2}" cy="540" rx="${width * 0.42}" ry="26" fill="url(#frame)" opacity="0.09" filter="url(#softGlow)" />
  `;

  const resetPulse = `
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;0.85;0" keyTimes="0;0.945;0.985;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
      <ellipse cx="${grid.x + gridWidth / 2}" cy="${grid.y + rows * step / 2}" rx="${gridWidth * 0.26}" ry="${rows * step * 0.64}" fill="none" stroke="url(#frame)" stroke-width="4" filter="url(#glow)" />
      <ellipse cx="${grid.x + gridWidth / 2}" cy="${grid.y + rows * step / 2}" rx="${gridWidth * 0.19}" ry="${rows * step * 0.42}" fill="none" stroke="${p.text}" stroke-width="1.4" opacity="0.6" />
    </g>`;

  const cells = renderFleet(data.weeks, p);
  const beams = renderBeams(p);
  const ship = renderShip(p, stats);

  const cellGlowDefs = data.weeks
    .flatMap((week, weekIndex) =>
      week.contributionDays.map((day, rowIndex) => {
        const level = Math.max(0, Math.min(4, day.contributionCount));
        const color = level === 0 ? p.cell0 : p.active[level];
        const id = `cell-glow-${weekIndex}-${rowIndex}`;
        return `
    <radialGradient id="${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${level === 0 ? p.cellBorder : color}" stop-opacity="0.85" />
      <stop offset="100%" stop-color="${level === 0 ? p.cellBorder : color}" stop-opacity="0" />
    </radialGradient>`;
      }),
    )
    .join('\n');

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animated Galaga style contribution graph">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.skyA}" />
      <stop offset="100%" stop-color="${p.skyB}" />
    </linearGradient>
    <linearGradient id="frame" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${p.glowA}" />
      <stop offset="45%" stop-color="${p.glowB}" />
      <stop offset="100%" stop-color="${p.glowA}" />
    </linearGradient>
    <linearGradient id="playfield" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${p.playfieldTop}" stop-opacity="0.96" />
      <stop offset="100%" stop-color="${p.playfieldBottom}" stop-opacity="0.96" />
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
    <filter id="shipGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.3 0 1 0 0 0.95 0 0 1 0 1 0 0 0 1 0" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    ${cellGlowDefs}
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="32" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
  <rect x="22" y="22" width="${width - 44}" height="${height - 44}" rx="30" fill="none" stroke="${p.line}" stroke-width="10" opacity="0.8" />
  <rect x="22" y="22" width="${width - 44}" height="${height - 44}" rx="30" fill="none" stroke="url(#frame)" stroke-width="2.4" filter="url(#glow)" />
  <rect x="34" y="110" width="${width - 68}" height="470" rx="24" fill="url(#playfield)" stroke="${p.line}" stroke-width="1" />
  ${edgeFog}
  ${starfield}
  ${scanlines}
  ${renderTitleBar(stats, p)}
  ${monthLabels}
  ${weekdayLabels(p)}
  ${resetPulse}
  ${cells}
  ${beams}
  ${ship}
  ${renderFooter(stats, p)}
</svg>
`.trimStart();
}

await fs.mkdir(distDir, { recursive: true });
await fs.writeFile(path.join(distDir, 'galaga-contribution-graph.svg'), renderSvg(false));
await fs.writeFile(path.join(distDir, 'galaga-contribution-graph-dark.svg'), renderSvg(true));

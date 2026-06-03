import fs from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const dataPath = path.join(distDir, 'galaga-data.json');
const data = JSON.parse((await fs.readFile(dataPath, 'utf8')).replace(/^\uFEFF/, ''));

const width = 2280;
const height = 760;
const waveCount = 7;
const cycleSeconds = 28;
const rows = 7;

const grid = {
  x: 92,
  y: 234,
  cell: 36,
  gap: 4,
};

const step = grid.cell + grid.gap;
const pixel = 4;
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
        active: ['#59f1ff', '#7cff7c', '#59f1ff', '#ffd55a', '#ff7770'],
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
        active: ['#77f8ff', '#7bff8b', '#62e0ff', '#ffd86b', '#ff8a7b'],
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

function summarizeWaves(weeks) {
  const summaries = Array.from({ length: waveCount }, () => ({
    level: 0,
    activeDays: 0,
    totalContribution: 0,
  }));

  weeks.forEach((week, weekIndex) => {
    const waveIndex = waveForWeek(weekIndex, weeks.length);
    const wave = summaries[waveIndex];
    for (const day of week.contributionDays) {
      const level = Math.max(0, Math.min(4, day.contributionCount));
      wave.level = Math.max(wave.level, level);
      wave.totalContribution += level;
      if (level > 0) wave.activeDays += 1;
    }
  });

  return summaries;
}

function buildTargets(weeks) {
  const targets = [];
  weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day, rowIndex) => {
      const contributionCount = Math.max(0, day.contributionCount || 0);
      if (contributionCount === 0) return;
      targets.push({
        weekIndex,
        rowIndex,
        contributionCount,
        level: Math.max(1, Math.min(4, contributionCount)),
        x: grid.x + weekIndex * step + grid.cell / 2,
        y: grid.y + rowIndex * step + grid.cell / 2,
      });
    });
  });
  return targets;
}

function buildTargetSchedule(targets) {
  if (targets.length === 0) {
    return [];
  }

  const resetWindow = 0.06;
  const available = 1 - resetWindow;
  const totalWeight = targets.reduce(
    (sum, target) => sum + 1.4 + target.contributionCount * 0.62,
    0,
  );
  let cursor = 0;

  return targets.map((target) => {
    const span = available * ((1.4 + target.contributionCount * 0.62) / totalWeight);
    const move = Math.min(span * 0.32, 0.018);
    const arrive = cursor + move;
    const end = cursor + span;
    const shotSpacing = Math.max(0.01, end - arrive) / (target.contributionCount + 1);
    const lastFireAt = arrive + shotSpacing * target.contributionCount;
    const vanishAt = Math.min(0.985, lastFireAt + 0.045);
    const entry = {
      ...target,
      start: cursor,
      arrive,
      end,
      shotSpacing,
      vanishAt,
    };
    cursor += span;
    return entry;
  });
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

function renderCell(day, x, y, p, weekIndex, totalWeeks, rowIndex, target) {
  const level = Math.max(0, Math.min(4, day.contributionCount));
  const waveIndex = waveForWeek(weekIndex, totalWeeks);
  const hit = target?.vanishAt ?? waveHit(waveIndex);
  const fade = Math.min(0.992, hit + 0.028);
  const respawn = 0.998;
  const type = level === 0 ? 'drone' : spriteTypeForCount(level);
  const cellFill = level === 0 ? p.cell0 : p.active[level];
  const hitStrength = Math.max(0.7, level / 4);
  const seed = `${weekIndex}-${rowIndex}`;
  const bob = 1.6 + ((weekIndex + rowIndex) % 3) * 0.35;
  const spriteScale = level === 0 ? 1 : 0.9 + level * 0.04;
  const glowOpacity = level === 0 ? 0 : (0.16 + hitStrength * 0.16).toFixed(2);
  const vanishAnimation = level > 0
    ? `<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${hit.toFixed(4)};${fade.toFixed(4)};${respawn.toFixed(4)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />`
    : '';

  return `
    <g transform="translate(${x},${y})">
      ${vanishAnimation}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-${bob.toFixed(2)}; 0,0" dur="${(2.4 + (level * 0.18)).toFixed(1)}s" begin="${(rowIndex * 0.24 + weekIndex * 0.04).toFixed(2)}s" repeatCount="indefinite" />
        <rect width="${grid.cell}" height="${grid.cell}" rx="5" fill="${p.cell0}" stroke="${p.cellBorder}" stroke-width="0.9" />
        ${level > 0 ? `<rect x="2" y="2" width="${grid.cell - 4}" height="${grid.cell - 4}" rx="4" fill="url(#cell-glow-${seed})" opacity="${glowOpacity}" />` : ''}
        ${level > 0 ? `<g transform="translate(2,2) scale(${spriteScale.toFixed(2)})">${drawMatrix(3, 3, alienSprites[type], cellFill, 1)}<rect x="6" y="6" width="4" height="4" fill="${p.text}" opacity="0.95" /></g>` : ''}
        ${level > 0 ? `
          <g transform="translate(${grid.cell / 2},${grid.cell / 2})" opacity="0">
            <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${Math.max(0.0001, hit - 0.012).toFixed(4)};${hit.toFixed(4)};${Math.min(0.996, hit + 0.07).toFixed(4)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
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
      const y = grid.y + index * step + 23;
      return `<text x="30" y="${y}" fill="${p.muted}" font-size="15" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="800">${label}</text>`;
    })
    .join('\n');
}

function renderTitleBar(stats, p) {
  return `
    <g>
      <rect x="34" y="24" width="2212" height="76" rx="20" fill="${p.panel}" stroke="${p.panelLine}" stroke-width="1.1" />
      <text x="60" y="60" fill="${p.text}" font-size="23" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="900" letter-spacing="2.6">GALAGA CONTRIBUTION FLEET</text>
      <text x="516" y="60" fill="${p.muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">${escapeXml(formatNumber.format(data.totalContributions || 0))} TOTAL CONTRIBUTIONS</text>
      <text x="1060" y="60" fill="${p.muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">${escapeXml(formatNumber.format(stats.activeDays))} ACTIVE DAYS</text>
      <text x="1590" y="60" fill="${p.muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.2">STREAK ${escapeXml(formatNumber.format(stats.currentStreak))} / BEST ${escapeXml(formatNumber.format(stats.bestStreak))}</text>
    </g>`;
}

function renderFooter(stats, p) {
  const score = stats.bestStreak * 100 + stats.currentStreak * 20 + stats.activeDays;
  return `
    <g>
      <rect x="34" y="700" width="2212" height="30" rx="15" fill="${p.strip}" stroke="${p.panelLine}" stroke-width="1" />
      <text x="58" y="720" fill="${p.text}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="800" letter-spacing="1.2">POWER LEVEL ${escapeXml(formatNumber.format(Math.max(stats.currentStreak, stats.bestStreak)))}</text>
      <text x="460" y="720" fill="${p.muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">WAVE ${escapeXml(formatNumber.format(stats.activeDays))}</text>
      <text x="760" y="720" fill="${p.muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">GALAGA MODE ENABLED</text>
      <text x="2058" y="720" fill="${p.muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" letter-spacing="1.1">SCORE ${escapeXml(formatNumber.format(score))}</text>
    </g>`;
}

function renderShip(p, schedule) {
  const yBase = 628;
  const fallbackX = width / 2;
  const values = [];
  const keyTimes = [];

  if (schedule.length === 0) {
    values.push(`${fallbackX.toFixed(1)},${yBase}`);
    keyTimes.push('0');
  } else {
    schedule.forEach((target, index) => {
      const previous = schedule[index - 1];
      if (index === 0) {
        values.push(`${target.x.toFixed(1)},${yBase}`);
        keyTimes.push('0');
      } else if (previous && target.arrive > previous.end) {
        values.push(`${previous.x.toFixed(1)},${yBase}`);
        keyTimes.push(previous.end.toFixed(4));
      }
      values.push(`${target.x.toFixed(1)},${yBase}`);
      keyTimes.push(target.arrive.toFixed(4));
      values.push(`${target.x.toFixed(1)},${yBase}`);
      keyTimes.push(target.end.toFixed(4));
    });
  }

  values.push(`${(schedule[0]?.x || fallbackX).toFixed(1)},${yBase}`);
  keyTimes.push('1');

  const shipDuration = `${cycleSeconds}s`;

  return `
    <g>
      <animateTransform attributeName="transform" type="translate" values="${values.join('; ')}" keyTimes="${keyTimes.join(';')}" dur="${shipDuration}" repeatCount="indefinite" />
      <g filter="url(#shipGlow)">
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-2; 2; -2" dur="2.2s" repeatCount="indefinite" />
          <g transform="translate(-18,-10) scale(1.55)">
            ${drawMatrix(0, 0, alienSprites.player, p.ship, 1)}
            <polygon points="6,16 10,8 14,16" fill="${p.shipGlow}" opacity="0.8" />
            <rect x="4" y="15" width="8" height="4" rx="2" fill="${p.text}" opacity="0.55" />
            <rect x="5" y="18" width="6" height="4" rx="1.5" fill="${p.shipGlow}" opacity="0.5" />
          </g>
          <circle cx="0" cy="10" r="5" fill="${p.shipGlow}" opacity="0">
            <animate attributeName="opacity" values="0;0;0.95;0.2;0" keyTimes="0;0.04;0.08;0.14;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
            <animate attributeName="r" values="1;1;8;18;1" keyTimes="0;0.04;0.08;0.14;1" dur="${cycleSeconds}s" repeatCount="indefinite" />
          </circle>
        </g>
      </g>
    </g>`;
}

function renderShipFire(p, schedule) {
  const shots = [];
  for (const target of schedule) {
    const shipY = 628;
    const shotCount = target.contributionCount;
    const shotColor = p.active[target.level] || p.laser;
    const shotRadius = 2.2 + target.level * 0.48;
    const shotSpacing = target.shotSpacing;

    for (let shotIndex = 0; shotIndex < shotCount; shotIndex += 1) {
      const fireAt = target.arrive + shotSpacing * (shotIndex + 1);
      const preFire = Math.max(0.0001, fireAt - 0.006);
      const hitAt = Math.min(target.vanishAt, fireAt + 0.045);
      const fadeAt = Math.min(0.998, fireAt + 0.064);
      const offset = shotCount === 1 ? 0 : ((shotIndex % 3) - 1) * 4;
      const shotDistance = Math.max(80, shipY - target.y + 8);
      const bulletHeight = 14 + Math.min(18, target.level * 3);
      shots.push(`
        <g transform="translate(${(target.x + offset).toFixed(1)},${shipY})" opacity="0">
          <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${preFire.toFixed(4)};${fireAt.toFixed(4)};${hitAt.toFixed(4)};${fadeAt.toFixed(4)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate" values="0,0;0,0;0,-${shotDistance.toFixed(1)};0,-${shotDistance.toFixed(1)}" keyTimes="0;${fireAt.toFixed(4)};${hitAt.toFixed(4)};1" dur="${cycleSeconds}s" repeatCount="indefinite" additive="sum" />
          <circle cx="0" cy="0" r="${shotRadius.toFixed(1)}" fill="${shotColor}" opacity="0.98" />
          <circle cx="0" cy="0" r="${(shotRadius + 3.8).toFixed(1)}" fill="none" stroke="${shotColor}" stroke-width="1.6" opacity="0.75" />
          <rect x="-1.5" y="${shotRadius.toFixed(1)}" width="3" height="${bulletHeight}" rx="1.5" fill="${shotColor}" opacity="0.58" />
        </g>`);
    }
  }
  return shots.join('\n');
}

function renderDiveSquads(p, waves) {
  const squads = [];
  const formationY = grid.y - 34;
  const diveY = 610;
  for (let waveIndex = 0; waveIndex < waveCount; waveIndex += 1) {
    const start = waveStart(waveIndex);
    const wave = waves[waveIndex];
    const level = wave?.level ?? 0;
    if (level <= 0) continue;
    const laneX = waveCenterX(waveIndex);
    const sway = waveIndex % 2 === 0 ? 120 : -120;
    const returnX = waveCenterX((waveIndex + 3) % waveCount);
    const type = waveIndex % 3 === 0 ? 'boss' : waveIndex % 3 === 1 ? 'ace' : 'wing';
    const delay = (waveIndex * 0.04).toFixed(2);
    const scale = (1.9 + level * 0.22).toFixed(2);

    squads.push(`
      <g opacity="0">
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${start.toFixed(3)};${Math.min(0.96, start + 0.03).toFixed(3)};${Math.min(0.99, start + 0.2).toFixed(3)};${Math.min(0.99, start + 0.24).toFixed(3)};1" dur="${cycleSeconds}s" repeatCount="indefinite" />
        <animateMotion path="M ${laneX.toFixed(1)} ${formationY} C ${(laneX + sway).toFixed(1)} ${formationY + 42}, ${(laneX + sway * 0.75).toFixed(1)} ${diveY - 200}, ${returnX.toFixed(1)} ${diveY} C ${(returnX - sway * 0.65).toFixed(1)} ${diveY + 96}, ${(laneX - sway * 0.45).toFixed(1)} ${formationY + 48}, ${laneX.toFixed(1)} ${formationY}" dur="${(cycleSeconds * 0.58).toFixed(1)}s" begin="${(start + 0.02).toFixed(3)}s" repeatCount="indefinite" />
        <g transform="translate(-16,-16) scale(${scale})">
          ${drawMatrix(0, 0, alienSprites[type], p.active[level], 1)}
        </g>
        <circle cx="0" cy="0" r="${(10 + level * 2).toFixed(1)}" fill="${p.shipGlow}" opacity="0.07">
          <animate attributeName="r" values="${(8 + level).toFixed(1)};${(14 + level * 2).toFixed(1)};${(8 + level).toFixed(1)}" dur="1.8s" begin="${delay}s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.03;0.12;0.03" dur="1.8s" begin="${delay}s" repeatCount="indefinite" />
        </circle>
      </g>`);
  }
  return squads.join('\n');
}

function renderFleet(weeks, p, schedule) {
  const targetsByCell = new Map(
    schedule.map((target) => [`${target.weekIndex}-${target.rowIndex}`, target]),
  );
  const cells = weeks
    .map((week, weekIndex) =>
      week.contributionDays
        .map((day, rowIndex) => {
          const x = grid.x + weekIndex * step;
          const y = grid.y + rowIndex * step;
          return renderCell(
            day,
            x,
            y,
            p,
            weekIndex,
            weeks.length,
            rowIndex,
            targetsByCell.get(`${weekIndex}-${rowIndex}`),
          );
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
  const waves = summarizeWaves(data.weeks);
  const targets = buildTargets(data.weeks);
  const targetSchedule = buildTargetSchedule(targets);
  const starfield = buildStarfield(dark ? 1200 : 520, dark ? 132 : 110, p);

  const monthLabels = markers
    .map((marker) => `<text x="${marker.x}" y="${grid.y - 22}" fill="${p.muted}" font-size="16" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="800" letter-spacing="1.1">${marker.label}</text>`)
    .join('\n');

  const scanlines = Array.from({ length: 30 }, (_, index) => {
    const y = 120 + index * 18;
    return `<rect x="0" y="${y}" width="${width}" height="2" fill="#ffffff" opacity="${index % 2 === 0 ? '0.045' : '0.022'}" />`;
  }).join('\n');

  const edgeFog = `
    <ellipse cx="${width / 2}" cy="116" rx="${width * 0.42}" ry="30" fill="url(#frame)" opacity="0.12" filter="url(#softGlow)" />
    <ellipse cx="${width / 2}" cy="${height - 108}" rx="${width * 0.42}" ry="28" fill="url(#frame)" opacity="0.09" filter="url(#softGlow)" />
  `;

  const cells = renderFleet(data.weeks, p, targetSchedule);
  const bursts = renderShipFire(p, targetSchedule);
  const dives = renderDiveSquads(p, waves);
  const ship = renderShip(p, targetSchedule);

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
  <rect x="34" y="110" width="${width - 68}" height="560" rx="24" fill="url(#playfield)" stroke="${p.line}" stroke-width="1" />
  ${edgeFog}
  ${starfield}
  ${scanlines}
  ${renderTitleBar(stats, p)}
  ${monthLabels}
  ${weekdayLabels(p)}
  ${dives}
  ${cells}
  ${ship}
  ${bursts}
  ${renderFooter(stats, p)}
</svg>
`.trimStart();
}

await fs.mkdir(distDir, { recursive: true });
await fs.writeFile(path.join(distDir, 'galaga-contribution-graph.svg'), renderSvg(false));
await fs.writeFile(path.join(distDir, 'galaga-contribution-graph-dark.svg'), renderSvg(true));

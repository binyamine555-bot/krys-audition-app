/* =========================================================================
   Graphiques SVG Audiologiques et Cliniques Réactifs
   -------------------------------------------------------------------------
   - Audiométrie Vocale (% vs dB avec courbe normale de référence)
   - Radar Phonétique Multi-Axes (Progression par famille de sons)
   - Évolution temporelle du Seuil dans le Bruit (RSB / SNR-50)
   - Histogramme d'Assiduité et Heatmap 28 jours
   - Courbes d'effort et confort d'écoute
   ========================================================================= */

const Charts = (() => {

  /* ---------------- 1. Courbe Linéaire Temporelle ---------------- */
  function line(points, { width = 340, height = 150, unit = "", invert = false, color = "#002D62", empty = "Pas encore de données" } = {}) {
    if (!points || points.length < 2) return `<div class="chart-empty">${empty}</div>`;
    const m = { l: 38, r: 12, t: 14, b: 24 };
    const iw = width - m.l - m.r, ih = height - m.t - m.b;
    const vs = points.map(p => Number(p.v));
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi - lo < 4) { const c = (hi + lo) / 2; lo = c - 2; hi = c + 2; }
    lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1);
    const x = i => m.l + (i / (points.length - 1)) * iw;
    const y = v => invert ? m.t + ((v - lo) / (hi - lo)) * ih : m.t + ((hi - v) / (hi - lo)) * ih;
    let s = `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="Graphique d'évolution">`;
    const ticks = 4;
    for (let k = 0; k <= ticks; k++) {
      const v = lo + (hi - lo) * k / ticks;
      s += `<line x1="${m.l}" x2="${width - m.r}" y1="${y(v)}" y2="${y(v)}" class="c-grid"/><text x="${m.l - 6}" y="${y(v) + 3}" class="c-lab" text-anchor="end">${Math.round(v)}${unit}</text>`;
    }
    const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const area = d + ` L${x(points.length - 1)},${m.t + ih} L${x(0)},${m.t + ih} Z`;
    s += `<path d="${area}" fill="${color}" opacity="0.08"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    points.forEach((p, i) => { s += `<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/>`; });
    if (points[0].date) {
      s += `<text x="${m.l}" y="${height - 5}" class="c-lab">${fmtShort(points[0].date)}</text>`;
      s += `<text x="${width - m.r}" y="${height - 5}" class="c-lab" text-anchor="end">${fmtShort(points[points.length - 1].date)}</text>`;
    }
    s += `</svg>`;
    return s;
  }

  /* ---------------- 2. Barres Horizontales de Performance ---------------- */
  function bars(items) {
    return `<div class="hbars">${items.map(it => {
      const pct = it.v === null ? 0 : Math.round(it.v * 100);
      const cls = it.v === null ? "na" : pct >= 80 ? "good" : pct >= 60 ? "mid" : "low";
      return `<div class="hbar"><div class="hbar-l">${esc(it.label)}</div><div class="hbar-t"><div class="hbar-f ${cls}" style="width:${pct}%"></div></div><div class="hbar-v">${it.v === null ? "—" : pct + "%"}</div></div>`;
    }).join("")}</div>`;
  }

  /* ---------------- 3. Heatmap Calendrier d'Assiduité ---------------- */
  function heat(sessions, days = 28) {
    const counts = {};
    sessions.forEach(s => { const k = dayKey(s.date); counts[k] = (counts[k] || 0) + 1; });
    let cells = "";
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(new Date(), -i), k = dayKey(d), c = counts[k] || 0;
      const lvl = c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : 3;
      cells += `<div class="heat-c l${lvl}${i === 0 ? " today" : ""}" title="${fmtShort(d)} : ${c} exercice(s)"><span>${d.getDate()}</span></div>`;
    }
    return `<div class="heat">${cells}</div>`;
  }

  /* ---------------- 4. Petite Sparkline ---------------- */
  function spark(values, { width = 90, height = 28, color = "#E2001A", invert = false } = {}) {
    if (!values || values.length < 2) return "";
    const lo = Math.min(...values), hi = Math.max(...values), r = hi - lo || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1) * (width - 4) + 2).toFixed(1)},${(invert ? 2 + (v - lo) / r * (height - 4) : height - 2 - (v - lo) / r * (height - 4)).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${width} ${height}" class="spark" width="${width}" height="${height}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }

  /* ---------------- 5. Audiométrie Vocale (% vs dB HL) ---------------- */
  function speechCurve(vocalDataRight, vocalDataLeft, { width = 340, height = 220 } = {}) {
    const m = { l: 38, r: 16, t: 20, b: 28 };
    const iw = width - m.l - m.r, ih = height - m.t - m.b;
    const minDb = 0, maxDb = 100;
    const x = db => m.l + ((db - minDb) / (maxDb - minDb)) * iw;
    const y = pct => m.t + ((100 - pct) / 100) * ih;

    let s = `<svg viewBox="0 0 ${width} ${height}" class="speech-svg" role="img" aria-label="Courbe d'audiométrie vocale">`;

    // Grille
    for (let pct = 0; pct <= 100; pct += 25) {
      s += `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(pct)}" y2="${y(pct)}" class="c-grid${pct === 50 ? " c-mid" : ""}"/><text x="${m.l - 6}" y="${y(pct) + 3}" class="c-lab" text-anchor="end">${pct}%</text>`;
    }
    for (let db = 0; db <= 100; db += 20) {
      s += `<line x1="${x(db)}" x2="${x(db)}" y1="${m.t}" y2="${m.t + ih}" class="c-grid"/><text x="${x(db)}" y="${m.t + ih + 16}" class="c-lab" text-anchor="middle">${db}</text>`;
    }
    s += `<text x="${m.l + iw}" y="${m.t + ih + 16}" class="c-lab" text-anchor="end">dB HL</text>`;

    // Courbe de référence normo-entendante (sigmoïde théorique centrée sur 20-25 dB)
    const normPts = [];
    for (let db = 5; db <= 50; db += 2.5) {
      const p = 100 / (1 + Math.exp(-(db - 20) / 4.2));
      normPts.push(`${x(db).toFixed(1)},${y(p).toFixed(1)}`);
    }
    s += `<path d="M${normPts.join(" L")}" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-dasharray="4 3"/>`;
    s += `<text x="${x(28)}" y="${y(85)}" fill="#64748b" font-size="9">Norme (Fournier)</text>`;

    // Tracé oreille droite (rouge, cercles)
    if (vocalDataRight && vocalDataRight.length) {
      const sorted = [...vocalDataRight].sort((a, b) => a.db - b.db);
      const dR = sorted.map((p, i) => `${i ? "L" : "M"}${x(p.db).toFixed(1)},${y(p.pct).toFixed(1)}`).join(" ");
      s += `<path d="${dR}" fill="none" stroke="#E2001A" stroke-width="2.5"/>`;
      sorted.forEach(p => {
        s += `<circle cx="${x(p.db)}" cy="${y(p.pct)}" r="4" fill="#fff" stroke="#E2001A" stroke-width="2.2"/>`;
      });
    }

    // Tracé oreille gauche (bleu, croix)
    if (vocalDataLeft && vocalDataLeft.length) {
      const sorted = [...vocalDataLeft].sort((a, b) => a.db - b.db);
      const dL = sorted.map((p, i) => `${i ? "L" : "M"}${x(p.db).toFixed(1)},${y(p.pct).toFixed(1)}`).join(" ");
      s += `<path d="${dL}" fill="none" stroke="#002D62" stroke-width="2.5"/>`;
      sorted.forEach(p => {
        s += `<g stroke="#002D62" stroke-width="2"><line x1="${x(p.db) - 3.5}" y1="${y(p.pct) - 3.5}" x2="${x(p.db) + 3.5}" y2="${y(p.pct) + 3.5}"/><line x1="${x(p.db) - 3.5}" y1="${y(p.pct) + 3.5}" x2="${x(p.db) + 3.5}" y2="${y(p.pct) - 3.5}"/></g>`;
      });
    }

    s += `</svg>`;
    return s;
  }

  /* ---------------- 6. Radar Phonétique Multi-Axes ---------------- */
  function radar(data, { width = 280, height = 240 } = {}) {
    const cx = width / 2, cy = height / 2 + 8, r = Math.min(width, height) * 0.38;
    const axes = [
      { key: "fricatives", label: "Aigus (S/CH/F)" },
      { key: "voisement", label: "Voisement (P-B/T-D)" },
      { key: "lieu", label: "Explosives (P/T/K)" },
      { key: "nasales", label: "Nasales (M/N)" },
      { key: "voyelles", label: "Voyelles (I/U/OU)" }
    ];
    const n = axes.length;
    const angle = i => -Math.PI / 2 + (i * 2 * Math.PI) / n;

    let s = `<svg viewBox="0 0 ${width} ${height}" class="radar-svg" role="img" aria-label="Radar phonétique">`;

    // Toiles concentriques
    [0.25, 0.5, 0.75, 1.0].forEach(k => {
      const pts = axes.map((_, i) => {
        const a = angle(i);
        return `${(cx + r * k * Math.cos(a)).toFixed(1)},${(cy + r * k * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      s += `<polygon points="${pts}" fill="${k === 1.0 ? "#f8fafc" : "none"}" stroke="#cbd5e1" stroke-width="1"/>`;
    });

    // Lignes d'axes et labels
    axes.forEach((ax, i) => {
      const a = angle(i);
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#cbd5e1" stroke-width="1.2"/>`;
      const tx = cx + (r + 18) * Math.cos(a), ty = cy + (r + 18) * Math.sin(a);
      const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
      s += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="radar-lab" text-anchor="${anchor}">${ax.label}</text>`;
    });

    // Polygone des scores réels
    const scorePts = axes.map((ax, i) => {
      const a = angle(i);
      const val = data && data[ax.key] !== null && data[ax.key] !== undefined ? Number(data[ax.key]) : 0.65;
      const dist = r * Math.max(0.1, Math.min(1.0, val));
      return `${(cx + dist * Math.cos(a)).toFixed(1)},${(cy + dist * Math.sin(a)).toFixed(1)}`;
    }).join(" ");

    s += `<polygon points="${scorePts}" fill="rgba(0, 45, 98, 0.2)" stroke="#002D62" stroke-width="2.5"/>`;
    axes.forEach((ax, i) => {
      const a = angle(i);
      const val = data && data[ax.key] !== null && data[ax.key] !== undefined ? Number(data[ax.key]) : 0.65;
      const dist = r * Math.max(0.1, Math.min(1.0, val));
      s += `<circle cx="${(cx + dist * Math.cos(a)).toFixed(1)}" cy="${(cy + dist * Math.sin(a)).toFixed(1)}" r="4" fill="#E2001A"/>`;
    });

    s += `</svg>`;
    return s;
  }

  return { line, bars, heat, spark, speechCurve, radar };
})();

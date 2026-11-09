/* =========================================================================
   Audiogramme : analyse du profil auditif + rendu graphique SVG
   ========================================================================= */
const Audiogram = (() => {

  const avg = arr => { const v = arr.filter(x => x !== null && x !== undefined && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const val = (ear, f) => (ear && ear[f] !== undefined && ear[f] !== null && ear[f] !== "") ? Number(ear[f]) : null;

  /* Perte tonale moyenne (BIAP : 500, 1000, 2000, 4000 Hz) */
  function pta(ear) { return avg([500, 1000, 2000, 4000].map(f => val(ear, f))); }

  /* Classification BIAP */
  function severity(db) {
    if (db === null) return { key: "na", label: "Non renseigné" };
    if (db <= 20) return { key: "normal", label: "Audition normale ou subnormale" };
    if (db <= 40) return { key: "leger", label: "Perte légère" };
    if (db <= 55) return { key: "moyen1", label: "Perte moyenne (1er degré)" };
    if (db <= 70) return { key: "moyen2", label: "Perte moyenne (2e degré)" };
    if (db <= 90) return { key: "severe", label: "Perte sévère" };
    return { key: "profond", label: "Perte profonde" };
  }

  function zoneLoss(ear, zone) { return avg(ZONES[zone].freqs.map(f => val(ear, f))); }

  function shape(ear) {
    const low = zoneLoss(ear, "grave"), mid = zoneLoss(ear, "medium"), high = avg([val(ear, 4000), val(ear, 6000), val(ear, 8000)]);
    if (low === null || high === null) return { key: "na", label: "—" };
    const f2 = val(ear, 2000), f4 = val(ear, 4000), f8 = val(ear, 8000);
    if (f4 !== null && f2 !== null && f8 !== null && f4 - Math.max(f2, f8) >= 10 && f4 - f2 >= 15)
      return { key: "notch", label: "Encoche autour de 4 kHz", desc: "Profil souvent lié à une exposition au bruit." };
    if (high - low >= 25) return { key: "descending", label: "Courbe descendante (perte dans les aigus)", desc: "Les consonnes aiguës (s, ch, f, t) sont les plus difficiles à percevoir, surtout dans le bruit." };
    if (low - high >= 15) return { key: "rising", label: "Courbe ascendante (perte dans les graves)", desc: "Les voyelles et les sons graves sont moins bien perçus." };
    if (mid !== null && mid - (low + high) / 2 >= 15) return { key: "cookie", label: "Courbe en cuvette (médiums)", desc: "Les fréquences moyennes de la parole sont les plus touchées." };
    return { key: "flat", label: "Courbe plate", desc: "La perte touche de façon similaire graves et aigus." };
  }

  /* Analyse complète */
  function analyze(ag) {
    if (!ag || !ag.right || !ag.left) return null;
    const ptaR = pta(ag.right), ptaL = pta(ag.left);
    const better = (ptaR !== null && ptaL !== null) ? Math.min(ptaR, ptaL) : (ptaR ?? ptaL);
    const mean = avg([ptaR, ptaL]);
    const asym = (ptaR !== null && ptaL !== null) ? Math.abs(ptaR - ptaL) : 0;
    // perte par zone : moyenne des deux oreilles
    const zones = {};
    Object.keys(ZONES).forEach(z => { zones[z] = avg([zoneLoss(ag.right, z), zoneLoss(ag.left, z)]) ?? 0; });
    // sévérité globale = moyenne des 2 oreilles (pondération simple)
    const sev = severity(mean);
    const shp = shape({ ...Object.fromEntries(AUDIO_FREQS.map(f => [f, avg([val(ag.right, f), val(ag.left, f)])])) });

    // priorité de chaque catégorie phonétique selon l'audiogramme (0..1)
    const catPriority = {};
    Object.entries(CATEGORIES).forEach(([k, c]) => {
      let s = 0; Object.entries(c.zones).forEach(([z, w]) => { s += w * Math.max(0, zones[z] - 15); });
      catPriority[k] = s;
    });
    const maxP = Math.max(...Object.values(catPriority), 1);
    Object.keys(catPriority).forEach(k => catPriority[k] = +(catPriority[k] / maxP).toFixed(2));

    // paramètres de départ de l'entraînement
    let startLevel = 2, startSnr = 10, rate = 0.9;
    if (["leger", "normal"].includes(sev.key)) { startLevel = 3; startSnr = 8; rate = 0.95; }
    if (sev.key === "moyen2") { startLevel = 2; startSnr = 12; rate = 0.85; }
    if (["severe", "profond"].includes(sev.key)) { startLevel = 1; startSnr = 15; rate = 0.8; }

    const insights = [];
    if (shp.key === "descending" || shp.key === "notch") insights.push("Priorité aux consonnes aiguës (s, ch, f, t, k) qui portent l'essentiel de l'intelligibilité.");
    if (shp.key === "rising") insights.push("Priorité aux voyelles et aux contrastes graves (m/b, an/on).");
    if (zones.aigu > 50) insights.push("Les exercices dans le bruit seront introduits progressivement.");
    if (["severe", "profond"].includes(sev.key)) insights.push("Démarrage au calme, avec un débit de parole ralenti et 2 choix de réponse.");
    if (asym >= 15) insights.push("Asymétrie entre les deux oreilles (" + Math.round(asym) + " dB) : à surveiller avec votre audioprothésiste.");
    if (!insights.length) insights.push("Programme équilibré entre discrimination des sons et compréhension dans le bruit.");

    return { ptaR, ptaL, better, mean, asym, zones, severity: sev, shape: shp, catPriority, startLevel, startSnr, rate, insights };
  }

  /* ---------- Rendu SVG ---------- */
  function render(ag, opts = {}) {
    const W = opts.width || 340, H = opts.height || 300;
    const m = { l: 38, r: 12, t: 26, b: 14 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const freqs = AUDIO_FREQS;
    const logMin = Math.log2(250), logMax = Math.log2(8000);
    const x = f => m.l + (Math.log2(f) - logMin) / (logMax - logMin) * iw;
    const yMin = -10, yMax = 120;
    const y = db => m.t + (db - yMin) / (yMax - yMin) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="audiogram-svg" role="img" aria-label="Audiogramme">`;

    // zones de sévérité
    const bands = [[-10, 20, "#f0fdf4"], [20, 40, "#fefce8"], [40, 70, "#fff7ed"], [70, 90, "#fef2f2"], [90, 120, "#fde8e8"]];
    bands.forEach(([a, b, c]) => { s += `<rect x="${m.l}" y="${y(a)}" width="${iw}" height="${y(b) - y(a)}" fill="${c}"/>`; });

    // banane de la parole (illustrative)
    if (opts.banana !== false) {
      const top = [[250, 22], [500, 20], [1000, 18], [2000, 18], [3000, 20], [4000, 22], [6000, 24]];
      const bot = [[6000, 38], [4000, 44], [3000, 50], [2000, 54], [1000, 58], [500, 56], [250, 50]];
      const pts = [...top, ...bot].map(([f, d]) => `${x(f).toFixed(1)},${y(d).toFixed(1)}`).join(" ");
      s += `<polygon points="${pts}" fill="#fde68a" fill-opacity="0.55" stroke="#f59e0b" stroke-opacity="0.5"/>`;
      const ph = [[300, 34, "ou"], [400, 46, "m n"], [600, 40, "o"], [900, 48, "a"], [1500, 36, "é"], [2200, 30, "ch"], [3200, 38, "t k"], [5000, 30, "s f"], [3500, 26, "i"]];
      ph.forEach(([f, d, t]) => { s += `<text x="${x(f)}" y="${y(d)}" class="ag-ph">${t}</text>`; });
    }

    // grille
    for (let db = -10; db <= 120; db += 10) {
      s += `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(db)}" y2="${y(db)}" class="ag-grid${db === 0 ? " ag-zero" : ""}"/>`;
      if (db % 20 === 0) s += `<text x="${m.l - 6}" y="${y(db) + 3}" class="ag-ylab">${db}</text>`;
    }
    freqs.forEach(f => {
      s += `<line x1="${x(f)}" x2="${x(f)}" y1="${m.t}" y2="${m.t + ih}" class="ag-grid"/>`;
      s += `<text x="${x(f)}" y="${m.t - 8}" class="ag-xlab">${f >= 1000 ? (f / 1000) + "k" : f}</text>`;
    });
    s += `<text x="8" y="${m.t + ih / 2}" class="ag-axis" transform="rotate(-90 8 ${m.t + ih / 2})">dB HL</text>`;

    // courbes
    const ear = (data, color, mark) => {
      if (!data) return;
      const pts = freqs.map(f => [f, val(data, f)]).filter(p => p[1] !== null);
      if (pts.length > 1) s += `<polyline points="${pts.map(([f, d]) => `${x(f)},${y(d)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>`;
      pts.forEach(([f, d]) => {
        if (mark === "o") s += `<circle cx="${x(f)}" cy="${y(d)}" r="5" fill="#fff" stroke="${color}" stroke-width="2"/>`;
        else s += `<g stroke="${color}" stroke-width="2.4"><line x1="${x(f) - 4.5}" y1="${y(d) - 4.5}" x2="${x(f) + 4.5}" y2="${y(d) + 4.5}"/><line x1="${x(f) - 4.5}" y1="${y(d) + 4.5}" x2="${x(f) + 4.5}" y2="${y(d) - 4.5}"/></g>`;
      });
    };
    if (ag) { ear(ag.right, "#d50032", "o"); ear(ag.left, "#1d4ed8", "x"); }
    s += `</svg>`;
    return s;
  }

  return { analyze, render, pta, severity };
})();

/* =========================================================================
   Espace audioprothésiste (démo) : suivi des patients du centre
   ========================================================================= */
const Pro = (() => {
  // Patients fictifs (démo) – séries générées de façon déterministe
  function seeded(seed) { let x = seed; return () => (x = (x * 9301 + 49297) % 233280) / 233280; }
  const DEMO = [
    { id: "d1", name: "Jean-Pierre M.", age: 74, fitDays: 12, preset: "skiSlope", adherence: 0.9, srtStart: 6, srtGain: 2.5, sat: [2, 3], alert: null },
    { id: "d2", name: "Françoise L.", age: 68, fitDays: 45, preset: "presbyLight", adherence: 0.75, srtStart: 3, srtGain: 4, sat: [3, 4, 4, 5], alert: null },
    { id: "d3", name: "Gérard B.", age: 81, fitDays: 20, preset: "flat", adherence: 0.15, srtStart: 8, srtGain: 0.5, sat: [2, 2, 1], alert: "inactive" },
    { id: "d4", name: "Nadia K.", age: 59, fitDays: 70, preset: "noiseNotch", adherence: 0.6, srtStart: 2, srtGain: 3, sat: [3, 3, 2, 2], alert: "satisfaction" },
    { id: "d5", name: "André T.", age: 77, fitDays: 8, preset: "presbyMod", adherence: 0.85, srtStart: 7, srtGain: 1, sat: [2], alert: null }
  ];

  function demoSummary(d) {
    const r = seeded(d.id.charCodeAt(1) * 97);
    const n = Math.min(12, Math.max(3, Math.floor(d.fitDays / 3)));
    const srt = Array.from({ length: n }, (_, i) => +(d.srtStart - d.srtGain * (i / (n - 1)) + (r() - 0.5) * 1.2).toFixed(1));
    const sessions = [];
    for (let i = 0; i < Math.min(28, d.fitDays); i++) if (r() < d.adherence * (d.alert === "inactive" && i < 9 ? 0 : 1)) sessions.push({ date: addDays(new Date(), -i).toISOString() });
    const lastActive = sessions.length ? sessions[0].date : null;
    const p = AUDIOGRAM_PRESETS[d.preset];
    const cat = {}; Object.keys(CATEGORIES).forEach(k => cat[k] = 0.55 + r() * 0.4);
    return {
      id: d.id, name: d.name, age: d.age, fittingDate: dayKey(addDays(new Date(), -d.fitDays)),
      audiogram: { right: p.right, left: p.left }, sessions, srt, catAcc: cat,
      week: new Set(sessions.filter(s => daysBetween(s.date, new Date()) < 7).map(s => dayKey(s.date))).size,
      lastActive, sat: d.sat, note: d.alert === "satisfaction" ? "Toujours gênée au restaurant, son métallique." : "", demo: true
    };
  }

  function realSummary() {
    const s = Store.s;
    if (!s.onboarded) return null;
    const st = Training.stats();
    const sat = s.journal.map(j => +(Object.values(j.ratings).reduce((a, b) => a + b, 0) / Object.values(j.ratings).length).toFixed(1));
    return {
      id: "me", name: `${s.profile.firstName || "Patient"} ${s.profile.lastName ? s.profile.lastName[0] + "." : ""}`, age: null,
      fittingDate: s.profile.fittingDate, audiogram: s.consent.audiogram ? s.audiogram : null,
      sessions: s.training.sessions, srt: st.srt.map(x => x.v), catAcc: st.catAcc, week: st.weekDays,
      lastActive: s.training.sessions.length ? s.training.sessions[s.training.sessions.length - 1].date : null,
      sat, note: (s.journal[s.journal.length - 1] || {}).note || "", shared: s.consent.shareWithCenter, journal: s.journal
    };
  }

  function alerts(p) {
    const out = [];
    const idle = p.lastActive ? daysBetween(p.lastActive, new Date()) : 99;
    const fitDays = daysBetween(p.fittingDate, new Date());
    if (idle >= 7) out.push({ k: "warn", t: `Aucun entraînement depuis ${idle >= 99 ? "le début" : idle + " jours"}`, a: "Appeler pour encourager / vérifier le port des appareils" });
    if (p.sat.length >= 2 && p.sat[p.sat.length - 1] < p.sat[p.sat.length - 2]) out.push({ k: "warn", t: "Satisfaction en baisse dans le journal", a: "Proposer un rendez-vous de réglage" });
    if (p.srt.length >= 3 && p.srt[p.srt.length - 1] < p.srt[0] - 1.5) out.push({ k: "ok", t: `Progrès dans le bruit : ${(p.srt[0] - p.srt[p.srt.length - 1]).toFixed(1)} dB gagnés`, a: "Valoriser la progression au prochain RDV" });
    if (fitDays <= 30 && fitDays >= 25) out.push({ k: "info", t: "Fin de période d'essai imminente", a: "Préparer le bilan d'adaptation" });
    const weak = Object.entries(p.catAcc).filter(([, v]) => v !== null && v < 0.65).map(([k]) => CATEGORIES[k].short);
    if (weak.length) out.push({ k: "info", t: "Difficultés persistantes : " + weak.join(", "), a: "Vérifier le gain dans les fréquences correspondantes" });
    return out;
  }

  let selected = null;

  function render(sel) {
    const me = realSummary();
    const list = [...(me ? [me] : []), ...DEMO.map(demoSummary)];
    selected = sel && list.find(p => p.id === sel) ? sel : list[0].id;
    const p = list.find(x => x.id === selected);
    const active = list.filter(x => x.week >= 1).length;
    const avgWeek = (list.reduce((a, x) => a + x.week, 0) / list.length).toFixed(1);
    const allAlerts = list.reduce((a, x) => a + alerts(x).filter(al => al.k === "warn").length, 0);
    const satAll = list.filter(x => x.sat.length).map(x => x.sat[x.sat.length - 1]);
    const satAvg = satAll.length ? (satAll.reduce((a, b) => a + b, 0) / satAll.length).toFixed(1) : "—";
    const al = alerts(p);
    return `
      <div class="pro">
        <header class="pro-head">
          <div class="brand"><span class="brand-k">KRYS</span><span class="brand-a">AUDITION</span><span class="pro-tag">Espace pro</span></div>
          <div class="pro-center">${esc(H.center().name)}</div>
          <a href="#/home" class="btn btn-ghost btn-sm">${icon("left")} Vue patient</a>
        </header>
        <div class="pro-kpis">
          <div class="kpi"><b>${list.length}</b><small>patients suivis dans l'app</small></div>
          <div class="kpi"><b>${Math.round(active / list.length * 100)}%</b><small>actifs cette semaine</small></div>
          <div class="kpi"><b>${avgWeek}</b><small>jours d'entraînement / sem.</small></div>
          <div class="kpi"><b>${satAvg}/5</b><small>satisfaction moyenne</small></div>
          <div class="kpi warn"><b>${allAlerts}</b><small>alertes à traiter</small></div>
        </div>
        <div class="pro-body">
          <aside class="pro-list">
            <h3>Patients</h3>
            ${list.map(x => { const a = alerts(x); const w = a.some(y => y.k === "warn"); return `
              <a href="#/pro/${x.id}" class="pro-pat ${x.id === selected ? "on" : ""}">
                <div class="grow"><b>${esc(x.name)}${x.id === "me" ? ` <span class="pill">cet appareil</span>` : ""}</b>
                <small>J+${daysBetween(x.fittingDate, new Date())} · ${x.week}/7 j cette sem.</small></div>
                ${Charts.spark(x.srt, { invert: true })}
                ${w ? `<span class="dot-warn" title="Alerte"></span>` : ""}
              </a>`; }).join("")}
          </aside>
          <section class="pro-detail">
            <div class="pro-d-head"><div><h2>${esc(p.name)}</h2><p class="muted">${p.age ? p.age + " ans · " : ""}Appareillé(e) le ${fmtDate(p.fittingDate, false)} (J+${daysBetween(p.fittingDate, new Date())})</p></div>
              <div class="btn-row"><a class="btn btn-ghost btn-sm" href="#/messages">${icon("message")} Message</a><button class="btn btn-primary btn-sm" data-action="pro-rdv">${icon("calendar")} Proposer un RDV</button></div></div>
            ${p.id === "me" && !p.shared ? `<div class="note-box warn">${icon("lock")}<div>Ce patient n'a pas consenti au partage de ses données : en production, ce détail ne serait pas visible.</div></div>` : ""}
            ${al.length ? `<div class="pro-alerts">${al.map(x => `<div class="pal ${x.k}">${icon(x.k === "ok" ? "award" : x.k === "warn" ? "alert" : "info")}<div><b>${esc(x.t)}</b><small>→ ${esc(x.a)}</small></div></div>`).join("")}</div>` : ""}
            <div class="pro-grid">
              <div class="card"><h3>Audiogramme</h3>${p.audiogram ? Audiogram.render(p.audiogram, { height: 220, banana: false }) : `<p class="muted">Non partagé.</p>`}</div>
              <div class="card"><h3>Seuil dans le bruit (chiffres)</h3>${Charts.line(p.srt.map((v, i) => ({ v })), { height: 200, empty: "Pas encore de mesure." })}<p class="tiny">RSB (dB) – plus bas = meilleur.</p></div>
              <div class="card"><h3>Assiduité (28 j)</h3>${Charts.heat(p.sessions)}</div>
              <div class="card"><h3>Reconnaissance par famille de sons</h3>${Charts.bars(Object.entries(CATEGORIES).map(([k, c]) => ({ label: c.short, v: p.catAcc[k] ?? null })))}</div>
              <div class="card"><h3>Journal d'adaptation</h3>
                ${p.sat.length ? Charts.line(p.sat.map(v => ({ v })), { height: 140, color: "#0f766e" }) : `<p class="muted">Pas encore de saisie.</p>`}
                ${p.note ? `<blockquote>« ${esc(p.note)} »</blockquote>` : ""}
              </div>
            </div>
          </section>
        </div>
        <p class="tiny center">Démo : patients fictifs + les données réelles de cet appareil. En production : interface sécurisée (hébergement HDS), intégrable au logiciel métier (Noah / logiciel de gestion du centre).</p>
      </div>`;
  }

  return { render };
})();

Views.pro = { noTabs: true, wide: true, render: (id) => Pro.render(id) };

/* =========================================================================
   Stockage local (localStorage) + profil de démonstration
   -------------------------------------------------------------------------
   PROTOTYPE : toutes les données restent sur l'appareil. En production :
   back-end hébergé chez un hébergeur certifié HDS, chiffrement, consentement
   tracé, droit d'accès / suppression (RGPD).
   ========================================================================= */
const Store = (() => {
  const KEY = "krysAudio.v1";

  const defaults = () => ({
    version: 1,
    onboarded: false,
    demo: false,
    profile: { firstName: "", lastName: "", centerId: "c-75011", fittingDate: dayKey(), deviceType: "ric", power: "rechargeable", brand: "" },
    consent: { audiogram: false, notifications: false, shareWithCenter: false, date: null },
    audiogram: null,            // { right:{}, left:{}, voRight:{}, voLeft:{}, date, source }
    speechAudiogram: null,      // { right:[{db, pct}], left:[{db, pct}], date }
    speechInNoise: null,        // { snr50, snrLoss, date }
    anamnesis: null,            // { deprivation, tinnitus, hyperacusis, lifestyle, fatigue, parsedNotes }
    calibration: null,          // { transducer, calibrated, method, outputGain, correctionDb, leftGain, rightGain }
    training: { sessions: [], levels: {}, snr: {}, catStats: {} },
    appointments: [],           // { id, date(ISO), type, note, done }
    journal: [],                // { date, ratings:{situation:1..5}, note }
    maintenance: {},            // { id: lastDoneDayKey }
    messages: [],               // { id, date, from:'patient'|'centre', text }
    favorites: [],
    readTips: [],
    settings: { fontScale: 1, contrast: false, voiceURI: null, rate: null, sounds: true }
  });

  function merge(base, src) {
    for (const k in src) {
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], src[k]);
      else base[k] = src[k];
    }
    return base;
  }

  function load() {
    try { const raw = localStorage.getItem(KEY); return raw ? merge(defaults(), JSON.parse(raw)) : defaults(); }
    catch (e) { return defaults(); }
  }

  let state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn("Sauvegarde impossible", e); } }
  function reset() { state = defaults(); save(); }

  /* ---------- Profil de démonstration (pour présentation) ---------- */
  function loadDemo() {
    const s = defaults();
    const today = new Date();
    const fitting = addDays(today, -26);
    s.onboarded = true; s.demo = true;
    s.profile = { firstName: "Monique", lastName: "Durand", centerId: "c-75011", fittingDate: dayKey(fitting), deviceType: "ric", power: "rechargeable", brand: "Contour RIC rechargeable" };
    s.consent = { audiogram: true, notifications: true, shareWithCenter: true, date: fitting.toISOString() };
    const p = AUDIOGRAM_PRESETS.presbyMod;
    s.audiogram = { right: { ...p.right }, left: { ...p.left }, voRight: { 500: 25, 1000: 35, 2000: 45, 4000: 55 }, voLeft: { 500: 25, 1000: 35, 2000: 50, 4000: 60 }, date: dayKey(addDays(fitting, -14)), source: "Transmis par votre centre Krys Audition" };
    s.speechAudiogram = {
      right: [{ db: 25, pct: 0 }, { db: 35, pct: 25 }, { db: 45, pct: 60 }, { db: 55, pct: 90 }, { db: 65, pct: 100 }, { db: 80, pct: 100 }],
      left:  [{ db: 25, pct: 0 }, { db: 35, pct: 15 }, { db: 45, pct: 50 }, { db: 60, pct: 85 }, { db: 70, pct: 95 }, { db: 80, pct: 90 }],
      date: dayKey(addDays(fitting, -14))
    };
    s.speechInNoise = {
      snr50: 1.2,
      snrLoss: 6.7,
      date: dayKey(addDays(fitting, -10))
    };
    s.anamnesis = {
      deprivation: 4,
      tinnitus: "occasional",
      hyperacusis: false,
      lifestyle: "social_family",
      fatigue: 2,
      parsedNotes: "Presbyacousie bilatérale symétrique évolutive depuis 4 ans. Gêne principale lors des repas de famille et restaurants. Acouphènes intermittents bilatéraux non invalidants. Équipement en contours RIC rechargeables bilatéraux."
    };
    s.calibration = {
      transducer: "bluetooth_aids",
      calibrated: true,
      method: "conversational_voice",
      outputGain: 1.0,
      correctionDb: 0,
      leftGain: 1.0,
      rightGain: 1.0,
      calibratedAt: dayKey(addDays(fitting, -25)),
      noiseFloorDba: 34
    };

    // historique d'entraînement : progression réaliste sur ~3,5 semaines
    const cats = Object.keys(CATEGORIES);
    const catStats = {}; cats.forEach(c => catStats[c] = { n: 0, c: 0 });
    let srt = 4.5, wordsSnr = 12;
    for (let d = 24; d >= 1; d--) {
      if (Math.random() < 0.25 && d !== 1) continue; // quelques jours sans entraînement
      const day = addDays(today, -d); day.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
      const progress = (24 - d) / 24;
      // paires
      const pairCats = {}; let pc = 0;
      for (let i = 0; i < 12; i++) {
        const c = Math.random() < 0.55 ? "fricatives" : pick(cats);
        const base = c === "fricatives" ? 0.55 : c === "lieu" ? 0.68 : 0.85;
        const ok = Math.random() < Math.min(0.97, base + progress * 0.25);
        pairCats[c] = pairCats[c] || { n: 0, c: 0 }; pairCats[c].n++; if (ok) { pairCats[c].c++; pc++; }
        catStats[c].n++; if (ok) catStats[c].c++;
      }
      s.training.sessions.push({ id: uid(), date: day.toISOString(), ex: "pairs", correct: pc, total: 12, score: pc / 12, level: progress < 0.4 ? 2 : progress < 0.75 ? 3 : 4, cats: pairCats, duration: 230 + Math.floor(Math.random() * 80) });
      // chiffres ou mots
      if (d % 2 === 0) {
        srt = Math.max(-4, srt - 0.35 - Math.random() * 0.35 + (Math.random() < 0.2 ? 0.8 : 0));
        const t = new Date(day.getTime() + 300000);
        s.training.sessions.push({ id: uid(), date: t.toISOString(), ex: "digits", correct: 6 + Math.floor(Math.random() * 3), total: 12, score: 0.55, srt: +srt.toFixed(1), snr: +srt.toFixed(1), duration: 170 });
      } else {
        wordsSnr = Math.max(0, wordsSnr - 0.6 - Math.random() * 0.4);
        const t = new Date(day.getTime() + 300000); const c = 7 + Math.floor(Math.random() * 3);
        s.training.sessions.push({ id: uid(), date: t.toISOString(), ex: "words", correct: c, total: 10, score: c / 10, snr: +wordsSnr.toFixed(1), duration: 200 });
      }
      if (Math.random() < 0.6) {
        const t = new Date(day.getTime() + 600000); const ex = d % 3 === 0 ? "memory" : "sentences"; const tot = 6, c = 4 + Math.floor(Math.random() * 3);
        s.training.sessions.push({ id: uid(), date: t.toISOString(), ex, correct: c, total: tot, score: c / tot, level: 3, duration: 210 });
      }
    }
    s.training.catStats = catStats;
    s.training.levels = { pairs: 4, sentences: 3, memory: 3 };
    s.training.snr = { words: +wordsSnr.toFixed(1), digits: +srt.toFixed(1) };

    // journal d'adaptation hebdomadaire
    const j = [[2, 1, 2, 2, 2], [3, 2, 3, 2, 3], [3, 2, 4, 3, 4], [4, 3, 4, 3, 4]];
    j.forEach((r, i) => {
      s.journal.push({ date: addDays(today, -21 + i * 7).toISOString(), ratings: { calme: r[0], bruit: r[1], tv: r[2], tel: r[3], confort: r[4] }, note: i === 0 ? "Ma voix résonne, les bruits de vaisselle sont forts." : i === 3 ? "Beaucoup mieux au calme. Le restaurant reste difficile." : "" });
    });

    // rendez-vous
    const at = (n, h, m = 0) => { const x = addDays(today, n); x.setHours(h, m, 0, 0); return x.toISOString(); };
    s.appointments = [
      { id: uid(), date: at(-19, 10, 30), type: "controle", note: "Contrôle J+7", done: true },
      { id: uid(), date: at(-5, 14, 0), type: "reglage", note: "Réglage J+21 : bruit de vaisselle atténué", done: true },
      { id: uid(), date: at(4, 11, 0), type: "controle", note: "Fin de période d'essai", done: false },
      { id: uid(), date: at(64, 15, 30), type: "reglage", note: "Contrôle 3 mois", done: false }
    ];
    s.maintenance = { filtre: dayKey(addDays(today, -27)), dome: dayKey(fitting), deshu: dayKey(addDays(today, -10)) };
    s.messages = [
      { id: uid(), date: at(-5, 15, 10), from: "centre", text: "Bonjour Mme Durand, suite à votre réglage, n'hésitez pas à nous dire comment se passent les repas en famille ce week-end. — Benjamin" },
      { id: uid(), date: at(-3, 9, 40), from: "patient", text: "Bonjour, c'est bien mieux pour la vaisselle ! Le restaurant reste un peu difficile." },
      { id: uid(), date: at(-3, 11, 5), from: "centre", text: "Merci pour votre retour ! Nous verrons le programme « restaurant » lors du prochain rendez-vous. Continuez les exercices « Mots dans le bruit »." }
    ];
    s.readTips = ["adapt-1", "use-1"];
    state = s; save();
  }

  return {
    get s() { return state; },
    save, reset, loadDemo,
    update(fn) { fn(state); save(); }
  };
})();

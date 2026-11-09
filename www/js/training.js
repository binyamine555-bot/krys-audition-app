/* =========================================================================
   Entraînement auditif : exercices, personnalisation, programme du jour
   ========================================================================= */
const Training = (() => {

  const EX = {
    pairs: { id: "pairs", name: "Paires de mots", icon: "target", skill: "Discrimination des sons", minutes: 4,
      desc: "Écoutez un mot et choisissez celui que vous avez entendu parmi deux mots très proches (ex. « chou » / « sou »)." },
    words: { id: "words", name: "Mots dans le bruit", icon: "volume", skill: "Écoute dans le bruit", minutes: 4,
      desc: "Retrouvez le mot entendu parmi 4 rimes. Le bruit de fond s'adapte automatiquement à vos réussites." },
    digits: { id: "digits", name: "Chiffres dans le bruit", icon: "activity", skill: "Seuil d'écoute dans le bruit", minutes: 3,
      desc: "Écoutez 3 chiffres dans un bruit de fond et tapez-les. Cet exercice mesure votre progression dans le bruit." },
    sentences: { id: "sentences", name: "Compréhension de phrases", icon: "message", skill: "Compréhension", minutes: 4,
      desc: "Écoutez une phrase de la vie quotidienne, puis répondez à une question sur son contenu." },
    memory: { id: "memory", name: "Mémoire auditive", icon: "award", skill: "Attention & mémoire", minutes: 3,
      desc: "Écoutez une suite de mots puis retrouvez-les dans le bon ordre." }
  };

  const LEVELS = {
    1: { snr: null, slow: true, label: "Au calme, débit ralenti" },
    2: { snr: null, label: "Au calme" },
    3: { snr: 12, label: "Bruit de fond léger" },
    4: { snr: 8, label: "Bruit de fond modéré" },
    5: { snr: 4, label: "Bruit de fond marqué" },
    6: { snr: 0, label: "Bruit de fond fort" }
  };

  const N_TRIALS = { pairs: 12, words: 10, digits: 12, sentences: 6, memory: 6 };

  /* ---------- Personnalisation ---------- */
  function analysis() {
    const s = Store.s;
    return (s.consent.audiogram && s.audiogram) ? Audiogram.analyze(s.audiogram) : null;
  }
  function baseRate() {
    const s = Store.s; if (s.settings.rate) return s.settings.rate;
    const a = analysis(); return a ? a.rate : 0.9;
  }
  function getLevel(ex) {
    const t = Store.s.training; if (t.levels[ex]) return t.levels[ex];
    if (ex === "memory") return 2;
    const a = analysis(); return a ? a.startLevel : 2;
  }
  function getSnr(ex) {
    const t = Store.s.training; if (t.snr[ex] !== undefined) return t.snr[ex];
    const a = analysis(); const base = a ? a.startSnr : 10;
    return ex === "digits" ? base - 4 : base;
  }

  /* Poids des catégories : profil audiométrique + erreurs réelles du patient */
  function catWeights() {
    const a = analysis(), st = Store.s.training.catStats, w = {};
    Object.keys(CATEGORIES).forEach(c => {
      const aud = a ? a.catPriority[c] : 0.5;
      const s = st[c]; const err = s && s.n >= 8 ? 1 - s.c / s.n : 0.25;
      w[c] = +(0.15 + 0.5 * aud + 0.9 * err).toFixed(3);
    });
    return w;
  }
  function focusCats(n = 2) {
    return Object.entries(catWeights()).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
  }

  /* ---------- Programme du jour ---------- */
  function sessionsOn(date = new Date()) {
    const k = dayKey(date);
    return Store.s.training.sessions.filter(s => dayKey(s.date) === k);
  }
  function program(date = new Date()) {
    const idx = Math.floor(new Date(dayKey(date) + "T12:00:00").getTime() / 86400000);
    const items = [
      { ex: "pairs", why: "Focus : " + focusCats(2).map(c => CATEGORIES[c].short).join(" · ") },
      idx % 2 ? { ex: "digits", why: "Mesure de votre seuil dans le bruit" } : { ex: "words", why: "Le bruit s'adapte à votre niveau" },
      idx % 2 ? { ex: "memory", why: "Attention et mémoire de travail" } : { ex: "sentences", why: "Situations de la vie quotidienne" }
    ];
    const done = sessionsOn(date);
    items.forEach(it => { it.done = done.some(s => s.ex === it.ex); });
    return items;
  }
  function nextInProgram() { return program().find(i => !i.done) || null; }

  /* ---------- Statistiques ---------- */
  function streak() {
    const days = new Set(Store.s.training.sessions.map(s => dayKey(s.date)));
    let n = 0, d = new Date();
    if (!days.has(dayKey(d))) d = addDays(d, -1);
    while (days.has(dayKey(d))) { n++; d = addDays(d, -1); }
    return n;
  }
  function stats(sessions = Store.s.training.sessions, catStats = Store.s.training.catStats) {
    const now = new Date();
    const last7 = sessions.filter(s => daysBetween(s.date, now) < 7);
    const days28 = new Set(sessions.filter(s => daysBetween(s.date, now) < 28).map(s => dayKey(s.date)));
    const minutes = Math.round(sessions.reduce((a, s) => a + (s.duration || 0), 0) / 60);
    const srt = sessions.filter(s => s.ex === "digits" && s.srt !== undefined).map(s => ({ date: s.date, v: s.srt }));
    const words = sessions.filter(s => s.ex === "words" && s.snr !== undefined).map(s => ({ date: s.date, v: s.snr }));
    const catAcc = {};
    Object.keys(CATEGORIES).forEach(c => { const x = catStats[c]; catAcc[c] = x && x.n ? x.c / x.n : null; });
    const avgScore = sessions.length ? sessions.slice(-15).reduce((a, s) => a + s.score, 0) / Math.min(15, sessions.length) : null;
    return { total: sessions.length, week: last7.length, weekDays: new Set(last7.map(s => dayKey(s.date))).size, days28: days28.size, minutes, srt, words, catAcc, avgScore };
  }

  /* ---------- Génération des essais ---------- */
  function genTrials(ex, level) {
    const n = N_TRIALS[ex];
    if (ex === "pairs") {
      const w = catWeights(), used = new Set(), out = [];
      for (let i = 0; i < n; i++) {
        const cat = weightedPick(w); let pair, t = 0;
        do { pair = pick(MINIMAL_PAIRS[cat]); } while (used.has(pair.join()) && t++ < 12);
        used.add(pair.join());
        const target = pick(pair);
        out.push({ type: "choice", say: target, choices: shuffle(pair), answer: target, cat, pair });
      }
      return out;
    }
    if (ex === "words") {
      return shuffle(RHYME_SETS).slice(0, n).map(set => { const t = pick(set); return { type: "choice", say: t, choices: shuffle(set), answer: t }; });
    }
    if (ex === "digits") {
      const keys = Object.keys(DIGITS);
      return Array.from({ length: n }, () => {
        const d = shuffle(keys).slice(0, 3);
        return { type: "digits", say: d.map(k => DIGITS[k]).join(", "), answer: d.join("") };
      });
    }
    if (ex === "sentences") {
      return shuffle(SENTENCES).slice(0, n).map(x => ({ type: "choice", say: x.s, question: x.q, choices: shuffle(x.o), answer: x.a }));
    }
    if (ex === "memory") {
      const len = clamp(level + 1, 2, 7);
      return Array.from({ length: n }, () => {
        const pool = shuffle(MEMORY_WORDS);
        const seq = pool.slice(0, len);
        const grid = shuffle(pool.slice(0, Math.max(6, len + 3)));
        return { type: "sequence", say: seq.join(", "), answer: seq, grid };
      });
    }
    return [];
  }

  /* ---------- Lecteur d'exercice ---------- */
  function run(exId, root, { onExit } = {}) {
    const def = EX[exId];
    const S = Store.s;
    const level = getLevel(exId);
    const st = {
      trials: genTrials(exId, level), i: 0, correct: 0, level,
      snr: getSnr(exId), okRun: 0, snrTrack: [], cats: {}, replays: 0,
      start: Date.now(), playing: false, answered: false, input: "", seq: []
    };
    const rate = baseRate() - (LEVELS[level] && LEVELS[level].slow && ["pairs", "sentences"].includes(exId) ? 0.12 : 0);
    const voiceURI = S.settings.voiceURI;

    function trialSnr() {
      if (exId === "words" || exId === "digits") return st.snr;
      if (exId === "memory") return level >= 5 ? 10 : null;
      return LEVELS[level].snr;
    }
    function noiseType() { return exId === "digits" ? "pink" : "babble"; }

    function condLabel() {
      if (exId === "words" || exId === "digits") return `Bruit adaptatif · départ ${fmtSnr(st.snr)}`;
      if (exId === "memory") return `${clamp(level + 1, 2, 7)} mots à retenir${level >= 5 ? " · bruit léger" : ""}`;
      return `Niveau ${level}/6 · ${LEVELS[level].label}`;
    }

    /* --- écran d'introduction --- */
    function intro() {
      const a = analysis();
      root.innerHTML = `
        <div class="ex-shell">
          <div class="ex-top"><button class="icon-btn" data-act="exit" aria-label="Quitter">${icon("x")}</button><span class="ex-title">${def.name}</span><span></span></div>
          <div class="ex-intro">
            <div class="ex-badge">${icon(def.icon)}</div>
            <h2>${def.name}</h2>
            <p class="lead">${def.desc}</p>
            <div class="chips"><span class="chip">${icon("clock")} ~${def.minutes} min</span><span class="chip">${icon("sliders")} ${condLabel()}</span></div>
            ${exId === "pairs" ? `<div class="note-box">${icon("target")}<div><b>Personnalisé pour vous</b><br>${a ? "D'après votre audiogramme et vos résultats : " : "D'après vos résultats : "}${focusCats(2).map(c => CATEGORIES[c].label.toLowerCase()).join(" et ")}.</div></div>` : ""}
            <div class="note-box soft">${icon("ear")}<div>Portez vos aides auditives et réglez le volume du téléphone à un niveau <b>confortable</b>, comme pour une conversation.</div></div>
            <button class="btn btn-primary btn-lg btn-block" data-act="start">${icon("play")} Commencer</button>
          </div>
        </div>`;
    }

    /* --- écran d'essai --- */
    function trialView() {
      const t = st.trials[st.i];
      const pct = Math.round((st.i / st.trials.length) * 100);
      let answerZone = "";
      if (t.type === "choice") {
        answerZone = `${t.question ? `<p class="ex-question" id="q" hidden>${esc(t.question)}</p>` : ""}
          <div class="choices ${t.choices.length > 2 ? "grid2" : "duo"} ${t.question ? "sentences" : ""}" id="choices">
            ${t.choices.map(c => `<button class="choice" data-act="choose" data-v="${esc(c)}" disabled>${esc(c)}</button>`).join("")}
          </div>`;
      } else if (t.type === "digits") {
        answerZone = `<div class="digit-display" id="dd">${[0, 1, 2].map(k => `<span>${st.input[k] || ""}</span>`).join("")}</div>
          <div class="keypad" id="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button class="key" data-act="key" data-v="${k}" disabled>${k}</button>`).join("")}
          <button class="key key-wide" data-act="del" disabled>Effacer</button></div>`;
      } else if (t.type === "sequence") {
        answerZone = `<p class="hint">Touchez les mots dans l'ordre entendu (${t.answer.length} mots)</p>
          <div class="seq-grid" id="seqgrid">${t.grid.map(w => `<button class="seq" data-act="seq" data-v="${esc(w)}" disabled>${esc(w)}</button>`).join("")}</div>
          <button class="btn btn-ghost btn-sm" data-act="seqreset">Recommencer la sélection</button>`;
      }
      root.innerHTML = `
        <div class="ex-shell">
          <div class="ex-top"><button class="icon-btn" data-act="exit" aria-label="Quitter">${icon("x")}</button>
            <div class="progress"><div style="width:${pct}%"></div></div>
            <span class="ex-count">${st.i + 1}/${st.trials.length}</span></div>
          <div class="ex-cond">${trialSnr() !== null ? icon("volume") + " Bruit de fond · RSB " + fmtSnr(trialSnr()) : icon("ear") + " Au calme"}</div>
          <div class="ex-stage">
            <button class="play-btn" data-act="play" id="playbtn" aria-label="Écouter">${icon("play")}</button>
            <div class="play-label" id="plabel">Écoute en cours…</div>
            <button class="btn btn-ghost btn-sm" data-act="replay" id="replay">${icon("replay")} Réécouter</button>
          </div>
          <div class="ex-answer">${answerZone}</div>
          <div class="ex-feedback" id="fb"></div>
        </div>`;
      st.answered = false; st.input = ""; st.seq = [];
      setTimeout(play, 350);
    }

    function enableAnswers(on) {
      root.querySelectorAll(".choice, .key, .seq").forEach(b => { if (!b.classList.contains("locked")) b.disabled = !on; });
    }

    async function play() {
      if (st.playing) return;
      const t = st.trials[st.i];
      st.playing = true;
      const pb = root.querySelector("#playbtn"), pl = root.querySelector("#plabel");
      if (pb) pb.classList.add("pulsing"); if (pl) pl.textContent = "Écoute en cours…";
      const snr = trialSnr();
      if (exId === "digits" || exId === "words") st.snrTrack.push(snr);
      await AudioEngine.playStimulus(t.say, { snr, noise: noiseType(), rate: exId === "memory" ? Math.min(rate, 0.85) : rate, voiceURI });
      st.playing = false;
      if (!root.isConnected) return;
      if (pb) pb.classList.remove("pulsing");
      if (pl) pl.textContent = st.answered ? "" : (t.type === "choice" ? (t.question ? "Répondez à la question" : "Quel mot avez-vous entendu ?") : t.type === "digits" ? "Tapez les 3 chiffres" : "À vous !");
      const q = root.querySelector("#q"); if (q) q.hidden = false;
      if (!st.answered) enableAnswers(true);
    }

    function replay() {
      if (st.playing || st.answered) return;
      st.replays++;
      if (exId === "digits" || exId === "words") st.snrTrack.pop(); // la réécoute ne compte pas comme un nouvel essai
      play();
    }

    function feedback(ok, t, given) {
      st.answered = true;
      enableAnswers(false);
      if (S.settings.sounds) AudioEngine.beep(ok ? "ok" : "ko");
      if (ok) st.correct++;
      if (t.cat) { st.cats[t.cat] = st.cats[t.cat] || { n: 0, c: 0 }; st.cats[t.cat].n++; if (ok) st.cats[t.cat].c++; }
      // règles adaptatives
      if (exId === "words") {
        if (ok) { st.okRun++; if (st.okRun >= 2) { st.snr = clamp(st.snr - 3, -8, 20); st.okRun = 0; } }
        else { st.snr = clamp(st.snr + 3, -8, 20); st.okRun = 0; }
      }
      if (exId === "digits") st.snr = clamp(st.snr + (ok ? -2 : 2), -14, 20);

      const fb = root.querySelector("#fb");
      const correctTxt = Array.isArray(t.answer) ? t.answer.join(" → ") : (t.type === "digits" ? t.answer.split("").join(" ") : t.answer);
      fb.innerHTML = ok
        ? `<div class="fb ok">${icon("check")} Bravo !</div>`
        : `<div class="fb ko">${icon("x")} La bonne réponse était <b>${esc(correctTxt)}</b></div>
           ${t.pair ? `<button class="btn btn-ghost btn-sm" data-act="compare">${icon("headphones")} Comparer « ${esc(t.pair[0])} » et « ${esc(t.pair[1])} »</button>` : ""}
           ${t.type === "sequence" || t.type === "digits" || t.question ? `<button class="btn btn-ghost btn-sm" data-act="hearagain">${icon("replay")} Réécouter au calme</button>` : ""}
           <button class="btn btn-primary btn-block" data-act="next">Continuer ${icon("right")}</button>`;
      if (ok) setTimeout(() => { if (root.isConnected && st.answered && st.trials[st.i] === t) next(); }, 1100);
    }

    function next() {
      AudioEngine.stopAll();
      st.i++;
      if (st.i >= st.trials.length) finish(); else trialView();
    }

    function choose(v, btn) {
      if (st.answered || st.playing) return;
      const t = st.trials[st.i];
      const ok = v === t.answer;
      root.querySelectorAll(".choice").forEach(b => {
        if (b.dataset.v === t.answer) b.classList.add("correct");
        else if (b === btn) b.classList.add("wrong");
      });
      feedback(ok, t, v);
    }

    function key(k) {
      if (st.answered || st.playing) return;
      if (st.input.length >= 3) return;
      st.input += k;
      root.querySelectorAll("#dd span").forEach((s, i) => s.textContent = st.input[i] || "");
      if (st.input.length === 3) {
        const t = st.trials[st.i]; const ok = st.input === t.answer;
        root.querySelector("#dd").classList.add(ok ? "ok" : "ko");
        feedback(ok, t, st.input);
      }
    }
    function del() { if (st.answered) return; st.input = st.input.slice(0, -1); root.querySelectorAll("#dd span").forEach((s, i) => s.textContent = st.input[i] || ""); }

    function seq(w, btn) {
      if (st.answered || st.playing || st.seq.includes(w)) return;
      const t = st.trials[st.i];
      st.seq.push(w);
      btn.classList.add("picked"); btn.dataset.n = st.seq.length;
      if (st.seq.length === t.answer.length) {
        const ok = st.seq.every((x, i) => x === t.answer[i]);
        root.querySelectorAll(".seq").forEach(b => { const idx = t.answer.indexOf(b.dataset.v); if (idx >= 0) { b.classList.add("target"); b.dataset.n = idx + 1; } else if (b.classList.contains("picked")) b.classList.add("wrong"); });
        feedback(ok, t, st.seq);
      }
    }
    function seqReset() { if (st.answered) return; st.seq = []; root.querySelectorAll(".seq").forEach(b => { b.classList.remove("picked"); delete b.dataset.n; }); }

    /* --- fin d'exercice --- */
    function finish() {
      AudioEngine.stopAll();
      const total = st.trials.length, score = st.correct / total;
      let newLevel = level, levelMsg = "";
      if (["pairs", "sentences", "memory"].includes(exId)) {
        if (score >= 0.85 && level < 6) { newLevel = level + 1; levelMsg = `Niveau suivant débloqué : ${exId === "memory" ? (newLevel + 1) + " mots" : LEVELS[newLevel].label.toLowerCase()} !`; }
        else if (score < 0.55 && level > 1) { newLevel = level - 1; levelMsg = "Le niveau est ajusté pour que vous progressiez à votre rythme."; }
      }
      let srt;
      if (exId === "digits") {
        const tr = st.snrTrack.slice(4).concat([st.snr]);
        srt = +(tr.reduce((a, b) => a + b, 0) / tr.length).toFixed(1);
      }
      const prevSrt = Store.s.training.sessions.filter(s => s.ex === "digits").slice(-1)[0];
      const sess = { id: uid(), date: new Date().toISOString(), ex: exId, correct: st.correct, total, score, level, cats: st.cats, duration: Math.round((Date.now() - st.start) / 1000), replays: st.replays };
      if (exId === "words" || exId === "digits") sess.snr = st.snr;
      if (srt !== undefined) sess.srt = srt;
      Store.update(s => {
        s.training.sessions.push(sess);
        Object.entries(st.cats).forEach(([c, v]) => { const x = s.training.catStats[c] || { n: 0, c: 0 }; x.n += v.n; x.c += v.c; s.training.catStats[c] = x; });
        s.training.levels[exId] = newLevel;
        if (exId === "words" || exId === "digits") s.training.snr[exId] = st.snr;
      });

      const stars = score >= 0.85 ? 3 : score >= 0.6 ? 2 : 1;
      const msg = score >= 0.85 ? "Excellent travail !" : score >= 0.6 ? "Très bien, continuez comme ça !" : "Chaque séance compte : votre cerveau apprend !";
      const nxt = nextInProgram();
      let measure = "";
      if (exId === "digits") {
        const delta = prevSrt && prevSrt.srt !== undefined ? srt - prevSrt.srt : null;
        measure = `<div class="measure"><div class="measure-v">${fmtSnr(srt)}</div><div>Seuil d'écoute dans le bruit<br><small>Plus la valeur est basse, mieux vous comprenez dans le bruit.${delta !== null ? ` ${delta <= 0 ? "▼ " + Math.abs(delta).toFixed(1) + " dB par rapport à la dernière fois 👏" : "▲ " + delta.toFixed(1) + " dB (normal d'un jour à l'autre)"}` : ""}</small></div></div>`;
      } else if (exId === "words") {
        measure = `<div class="measure"><div class="measure-v">${fmtSnr(st.snr)}</div><div>Niveau de bruit atteint<br><small>Prochaine séance : départ à ce niveau.</small></div></div>`;
      }
      root.innerHTML = `
        <div class="ex-shell">
          <div class="ex-top"><span></span><span class="ex-title">${def.name}</span><button class="icon-btn" data-act="exit" aria-label="Fermer">${icon("x")}</button></div>
          <div class="ex-end">
            <div class="stars">${[1, 2, 3].map(k => `<span class="${k <= stars ? "on" : ""}">${icon("star")}</span>`).join("")}</div>
            <h2>${msg}</h2>
            <div class="score-ring" style="--p:${Math.round(score * 100)}"><span>${st.correct}/${total}</span></div>
            ${measure}
            ${levelMsg ? `<div class="note-box">${icon("award")}<div>${levelMsg}</div></div>` : ""}
            ${nxt ? `<button class="btn btn-primary btn-lg btn-block" data-act="goto" data-ex="${nxt.ex}">Exercice suivant : ${EX[nxt.ex].name} ${icon("right")}</button>`
                  : `<div class="note-box success">${icon("check")}<div><b>Programme du jour terminé !</b> Rendez-vous demain pour la suite.</div></div>`}
            <button class="btn btn-ghost btn-block" data-act="exit">Retour</button>
          </div>
        </div>`;
    }

    /* --- événements --- */
    root.onclick = e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const t = st.trials[st.i];
      switch (b.dataset.act) {
        case "exit": AudioEngine.stopAll(); root.onclick = null; onExit && onExit(); break;
        case "start": AudioEngine.ensureCtx(); trialView(); break;
        case "play": if (!st.answered) replay(); break;
        case "replay": replay(); break;
        case "choose": choose(b.dataset.v, b); break;
        case "key": key(b.dataset.v); break;
        case "del": del(); break;
        case "seq": seq(b.dataset.v, b); break;
        case "seqreset": seqReset(); break;
        case "next": next(); break;
        case "compare": (async () => { await AudioEngine.speak(t.pair[0], { rate: 0.8, voiceURI }); await new Promise(r => setTimeout(r, 400)); await AudioEngine.speak(t.pair[1], { rate: 0.8, voiceURI }); })(); break;
        case "hearagain": AudioEngine.speak(t.say, { rate: 0.8, voiceURI }); break;
        case "goto": AudioEngine.stopAll(); root.onclick = null; location.hash = "#/exercise/" + b.dataset.ex; break;
      }
    };
    intro();
    return { stop: () => { AudioEngine.stopAll(); root.onclick = null; } };
  }

  function fmtSnr(v) { if (v === null || v === undefined) return "—"; return (v > 0 ? "+" : "") + Number(v).toFixed(v % 1 ? 1 : 0) + " dB"; }

  return { EX, LEVELS, analysis, getLevel, getSnr, catWeights, focusCats, program, nextInProgram, sessionsOn, streak, stats, run, fmtSnr };
})();

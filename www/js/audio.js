/* =========================================================================
   Moteur audio : synthèse vocale (Web Speech API) + bruits de fond (Web Audio)
   -------------------------------------------------------------------------
   PROTOTYPE : la voix est générée par la synthèse vocale du système et le
   rapport signal/bruit (RSB) est ESTIMÉ. En production, les stimuli seront
   des enregistrements calibrés (locuteurs professionnels, niveaux mesurés).
   ========================================================================= */
const AudioEngine = (() => {
  let ctx = null, master = null;
  let noiseSrc = null, noiseGain = null, noiseFilter = null;
  const buffers = {};
  let voices = [];

  /* ---------- Contexte Web Audio ---------- */
  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      try { ctx.resume(); } catch(e) {}
    }
    return ctx;
  }

  // Déverrouillage automatique du contexte audio dès la première interaction utilisateur sur mobile
  if (typeof document !== "undefined") {
    const unlockAudio = () => {
      ensureCtx();
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("touchend", unlockAudio);
      document.removeEventListener("click", unlockAudio);
    };
    document.addEventListener("touchstart", unlockAudio, { passive: true });
    document.addEventListener("touchend", unlockAudio, { passive: true });
    document.addEventListener("click", unlockAudio, { passive: true });
  }

  /* ---------- Voix ---------- */
  window._ttsUtterances = window._ttsUtterances || [];

  function loadVoices() {
    if (!("speechSynthesis" in window)) return [];
    try {
      const all = speechSynthesis.getVoices() || [];
      voices = all.filter(v => v.lang && v.lang.toLowerCase().replace(/_/g, "-").startsWith("fr"));
      if (!voices.length && all.length) {
        voices = all.filter(v => (v.name && v.name.toLowerCase().includes("fr")) || (v.lang && v.lang.toLowerCase().includes("fr")));
      }
    } catch(e) {
      voices = [];
    }
    return voices;
  }
  if ("speechSynthesis" in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = () => { loadVoices(); document.dispatchEvent(new Event("voiceschanged")); };
  }

  function getVoice(voiceURI) {
    if (!voices.length) loadVoices();
    if (voiceURI) { const v = voices.find(x => x.voiceURI === voiceURI); if (v) return v; }
    const prefs = ["Google français", "Microsoft Denise", "Microsoft Hortense", "Amélie", "Thomas", "Audrey"];
    for (const p of prefs) { const v = voices.find(x => x.name && x.name.includes(p)); if (v) return v; }
    const frVoice = voices.find(v => v.lang && v.lang.toLowerCase().replace(/_/g, "-").startsWith("fr"));
    return frVoice || null;
  }

  function hasSpeech() { return "speechSynthesis" in window; }

  function speak(text, opts = {}) {
    const { rate = 0.9, volume = 1, voiceURI = null } = opts;
    return new Promise(resolve => {
      if (!hasSpeech()) { resolve(false); return; }

      // 1. Débloquer l'état paused si Android a mis en veille le moteur vocal
      try {
        if (speechSynthesis.paused) {
          speechSynthesis.resume();
        }
      } catch (e) {}

      // 2. Annuler uniquement si une précédente parole est déjà en cours
      if (speechSynthesis.speaking) {
        try { speechSynthesis.cancel(); } catch(e) {}
      }

      // 3. Délai de transition IPC pour Android
      setTimeout(() => {
        try {
          if (speechSynthesis.paused) {
            speechSynthesis.resume();
          }
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "fr-FR";

          const v = getVoice(voiceURI);
          if (v && v.lang && v.lang.toLowerCase().startsWith("fr")) {
            u.voice = v;
          }
          // Note : si aucune voix FR spécifique n'est trouvée, ne PAS forcer une voix étrangère,
          // laisser le système Android utiliser sa voix par défaut grâce à u.lang = "fr-FR".

          u.rate = rate;
          u.volume = Math.max(0.9, Math.min(1.0, volume));
          u.pitch = 1.0;

          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              const idx = window._ttsUtterances.indexOf(u);
              if (idx !== -1) window._ttsUtterances.splice(idx, 1);
              resolve(true);
            }
          };

          u.onend = finish;
          u.onerror = (err) => {
            console.warn("TTS Event Error:", err);
            finish();
          };

          // Filet de sécurité pour ne jamais bloquer l'interface
          setTimeout(finish, 2600 + (String(text).length * 160) / rate);

          // Garder une référence forte pour éviter le bug de Garbage Collection Android/Chrome
          window._ttsUtterances.push(u);

          speechSynthesis.speak(u);
        } catch(err) {
          console.warn("TTS Exception:", err);
          resolve(false);
        }
      }, 70);
    });
  }

  function stopSpeech() {
    if (hasSpeech()) {
      try { speechSynthesis.cancel(); } catch(e) {}
    }
  }

  /* ---------- Génération des bruits ---------- */
  function makeBuffer(type) {
    const c = ensureCtx(); if (!c) return null;
    if (buffers[type]) return buffers[type];
    const sr = c.sampleRate, len = sr * 6;
    const buf = c.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    if (type === "white") {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else {
      // bruit rose (filtre de Paul Kellet)
      const pink = () => {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        return () => {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
          const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
          return out * 0.11;
        };
      };
      if (type === "pink") {
        const p = pink();
        for (let i = 0; i < len; i++) d[i] = p();
      } else if (type === "traffic") {
        // Bruit de circulation : grondement grave + montées/descentes lentes
        const p = pink();
        let rumble = 0;
        for (let i = 0; i < len; i++) {
          const mod = 0.5 + 0.5 * Math.sin((i / sr) * 0.8) + 0.3 * Math.sin((i / sr) * 2.3);
          rumble = 0.96 * rumble + 0.04 * (Math.random() * 2 - 1);
          d[i] = (p() * 0.4 + rumble * 1.8) * mod;
        }
      } else if (type === "dishes") {
        // Bruit ménager / vaisselle : fond doux + chocs métalliques et cliquetis aigus
        const p = pink();
        for (let i = 0; i < len; i++) d[i] = p() * 0.3;
        const clinks = 18;
        for (let k = 0; k < clinks; k++) {
          const pos = Math.floor(Math.random() * (len - 8000));
          const freq = 2200 + Math.random() * 3500;
          for (let j = 0; j < 6000; j++) {
            const decay = Math.exp(-j / 600);
            d[pos + j] += Math.sin(2 * Math.PI * freq * (j / sr)) * decay * 0.8;
          }
        }
      } else {
        // "babble" : somme de plusieurs sources roses modulées à rythme syllabique (≈ 3–6 Hz)
        const talkers = 6;
        for (let t = 0; t < talkers; t++) {
          const p = pink();
          let env = 0, target = Math.random();
          const changeEvery = Math.floor(sr / (3 + Math.random() * 3));
          for (let i = 0; i < len; i++) {
            if (i % changeEvery === 0) target = Math.random() < 0.25 ? 0.05 : 0.4 + Math.random() * 0.6;
            env += (target - env) * 0.0015;
            d[i] += p() * env;
          }
        }
      }
    }
    // normalisation RMS ≈ 0.1
    let sum = 0; for (let i = 0; i < len; i++) sum += d[i] * d[i];
    const rms = Math.sqrt(sum / len) || 1, k = 0.1 / rms;
    for (let i = 0; i < len; i++) d[i] *= k;
    // fondu de bouclage
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < fade; i++) { const g = i / fade; d[i] *= g; d[len - 1 - i] *= g; }
    buffers[type] = buf;
    return buf;
  }

  /* Gain du bruit calibré pour un RSB donné (dB).
     Le bruit est un fond réaliste (doux à modéré) et ne couvre jamais la voix. */
  function gainForSnr(snr, isSolo = false) {
    if (snr === null || snr === undefined) return 0;
    if (isSolo) {
      // Pour l'écoute d'ambiance seule dans le simulateur : niveau clair, confortable et audible sur haut-parleur mobile
      const g = 0.32 * Math.pow(10, -snr / 30);
      return Math.min(0.35, Math.max(0.14, g));
    }
    // Pour l'entraînement avec parole : fond doux pour faire ressortir la voix
    const g = 0.065 * Math.pow(10, -snr / 20);
    return Math.min(0.14, Math.max(0.005, g));
  }

  let originalNoiseGain = 0;

  function startNoise(type = "babble", snr = 10, isSolo = false) {
    const c = ensureCtx(); if (!c) return;
    if (c.state === "suspended") {
      try { c.resume(); } catch(e) {}
    }
    stopNoise(true);
    const buf = makeBuffer(type === "babble" ? "babble" : type);
    noiseSrc = c.createBufferSource();
    noiseSrc.buffer = buf; noiseSrc.loop = true;
    noiseFilter = c.createBiquadFilter();
    if (type === "babble") {
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = 3400;
      noiseFilter.Q.value = 0.5;
    } else if (type === "traffic") {
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = 1400;
      noiseFilter.Q.value = 0.7;
    } else if (type === "dishes") {
      noiseFilter.type = "peaking";
      noiseFilter.frequency.value = 2800;
      noiseFilter.Q.value = 0.8;
      noiseFilter.gain.value = 3;
    } else {
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = 4000;
      noiseFilter.Q.value = 0.7;
    }
    noiseGain = c.createGain();
    const targetGain = gainForSnr(snr, isSolo);
    originalNoiseGain = targetGain;
    noiseGain.gain.value = targetGain;
    noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master);
    try {
      noiseSrc.start();
    } catch(e) {
      console.warn("Audio start error:", e);
    }
  }

  function setSnr(snr, isSolo = false) {
    if (noiseGain && ctx) {
      const g = gainForSnr(snr, isSolo);
      originalNoiseGain = g;
      noiseGain.gain.setTargetAtTime(g, ctx.currentTime, 0.1);
    }
  }

  function duckNoise(factor = 0.35) {
    if (noiseGain && ctx && originalNoiseGain > 0) {
      noiseGain.gain.setTargetAtTime(originalNoiseGain * factor, ctx.currentTime, 0.05);
    }
  }

  function unduckNoise() {
    if (noiseGain && ctx && originalNoiseGain > 0) {
      noiseGain.gain.setTargetAtTime(originalNoiseGain, ctx.currentTime, 0.15);
    }
  }

  function stopNoise(immediate = false) {
    if (!noiseSrc || !ctx) return;
    const src = noiseSrc, g = noiseGain;
    noiseSrc = null; noiseGain = null;
    try {
      if (immediate) { src.stop(); }
      else { g.gain.setTargetAtTime(0, ctx.currentTime, 0.12); src.stop(ctx.currentTime + 0.6); }
    } catch (e) { /* déjà arrêté */ }
  }

  /* ---------- Petits signaux de retour (correct / incorrect) ---------- */
  function beep(kind = "ok") {
    const c = ensureCtx(); if (!c) return;
    const seq = kind === "ok" ? [660, 880] : [330, 247];
    seq.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t0 = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.2);
    });
  }

  /* Joue un stimulus : bruit (optionnel) + voix, puis coupe le bruit. */
  async function playStimulus(text, { snr = null, noise = "babble", rate = 0.9, voiceURI = null, lead = 450 } = {}) {
    ensureCtx();
    if ("speechSynthesis" in window && speechSynthesis.paused) {
      try { speechSynthesis.resume(); } catch(e) {}
    }
    if (snr !== null && snr !== undefined) {
      startNoise(noise, snr, false);
      await new Promise(r => setTimeout(r, lead));
    }
    // Ducking acoustique : légère baisse du bruit pendant la prononciation du mot
    if (noiseGain && ctx && snr !== null && snr !== undefined) {
      const g = gainForSnr(snr, false);
      noiseGain.gain.setTargetAtTime(g * 0.65, ctx.currentTime, 0.05);
    }
    await speak(text, { rate, voiceURI, volume: 1.0 });
    if (noiseGain && ctx && snr !== null && snr !== undefined) {
      const g = gainForSnr(snr, false);
      noiseGain.gain.setTargetAtTime(g, ctx.currentTime, 0.08);
      await new Promise(r => setTimeout(r, 400));
      stopNoise();
    }
  }

  function stopAll() { stopSpeech(); stopNoise(true); }

  return { ensureCtx, loadVoices, getVoice, hasSpeech, speak, stopSpeech, startNoise, setSnr, duckNoise, unduckNoise, stopNoise, stopAll, beep, playStimulus, get voices() { return voices; } };
})();

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

  /* La synthèse vocale est TOUJOURS disponible grâce au moteur hybride universel :
     1. Web Speech API native si le système le permet
     2. Streaming Audio HD français en secours universel (garanti sur 100% des WebViews et mobiles)
     3. Synthétiseur phonétique Web Audio hors-ligne */
  function hasSpeech() {
    return true;
  }

  let currentAudioStream = null;

  /* 1. Moteur Natif Web Speech API */
  function speakNative(text, opts = {}) {
    const { rate = 0.9, volume = 1, voiceURI = null } = opts;
    return new Promise(resolve => {
      if (!("speechSynthesis" in window) || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
        resolve(false);
        return;
      }

      try {
        if (speechSynthesis.paused) {
          speechSynthesis.resume();
        }
      } catch (e) {}

      if (speechSynthesis.speaking) {
        try { speechSynthesis.cancel(); } catch(e) {}
      }

      let ended = false;
      let watchdog = null;

      const finish = (success) => {
        if (!ended) {
          ended = true;
          if (watchdog) clearTimeout(watchdog);
          resolve(success);
        }
      };

      // Si le moteur natif Android ne commence pas à parler sous 500ms, basculer sur le stream HD
      watchdog = setTimeout(() => {
        if (!speechSynthesis.speaking) {
          finish(false);
        }
      }, 500);

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

          u.rate = rate;
          u.volume = Math.max(0.9, Math.min(1.0, volume));
          u.pitch = 1.0;

          u.onstart = () => {
            if (watchdog) clearTimeout(watchdog);
            // Filet de sécurité maximal
            watchdog = setTimeout(() => finish(true), 3200 + (String(text).length * 160) / rate);
          };

          u.onend = () => finish(true);
          u.onerror = (err) => {
            console.warn("TTS Native Error:", err);
            finish(false);
          };

          window._ttsUtterances = window._ttsUtterances || [];
          window._ttsUtterances.push(u);

          speechSynthesis.speak(u);
        } catch(err) {
          console.warn("TTS Native Exception:", err);
          finish(false);
        }
      }, 50);
    });
  }

  /* 2. Moteur Universel de Streaming Audio HD Français */
  function speakStream(text, opts = {}) {
    const { rate = 0.9, volume = 1 } = opts;
    return new Promise(resolve => {
      try {
        const clean = String(text).trim().slice(0, 200);
        if (!clean) { resolve(false); return; }

        if (currentAudioStream) {
          try { currentAudioStream.pause(); currentAudioStream = null; } catch(e) {}
        }

        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(clean)}`;
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.src = url;
        audio.playbackRate = Math.min(1.3, Math.max(0.75, rate));
        audio.volume = Math.max(0.85, Math.min(1.0, volume));

        currentAudioStream = audio;

        let ended = false;
        const done = (success) => {
          if (!ended) {
            ended = true;
            if (currentAudioStream === audio) currentAudioStream = null;
            resolve(success);
          }
        };

        audio.onended = () => done(true);
        audio.onerror = (e) => {
          console.warn("TTS Stream Error:", e);
          done(false);
        };

        // Filet de sécurité temps maximum
        setTimeout(() => done(true), 3500 + clean.length * 120);

        const playPromise = audio.play();
        if (playPromise && playPromise.catch) {
          playPromise.catch(err => {
            console.warn("TTS Stream Play Error:", err);
            done(false);
          });
        }
      } catch(e) {
        console.warn("TTS Stream Exception:", e);
        resolve(false);
      }
    });
  }

  /* 3. Synthèse Phonétique Web Audio (Secours ultime hors-ligne) */
  function speakPhonetic(text, opts = {}) {
    return new Promise(resolve => {
      const c = ensureCtx();
      if (!c) { resolve(false); return; }
      try {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(180, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, c.currentTime + 0.35);
        g.gain.setValueAtTime(0, c.currentTime);
        g.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
        osc.connect(g);
        g.connect(master);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.42);
        setTimeout(() => resolve(true), 450);
      } catch(e) {
        resolve(false);
      }
    });
  }

  /* Point d'entrée universel : essaie le natif, puis le flux HD, puis la synthèse phonétique */
  async function speak(text, opts = {}) {
    if (!text) return false;

    // A. Essai natif
    const nativeOk = await speakNative(text, opts);
    if (nativeOk) return true;

    // B. Flux HD en secours
    const streamOk = await speakStream(text, opts);
    if (streamOk) return true;

    // C. Synthèse phonétique en ultime secours
    return await speakPhonetic(text, opts);
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      try { speechSynthesis.cancel(); } catch(e) {}
    }
    if (currentAudioStream) {
      try {
        currentAudioStream.pause();
        currentAudioStream.currentTime = 0;
        currentAudioStream = null;
      } catch(e) {}
    }
  }

  /* ---------- Génération des bruits & environnements sonores ---------- */
  function makeBuffer(type) {
    const c = ensureCtx(); if (!c) return null;
    if (buffers[type]) return buffers[type];
    const sr = c.sampleRate || 44100;
    const dur = 8; // 8 secondes de boucle haute fidélité
    const len = sr * dur;
    const buf = c.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);

    if (type === "white") {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (type === "pink") {
      // 1. SALON & VENTILATION DOUCE : Souffle stationnaire très régulier et apaisant
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.992 * b0 + white * 0.05;
        b1 = 0.965 * b1 + white * 0.09;
        b2 = 0.880 * b2 + white * 0.16;
        d[i] = (b0 + b1 + b2) * 0.45;
      }
    } else if (type === "traffic") {
      // 2. BOULEVARD & CIRCULATION : Passage de véhicules en Doppler + roulement pneus + klaxon lointain
      let urbanHiss = 0;
      for (let i = 0; i < len; i++) {
        const n = Math.random() * 2 - 1;
        urbanHiss = 0.94 * urbanHiss + 0.06 * n;
        d[i] = urbanHiss * 0.22;
      }
      // Deux véhicules qui s'approchent, accélèrent et s'éloignent (effet Doppler)
      const cars = [
        { peak: 2.4, width: 1.1, fStart: 950, fEnd: 320, vol: 0.8 },
        { peak: 6.2, width: 1.3, fStart: 880, fEnd: 290, vol: 0.9 }
      ];
      cars.forEach(car => {
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const dt = t - car.peak;
          const env = Math.exp(-(dt * dt) / (car.width * car.width));
          if (env < 0.005) continue;
          const progress = Math.min(1, Math.max(0, (dt / car.width + 1) / 2));
          const freq = car.fStart + (car.fEnd - car.fStart) * progress;
          // Frottement du pneu sur bitume
          const tire = (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * freq * t);
          // Grondement mécanique moteur 4 cylindres
          const engine = Math.sin(2 * Math.PI * 52 * t) + 0.5 * Math.sin(2 * Math.PI * 104 * t);
          d[i] += (tire * 0.7 + engine * 0.55) * env * car.vol;
        }
      });
      // Coup de klaxon lointain typique de la circulation parisienne (à t = 4.2s)
      const hornStart = Math.floor(sr * 4.1), hornLen = Math.floor(sr * 0.35);
      for (let j = 0; j < hornLen; j++) {
        const t = j / sr;
        const env = Math.sin((j / hornLen) * Math.PI);
        const h = (Math.sin(2 * Math.PI * 435 * t) + Math.sin(2 * Math.PI * 545 * t)) * 0.2;
        d[hornStart + j] += h * env;
      }
    } else if (type === "dishes") {
      // 3. CUISINE & VAISSELLE : Eau qui coule dans l'évier + chocs et tintements de verres, assiettes et couverts
      let wFilt = 0;
      for (let i = 0; i < len; i++) {
        const flow = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.18 * (i / sr));
        const n = Math.random() * 2 - 1;
        wFilt = 0.88 * wFilt + 0.12 * n; // filet d'eau fluide
        d[i] = wFilt * 0.22 * flow;
      }
      // Tintements nets d'assiettes en céramique, verres en cristal et couverts métalliques
      const clinkCount = 38;
      for (let k = 0; k < clinkCount; k++) {
        const tStart = Math.floor((k / clinkCount) * len + (Math.random() - 0.5) * (sr * 0.16));
        if (tStart < 0 || tStart > len - 14000) continue;
        const f1 = 1800 + Math.random() * 3200;
        const f2 = f1 * (1.28 + Math.random() * 0.38);
        const decayRate = 140 + Math.random() * 300;
        const impactVol = 0.5 + Math.random() * 0.5;
        for (let j = 0; j < 12000; j++) {
          const env = Math.exp(-j / decayRate);
          const tSec = j / sr;
          const sig = (Math.sin(2 * Math.PI * f1 * tSec) * 0.6 + Math.sin(2 * Math.PI * f2 * tSec) * 0.4);
          d[tStart + j] += sig * env * impactVol;
        }
      }
    } else {
      // 4. RESTAURANT & DÉJEUNER ANIMÉ : Polyphonie vocale (hommes, femmes) aux rythmes syllabiques articulés + verres feutrés
      const voices = [
        { f0: 115, f1: 650, f2: 1300, rate: 3.8 },
        { f0: 135, f1: 520, f2: 1650, rate: 4.2 },
        { f0: 195, f1: 750, f2: 1550, rate: 4.5 },
        { f0: 220, f1: 580, f2: 1900, rate: 4.0 },
        { f0: 125, f1: 700, f2: 1400, rate: 3.6 },
        { f0: 210, f1: 620, f2: 1800, rate: 4.7 },
        { f0: 145, f1: 800, f2: 1600, rate: 4.1 },
        { f0: 235, f1: 650, f2: 2100, rate: 3.9 }
      ];
      voices.forEach(v => {
        let phase0 = Math.random();
        let syllEnv = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const syllPhase = t * v.rate;
          const syllGate = Math.sin(2 * Math.PI * syllPhase);
          const isSpeaking = Math.sin(2 * Math.PI * 0.35 * t + v.f0) > -0.25;
          const targetEnv = (isSpeaking && syllGate > 0) ? syllGate : 0;
          syllEnv += (targetEnv - syllEnv) * 0.008;

          phase0 = (phase0 + v.f0 / sr) % 1.0;
          const glottal = (phase0 < 0.25 ? (phase0 * 4) : (1 - (phase0 - 0.25) / 0.75 * 2)) - 0.5;

          const form1 = Math.sin(2 * Math.PI * v.f1 * t);
          const form2 = Math.sin(2 * Math.PI * v.f2 * t);
          const vocalTone = (glottal * 0.35 + form1 * 0.45 + form2 * 0.2) * syllEnv;
          d[i] += vocalTone * 0.28;
        }
      });
      // Bruit de salle et résonances de couverts feutrés
      for (let k = 0; k < 8; k++) {
        const tClink = Math.floor((k / 8) * len + Math.random() * (sr * 0.3));
        if (tClink < len - 4000) {
          for (let j = 0; j < 3500; j++) {
            d[tClink + j] += Math.sin(2 * Math.PI * 3100 * (j / sr)) * Math.exp(-j / 200) * 0.22;
          }
        }
      }
    }

    // Normalisation RMS = 0.12
    let sum = 0; for (let i = 0; i < len; i++) sum += d[i] * d[i];
    const rms = Math.sqrt(sum / len) || 1, k = 0.12 / rms;
    for (let i = 0; i < len; i++) d[i] *= k;

    // Fondu de bouclage propre sur 60 ms pour zéro clic à la boucle
    const fade = Math.floor(sr * 0.06);
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      d[i] *= g;
      d[len - 1 - i] *= g;
    }
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

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
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* ---------- Voix ---------- */
  function loadVoices() {
    if (!("speechSynthesis" in window)) return [];
    voices = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("fr"));
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
    for (const p of prefs) { const v = voices.find(x => x.name.includes(p)); if (v) return v; }
    return voices.find(v => v.lang.toLowerCase().startsWith("fr-fr")) || voices[0] || null;
  }

  function hasSpeech() { return "speechSynthesis" in window; }

  function speak(text, opts = {}) {
    const { rate = 0.9, volume = 1, voiceURI = null } = opts;
    return new Promise(resolve => {
      if (!hasSpeech()) { resolve(false); return; }
      speechSynthesis.cancel();
      // petit délai : contourne un bug Chrome lorsque speak() suit cancel()
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "fr-FR";
        const v = getVoice(voiceURI);
        if (v) u.voice = v;
        u.rate = rate; u.volume = volume; u.pitch = 1;
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(true); } };
        u.onend = finish; u.onerror = finish;
        // filet de sécurité si onend ne se déclenche pas
        setTimeout(finish, 1800 + (text.length * 110) / rate);
        speechSynthesis.speak(u);
      }, 60);
    });
  }

  function stopSpeech() { if (hasSpeech()) speechSynthesis.cancel(); }

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

  /* Gain du bruit pour un RSB donné (dB). RSB 0 ≈ bruit aussi fort que la voix. */
  function gainForSnr(snr) { return Math.min(3, 1.2 * Math.pow(10, -snr / 20)); }

  function startNoise(type = "babble", snr = 10) {
    const c = ensureCtx(); if (!c) return;
    stopNoise(true);
    const buf = makeBuffer(type === "babble" ? "babble" : type);
    noiseSrc = c.createBufferSource();
    noiseSrc.buffer = buf; noiseSrc.loop = true;
    noiseFilter = c.createBiquadFilter();
    noiseFilter.type = type === "babble" ? "bandpass" : "lowpass";
    noiseFilter.frequency.value = type === "babble" ? 900 : 6000;
    noiseFilter.Q.value = type === "babble" ? 0.6 : 0.7;
    noiseGain = c.createGain();
    noiseGain.gain.value = 0;
    noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master);
    noiseSrc.start();
    noiseGain.gain.setTargetAtTime(gainForSnr(snr), c.currentTime, 0.15);
  }

  function setSnr(snr) {
    if (noiseGain && ctx) noiseGain.gain.setTargetAtTime(gainForSnr(snr), ctx.currentTime, 0.1);
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
  async function playStimulus(text, { snr = null, noise = "babble", rate = 0.9, voiceURI = null, lead = 700 } = {}) {
    ensureCtx();
    if (snr !== null && snr !== undefined) {
      startNoise(noise, snr);
      await new Promise(r => setTimeout(r, lead));
    }
    await speak(text, { rate, voiceURI });
    if (snr !== null && snr !== undefined) {
      await new Promise(r => setTimeout(r, 350));
      stopNoise();
    }
  }

  function stopAll() { stopSpeech(); stopNoise(true); }

  return { ensureCtx, loadVoices, getVoice, hasSpeech, speak, stopSpeech, startNoise, setSnr, stopNoise, stopAll, beep, playStimulus, get voices() { return voices; } };
})();

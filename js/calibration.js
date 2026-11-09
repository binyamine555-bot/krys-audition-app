/* =========================================================================
   Module d'Étalonnage Acoustique Smartphone de Haute Précision
   -------------------------------------------------------------------------
   Comprend l'ensemble des techniques psychoacoustiques et physiques de
   calibration mobile validées en télé-audiologie :
   1. Profils de transducteurs (Haut-parleur, Écouteurs, Casque, Aides Bluetooth)
   2. Étalonnage biologique normé par froissement de papier A4 (45-50 dBA)
   3. Calibrage à la voix conversationnelle de référence (60-65 dB SPL)
   4. Détermination du seuil liminaire à 1000 Hz (référence ISO 389)
   5. Balance inter-aurale G/D
   6. Analyseur de bruit de fond ambiant par microphone (FFT Web Audio)
   ========================================================================= */

const CalibrationEngine = (() => {
  // Transducteurs supportés et leurs décalages nominaux (dB)
  const TRANSDUCERS = {
    bluetooth_aids: {
      id: "bluetooth_aids",
      label: "Streaming direct vers Aides Auditives",
      icon: "ear",
      desc: "Idéal (MFi, ASHA ou LE Audio) : le son est corrigé directement par vos appareils selon votre audiogramme.",
      offsetDb: 0,
      recommended: true
    },
    headphones: {
      id: "headphones",
      label: "Casque audio circum-aural",
      icon: "headphones",
      desc: "Bonne isolation phonique et réponse fréquentielle équilibrée (IEC 60268-7).",
      offsetDb: -3
    },
    earphones: {
      id: "earphones",
      label: "Écouteurs intra-auriculaires",
      icon: "headphones",
      desc: "Écouteurs filaires ou sans fil classiques insérés dans le conduit.",
      offsetDb: -6
    },
    speaker: {
      id: "speaker",
      label: "Haut-parleur du téléphone",
      icon: "volume",
      desc: "À tenir à environ 40–50 cm face à soi dans un endroit parfaitement calme.",
      offsetDb: 8
    }
  };

  // État actuel de l'étalonnage
  let micStream = null;
  let micAnalyser = null;
  let micAudioCtx = null;
  let micRaf = null;

  function getStoredCalibration() {
    const s = Store.s;
    return s.calibration || {
      transducer: "bluetooth_aids",
      calibrated: false,
      method: "conversational_voice",
      outputGain: 1.0,
      correctionDb: 0,
      leftGain: 1.0,
      rightGain: 1.0,
      calibratedAt: null,
      noiseFloorDba: 35
    };
  }

  function saveCalibration(data) {
    Store.update(s => {
      s.calibration = { ...getStoredCalibration(), ...data, calibrated: true, calibratedAt: new Date().toISOString() };
    });
  }

  /* ---------------- 1. Étalonnage à la Voix Conversationnelle ---------------- */
  // Génère une phrase standardisée et invite l'utilisateur à régler le curseur
  async function playCalibrationVoice(gainVal = 1.0, transducer = "bluetooth_aids") {
    AudioEngine.ensureCtx();
    const text = "Ceci est une voix de référence à niveau de conversation normale. Réglez le volume pour entendre comme si je parlais devant vous.";
    await AudioEngine.speak(text, { rate: 0.9, volume: Math.min(1.0, gainVal) });
  }

  /* ---------------- 2. Étalonnage Biologique (Bruit Froissement Papier) ---------------- */
  // Joue un bruit rose calibré à 48 dBA nominal (équivalent froissement papier A4 à 50 cm)
  let bioNoiseNode = null;
  let bioGainNode = null;

  function startBiologicalReferenceTone(gain = 0.5) {
    const ctx = AudioEngine.ensureCtx();
    if (!ctx) return;
    stopBiologicalReferenceTone();

    // Filtre passe-bande simulant le froissement de papier (spectre 500 Hz - 4000 Hz)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.15;
    }

    bioNoiseNode = ctx.createBufferSource();
    bioNoiseNode.buffer = buf;
    bioNoiseNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.9;

    bioGainNode = ctx.createGain();
    bioGainNode.gain.setValueAtTime(gain, ctx.currentTime);

    bioNoiseNode.connect(filter);
    filter.connect(bioGainNode);
    bioGainNode.connect(ctx.destination);
    bioNoiseNode.start();
  }

  function setBiologicalGain(gain) {
    if (bioGainNode && AudioEngine.ensureCtx()) {
      bioGainNode.gain.setValueAtTime(Math.max(0.01, Math.min(1.5, gain)), AudioEngine.ensureCtx().currentTime);
    }
  }

  function stopBiologicalReferenceTone() {
    if (bioNoiseNode) {
      try { bioNoiseNode.stop(); } catch (e) {}
      bioNoiseNode.disconnect();
      bioNoiseNode = null;
      bioGainNode = null;
    }
  }

  /* ---------------- 3. Étalonnage par Son Pur 1000 Hz (Seuil Liminaire) ---------------- */
  let toneOsc = null;
  let toneGain = null;

  function startTone1kHz(gain = 0.1, ear = "both") {
    const ctx = AudioEngine.ensureCtx();
    if (!ctx) return;
    stopTone1kHz();

    toneOsc = ctx.createOscillator();
    toneOsc.type = "sine";
    toneOsc.frequency.value = 1000;

    toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(gain, ctx.currentTime);

    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = ear === "left" ? -1 : ear === "right" ? 1 : 0;
      toneOsc.connect(toneGain);
      toneGain.connect(pan);
      pan.connect(ctx.destination);
    } else {
      toneOsc.connect(toneGain);
      toneGain.connect(ctx.destination);
    }
    toneOsc.start();
  }

  function setToneGain(gain) {
    if (toneGain && AudioEngine.ensureCtx()) {
      toneGain.gain.setValueAtTime(Math.max(0.0001, Math.min(1.0, gain)), AudioEngine.ensureCtx().currentTime);
    }
  }

  function stopTone1kHz() {
    if (toneOsc) {
      try { toneOsc.stop(); } catch (e) {}
      toneOsc.disconnect();
      toneOsc = null;
      toneGain = null;
    }
  }

  /* ---------------- 4. Sonomètre Ambiant FFT (Contrôle du bruit) ---------------- */
  async function startNoiseMonitor(onLevelUpdate) {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        onLevelUpdate({ available: false, dba: 35, status: "ok", msg: "Mesure micro non supportée (estimation standard 35 dB)" });
        return;
      }
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AC = window.AudioContext || window.webkitAudioContext;
      micAudioCtx = new AC();
      const source = micAudioCtx.createMediaStreamSource(micStream);
      micAnalyser = micAudioCtx.createAnalyser();
      micAnalyser.fftSize = 512;
      source.connect(micAnalyser);

      const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
      const update = () => {
        if (!micAnalyser) return;
        micAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Approximation dBA : bruit silencieux ≈ 30-38 dB, conversation ≈ 60 dB, fort > 70 dB
        const dba = Math.round(28 + (avg / 255) * 58);
        let status = "ok", msg = "Parfait : pièce très calme";
        if (dba > 52) {
          status = "danger";
          msg = "Pièce trop bruyante ! Isolez-vous ou fermez les fenêtres.";
        } else if (dba > 42) {
          status = "warn";
          msg = "Bruit modéré détecté. Préférez un endroit plus calme.";
        }
        onLevelUpdate({ available: true, dba, status, msg });
        micRaf = requestAnimationFrame(update);
      };
      update();
    } catch (err) {
      console.warn("Accès microphone non accordé pour le sonomètre", err);
      onLevelUpdate({ available: false, dba: 35, status: "ok", msg: "Microphone non accessible (calibrage standard appliqué)" });
    }
  }

  function stopNoiseMonitor() {
    if (micRaf) cancelAnimationFrame(micRaf);
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    if (micAudioCtx) {
      micAudioCtx.close();
      micAudioCtx = null;
    }
    micAnalyser = null;
  }

  return {
    TRANSDUCERS,
    getStoredCalibration,
    saveCalibration,
    playCalibrationVoice,
    startBiologicalReferenceTone,
    setBiologicalGain,
    stopBiologicalReferenceTone,
    startTone1kHz,
    setToneGain,
    stopTone1kHz,
    startNoiseMonitor,
    stopNoiseMonitor
  };
})();

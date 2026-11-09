/* =========================================================================
   Application Principale Krys Audition – Mon Parcours Auditif
   -------------------------------------------------------------------------
   Contrôleur central, routeur d'état, gestionnaire d'événements et PWA
   ========================================================================= */

const App = (() => {
  const container = () => document.getElementById("app");
  const navEl = () => document.getElementById("bottom-nav");
  let curView = null;

  /* ---------------- Routeur ---------------- */
  function route() {
    const hash = location.hash.slice(2) || "";
    const [path, ...params] = hash.split("/");
    const param = params.join("/");

    // Vérification du verrou d'accès confidentiel
    const headerRight = document.querySelector(".header-right");
    if (!Store.s.unlocked) {
      if (headerRight) headerRight.style.display = "none";
      if (curView && curView !== "lock" && Views[curView] && Views[curView].unmount) {
        Views[curView].unmount();
      }
      curView = "lock";
      container().innerHTML = Views.lock.render();
      renderNav(null);
      window.scrollTo(0, 0);
      return;
    }
    if (headerRight) headerRight.style.display = "";

    if (!Store.s.onboarded && path !== "welcome") {
      location.hash = "#/welcome";
      return;
    }

    const viewKey = path || "home";

    // Démonter uniquement si l'on quitte réellement l'écran en cours
    if (curView && curView !== viewKey && Views[curView] && Views[curView].unmount) {
      Views[curView].unmount();
    }
    const v = Views[viewKey] || Views.home;
    curView = viewKey;

    // Mise à jour de l'affichage
    const main = container();
    if (v.wide) document.body.classList.add("wide-mode");
    else document.body.classList.remove("wide-mode");

    main.innerHTML = v.render(param);

    if (v.mount) {
      v.mount(param);
    }

    renderNav(v.noTabs ? null : v.tab || (["home", "train", "care", "centre", "discover"].includes(viewKey) ? viewKey : "home"));
    window.scrollTo(0, 0);
  }

  /* ---------------- Barre de navigation mobile ---------------- */
  function renderNav(activeTab) {
    const nav = navEl();
    if (!nav) return;
    if (!activeTab) {
      nav.style.display = "none";
      return;
    }
    nav.style.display = "flex";
    const tabs = [
      { id: "home", label: "Accueil", icon: "home", href: "#/home" },
      { id: "train", label: "Entraînement", icon: "target", href: "#/train" },
      { id: "care", label: "Appareils", icon: "ear", href: "#/care" },
      { id: "centre", label: "Mon centre", icon: "pin", href: "#/centre" },
      { id: "discover", label: "Découvrir", icon: "glasses", href: "#/discover" }
    ];
    nav.innerHTML = tabs.map(t => `
      <a href="${t.href}" class="nav-i ${t.id === activeTab ? "on" : ""}">
        ${icon(t.icon)}
        <span>${t.label}</span>
      </a>
    `).join("");
  }

  /* ---------------- Gestionnaire Global des Événements ---------------- */
  function bindEvents() {
    // Événements au clic
    document.addEventListener("click", async e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const act = btn.dataset.action;

      // 1. Démonstration
      if (act === "load-demo") {
        Store.loadDemo();
        toast("Profil de démonstration chargé ✔");
        location.hash = "#/home";
        return;
      }

      // 2. Onboarding
      if (act === "ob-next") {
        OB.step++;
        route();
      } else if (act === "ob-back") {
        OB.step = Math.max(0, OB.step - 1);
        route();
      } else if (act === "ob-qr") {
        // Simulation scan QR code en cabinet
        OB.data.audiogram = {
          right: { 250: 20, 500: 25, 1000: 35, 2000: 50, 3000: 55, 4000: 60, 6000: 65, 8000: 70 },
          left:  { 250: 20, 500: 25, 1000: 35, 2000: 55, 3000: 60, 4000: 65, 6000: 70, 8000: 75 },
          voRight: { 500: 25, 1000: 35, 2000: 50, 4000: 60 },
          voLeft:  { 500: 25, 1000: 35, 2000: 55, 4000: 65 },
          date: dayKey(),
          source: "QR Code Centre Krys Audition"
        };
        toast("Audiogramme importé avec succès ✔");
        route();
      } else if (act === "ob-manual") {
        location.hash = "#/audiogram-edit/ob";
      } else if (act === "ob-finish") {
        Store.update(s => {
          s.onboarded = true;
          s.profile = { ...s.profile, ...OB.data.profile };
          s.consent = { ...s.consent, ...OB.data.consent, date: new Date().toISOString() };
          if (OB.data.audiogram) s.audiogram = OB.data.audiogram;
        });
        toast("Bienvenue sur Mon Parcours Auditif !");
        location.hash = "#/home";
      }

      // 3. Étalonnage Smartphone
      if (act === "cal-check-noise") {
        btn.disabled = true;
        btn.textContent = "Mesure en cours (micro)...";
        CalibrationEngine.startNoiseMonitor(res => {
          const valEl = document.getElementById("noise-dba-val");
          const barEl = document.getElementById("noise-bar");
          const msgEl = document.getElementById("noise-msg");
          const badgeEl = document.getElementById("noise-badge");
          if (valEl) valEl.textContent = res.dba + " dB";
          if (barEl) {
            barEl.style.width = Math.min(100, (res.dba / 80) * 100) + "%";
            barEl.className = "noise-bar " + (res.status === "danger" ? "danger" : res.status === "warn" ? "warn" : "ok");
          }
          if (msgEl) msgEl.textContent = res.msg;
          if (badgeEl) {
            badgeEl.textContent = res.status === "ok" ? "Calme ✔" : "Bruyant ⚠";
            badgeEl.className = "pill " + (res.status === "ok" ? "ok" : "warn");
          }
        });
      }
      if (act === "cal-select-transducer") {
        const tid = btn.dataset.id || btn.closest("[data-action='cal-select-transducer']")?.dataset.id;
        if (tid) {
          CalibrationEngine.saveCalibration({ transducer: tid });
          document.querySelectorAll(`[data-action="cal-select-transducer"]`).forEach(c => {
            const match = c.dataset.id === tid;
            c.classList.toggle("selected", match);
            const r = c.querySelector('input[type="radio"]');
            if (r) r.checked = match;
            const badge = c.querySelector(".t-badge");
            if (badge) {
              badge.classList.toggle("on", match);
              badge.textContent = match ? "Actif ✔" : "Choisir";
            }
          });
          const calBadge = document.getElementById("cal-status-badge");
          if (calBadge) {
            calBadge.className = "pill ok";
            calBadge.textContent = "Étalonné ✔";
          }
          const tObj = CalibrationEngine.TRANSDUCERS[tid];
          toast(`Profil d'écoute activé : ${tObj ? tObj.label : tid} ✔`);
        }
      } else if (act === "cal-play-voice") {
        btn.disabled = true;
        const curCal = CalibrationEngine.getStoredCalibration();
        await CalibrationEngine.playCalibrationVoice(curCal.outputGain || 0.8, curCal.transducer);
        btn.disabled = false;
      } else if (act === "cal-start-bio") {
        CalibrationEngine.startBiologicalReferenceTone(0.5);
      } else if (act === "cal-stop-bio") {
        CalibrationEngine.stopBiologicalReferenceTone();
      } else if (act === "cal-start-tone") {
        CalibrationEngine.startTone1kHz(0.08, "both");
      } else if (act === "cal-stop-tone") {
        CalibrationEngine.stopTone1kHz();
      } else if (act === "cal-test-left") {
        CalibrationEngine.startTone1kHz(0.08, "left");
        setTimeout(() => CalibrationEngine.stopTone1kHz(), 1200);
      } else if (act === "cal-test-right") {
        CalibrationEngine.startTone1kHz(0.08, "right");
        setTimeout(() => CalibrationEngine.stopTone1kHz(), 1200);
      } else if (act === "cal-save-all") {
        CalibrationEngine.stopBiologicalReferenceTone();
        CalibrationEngine.stopTone1kHz();
        CalibrationEngine.stopNoiseMonitor();
        CalibrationEngine.saveCalibration({ calibrated: true });
        toast("Étalonnage de votre mobile validé ✔");
        location.hash = "#/home";
      }

      // 4. Répertoire des Centres Krys France
      if (act === "center-set-my") {
        const cid = btn.dataset.id;
        Store.update(s => { s.profile.centerId = cid; });
        toast("Votre centre principal a été mis à jour ✔");
        if (Views.centers && typeof Views.centers.updateList === "function") {
          Views.centers.updateList();
        } else {
          route();
        }
      } else if (act === "center-locate") {
        if (!navigator.geolocation) {
          toast("Géolocalisation non disponible");
          return;
        }
        btn.disabled = true;
        btn.textContent = "Recherche...";
        navigator.geolocation.getCurrentPosition(
          pos => {
            const nearest = KrysDirectory.findNearest(pos.coords.latitude, pos.coords.longitude);
            btn.disabled = false;
            btn.textContent = "Autour de moi";
            if (nearest) {
              CENTERS_FILTER.query = nearest.city;
              const inputEl = document.querySelector('input[data-action-input="center-search"]');
              if (inputEl) inputEl.value = nearest.city;
              if (Views.centers && typeof Views.centers.updateList === "function") {
                Views.centers.updateList();
              } else {
                route();
              }
              toast(`Centre le plus proche : ${nearest.name}`);
            }
          },
          err => {
            btn.disabled = false;
            btn.textContent = "Autour de moi";
            toast("Position non accessible : utilisez la recherche par ville ou code postal.");
          }
        );
      } else if (act === "center-reset-search") {
        CENTERS_FILTER.query = "";
        CENTERS_FILTER.region = "";
        const inputEl = document.querySelector('input[data-action-input="center-search"]');
        if (inputEl) inputEl.value = "";
        const selectEl = document.querySelector('select[data-action-input="center-region-filter"]');
        if (selectEl) selectEl.value = "";
        if (Views.centers && typeof Views.centers.updateList === "function") {
          Views.centers.updateList();
        } else {
          route();
        }
      }

      // 5. Anamnèse Médicale Locale RGPD
      if (act === "anam-parse-text") {
        const txt = document.getElementById("anam-notes-input")?.value || "";
        if (!txt.trim()) {
          toast("Veuillez saisir ou coller un texte de compte-rendu.");
          return;
        }
        const parsed = ClinicalEngine.parseMedicalNotesLocally(txt);
        Store.update(s => {
          if (!s.anamnesis) s.anamnesis = {};
          s.anamnesis.parsedNotes = txt;
        });
        const resEl = document.getElementById("anam-parse-results");
        if (resEl && parsed) {
          resEl.innerHTML = `
            <div class="card parse-results mt-sm">
              <div class="card-head-row">
                <b>Éléments identifiés en local</b>
                <span class="pill ok">Analysé</span>
              </div>
              <ul class="bullets mt-xs">
                ${parsed.entities.pathologies.length ? `<li><b>Pathologie(s) :</b> ${parsed.entities.pathologies.join(", ")}</li>` : ""}
                ${parsed.entities.symptoms.length ? `<li><b>Symptômes :</b> ${parsed.entities.symptoms.join(", ")}</li>` : ""}
                ${parsed.entities.devices.length ? `<li><b>Aides auditives :</b> ${parsed.entities.devices.join(", ")}</li>` : ""}
                ${parsed.entities.earsMentioned.length ? `<li><b>Latéralité :</b> ${parsed.entities.earsMentioned.join(", ")}</li>` : ""}
                ${parsed.estimatedPta ? `<li><b>Seuil tonal estimé :</b> ${parsed.estimatedPta} dB</li>` : ""}
              </ul>
              <p class="tiny mt-xs">${parsed.privacyGuaranteed}</p>
            </div>
          `;
        }
        toast("Compte-rendu analysé et pris en compte ✔");
      }

      // 6. Sauvegarde Audiogramme
      if (act === "ag-save") {
        if (!AG_DRAFT) return;
        const fromOb = btn.dataset.from === "ob";
        if (fromOb) {
          OB.data.audiogram = JSON.parse(JSON.stringify(AG_DRAFT));
          location.hash = "#/welcome";
        } else {
          Store.update(s => { s.audiogram = JSON.parse(JSON.stringify(AG_DRAFT)); });
          toast("Audiogramme enregistré ✔");
          location.hash = "#/hearing";
        }
      }

      // 7. Entretien fait
      if (act === "maint-done") {
        const mid = btn.dataset.id;
        Store.update(s => { s.maintenance[mid] = dayKey(); });
        toast("Entretien enregistré ! Rendez-vous au prochain rappel.");
        route();
      }

      // 8. Test vocal
      if (act === "test-voice") {
        AudioEngine.speak("Bonjour, voici un exemple de voix pour vos exercices d'entraînement auditif avec Krys Audition.");
      }

      // 9. Synthèse vocale de conseil
      if (act === "read-aloud") {
        AudioEngine.speak(btn.dataset.text || "");
      }

      // 10. Rendez-vous suppression / ICS
      if (act === "appt-del") {
        const aid = btn.dataset.id;
        Store.update(s => { s.appointments = s.appointments.filter(a => a.id !== aid); });
        toast("Rendez-vous supprimé");
        route();
      } else if (act === "ics") {
        const aid = btn.dataset.id;
        const a = Store.s.appointments.find(x => x.id === aid);
        if (a) downloadIcs(a);
      }

      // 11. Favoris montures optique
      if (act === "fav") {
        const fid = btn.dataset.id;
        Store.update(s => {
          if (s.favorites.includes(fid)) s.favorites = s.favorites.filter(x => x !== fid);
          else s.favorites.push(fid);
        });
        route();
      } else if (act === "disc-tab") {
        DISC_TAB = btn.dataset.tab;
        route();
      } else if (act === "optic-filter") {
        OPTIC_FILTER = btn.dataset.cat || "all";
        route();
      } else if (act === "book-frame") {
        const frameName = btn.dataset.name || "cette monture";
        const center = KrysDirectory ? KrysDirectory.getById(Store.s.profile.centerId) : null;
        const centerName = center ? center.name : "votre centre Krys";
        toast(`Essayage réservé pour « ${frameName} » dans ${centerName} ! ✔`);
      } else if (act === "go-optic") {
        DISC_TAB = "optique";
        location.hash = "#/discover";
        route();
      }

      // 12. Intérêt produit
      if (act === "interest") {
        toast(`Votre intérêt pour « ${btn.dataset.name} » a été noté pour votre prochain rendez-vous.`);
      }

      // 13. Exporter / Reset
      if (act === "export") {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(Store.s, null, 2));
        const dl = document.createElement("a");
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `mon-parcours-auditif-${dayKey()}.json`);
        dl.click();
      } else if (act === "lock-app") {
        Store.update(s => { s.unlocked = false; });
        toast("Application reverrouillée");
        route();
      } else if (act === "reset") {
        if (confirm("Voulez-vous réinitialiser toutes les données de l'application ?")) {
          Store.reset();
          location.hash = "#/welcome";
        }
      }

      // 14. Simulateur Sonore d'Immersion Krys
      if (act === "soundscape-select") {
        const id = btn.dataset.id;
        if (id && id !== ACTIVE_SOUNDSCAPE) {
          ACTIVE_SOUNDSCAPE = id;
          if (SOUNDSCAPE_PLAYING) {
            AudioEngine.stopNoise(true);
            AudioEngine.startNoise(ACTIVE_SOUNDSCAPE, SOUNDSCAPE_SNR, true);
          }
          SOUNDSCAPE_SENTENCE = null;
          SOUNDSCAPE_REVEALED = false;
          route();
        }
      } else if (act === "soundscape-toggle") {
        if (SOUNDSCAPE_PLAYING) {
          AudioEngine.stopNoise(false);
          SOUNDSCAPE_PLAYING = false;
        } else {
          AudioEngine.startNoise(ACTIVE_SOUNDSCAPE, SOUNDSCAPE_SNR, true);
          SOUNDSCAPE_PLAYING = true;
          Store.update(s => {
            s.training = s.training || {};
            s.training.soundscapeTested = true;
          });
        }
        route();
      } else if (act === "soundscape-snr") {
        SOUNDSCAPE_SNR = Number(btn.dataset.snr || 10);
        if (SOUNDSCAPE_PLAYING) {
          AudioEngine.setSnr(SOUNDSCAPE_SNR, true);
        }
        route();
      } else if (act === "soundscape-speak") {
        const sentences = (typeof DATA_SENTENCES !== "undefined" && DATA_SENTENCES.length) ? DATA_SENTENCES : ["Le facteur distribue le courrier dans la boîte aux lettres.", "Nous irons au restaurant ce soir à vingt heures.", "Le train pour Marseille partira voie numéro trois."];
        const sent = pick(sentences);
        SOUNDSCAPE_SENTENCE = sent;
        SOUNDSCAPE_REVEALED = false;
        route();
        const rate = Store.s.settings.rate || 0.9;
        const voiceURI = Store.s.settings.voiceURI;
        if (!SOUNDSCAPE_PLAYING) {
          AudioEngine.playStimulus(sent, { snr: SOUNDSCAPE_SNR, noise: ACTIVE_SOUNDSCAPE, rate, voiceURI });
        } else {
          AudioEngine.duckNoise(0.35);
          AudioEngine.speak(sent, { rate, voiceURI }).then(() => {
            AudioEngine.unduckNoise();
          });
        }
      } else if (act === "soundscape-reveal") {
        SOUNDSCAPE_REVEALED = true;
        route();
      }

      // 15. Passeport Auditif (Impression / Partage)
      if (act === "print-passport") {
        window.print();
      } else if (act === "share-passport") {
        toast("Passeport transmis en toute sécurité au centre Krys et au médecin ORL ✔");
      }

      // 16. Mode Démo Réseau Krys (Monique Durand)
      if (act === "load-demo-profile") {
        Store.loadDemo();
        toast("Profil de démonstration réseau (Monique Durand) chargé ✔");
        location.hash = "#/home";
        route();
      }
    });

    // Événements d'entrée et de changement de formulaire en temps réel
    function handleFormInput(e) {
      const el = e.target;
      const act = el.dataset.actionInput;
      if (!act) return;

      if (act === "center-search") {
        CENTERS_FILTER.query = el.value;
        if (Views.centers && typeof Views.centers.updateList === "function") {
          Views.centers.updateList();
        } else {
          route();
        }
      } else if (act === "center-region-filter") {
        CENTERS_FILTER.region = el.value;
        if (Views.centers && typeof Views.centers.updateList === "function") {
          Views.centers.updateList();
        } else {
          route();
        }
      } else if (act === "cal-transducer") {
        CalibrationEngine.saveCalibration({ transducer: el.value, calibrated: true });
        document.querySelectorAll(`[data-action="cal-select-transducer"]`).forEach(c => {
          const match = c.dataset.id === el.value;
          c.classList.toggle("selected", match);
          const r = c.querySelector('input[type="radio"]');
          if (r) r.checked = match;
          const badge = c.querySelector(".t-badge");
          if (badge) {
            badge.classList.toggle("on", match);
            badge.textContent = match ? "Actif ✔" : "Choisir";
          }
        });
        const calBadge = document.getElementById("cal-status-badge");
        if (calBadge) {
          calBadge.className = "pill ok";
          calBadge.textContent = "Étalonné ✔";
        }
      } else if (act === "cal-gain-voice") {
        CalibrationEngine.saveCalibration({ outputGain: Number(el.value) });
      } else if (act === "cal-gain-bio") {
        CalibrationEngine.setBiologicalGain(Number(el.value));
        CalibrationEngine.saveCalibration({ outputGain: Number(el.value) });
      } else if (act === "cal-gain-tone") {
        CalibrationEngine.setToneGain(Number(el.value));
      } else if (act === "ag-cell") {
        if (!AG_DRAFT) return;
        const ear = el.dataset.ear, freq = el.dataset.f;
        AG_DRAFT[ear][freq] = el.value === "" ? null : Number(el.value);
        const prev = document.getElementById("ag-preview");
        if (prev) prev.innerHTML = Audiogram.render(AG_DRAFT, { height: 230 });
      } else if (act === "ag-preset") {
        if (!AG_DRAFT) return;
        const p = AUDIOGRAM_PRESETS[el.value];
        if (p) {
          AG_DRAFT.right = { ...p.right };
          AG_DRAFT.left = { ...p.left };
          route();
        }
      } else if (act === "ag-date") {
        if (AG_DRAFT) AG_DRAFT.date = el.value;
      } else if (act === "rate") {
        const v = Number(el.value);
        Store.update(s => { s.settings.rate = v; });
        const rv = document.getElementById("rate-v");
        if (rv) rv.textContent = v.toFixed(2);
      } else if (act === "voice") {
        Store.update(s => { s.settings.voiceURI = el.value || null; });
      } else if (act === "contrast") {
        Store.update(s => { s.settings.contrast = el.checked; });
        applySettings();
      } else if (act === "sounds") {
        Store.update(s => { s.settings.sounds = el.checked; });
      } else if (act === "consent-audiogram") {
        Store.update(s => { s.consent.audiogram = el.checked; });
      } else if (act === "consent-share") {
        Store.update(s => { s.consent.shareWithCenter = el.checked; });
      } else if (act === "consent-notif") {
        Store.update(s => { s.consent.notifications = el.checked; });
      }
    }

    document.addEventListener("input", handleFormInput);
    document.addEventListener("change", handleFormInput);

    // Soumission de formulaires
    document.addEventListener("submit", e => {
      const form = e.target.closest("[data-form]");
      if (!form) return;
      e.preventDefault();
      const name = form.dataset.form;
      const data = new FormData(form);

      if (name === "lock") {
        const code = data.get("code") || "";
        const ok = Store.checkAccessCode(code);
        if (ok) {
          toast("Code d'accès validé ! Bienvenue ✔");
          location.hash = Store.s.onboarded ? "#/home" : "#/welcome";
          route();
        } else {
          const errEl = document.getElementById("lock-err");
          if (errEl) errEl.style.display = "flex";
          const inputEl = document.getElementById("lock-input");
          if (inputEl) {
            inputEl.value = "";
            inputEl.focus();
          }
        }
        return;
      }

      if (name === "ob-profile") {
        OB.data.profile.firstName = data.get("firstName") || "";
        OB.data.profile.lastName = data.get("lastName") || "";
        OB.data.profile.centerId = data.get("centerId") || "c-75011";
        OB.data.profile.fittingDate = data.get("fittingDate") || dayKey();
        OB.data.profile.deviceType = data.get("deviceType") || "ric";
        OB.data.profile.power = data.get("power") || "rechargeable";
        OB.step++;
        route();
      } else if (name === "ob-consent") {
        OB.data.consent.audiogram = form.querySelector('[name="audiogram"]').checked;
        OB.data.consent.shareWithCenter = form.querySelector('[name="shareWithCenter"]').checked;
        OB.data.consent.notifications = form.querySelector('[name="notifications"]').checked;
        OB.step++;
        route();
      } else if (name === "anamnesis") {
        Store.update(s => {
          s.anamnesis = s.anamnesis || {};
          ClinicalEngine.ANAMNESIS_QUESTIONS.forEach(q => {
            const val = data.get(q.id);
            if (val !== null) s.anamnesis[q.id] = isNaN(val) ? val : Number(val);
          });
        });
        toast("Anamnèse enregistrée et prise en compte dans votre parcours ✔");
        location.hash = "#/hearing";
      } else if (name === "journal") {
        const ratings = {};
        JOURNAL_SITUATIONS.forEach(sit => {
          const v = data.get(sit.id);
          if (v) ratings[sit.id] = Number(v);
        });
        const note = data.get("note") || "";
        Store.update(s => {
          s.journal.push({ date: new Date().toISOString(), ratings, note });
        });
        toast("Votre journal a été enregistré ! Merci.");
        location.hash = "#/home";
      } else if (name === "book") {
        const slot = data.get("slot") || data.get("custom");
        const type = data.get("type") || "controle";
        const note = data.get("note") || "";
        if (!slot) {
          toast("Veuillez sélectionner un créneau.");
          return;
        }
        Store.update(s => {
          s.appointments.push({ id: uid(), date: new Date(slot).toISOString(), type, note, done: false });
        });
        toast("Rendez-vous confirmé dans votre agenda Krys Audition ✔");
        location.hash = "#/centre";
      } else if (name === "message") {
        const text = data.get("text") || "";
        if (!text.trim()) return;
        Store.update(s => {
          s.messages.push({ id: uid(), date: new Date().toISOString(), from: "patient", text });
        });
        form.reset();
        route();
        setTimeout(() => {
          Store.update(s => {
            s.messages.push({
              id: uid(),
              date: new Date().toISOString(),
              from: "centre",
              text: "Bonjour, nous avons bien reçu votre message. Votre audioprothésiste vous répondra dans les plus brefs délais."
            });
          });
          if (location.hash === "#/messages") route();
        }, 1200);
      } else if (name === "profile") {
        Store.update(s => {
          s.profile.firstName = data.get("firstName") || "";
          s.profile.lastName = data.get("lastName") || "";
          s.profile.centerId = data.get("centerId") || s.profile.centerId;
          s.profile.fittingDate = data.get("fittingDate") || s.profile.fittingDate;
          s.profile.deviceType = data.get("deviceType") || s.profile.deviceType;
          s.profile.power = data.get("power") || s.profile.power;
        });
        toast("Profil mis à jour ✔");
      }
    });

    window.addEventListener("hashchange", route);
  }

  /* ---------------- Exportation ICS Calendrier ---------------- */
  function downloadIcs(appt) {
    const start = new Date(appt.date);
    const end = new Date(start.getTime() + 45 * 60000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const center = H.center();
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Krys Audition//Mon Parcours Auditif//FR",
      "BEGIN:VEVENT",
      `UID:${appt.id}@krys-audition.fr`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Krys Audition - ${APPT_TYPES[appt.type]}`,
      `DESCRIPTION:${appt.note ? appt.note + " \\n" : ""}Avec votre audioprothésiste ${center.audiologist}`,
      `LOCATION:${center.name}, ${center.address}, ${center.city}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `krys-rdv-${dayKey(start)}.ics`;
    link.click();
    toast("Fichier calendrier .ics téléchargé ✔");
  }

  /* ---------------- Paramètres visuels (Accessibilité) ---------------- */
  function applySettings() {
    const s = Store.s.settings;
    if (s.contrast) document.body.classList.add("high-contrast");
    else document.body.classList.remove("high-contrast");
    document.documentElement.style.fontSize = (16 * (s.fontScale || 1)) + "px";
  }

  /* ---------------- Enregistrement PWA Service Worker ---------------- */
  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js").catch(e => console.log("SW non actif en local", e));
    }
  }

  /* ---------------- Démarrage ---------------- */
  function init() {
    applySettings();
    bindEvents();
    registerServiceWorker();
    route();
  }

  return { init, route };
})();

// Lancement au chargement du DOM
document.addEventListener("DOMContentLoaded", App.init);

/* =========================================================================
   Vues patient
   ========================================================================= */
const H = {
  center: () => (window.KrysDirectory ? KrysDirectory.getById(Store.s.profile.centerId) : (CENTERS.find(c => c.id === Store.s.profile.centerId) || CENTERS[0])),
  tags: () => ["all", Store.s.profile.deviceType, Store.s.profile.power],
  tips: () => TIPS.filter(t => t.tags.some(x => H.tags().includes(x))),
  tipOfDay: () => { const t = H.tips(); const i = Math.floor(Date.now() / 86400000) % t.length; return t[i]; },
  upcoming: () => Store.s.appointments.filter(a => !a.done && new Date(a.date) >= new Date(dayKey())).sort((a, b) => new Date(a.date) - new Date(b.date)),
  past: () => Store.s.appointments.filter(a => a.done || new Date(a.date) < new Date(dayKey())).sort((a, b) => new Date(b.date) - new Date(a.date)),
  adaptDay: () => Math.max(1, daysBetween(Store.s.profile.fittingDate, new Date()) + 1),
  maintenance: () => MAINTENANCE.filter(m => m.tags.some(x => H.tags().includes(x))).map(m => {
    const last = Store.s.maintenance[m.id] || Store.s.profile.fittingDate;
    const next = addDays(last, m.every);
    return { ...m, last, next, due: daysBetween(new Date(), next) };
  }),
  header: (title, back, extra = "") => `<div class="page-head">${back ? `<a class="icon-btn" href="${back}" aria-label="Retour">${icon("left")}</a>` : ""}<h1>${title}</h1>${extra}</div>`,
  deviceLabel: () => ({ ric: "Contour à écouteur déporté (RIC)", contour: "Contour classique", intra: "Intra-auriculaire" }[Store.s.profile.deviceType] || "Aide auditive"),
  powerLabel: () => Store.s.profile.power === "rechargeable" ? "Rechargeable" : "À piles"
};

var Views = window.Views = window.Views || {};

/* =============================== ÉCRAN DE SÉCURITÉ / CODE D'ACCÈS =============================== */
Views.lock = {
  noTabs: true,
  render() {
    return `
      <div class="lock-shell">
        <div class="card lock-card">
          <div class="brand-big center"><span class="brand-k">KRYS</span><span class="brand-a">AUDITION</span></div>
          <div class="lock-ico center">${icon("lock")}</div>
          <h2 class="center">Projet Confidentiel</h2>
          <p class="muted center">Cette application est un prototype réservé au réseau Krys Audition. Veuillez renseigner le code d'accès confidentiel pour déverrouiller l'accès.</p>

          <form data-form="lock" class="form mt-sm">
            <label>Code d'accès confidentiel
              <input type="text" name="code" id="lock-input" placeholder="Ex. : KRYS2026" autofocus autocomplete="off" required>
            </label>
            <button class="btn btn-primary btn-block btn-lg mt-xs">${icon("check")} Déverrouiller l'application</button>
            <div id="lock-err" class="note-box warn mt-sm" style="display:none;">
              ${icon("alert")}
              <div>Code incorrect. Veuillez vérifier ou contacter l'audioprothésiste.</div>
            </div>
          </form>

          <div class="note-box soft mt">
            ${icon("shield")}
            <div>
              <b>Accès sur invitation :</b><br>
              Pour obtenir un code d'accès, contactez <b>Benjamin Joseph COHEN</b>, audioprothésiste D.E. Cnam Paris (07 68 15 86 96 / binyamine555@gmail.com).
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

/* =============================== ONBOARDING =============================== */
let OB = { step: 0, data: null };
Views.welcome = {
  noTabs: true,
  render() {
    if (!OB.data) OB.data = JSON.parse(JSON.stringify({ profile: Store.s.profile, consent: Store.s.consent, audiogram: Store.s.audiogram }));
    const d = OB.data, st = OB.step;
    const dots = `<div class="ob-dots">${[0, 1, 2, 3, 4].map(i => `<span class="${i === st ? "on" : i < st ? "done" : ""}"></span>`).join("")}</div>`;
    if (st === 0) return `
      <div class="ob ob-hero">
        <div class="brand-big"><span class="brand-k">KRYS</span><span class="brand-a">AUDITION</span></div>
        <div class="ob-illu">${icon("ear")}</div>
        <h1>Mon Parcours Auditif</h1>
        <p class="lead">L'application qui vous accompagne au quotidien avec vos aides auditives.</p>
        <ul class="ob-list">
          <li>${icon("target")}<span><b>Entraînement auditif personnalisé</b>, gratuit, adapté à votre audiogramme</span></li>
          <li>${icon("tool")}<span><b>Conseils</b> d'utilisation, d'entretien et dépannage</span></li>
          <li>${icon("calendar")}<span><b>Rappels</b> de rendez-vous et de suivi</span></li>
          <li>${icon("pin")}<span><b>Votre centre</b> Krys Audition à portée de main</span></li>
        </ul>
        <button class="btn btn-primary btn-lg btn-block" data-action="ob-next">Commencer</button>
        <button class="btn btn-ghost btn-block" data-action="load-demo">${icon("play")} Découvrir avec un profil de démonstration</button>
        <p class="tiny">Prototype de démonstration – données stockées uniquement sur cet appareil.</p>
      </div>`;
    if (st === 1) return `
      <div class="ob">${dots}
        <h2>Faisons connaissance</h2>
        <form data-form="ob-profile" class="form">
          <label>Prénom<input name="firstName" required value="${esc(d.profile.firstName)}" autocomplete="given-name"></label>
          <label>Nom<input name="lastName" value="${esc(d.profile.lastName)}" autocomplete="family-name"></label>
          <label>Mon centre Krys Audition<select name="centerId">${CENTERS.map(c => `<option value="${c.id}" ${c.id === d.profile.centerId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
          <label>Date de mon appareillage<input type="date" name="fittingDate" value="${esc(d.profile.fittingDate)}" max="${dayKey()}"></label>
          <fieldset><legend>Type d'aides auditives</legend><div class="seg">
            ${[["ric", "Contour RIC"], ["contour", "Contour classique"], ["intra", "Intra"]].map(([v, l]) => `<label class="seg-i"><input type="radio" name="deviceType" value="${v}" ${d.profile.deviceType === v ? "checked" : ""}><span>${l}</span></label>`).join("")}
          </div></fieldset>
          <fieldset><legend>Alimentation</legend><div class="seg">
            ${[["rechargeable", "Rechargeable"], ["piles", "À piles"]].map(([v, l]) => `<label class="seg-i"><input type="radio" name="power" value="${v}" ${d.profile.power === v ? "checked" : ""}><span>${l}</span></label>`).join("")}
          </div></fieldset>
          <p class="tiny">Vous ne savez pas ? Votre audioprothésiste pourra compléter ces informations.</p>
          <div class="ob-actions"><button type="button" class="btn btn-ghost" data-action="ob-back">Retour</button><button class="btn btn-primary">Continuer</button></div>
        </form>
      </div>`;
    if (st === 2) return `
      <div class="ob">${dots}
        <h2>Vos données, votre choix</h2>
        <p>Pour personnaliser votre entraînement, l'application peut utiliser votre <b>audiogramme</b> (le résultat de votre test auditif). C'est une donnée de santé : elle n'est utilisée qu'avec votre accord.</p>
        <form data-form="ob-consent" class="form">
          <label class="check"><input type="checkbox" name="audiogram" ${d.consent.audiogram ? "checked" : ""}><span><b>J'accepte que mon audiogramme soit utilisé</b> pour adapter les exercices à mon audition.</span></label>
          <label class="check"><input type="checkbox" name="shareWithCenter" ${d.consent.shareWithCenter ? "checked" : ""}><span>J'accepte de <b>partager mes progrès</b> et mon journal d'adaptation avec mon audioprothésiste.</span></label>
          <label class="check"><input type="checkbox" name="notifications" ${d.consent.notifications ? "checked" : ""}><span>Je souhaite recevoir des <b>rappels</b> (rendez-vous, entraînement, entretien).</span></label>
          <div class="note-box soft">${icon("shield")}<div>Vous pouvez modifier ces choix à tout moment dans « Mon profil ». Aucune donnée n'est revendue. <a href="#" data-action="privacy">En savoir plus</a></div></div>
          <div class="ob-actions"><button type="button" class="btn btn-ghost" data-action="ob-back">Retour</button><button class="btn btn-primary">Continuer</button></div>
        </form>
      </div>`;
    if (st === 3) {
      if (!d.consent.audiogram) return `
        <div class="ob">${dots}
          <h2>Entraînement standard</h2>
          <div class="ob-illu small">${icon("activity")}</div>
          <p>Sans audiogramme, vous bénéficiez d'un programme équilibré qui s'adaptera <b>automatiquement à vos résultats</b> au fil des séances.</p>
          <p class="muted">Vous pourrez ajouter votre audiogramme plus tard depuis « Mon audition ».</p>
          <div class="ob-actions"><button type="button" class="btn btn-ghost" data-action="ob-back">Retour</button><button class="btn btn-primary" data-action="ob-next">Continuer</button></div>
        </div>`;
      return `
        <div class="ob">${dots}
          <h2>Votre audiogramme</h2>
          <p>Votre audioprothésiste peut vous le transmettre en un instant.</p>
          <button class="option-card" data-action="ob-qr">${icon("qr")}<span><b>Scanner le QR code</b><small>remis par votre centre Krys Audition</small></span>${icon("right")}</button>
          <button class="option-card" data-action="ob-manual">${icon("edit")}<span><b>Saisir mon audiogramme</b><small>à partir de mon compte-rendu</small></span>${icon("right")}</button>
          ${d.audiogram ? `<div class="card mt">${Audiogram.render(d.audiogram, { height: 240 })}<p class="center tiny">${icon("check")} Audiogramme enregistré (${esc(d.audiogram.source || "")})</p></div>` : ""}
          <div class="ob-actions"><button type="button" class="btn btn-ghost" data-action="ob-back">Retour</button><button class="btn btn-primary" data-action="ob-next">${d.audiogram ? "Continuer" : "Plus tard"}</button></div>
        </div>`;
    }
    if (st === 4) return `
      <div class="ob">${dots}
        <h2>Test d'écoute</h2>
        <p>Mettez vos aides auditives, puis touchez le bouton. Réglez le volume du téléphone pour entendre la voix <b>confortablement</b>.</p>
        <button class="play-btn big" data-action="test-voice">${icon("volume")}</button>
        <label class="form">Vitesse de la voix
          <input type="range" min="0.7" max="1.1" step="0.05" value="${Store.s.settings.rate || 0.9}" data-action-input="rate"></label>
        <div class="note-box soft">${icon("headphones")}<div>Si vos aides sont connectées en Bluetooth, le son sera transmis directement dans vos oreilles.</div></div>
        <div class="ob-actions"><button type="button" class="btn btn-ghost" data-action="ob-back">Retour</button><button class="btn btn-primary" data-action="ob-finish">C'est parti !</button></div>
      </div>`;
  }
};

/* ================================= ACCUEIL ================================ */
Views.home = {
  tab: "home",
  render() {
    const s = Store.s, p = s.profile;
    const prog = Training.program(), doneN = prog.filter(i => i.done).length;
    const nxt = Training.nextInProgram();
    const streak = Training.streak();
    const appt = H.upcoming()[0];
    const tip = H.tipOfDay();
    const dueMaint = H.maintenance().filter(m => m.due <= 3);
    const lastJ = s.journal[s.journal.length - 1];
    const needJournal = !lastJ || daysBetween(lastJ.date, new Date()) >= 7;
    const unread = s.messages.filter(m => m.from === "centre").slice(-1)[0];
    const hour = new Date().getHours();
    const hello = hour < 18 ? "Bonjour" : "Bonsoir";
    const day = H.adaptDay();
    const unlockedBadges = KRYS_BADGES.filter(b => b.check(s)).length;
    return `
      <section class="hello">
        <div><p class="muted">${fmtDate(new Date())}</p><h1>${hello}${p.firstName ? " " + esc(p.firstName) : ""} 👋</h1>
        <p class="muted">${day <= 120 ? `Jour <b>${day}</b> de votre adaptation` : "Merci de votre fidélité"}</p></div>
        ${streak ? `<div class="streak" title="Jours d'affilée">${icon("zap")}<b>${streak}</b><small>jour${streak > 1 ? "s" : ""}</small></div>` : ""}
      </section>

      <!-- BADGES & RÉCOMPENSES KRYS ACCUEIL -->
      <a class="card badge-hero-card" href="#/progress">
        <div class="bh-left">
          <div class="bh-icon">${icon("award")}</div>
          <div>
            <b>${unlockedBadges} / ${KRYS_BADGES.length} Badges Krys Débloqués</b>
            <p class="tiny muted">${unlockedBadges >= 4 ? "Excellente assiduité dans votre rééducation !" : "Continuez vos séances régulières pour vos récompenses."}</p>
          </div>
        </div>
        <span class="pill">${icon("right")}</span>
      </a>

      <section class="card hero">
        <div class="hero-top"><div><p class="eyebrow">Entraînement du jour</p><h2>${doneN === 3 ? "Programme terminé ✔" : `${doneN}/3 exercices`}</h2></div>
          <div class="ring" style="--p:${Math.round(doneN / 3 * 100)}"><span>${icon(doneN === 3 ? "check" : "target")}</span></div></div>
        <div class="mini-steps">${prog.map(i => `<span class="${i.done ? "done" : ""}">${icon(i.done ? "check" : Training.EX[i.ex].icon)} ${Training.EX[i.ex].name}</span>`).join("")}</div>
        ${nxt ? `<a class="btn btn-light btn-block" href="#/exercise/${nxt.ex}">${icon("play")} ${doneN ? "Continuer" : "Commencer"} · ~${Training.EX[nxt.ex].minutes} min</a>` : `<a class="btn btn-light btn-block" href="#/progress">${icon("chart")} Voir mes progrès</a>`}
      </section>

      <!-- NOUVEAU : SIMULATEUR SONORE D'IMMERSION KRYS -->
      <a class="card feature-card-soundscape" href="#/soundscapes">
        <div class="card-head-row">
          <div class="sc-badge-title">
            <span class="pill-red">Nouveau</span>
            <b>Simulateur Sonore d'Immersion</b>
          </div>
          <span class="pill ok">Interactif 🔊</span>
        </div>
        <p class="muted">Entraînez-vous au restaurant, dans la rue ou en cuisine avec nos 4 ambiances calibrées en direct.</p>
        <span class="link small">Lancer une immersion sonore ${icon("right")}</span>
      </a>

      <!-- PASSEPORT AUDITIF & BILAN ORL -->
      <a class="card feature-card-passport" href="#/passport">
        <div class="card-head-row">
          <div class="sc-badge-title">
            <div class="avatar navy">${icon("shield")}</div>
            <div>
              <b>Mon Passeport Auditif Krys</b>
              <p class="tiny muted">Attestation d'observance & bilan pour le médecin ORL</p>
            </div>
          </div>
          ${icon("right")}
        </div>
      </a>

      ${appt ? `<a class="card row-card" href="#/centre">
          <div class="date-chip"><b>${new Date(appt.date).getDate()}</b><small>${MONTHS[new Date(appt.date).getMonth()]}</small></div>
          <div class="grow"><p class="eyebrow">Prochain rendez-vous · ${relDays(appt.date)}</p><b>${esc(APPT_TYPES[appt.type])}</b><p class="muted">${fmtTime(appt.date)} · ${esc(H.center().name.replace(" (démo)", ""))}</p></div>${icon("right")}</a>` : ""}

      ${unread ? `<a class="card row-card msg-card" href="#/messages"><div class="avatar">${icon("message")}</div><div class="grow"><p class="eyebrow">Message de votre centre</p><p class="clamp2">${esc(unread.text)}</p></div>${icon("right")}</a>` : ""}

      ${dueMaint.length ? `<a class="card row-card warn" href="#/care"><div class="avatar warn">${icon("tool")}</div><div class="grow"><p class="eyebrow">Entretien</p><b>${esc(dueMaint[0].label)}</b><p class="muted">${dueMaint[0].due < 0 ? "En retard de " + -dueMaint[0].due + " j" : dueMaint[0].due === 0 ? "Aujourd'hui" : "Dans " + dueMaint[0].due + " j"}</p></div>${icon("right")}</a>` : ""}

      ${needJournal ? `<a class="card row-card" href="#/journal"><div class="avatar teal">${icon("smile")}</div><div class="grow"><p class="eyebrow">Journal d'adaptation</p><b>Comment entendez-vous cette semaine ?</b><p class="muted">1 minute · partagé avec votre audioprothésiste</p></div>${icon("right")}</a>` : ""}

      <section class="card tip-card">
        <p class="eyebrow">${icon("info")} Conseil du jour · ${TIP_CATEGORIES[tip.cat]}</p>
        <h3>${esc(tip.title)}</h3><p>${esc(tip.body)}</p>
        <a href="#/care" class="link">Tous les conseils ${icon("right")}</a>
      </section>

      <!-- ACCÈS RAPIDES EN 8 MODULES CLÉS -->
      <section class="quick eight">
        <a href="#/hearing" class="q">${icon("ear")}<span>Bilan Tonal & Vocal</span></a>
        <a href="#/soundscapes" class="q">${icon("volume")}<span>Simulateur Sonore</span></a>
        <a href="#/passport" class="q">${icon("award")}<span>Passeport Auditif</span></a>
        <a href="#/calibration" class="q">${icon("sliders")}<span>Étalonner mon mobile</span></a>
        <a href="#/centers" class="q">${icon("pin")}<span>Centres France</span></a>
        <a href="#/anamnesis" class="q">${icon("book")}<span>Mon Anamnèse</span></a>
        <a href="#/pro" class="q">${icon("briefcase")}<span>Espace Pro D.E.</span></a>
        <a href="#/troubleshoot/start" class="q">${icon("alert")}<span>Dépannage SOS</span></a>
      </section>

      <!-- SYNERGIE KRYS OPTIQUE & AUDITION -->
      <section class="card synergy-card">
        <div class="synergy-head">
          <div class="synergy-ico">${icon("glasses")}</div>
          <div class="grow">
            <b>Privilège Krys : Optique & Audition</b>
            <p class="tiny muted">1 contrôle visuel + auditif offert chaque année dans votre réseau Krys.</p>
          </div>
          <a href="#/discover" class="btn btn-sm btn-ghost">Voir</a>
        </div>
      </section>

      <!-- BOUTON DÉMO POUR PRÉSENTATION DIRECTION -->
      <div class="demo-bar mt-sm center">
        <button class="btn btn-xs btn-ghost" data-action="load-demo-profile">${icon("replay")} ${s.demo ? "Réinitialiser profil démo" : "Charger profil patient type (démo)"}</button>
      </div>`;
  }
};

/* =============================== S'ENTRAÎNER ============================== */
Views.train = {
  tab: "train",
  render() {
    const a = Training.analysis();
    const prog = Training.program();
    const st = Training.stats();
    const focus = Training.focusCats(3);
    return `
      ${H.header("S'entraîner", null, `<a class="icon-btn" href="#/progress" aria-label="Progrès">${icon("chart")}</a>`)}
      <section class="card perso">
        <div class="perso-h">${icon("target")}<div><p class="eyebrow">Programme personnalisé</p>
        <b>${a ? `${esc(a.severity.label)} · ${esc(a.shape.label.split("(")[0].trim().toLowerCase())}` : "Adapté à vos résultats"}</b></div></div>
        <p class="muted">${a ? "Basé sur votre audiogramme et vos réponses aux exercices." : `<a href="#/hearing" class="link">Ajoutez votre audiogramme</a> pour un programme encore plus précis.`}</p>
        <div class="chips">${focus.map(c => `<span class="chip">${CATEGORIES[c].short}</span>`).join("")}</div>
      </section>

      <!-- SIMULATEUR SONORE ACCÈS RAPIDE -->
      <a class="card row-card feature-train-soundscape" href="#/soundscapes">
        <div class="avatar navy">${icon("volume")}</div>
        <div class="grow">
          <p class="eyebrow">Entraînement en situation réelle</p>
          <b>Simulateur d'Environnements Krys</b>
          <p class="muted">Habituez vos aides et votre cerveau aux 4 bruits types du quotidien.</p>
        </div>
        ${icon("right")}
      </a>

      <h3 class="sec">Aujourd'hui</h3>
      <div class="list">${prog.map((i, k) => {
        const e = Training.EX[i.ex];
        return `<a class="list-item ${i.done ? "done" : ""}" href="#/exercise/${i.ex}">
          <div class="li-ico">${icon(i.done ? "check" : e.icon)}</div>
          <div class="grow"><b>${k + 1}. ${e.name}</b><small>${esc(i.why)}</small></div>
          <span class="pill">${i.done ? "Fait" : "~" + e.minutes + " min"}</span></a>`;
      }).join("")}</div>

      <div class="kpis">
        <div class="kpi"><b>${Training.streak()}</b><small>jours d'affilée</small></div>
        <div class="kpi"><b>${st.weekDays}/7</b><small>jours cette semaine</small></div>
        <div class="kpi"><b>${st.minutes}</b><small>minutes au total</small></div>
      </div>

      <h3 class="sec">Tous les exercices</h3>
      <div class="list">${Object.values(Training.EX).map(e => {
        const lvl = ["words", "digits"].includes(e.id) ? "RSB " + Training.fmtSnr(Training.getSnr(e.id)) : e.id === "memory" ? (Training.getLevel(e.id) + 1) + " mots" : "Niveau " + Training.getLevel(e.id) + "/6";
        return `<a class="list-item" href="#/exercise/${e.id}"><div class="li-ico">${icon(e.icon)}</div>
          <div class="grow"><b>${e.name}</b><small>${e.skill}</small></div><span class="pill soft">${lvl}</span></a>`;
      }).join("")}</div>

      <div class="note-box soft mt">${icon("info")}<div><b>Pourquoi s'entraîner ?</b> Les aides auditives rendent les sons audibles ; l'entraînement aide le cerveau à les <b>interpréter</b>. 10 à 15 minutes par jour, surtout pendant les premiers mois, favorisent une adaptation plus rapide.</div></div>`;
  }
};

/* ================================ EXERCICE ================================ */
let currentRunner = null;
Views.exercise = {
  noTabs: true,
  render() { return `<div id="ex-root"></div>`; },
  mount(id) {
    if (!Training.EX[id]) { location.hash = "#/train"; return; }
    currentRunner = Training.run(id, document.getElementById("ex-root"), { onExit: () => { location.hash = "#/train"; } });
  },
  unmount() { if (currentRunner) { currentRunner.stop(); currentRunner = null; } }
};

/* ================================ PROGRÈS ================================= */
Views.progress = {
  tab: "train",
  render() {
    const s = Store.s, st = Training.stats();
    const srt = st.srt.slice(-15), words = st.words.slice(-15);
    const first = srt[0], last = srt[srt.length - 1];
    const gain = first && last && srt.length > 1 ? first.v - last.v : null;
    return `
      ${H.header("Mes progrès & Évolution", "#/train")}
      <div class="kpis four">
        <div class="kpi"><b>${st.total}</b><small>exercices</small></div>
        <div class="kpi"><b>${st.minutes}</b><small>minutes</small></div>
        <div class="kpi"><b>${st.days28}</b><small>jours actifs / 28</small></div>
        <div class="kpi"><b>${Training.streak()}</b><small>série (j)</small></div>
      </div>

      <!-- SEUIL DANS LE BRUIT AVEC EXPLICATION PATIENT -->
      <section class="card">
        <div class="card-head-row">
          <h3>Compréhension dans le bruit (Évolution)</h3>
          ${gain !== null && gain > 0 ? `<span class="pill ok">+${gain.toFixed(1)} dB gagnés</span>` : ""}
        </div>
        <p class="muted">Mesure de votre seuil critique RSB (dB) au fil des semaines. <b>Plus la courbe descend, plus votre cerveau tolère le bruit pour comprendre la parole.</b></p>
        ${Charts.line(srt, { unit: " dB", invert: false, empty: "Faites l'exercice « Chiffres dans le bruit » pour suivre votre courbe." })}
        ${gain !== null && gain > 0 ? `
          <div class="note-box success mt-sm">
            ${icon("award")}
            <div>
              <b>Progrès concret de +${gain.toFixed(1)} dB RSB</b><br>
              En psychoacoustique, un gain de 3 dB correspond à une division par deux de l'énergie sonore nécessaire. Cela signifie que vous comprenez désormais vos interlocuteurs dans des environnements deux fois plus bruyants qu'au début de votre appareillage !
            </div>
          </div>
        ` : `
          <div class="note-box soft mt-sm">
            ${icon("info")}
            <div>Chaque séance stimule la neuroplasticité de votre cortex auditif. La progression dans le bruit se consolide généralement entre la 3e et la 8e semaine.</div>
          </div>
        `}
      </section>

      <!-- RADAR PHONÉTIQUE -->
      <section class="card">
        <div class="card-head-row">
          <h3>Radar de Discrimination Phonétique</h3>
          <span class="pill">5 Axes</span>
        </div>
        <p class="muted">Équilibre de votre perception sur les différentes caractéristiques acoustiques des sons de la parole.</p>
        <div class="center">${Charts.radar(st.catAcc, { width: 290, height: 230 })}</div>
        <div class="mt-sm">${Charts.bars(Object.entries(CATEGORIES).map(([k, c]) => ({ label: c.short, v: st.catAcc[k] })))}</div>
      </section>

      <!-- ASSIDUITÉ 28 JOURS -->
      <section class="card">
        <h3>Régularité d'entraînement (28 derniers jours)</h3>
        <p class="muted">La régularité (5 à 10 min par jour) est beaucoup plus efficace qu'une longue séance hebdomadaire.</p>
        ${Charts.heat(s.training.sessions)}
      </section>

      <!-- HISTORIQUE RÉCENT -->
      <section class="card">
        <h3>Dernières séances effectuées</h3>
        <div class="hist">
          ${s.training.sessions.slice(-10).reverse().map(x => `
            <div class="hist-i">
              <span>${icon(Training.EX[x.ex]?.icon || "activity")}</span>
              <div class="grow">
                <b>${Training.EX[x.ex]?.name || "Exercice"}</b>
                <small>${fmtShort(x.date)} · ${fmtTime(x.date)}</small>
              </div>
              <span class="pill ${x.score >= 0.8 ? "ok" : ""}">${x.srt !== undefined ? Training.fmtSnr(x.srt) : Math.round(x.score * 100) + "%"}</span>
            </div>
          `).join("") || `<p class="muted">Aucun exercice pour l'instant.</p>`}
        </div>
      </section>

      <!-- BADGES & RÉCOMPENSES KRYS -->
      <section class="card">
        <div class="card-head-row">
          <h3>Mes Badges & Récompenses Krys</h3>
          <span class="pill ok">${KRYS_BADGES.filter(b => b.check(s)).length} / ${KRYS_BADGES.length} Débloqués</span>
        </div>
        <p class="muted">Chaque étape clé de votre adaptation auditive est récompensée.</p>
        <div class="badge-grid mt-sm">
          ${KRYS_BADGES.map(b => {
            const unlocked = b.check(s);
            return `
              <div class="badge-item ${unlocked ? "unlocked" : "locked"}">
                <div class="badge-ico">${icon(b.icon)}</div>
                <b>${esc(b.name)}</b>
                <small>${esc(b.desc)}</small>
                <span class="badge-status">${unlocked ? "Obtenu ✔" : "À débloquer"}</span>
              </div>
            `;
          }).join("")}
        </div>
      </section>

      <!-- PASSEPORT AUDITIF ACCÈS RAPIDE -->
      <a class="btn btn-primary btn-block btn-lg mt" href="#/passport">
        ${icon("award")} Consulter mon Passeport Auditif Krys
      </a>
    `;
  }
};

/* ============================== MON AUDITION ============================== */
Views.hearing = {
  render() {
    const s = Store.s;
    if (!s.consent.audiogram) return `${H.header("Mon audition", "#/home")}
      <section class="card center"><div class="ob-illu small">${icon("lock")}</div><h3>Audiogramme non utilisé</h3>
      <p>Vous n'avez pas autorisé l'utilisation de votre audiogramme. En l'activant, vos exercices seront adaptés à votre profil auditif.</p>
      <button class="btn btn-primary" data-action="enable-audiogram">Autoriser et ajouter mon audiogramme</button></section>`;
    if (!s.audiogram) return `${H.header("Mon audition", "#/home")}
      <section class="card center"><div class="ob-illu small">${icon("ear")}</div><h3>Aucun audiogramme</h3><p>Ajoutez votre audiogramme pour personnaliser votre entraînement.</p>
      <a class="btn btn-primary" href="#/audiogram-edit">Ajouter mon audiogramme</a></section>`;

    const a = Audiogram.analyze(s.audiogram);
    const ptaR = ClinicalEngine.calcPta(s.audiogram.right);
    const ptaL = ClinicalEngine.calcPta(s.audiogram.left);
    const biapR = ClinicalEngine.classifyBiap(ptaR);
    const biapL = ClinicalEngine.classifyBiap(ptaL);
    const morphR = ClinicalEngine.detectMorphology(s.audiogram.right);
    const hearingType = ClinicalEngine.detectHearingType(s.audiogram.right, s.audiogram.voRight);
    const siiR = ClinicalEngine.estimateSII(s.audiogram.right);

    // Vocal analysis
    const vocalRight = s.speechAudiogram ? s.speechAudiogram.right : [{ db: 25, pct: 0 }, { db: 40, pct: 30 }, { db: 55, pct: 80 }, { db: 70, pct: 100 }];
    const vocalLeft = s.speechAudiogram ? s.speechAudiogram.left : [{ db: 30, pct: 0 }, { db: 45, pct: 20 }, { db: 60, pct: 75 }, { db: 75, pct: 95 }];
    const vocalAnalysis = ClinicalEngine.analyzeSpeechAudiometry(vocalRight);

    // Speech in noise
    const sinMeasured = s.speechInNoise ? s.speechInNoise.snr50 : 1.5;
    const sinAnalysis = ClinicalEngine.analyzeSpeechInNoise(sinMeasured);

    // Patient explanation cards
    const explanations = ClinicalEngine.generatePatientExplanation(
      { shape: morphR, severity: biapR },
      vocalAnalysis,
      sinAnalysis,
      s.anamnesis
    );

    return `
      ${H.header("Mon audition & Bilans", "#/home", `<a class="icon-btn" href="#/audiogram-edit" aria-label="Modifier">${icon("edit")}</a>`)}

      <!-- 1. AUDIOGRAMME TONAL LIMINAIRE -->
      <section class="card">
        <div class="card-head-row">
          <h3>Audiométrie Tonale (Liminaire)</h3>
          <span class="pill">${esc(morphR.label.split("(")[0].trim())}</span>
        </div>
        <div class="ag-legend">
          <span><i class="o"></i> Oreille droite</span>
          <span><i class="x">✕</i> Oreille gauche</span>
          <span><i class="ban"></i> Banane de la parole</span>
        </div>
        ${Audiogram.render(s.audiogram)}
        <div class="ears mt">
          <div class="ear r">
            <small>Oreille droite</small>
            <b>${ptaR !== null ? Math.round(ptaR) + " dB" : "—"}</b>
            <span>${biapR.label}</span>
          </div>
          <div class="ear l">
            <small>Oreille gauche</small>
            <b>${ptaL !== null ? Math.round(ptaL) + " dB" : "—"}</b>
            <span>${biapL.label}</span>
          </div>
        </div>
        <p class="muted mt-sm"><b>Type :</b> ${esc(hearingType.label)} · ${esc(hearingType.desc)}</p>
        ${siiR !== null ? `<div class="note-box soft mt-sm">${icon("activity")}<div><b>Indice d'Intelligibilité Vocale estimé (SII) : ${siiR}%</b><br><small>Sans appareil, environ ${siiR}% des informations acoustiques de la parole sont audibles au calme.</small></div></div>` : ""}
      </section>

      <!-- 2. AUDIOMÉTRIE VOCALE (PAROLE DANS LE SILENCE) -->
      <section class="card">
        <div class="card-head-row">
          <h3>Audiométrie Vocale (Dans le silence)</h3>
          <span class="pill ${vocalAnalysis && vocalAnalysis.hasRollOff ? "warn" : "ok"}">${vocalAnalysis ? (vocalAnalysis.hasRollOff ? "Distorsion Roll-Off" : "PB-Max " + vocalAnalysis.pbMax + "%") : "Fournier"}</span>
        </div>
        <p class="muted">Courbe d'intelligibilité des mots de Fournier (% de mots reconnus selon le volume en dB).</p>
        ${Charts.speechCurve(vocalRight, vocalLeft, { height: 210 })}
        ${vocalAnalysis ? `
          <div class="kpis three mt-sm">
            <div class="kpi"><b>${vocalAnalysis.sdt} dB</b><small>Seuil détection</small></div>
            <div class="kpi"><b>${vocalAnalysis.srt} dB</b><small>Seuil 50% (SRT)</small></div>
            <div class="kpi"><b>${vocalAnalysis.pbMax}%</b><small>Score maximal</small></div>
          </div>
          <p class="tiny mt-sm">${esc(vocalAnalysis.desc)}</p>
        ` : ""}
      </section>

      <!-- 3. TEST DE LA PAROLE DANS LE BRUIT (SIN / DIN / MATRIX) -->
      <section class="card">
        <div class="card-head-row">
          <h3>Compréhension dans le Bruit (SNR / DIN)</h3>
          <span class="pill ${sinAnalysis && sinAnalysis.classification === "excellent" ? "ok" : "warn"}">${sinAnalysis ? sinAnalysis.classification : "Adaptatif"}</span>
        </div>
        <div class="measure">
          <div class="measure-v">${Training.fmtSnr(sinAnalysis.snrVal)}</div>
          <div>
            <b>${esc(sinAnalysis.title)}</b><br>
            <small>Perte en rapport signal/bruit (SNR Loss) : <b>+${sinAnalysis.snrLoss} dB</b> par rapport à un sujet normo-entendant.</small>
          </div>
        </div>
        <div class="note-box soft mt-sm">
          ${icon("volume")}
          <div>${esc(sinAnalysis.advice)}</div>
        </div>
      </section>

      <!-- 4. EXPLICATIONS CLINIQUES & PÉDAGOGIQUES POUR LE PATIENT -->
      <section class="card">
        <div class="card-head-row">
          <h3>Pourquoi ce programme vous est recommandé ?</h3>
          ${icon("award")}
        </div>
        <p class="muted">Explications personnalisées rédigées par nos audioprothésistes diplômés selon votre bilan complet.</p>
        <div class="explanations-list mt-sm">
          ${explanations.map(exp => `
            <div class="exp-item">
              <div class="exp-ico">${icon(exp.icon)}</div>
              <div>
                <b>${esc(exp.title)}</b>
                <p>${esc(exp.text)}</p>
              </div>
            </div>
          `).join("")}
        </div>
      </section>

      <!-- 5. ANAMNÈSE COMPLÉMENTAIRE RGPD -->
      <section class="card">
        <div class="card-head-row">
          <h3>Mon Anamnèse & Historique Médical</h3>
          <span class="pill soft">RGPD Conforme</span>
        </div>
        <p>Vos antécédents et habitudes de vie permettent d'affiner encore plus vos exercices quotidiens.</p>
        <a class="btn btn-ghost btn-block mt-sm" href="#/anamnesis">${icon("book")} ${s.anamnesis ? "Consulter / Modifier mon anamnèse" : "Remplir le questionnaire facultatif"}</a>
      </section>
    `;
  }
};

/* ========================== SAISIE AUDIOGRAMME =========================== */
let AG_DRAFT = null;
Views["audiogram-edit"] = {
  render(param) {
    const fromOb = param === "ob";
    if (!AG_DRAFT) AG_DRAFT = JSON.parse(JSON.stringify((fromOb ? OB.data.audiogram : Store.s.audiogram) || { right: {}, left: {}, date: dayKey(), source: "Saisie manuelle" }));
    const opts = v => `<option value="">–</option>` + Array.from({ length: 27 }, (_, i) => -10 + i * 5).map(db => `<option ${Number(v) === db && v !== "" && v !== undefined && v !== null ? "selected" : ""}>${db}</option>`).join("");
    return `
      ${H.header("Saisir l'audiogramme", fromOb ? "#/welcome" : "#/hearing")}
      <section class="card"><div id="ag-preview">${Audiogram.render(AG_DRAFT, { height: 230 })}</div></section>
      <section class="card">
        <label class="form">Exemple (démo)<select data-action-input="ag-preset"><option value="">Choisir un profil type…</option>${Object.entries(AUDIOGRAM_PRESETS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("")}</select></label>
        <table class="ag-table"><thead><tr><th>Hz</th><th class="r">Droite (dB)</th><th class="l">Gauche (dB)</th></tr></thead><tbody>
        ${AUDIO_FREQS.map(f => `<tr><td>${f}</td><td><select data-ear="right" data-f="${f}" data-action-input="ag-cell">${opts(AG_DRAFT.right[f])}</select></td><td><select data-ear="left" data-f="${f}" data-action-input="ag-cell">${opts(AG_DRAFT.left[f])}</select></td></tr>`).join("")}
        </tbody></table>
        <label class="form">Date de l'audiogramme<input type="date" value="${esc(AG_DRAFT.date || dayKey())}" data-action-input="ag-date"></label>
        <button class="btn btn-primary btn-block" data-action="ag-save" data-from="${fromOb ? "ob" : ""}">Enregistrer</button>
      </section>`;
  },
  unmount() { AG_DRAFT = null; }
};

/* ============================== MES APPAREILS ============================= */
Views.care = {
  tab: "care",
  render() {
    const day = H.adaptDay();
    const stages = [
      { from: 1, to: 14, t: "Semaines 1–2 : découverte", d: "Portez vos aides chaque jour, d'abord au calme. Les sons paraissent forts : c'est normal." },
      { from: 15, to: 30, t: "Semaines 3–4 : habituation", d: "Augmentez la durée de port. Abordez les situations plus bruyantes. Notez vos difficultés dans le journal." },
      { from: 31, to: 90, t: "Mois 2–3 : stabilisation", d: "Le cerveau s'est habitué. Les réglages fins se font avec votre audioprothésiste." },
      { from: 91, to: 99999, t: "Au-delà : suivi", d: "Entretien tous les 6 mois et bilan annuel pour garder une écoute optimale." }
    ];
    const maint = H.maintenance();
    const byCat = {};
    H.tips().forEach(t => { (byCat[t.cat] = byCat[t.cat] || []).push(t); });
    return `
      ${H.header("Mes appareils")}
      <section class="card device">
        <div class="device-ico">${icon("ear")}</div>
        <div class="grow"><b>${H.deviceLabel()}</b><small>${H.powerLabel()} · appareillé(e) le ${fmtDate(Store.s.profile.fittingDate, false)}</small></div>
        <a href="#/profile" class="icon-btn">${icon("edit")}</a>
      </section>

      <a class="card row-card warn" href="#/troubleshoot/start"><div class="avatar warn">${icon("alert")}</div><div class="grow"><b>Un problème avec mes aides ?</b><p class="muted">Dépannage guidé pas à pas</p></div>${icon("right")}</a>

      <!-- CONSEIL DUO LUNETTES & APPAREILS AUDITIFS -->
      <section class="card synergy-card">
        <div class="synergy-head">
          <div class="synergy-ico">${icon("glasses")}</div>
          <div class="grow">
            <b>Le Duo Confort : Lunettes & Aides Auditives</b>
            <p class="tiny muted">Chaussage sans frottement : enfilez toujours vos aides auditives en premier, puis glissez les branches de lunettes par-dessus vers l'extérieur de l'oreille.</p>
          </div>
        </div>
      </section>

      <section class="card"><h3>Mon parcours d'adaptation</h3>
        <div class="timeline">${stages.map(s => { const cur = day >= s.from && day <= s.to, past = day > s.to; return `<div class="tl ${cur ? "cur" : past ? "past" : ""}"><span class="tl-dot">${past ? icon("check") : ""}</span><div><b>${s.t}</b>${cur ? `<span class="pill">Vous êtes ici · jour ${day}</span>` : ""}<p>${s.d}</p></div></div>`; }).join("")}</div>
      </section>

      <section class="card"><h3>Rappels d'entretien</h3>
        ${maint.map(m => `<div class="maint ${m.due < 0 ? "late" : m.due <= 3 ? "soon" : ""}"><div class="grow"><b>${m.label}</b><small>Tous les ${m.every} jours · ${m.due < 0 ? "en retard de " + -m.due + " j" : m.due === 0 ? "aujourd'hui" : "dans " + m.due + " j"}</small></div><button class="btn btn-sm ${m.due <= 3 ? "btn-primary" : "btn-ghost"}" data-action="maint-done" data-id="${m.id}">${icon("check")} Fait</button></div>`).join("")}
      </section>

      <h3 class="sec">Conseils</h3>
      ${Object.entries(byCat).map(([cat, list]) => `
        <details class="card acc" ${cat === "adaptation" && day <= 30 ? "open" : ""}><summary><b>${TIP_CATEGORIES[cat]}</b><span class="pill soft">${list.length}</span></summary>
          ${list.map(t => `<a class="tip-link ${Store.s.readTips.includes(t.id) ? "read" : ""}" href="#/tip/${t.id}">${icon(Store.s.readTips.includes(t.id) ? "check" : "book")}<span>${esc(t.title)}</span>${icon("right")}</a>`).join("")}
        </details>`).join("")}`;
  }
};

Views.tip = {
  tab: "care",
  render(id) {
    const t = TIPS.find(x => x.id === id); if (!t) return H.header("Conseil", "#/care");
    if (!Store.s.readTips.includes(id)) Store.update(s => s.readTips.push(id));
    const related = H.tips().filter(x => x.cat === t.cat && x.id !== id).slice(0, 3);
    return `${H.header(TIP_CATEGORIES[t.cat], "#/care")}
      <article class="card article"><h2>${esc(t.title)}</h2><p>${esc(t.body)}</p>
        <div class="video-ph">${icon("play")}<span>Tutoriel vidéo (à produire avec le réseau)</span></div>
        <button class="btn btn-ghost btn-sm" data-action="read-aloud" data-text="${esc(t.title + ". " + t.body)}">${icon("volume")} Écouter ce conseil</button>
      </article>
      ${related.length ? `<h3 class="sec">À lire aussi</h3><div class="list">${related.map(r => `<a class="list-item" href="#/tip/${r.id}"><div class="li-ico">${icon("book")}</div><div class="grow"><b>${esc(r.title)}</b></div>${icon("right")}</a>`).join("")}</div>` : ""}`;
  }
};

Views.troubleshoot = {
  tab: "care",
  render(nodeId = "start") {
    const parts = String(nodeId).split(":");
    const node = TROUBLESHOOT[parts[0]];
    if (parts[1] !== undefined) {
      const opt = node.options[Number(parts[1])];
      return `${H.header("Dépannage", "#/troubleshoot/start")}
        <section class="card center"><div class="ob-illu small ${opt.contact ? "warn" : ""}">${icon(opt.contact ? "phone" : "tool")}</div>
        <h3>${opt.contact ? "Contactez votre centre" : "Essayez ceci"}</h3><p>${esc(opt.end)}</p>
        ${opt.contact ? `<a class="btn btn-primary btn-block" href="tel:${H.center().phone.replace(/\s/g, "")}">${icon("phone")} Appeler ${esc(H.center().name.replace(" (démo)", ""))}</a><a class="btn btn-ghost btn-block" href="#/book">${icon("calendar")} Prendre rendez-vous</a>` : `<a class="btn btn-primary btn-block" href="#/care">${icon("check")} Problème résolu</a><a class="btn btn-ghost btn-block" href="#/messages">Toujours un souci ? Écrire au centre</a>`}
        </section>`;
    }
    return `${H.header("Dépannage", parts[0] === "start" ? "#/care" : "#/troubleshoot/start")}
      <section class="card"><h3>${esc(node.q)}</h3>
      <div class="list">${node.options.map((o, i) => `<a class="list-item" href="#/troubleshoot/${o.next || parts[0] + ":" + i}"><div class="grow"><b>${esc(o.label)}</b></div>${icon("right")}</a>`).join("")}</div></section>`;
  }
};

/* ================================ MON CENTRE ============================== */
Views.centre = {
  tab: "centre",
  render() {
    const c = H.center(), up = H.upcoming(), past = H.past().slice(0, 4);
    const fit = Store.s.profile.fittingDate;
    return `
      ${H.header("Mon centre")}
      <section class="card centre-card">
        <div class="centre-map">${icon("pin")}</div>
        <h2>${esc(c.name)}</h2>
        <p class="muted">${esc(c.address)}</p>
        <p>${icon("user")} Votre audioprothésiste : <b>${esc(c.audiologist)}</b></p>
        <div class="actions4">
          <a href="tel:${c.phone.replace(/\s/g, "")}" class="act">${icon("phone")}<span>Appeler</span></a>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}" target="_blank" rel="noopener" class="act">${icon("pin")}<span>Itinéraire</span></a>
          <a href="#/messages" class="act">${icon("message")}<span>Message</span></a>
          <a href="#/book" class="act">${icon("calendar")}<span>Rendez-vous</span></a>
        </div>
        <details><summary>${icon("clock")} Horaires</summary><table class="hours">${c.hours.map(([d, h]) => `<tr><td>${d}</td><td>${h}</td></tr>`).join("")}</table></details>
      </section>

      <h3 class="sec">Mes rendez-vous <a href="#/book" class="link small">${icon("plus")} Ajouter</a></h3>
      ${up.length ? `<div class="list">${up.map(a => `<div class="list-item"><div class="date-chip sm"><b>${new Date(a.date).getDate()}</b><small>${MONTHS[new Date(a.date).getMonth()]}</small></div>
        <div class="grow"><b>${esc(APPT_TYPES[a.type])}</b><small>${fmtDate(a.date)} · ${fmtTime(a.date)} · ${relDays(a.date)}</small>${a.note ? `<small>${esc(a.note)}</small>` : ""}</div>
        <button class="icon-btn" data-action="ics" data-id="${a.id}" title="Ajouter à mon agenda">${icon("download")}</button>
        <button class="icon-btn" data-action="appt-del" data-id="${a.id}" title="Supprimer">${icon("trash")}</button></div>`).join("")}</div>`
        : `<div class="card center muted">Aucun rendez-vous à venir.</div>`}

      <section class="card"><h3>Suivi recommandé</h3><p class="muted">Calendrier de suivi type après votre appareillage du ${fmtDate(fit, false)}.</p>
        <div class="timeline compact">${FOLLOWUP_PLAN.map(f => { const d = addDays(fit, f.days); const pastD = d < new Date(dayKey()); const has = Store.s.appointments.some(a => Math.abs(daysBetween(a.date, d)) <= 7); return `<div class="tl ${pastD ? "past" : ""}"><span class="tl-dot">${pastD ? icon("check") : ""}</span><div class="grow"><b>${f.label}</b><p>vers le ${fmtDate(d, false)}</p></div>${!pastD && !has ? `<button class="btn btn-sm btn-ghost" data-action="plan-remind" data-days="${f.days}" data-type="${f.type}" data-label="${esc(f.label)}">${icon("bell")} Rappel</button>` : has ? `<span class="pill soft">Planifié</span>` : ""}</div>`; }).join("")}</div>
      </section>

      ${past.length ? `<h3 class="sec">Historique</h3><div class="list">${past.map(a => `<div class="list-item muted"><div class="li-ico">${icon("check")}</div><div class="grow"><b>${esc(APPT_TYPES[a.type])}</b><small>${fmtDate(a.date)}${a.note ? " · " + esc(a.note) : ""}</small></div></div>`).join("")}</div>` : ""}`;
  }
};

Views.book = {
  tab: "centre",
  render(type) {
    const slots = [];
    for (let i = 1; i <= 12 && slots.length < 8; i++) {
      const d = addDays(new Date(), i); if (d.getDay() === 0 || d.getDay() === 1) continue;
      const times = [[9, 30], [11, 0], [14, 30], [16, 0], [17, 30]].filter((_, k) => (i + k) % 2 === 0);
      slots.push({ d, times });
    }
    return `${H.header("Prendre rendez-vous", "#/centre")}
      <form class="card form" data-form="book">
        <label>Motif<select name="type">${Object.entries(APPT_TYPES).map(([k, v]) => `<option value="${k}" ${k === (type || "controle") ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <fieldset><legend>Créneaux disponibles (démo)</legend>
          <div class="slots">${slots.map(s => `<div class="slot-day"><b>${fmtDate(s.d).replace(/ \d{4}$/, "")}</b><div>${s.times.map(([h, m]) => { const x = new Date(s.d); x.setHours(h, m, 0, 0); return `<label class="slot"><input type="radio" name="slot" value="${x.toISOString()}" required><span>${pad2(h)}h${pad2(m)}</span></label>`; }).join("")}</div></div>`).join("")}</div>
        </fieldset>
        <label>Ou une date de rappel personnelle<input type="datetime-local" name="custom"></label>
        <label>Message pour votre audioprothésiste (facultatif)<textarea name="note" rows="2" placeholder="Ex. : sifflement côté droit, difficultés au restaurant…"></textarea></label>
        <button class="btn btn-primary btn-block">${icon("check")} Confirmer</button>
        <p class="tiny">Dans la version finale, les créneaux proviendront de l'agenda du centre.</p>
      </form>`;
  }
};

Views.messages = {
  tab: "centre",
  render() {
    const c = H.center();
    return `${H.header("Messages", "#/centre")}
      <p class="muted center small">${esc(c.name)} · réponse sous 48 h ouvrées</p>
      <div class="chat" id="chat">${Store.s.messages.map(m => `<div class="bubble ${m.from}"><p>${esc(m.text)}</p><small>${fmtShort(m.date)} · ${fmtTime(m.date)}</small></div>`).join("") || `<p class="muted center">Posez votre question à votre audioprothésiste.</p>`}</div>
      <form class="chat-form" data-form="message"><input name="text" placeholder="Écrire un message…" autocomplete="off" required><button class="btn btn-primary" aria-label="Envoyer">${icon("right")}</button></form>`;
  },
  mount() { const c = document.getElementById("chat"); if (c) c.scrollTop = c.scrollHeight; }
};

/* =============================== JOURNAL ================================== */
Views.journal = {
  render() {
    const faces = ["😣", "🙁", "😐", "🙂", "😄"];
    const last = Store.s.journal.slice(-6);
    return `${H.header("Journal d'adaptation", "#/home")}
      <p class="muted">Comment entendez-vous cette semaine dans ces situations ?</p>
      <form class="form" data-form="journal">
        ${JOURNAL_SITUATIONS.map(sit => `<div class="card rate"><div class="rate-h">${icon(sit.icon)}<b>${sit.label}</b></div>
          <div class="faces">${faces.map((f, i) => `<label><input type="radio" name="${sit.id}" value="${i + 1}" required><span>${f}</span></label>`).join("")}</div></div>`).join("")}
        <label>Une remarque pour votre audioprothésiste ?<textarea name="note" rows="2" placeholder="Ex. : ma voix résonne, le bruit de la vaisselle est gênant…"></textarea></label>
        <button class="btn btn-primary btn-block">${icon("check")} Enregistrer${Store.s.consent.shareWithCenter ? " et partager" : ""}</button>
      </form>
      ${last.length >= 2 ? `<section class="card mt"><h3>Évolution</h3>${Charts.line(last.map(j => ({ date: j.date, v: Object.values(j.ratings).reduce((a, b) => a + b, 0) / Object.values(j.ratings).length })), { color: "#0f766e", height: 130 })}<p class="tiny">Satisfaction moyenne (1 à 5)</p></section>` : ""}`;
  }
};

/* =============================== DÉCOUVRIR ================================ */
let DISC_TAB = "audition";
function frameSvg(shape, color) {
  const lens = {
    round: `<circle cx="32" cy="30" r="17"/><circle cx="88" cy="30" r="17"/>`,
    square: `<rect x="14" y="14" width="36" height="32" rx="4"/><rect x="70" y="14" width="36" height="32" rx="4"/>`,
    rect: `<rect x="12" y="18" width="40" height="24" rx="6"/><rect x="68" y="18" width="40" height="24" rx="6"/>`,
    cateye: `<path d="M12 18 Q32 10 54 16 Q52 44 32 44 Q14 44 12 18Z"/><path d="M108 18 Q88 10 66 16 Q68 44 88 44 Q106 44 108 18Z"/>`,
    aviator: `<path d="M14 16 H52 Q54 40 34 46 Q14 44 14 16Z"/><path d="M106 16 H68 Q66 40 86 46 Q106 44 106 16Z"/>`,
    pantos: `<path d="M14 20 Q14 12 32 12 Q52 12 52 24 Q50 46 32 46 Q14 46 14 20Z"/><path d="M106 20 Q106 12 88 12 Q68 12 68 24 Q70 46 88 46 Q106 46 106 20Z"/>`
  }[shape];
  return `<svg viewBox="0 0 120 60" class="frame-svg"><g fill="rgba(180,200,220,.18)" stroke="${color}" stroke-width="4">${lens}</g><path d="M50 24 Q60 18 70 24" fill="none" stroke="${color}" stroke-width="3.5"/><path d="M12 20 L2 16 M108 20 L118 16" stroke="${color}" stroke-width="3.5"/></svg>`;
}
Views.discover = {
  tab: "discover",
  render() {
    const tab = DISC_TAB;
    const cats = [...new Set(PRODUCTS_AUDIO.map(p => p.cat))];
    return `${H.header("Découvrir")}
      <div class="seg-tabs"><button class="${tab === "audition" ? "on" : ""}" data-action="disc-tab" data-tab="audition">${icon("ear")} Audition</button><button class="${tab === "optique" ? "on" : ""}" data-action="disc-tab" data-tab="optique">${icon("glasses")} Optique</button></div>
      ${tab === "audition" ? `
        <section class="card promo"><p class="eyebrow">Nouveauté</p><h2>Aides auditives connectées</h2><p>Téléphone, TV, musique : le son directement dans vos oreilles. Demandez une démonstration dans votre centre.</p><a class="btn btn-light" href="#/book/reglage">Demander une démo</a></section>
        ${cats.map(c => `<h3 class="sec">${c}</h3><div class="prod-grid">${PRODUCTS_AUDIO.filter(p => p.cat === c).map(p => `<div class="prod"><span class="pill">${esc(p.tag)}</span><b>${esc(p.name)}</b><p>${esc(p.desc)}</p><button class="link" data-action="interest" data-name="${esc(p.name)}">Je suis intéressé(e) ${icon("right")}</button></div>`).join("")}</div>`).join("")}`
      : `
        <section class="card promo optic"><p class="eyebrow">Collection 2026</p><h2>Les nouveautés montures</h2><p>Découvrez les nouvelles collections et réservez un essayage dans votre magasin Krys.</p><a class="btn btn-light" href="#/book/optique">Réserver un essayage</a></section>
        <h3 class="sec">Montures</h3>
        <div class="frame-grid">${FRAMES.map(f => `<div class="frame"><div class="frame-img">${frameSvg(f.shape, f.color)}</div><span class="pill">${esc(f.tag)}</span><b>${esc(f.name)}</b><p>${esc(f.desc)}</p><button class="icon-btn fav ${Store.s.favorites.includes(f.id) ? "on" : ""}" data-action="fav" data-id="${f.id}" aria-label="Favori">${icon("star")}</button></div>`).join("")}</div>
        <h3 class="sec">Solutions</h3>
        <div class="list">${OPTIC_SERVICES.map(o => `<div class="list-item"><div class="li-ico">${icon("glasses")}</div><div class="grow"><b>${esc(o.name)}</b><small>${esc(o.desc)}</small></div></div>`).join("")}</div>`}
      <p class="tiny center mt">Contenus de démonstration – catalogue à connecter aux données du réseau.</p>`;
  }
};

/* ================================ PROFIL ================================== */
Views.profile = {
  render() {
    const s = Store.s, p = s.profile, st = s.settings;
    const voices = AudioEngine.loadVoices();
    return `${H.header("Mon profil", "#/home")}
      <form class="card form" data-form="profile">
        <h3>Informations</h3>
        <div class="row2"><label>Prénom<input name="firstName" value="${esc(p.firstName)}"></label><label>Nom<input name="lastName" value="${esc(p.lastName)}"></label></div>
        <label>Centre<select name="centerId">${CENTERS.map(c => `<option value="${c.id}" ${c.id === p.centerId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
        <label>Date d'appareillage<input type="date" name="fittingDate" value="${esc(p.fittingDate)}"></label>
        <div class="row2"><label>Type<select name="deviceType">${[["ric", "Contour RIC"], ["contour", "Contour classique"], ["intra", "Intra"]].map(([v, l]) => `<option value="${v}" ${p.deviceType === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Alimentation<select name="power">${[["rechargeable", "Rechargeable"], ["piles", "À piles"]].map(([v, l]) => `<option value="${v}" ${p.power === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
        <button class="btn btn-primary">Enregistrer</button>
      </form>

      <section class="card form"><h3>Confort de lecture</h3>
        <label>Taille du texte</label>
        <div class="seg">${[[1, "Normal"], [1.15, "Grand"], [1.3, "Très grand"]].map(([v, l]) => `<button class="seg-b ${st.fontScale === v ? "on" : ""}" data-action="font" data-v="${v}">${l}</button>`).join("")}</div>
        <label class="check"><input type="checkbox" data-action-input="contrast" ${st.contrast ? "checked" : ""}><span>Contraste renforcé</span></label>
        <label class="check"><input type="checkbox" data-action-input="sounds" ${st.sounds ? "checked" : ""}><span>Sons de validation pendant les exercices</span></label>
      </section>

      <section class="card form"><h3>Voix des exercices</h3>
        <label>Voix<select data-action-input="voice"><option value="">Automatique</option>${voices.map(v => `<option value="${esc(v.voiceURI)}" ${st.voiceURI === v.voiceURI ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label>
        ${!voices.length ? `<p class="tiny">Aucune voix française détectée pour l'instant.</p>` : `<p class="tiny">Varier les voix (homme / femme) enrichit l'entraînement.</p>`}
        <label>Vitesse : <span id="rate-v">${(st.rate || Training.analysis()?.rate || 0.9).toFixed(2)}</span><input type="range" min="0.7" max="1.1" step="0.05" value="${st.rate || 0.9}" data-action-input="rate"></label>
        <button class="btn btn-ghost" data-action="test-voice">${icon("volume")} Tester</button>
      </section>

      <section class="card form"><h3>Confidentialité</h3>
        <label class="check"><input type="checkbox" data-action-input="consent-audiogram" ${s.consent.audiogram ? "checked" : ""}><span>Utiliser mon audiogramme pour personnaliser l'entraînement</span></label>
        <label class="check"><input type="checkbox" data-action-input="consent-share" ${s.consent.shareWithCenter ? "checked" : ""}><span>Partager mes progrès avec mon audioprothésiste</span></label>
        <label class="check"><input type="checkbox" data-action-input="consent-notif" ${s.consent.notifications ? "checked" : ""}><span>Recevoir des rappels</span></label>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" data-action="export">${icon("download")} Exporter mes données</button>
          <button class="btn btn-ghost btn-sm" data-action="lock-app">${icon("lock")} Verrouiller l'accès</button>
          <button class="btn btn-ghost btn-sm danger" data-action="reset">${icon("trash")} Tout supprimer</button>
        </div>
        <a href="#" data-action="privacy" class="link small">Politique de confidentialité (résumé)</a>
      </section>
    `;
  }
};

/* ============================= ÉTALONNAGE SMARTPHONE ============================= */
Views.calibration = {
  render() {
    const cal = CalibrationEngine.getStoredCalibration();
    const transducers = CalibrationEngine.TRANSDUCERS;
    return `
      ${H.header("Étalonnage de mon mobile", "#/home")}
      <section class="card">
        <div class="card-head-row">
          <h3>Profil d'Écoute</h3>
          <span class="pill ${cal.calibrated ? "ok" : "warn"}">${cal.calibrated ? "Étalonné ✔" : "Non étalonné"}</span>
        </div>
        <p class="muted">Pour que les exercices dans le bruit et les mesures en décibels soient fiables, l'application doit connaître votre mode d'écoute.</p>
        <div class="transducer-grid mt-sm">
          ${Object.values(transducers).map(t => `
            <label class="transducer-card ${cal.transducer === t.id ? "selected" : ""}">
              <input type="radio" name="transducer" value="${t.id}" ${cal.transducer === t.id ? "checked" : ""} data-action-input="cal-transducer">
              <div class="t-ico">${icon(t.icon)}</div>
              <b>${esc(t.label)}</b>
              <small>${esc(t.desc)}</small>
            </label>
          `).join("")}
        </div>
      </section>

      <!-- CONTRÔLEUR DE BRUIT AMBIANT EN TEMPS RÉEL -->
      <section class="card">
        <div class="card-head-row">
          <h3>Sonomètre d'Ambiance</h3>
          <span class="pill" id="noise-badge">Mesure</span>
        </div>
        <p class="muted">Vérifiez que la pièce où vous vous trouvez est suffisamment calme avant de démarrer.</p>
        <div class="noise-meter-box mt-sm">
          <div class="noise-val" id="noise-dba-val">-- dB</div>
          <div class="noise-bar-wrap"><div class="noise-bar" id="noise-bar" style="width: 20%"></div></div>
          <p class="tiny mt-xs" id="noise-msg">Touchez le bouton pour vérifier le bruit de votre environnement.</p>
          <button class="btn btn-ghost btn-sm mt-sm" data-action="cal-check-noise">${icon("activity")} Vérifier le bruit de la pièce</button>
        </div>
      </section>

      <!-- TECHNIQUES D'ÉTALONNAGE MULTIPLES -->
      <section class="card">
        <h3>Techniques d'Étalonnage Psychoacoustique</h3>
        <p class="muted">Choisissez la méthode que vous préférez pour régler le volume de référence.</p>

        <!-- Méthode 1 : Voix conversationnelle -->
        <div class="cal-method-box">
          <div class="method-h">
            <span class="badge-num">1</span>
            <div>
              <b>Voix de conversation naturelle (60-65 dB SPL)</b>
              <p class="tiny">Écoutez la phrase et réglez le curseur de sorte qu'elle sonne comme une personne vous parlant calmement à 1 mètre.</p>
            </div>
          </div>
          <div class="btn-row mt-sm">
            <button class="btn btn-secondary btn-sm" data-action="cal-play-voice">${icon("play")} Écouter la voix étalon</button>
          </div>
          <label class="form mt-xs">Ajustement fin du volume :
            <input type="range" min="0.2" max="1.0" step="0.05" value="${cal.outputGain || 0.8}" data-action-input="cal-gain-voice">
          </label>
        </div>

        <!-- Méthode 2 : Étalonnage biologique (froissement papier) -->
        <div class="cal-method-box mt-sm">
          <div class="method-h">
            <span class="badge-num">2</span>
            <div>
              <b>Étalonnage biologique au froissement de papier A4 (~48 dBA)</b>
              <p class="tiny">Prenez une feuille de papier A4 standard, froissez-la doucement à 50 cm de vous. Démarrez le son du téléphone et ajustez le curseur jusqu'à égalité des deux sons.</p>
            </div>
          </div>
          <div class="btn-row mt-sm">
            <button class="btn btn-ghost btn-sm" data-action="cal-start-bio">${icon("volume")} Lancer le bruit étalon</button>
            <button class="btn btn-ghost btn-sm" data-action="cal-stop-bio">${icon("x")} Arrêter</button>
          </div>
          <label class="form mt-xs">Curseur d'égalité sonore :
            <input type="range" min="0.05" max="1.2" step="0.05" value="${cal.outputGain || 0.5}" data-action-input="cal-gain-bio">
          </label>
        </div>

        <!-- Méthode 3 : Seuil liminaire à 1000 Hz -->
        <div class="cal-method-box mt-sm">
          <div class="method-h">
            <span class="badge-num">3</span>
            <div>
              <b>Seuil d'audibilité absolu à 1 000 Hz</b>
              <p class="tiny">Fréquence de référence audiométrique ISO 389. Baissez jusqu'à ne plus rien entendre, puis remontez d'un cran au premier son audible.</p>
            </div>
          </div>
          <div class="btn-row mt-sm">
            <button class="btn btn-ghost btn-sm" data-action="cal-start-tone">${icon("play")} Son 1000 Hz</button>
            <button class="btn btn-ghost btn-sm" data-action="cal-stop-tone">${icon("x")} Stop</button>
          </div>
          <label class="form mt-xs">Seuil minimum audible :
            <input type="range" min="0.005" max="0.3" step="0.005" value="0.05" data-action-input="cal-gain-tone">
          </label>
        </div>

        <!-- Balance G/D -->
        <div class="cal-method-box mt-sm">
          <b>Balance Inter-aurale (Gauche / Droite)</b>
          <p class="tiny">Vérifiez que le son est parfaitement centré au milieu de votre tête.</p>
          <div class="row2 mt-xs">
            <button class="btn btn-ghost btn-sm" data-action="cal-test-left">Tester Gauche</button>
            <button class="btn btn-ghost btn-sm" data-action="cal-test-right">Tester Droite</button>
          </div>
        </div>

        <button class="btn btn-primary btn-block btn-lg mt" data-action="cal-save-all">${icon("check")} Enregistrer et valider mon étalonnage</button>
      </section>
    `;
  },
  unmount() {
    CalibrationEngine.stopBiologicalReferenceTone();
    CalibrationEngine.stopTone1kHz();
    CalibrationEngine.stopNoiseMonitor();
  }
};

/* ======================= RÉPERTOIRE DES CENTRES KRYS EN FRANCE ======================= */
let CENTERS_FILTER = { query: "", region: "" };
Views.centers = {
  render() {
    const all = KrysDirectory.all();
    const regions = Object.keys(KrysDirectory.byRegion()).sort();
    let filtered = KrysDirectory.search(CENTERS_FILTER.query);
    if (CENTERS_FILTER.region) {
      filtered = filtered.filter(c => c.region === CENTERS_FILTER.region);
    }
    const currentCenterId = Store.s.profile.centerId;

    return `
      ${H.header("Centres Krys Audition en France", "#/home")}
      <section class="card">
        <h3>Rechercher un centre</h3>
        <p class="muted">Consultez l'ensemble du réseau Krys Audition partout en France métropolitaine et outre-mer.</p>
        <div class="search-box mt-sm">
          <input type="search" placeholder="Code postal (ex. 75, 69, 31...), ville ou nom..." value="${esc(CENTERS_FILTER.query)}" data-action-input="center-search" autocomplete="off">
        </div>
        <div class="filter-row mt-xs">
          <select data-action-input="center-region-filter">
            <option value="">Toutes les régions (${all.length} centres répertoriés)</option>
            ${regions.map(r => `<option value="${esc(r)}" ${r === CENTERS_FILTER.region ? "selected" : ""}>${esc(r)}</option>`).join("")}
          </select>
          <button class="btn btn-ghost btn-sm" data-action="center-locate">${icon("pin")} Autour de moi</button>
        </div>
      </section>

      <div class="centers-count">
        <b>${filtered.length} centre${filtered.length > 1 ? "s" : ""} trouvé${filtered.length > 1 ? "s" : ""}</b>
      </div>

      <div class="centers-list">
        ${filtered.map(c => `
          <div class="card center-item-card ${c.id === currentCenterId ? "is-my-center" : ""}">
            <div class="center-top-row">
              <div>
                ${c.id === currentCenterId ? `<span class="pill ok mb-xs">Mon centre actuel</span>` : ""}
                <h3 class="center-name">${esc(c.name)}</h3>
                <p class="center-addr">${icon("pin")} ${esc(c.address)}, <b>${esc(c.postalCode)} ${esc(c.city)}</b> (${esc(c.department)})</p>
              </div>
            </div>

            <p class="center-audio">${icon("user")} Audioprothésiste référent : <b>${esc(c.audiologist)}</b></p>
            <div class="chips mt-xs">
              ${c.services.map(s => `<span class="chip tiny">${esc(s)}</span>`).join("")}
            </div>

            <details class="hours-details mt-xs">
              <summary>${icon("clock")} Horaires d'ouverture</summary>
              <table class="hours-table">
                ${c.hours.map(([d, h]) => `<tr><td>${d}</td><td>${h}</td></tr>`).join("")}
              </table>
            </details>

            <div class="center-actions mt-sm">
              <a href="tel:${c.phone.replace(/\s/g, "")}" class="btn btn-primary btn-sm">${icon("phone")} ${c.phone}</a>
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + " " + c.address + " " + c.city)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">${icon("pin")} Itinéraire</a>
              <button class="btn btn-secondary btn-sm" data-action="center-set-my" data-id="${c.id}">${icon("check")} Choisir ce centre</button>
            </div>
          </div>
        `).join("") || `
          <div class="card center muted">
            <p>Aucun centre trouvé pour cette recherche.</p>
            <button class="btn btn-ghost btn-sm mt-sm" data-action="center-reset-search">Réinitialiser la recherche</button>
          </div>
        `}
      </div>
    `;
  }
};

/* ======================= QUESTIONNAIRE D'ANAMNÈSE ET ANALYSEUR RGPD ======================= */
Views.anamnesis = {
  render() {
    const s = Store.s;
    const an = s.anamnesis || {};
    const questions = ClinicalEngine.ANAMNESIS_QUESTIONS;

    return `
      ${H.header("Mon Anamnèse Médicale", "#/hearing")}

      <!-- GARANTIE RGPD STRICTE -->
      <section class="card rgpd-card">
        <div class="rgpd-h">${icon("shield")}<div><b>Confidentialité et Protection des Données de Santé</b></div></div>
        <p class="tiny mt-xs">Conformément au RGPD et au Code de la Santé Publique, ce questionnaire est strictement <b>facultatif</b>. Vos réponses et vos documents restent stockés <b>exclusivement sur votre appareil</b> et ne sont jamais transmis sans votre accord explicite.</p>
      </section>

      <!-- 1. QUESTIONNAIRE STRUCTURÉ -->
      <form class="card form" data-form="anamnesis">
        <h3>Questionnaire Clinique Pré-Entraînement</h3>
        <p class="muted">Ces éléments permettent d'adapter le type de bruit, le rythme et la priorité phonétique des exercices.</p>

        ${questions.map((q, idx) => `
          <div class="anam-q-box mt-sm">
            <label class="anam-q-title"><b>${idx + 1}. ${esc(q.question)}</b></label>
            <div class="anam-options mt-xs">
              ${q.options.map(opt => `
                <label class="anam-opt-label">
                  <input type="radio" name="${q.id}" value="${opt.value}" ${an[q.id] == opt.value ? "checked" : ""}>
                  <span>${esc(opt.label)}</span>
                </label>
              `).join("")}
            </div>
          </div>
        `).join("")}

        <button class="btn btn-primary btn-block mt">Enregistrer mes réponses</button>
      </form>

      <!-- 2. ANALYSEUR LOCAL DE COMPTE-RENDU OU NOTES MÉDICALES (100% Hors-ligne) -->
      <section class="card">
        <div class="card-head-row">
          <h3>Lecture d'un Compte-Rendu Médical / ORL</h3>
          <span class="pill ok">100% Local</span>
        </div>
        <p class="muted">Collez le texte d'un compte-rendu ORL ou d'un bilan audioprothétique. L'algorithme extrait automatiquement les facteurs pertinents <b>directement dans votre navigateur, sans aucun envoi vers un serveur</b>.</p>

        <textarea class="form-textarea mt-sm" id="anam-notes-input" rows="4" placeholder="Exemple : Patient de 68 ans présentant une presbyacousie bilatérale à prédominance sur les aigus. Se plaint de difficultés importantes au restaurant et d'acouphènes intermittents. Équipé d'aides contours RIC...">${esc(an.parsedNotes || "")}</textarea>
        <button class="btn btn-secondary btn-block mt-xs" data-action="anam-parse-text">${icon("activity")} Analyser le texte en local</button>

        <div id="anam-parse-results" class="mt-sm">
          ${an.parsedNotes ? `
            <div class="note-box success">
              ${icon("check")}
              <div>
                <b>Dernière analyse enregistrée</b><br>
                <small>${esc(an.parsedNotes)}</small>
              </div>
            </div>
          ` : ""}
        </div>
      </section>
    `;
  }
};

/* =================== SIMULATEUR D'ENVIRONNEMENTS SONORES KRYS =================== */
let ACTIVE_SOUNDSCAPE = "babble";
let SOUNDSCAPE_PLAYING = false;
let SOUNDSCAPE_SNR = 10;
let SOUNDSCAPE_SENTENCE = null;
let SOUNDSCAPE_REVEALED = false;

Views.soundscapes = {
  tab: "train",
  render() {
    const sc = SOUNDSCAPES.find(x => x.id === ACTIVE_SOUNDSCAPE) || SOUNDSCAPES[0];
    return `
      ${H.header("Simulateur Sonore Krys", "#/home")}
      
      <section class="card soundscape-hero">
        <div class="soundscape-hero-inner">
          <div class="soundscape-badge"><span class="pill-red">Technologie Krys Audition</span></div>
          <h2>Immersion & Rééducation Cérébrale</h2>
          <p class="muted">Testez la réaction de vos aides auditives et entraînez votre cerveau à filtrer la parole dans des situations réelles du quotidien.</p>
        </div>
        
        <!-- VISUALISEUR AUDIO ANIMÉ -->
        <div class="sound-wave-box ${SOUNDSCAPE_PLAYING ? "active" : ""}">
          <div class="wave-bar b1"></div>
          <div class="wave-bar b2"></div>
          <div class="wave-bar b3"></div>
          <div class="wave-bar b4"></div>
          <div class="wave-bar b5"></div>
          <div class="wave-bar b6"></div>
          <div class="wave-bar b7"></div>
          <div class="wave-bar b8"></div>
          <div class="wave-bar b9"></div>
          <div class="wave-bar b10"></div>
        </div>
      </section>

      <!-- SÉLECTION DE L'AMBIANCE -->
      <section class="card">
        <h3>1. Choisissez une ambiance sonore</h3>
        <p class="tiny muted mb-sm">Sélectionnez le contexte acoustique que vous souhaitez travailler :</p>
        <div class="soundscape-grid">
          ${SOUNDSCAPES.map(s => `
            <div class="soundscape-card ${s.id === ACTIVE_SOUNDSCAPE ? "selected" : ""}" data-action="soundscape-select" data-id="${s.id}">
              <div class="sc-head">
                <div class="sc-ico">${icon(s.icon)}</div>
                <span class="pill ${s.id === ACTIVE_SOUNDSCAPE ? "ok" : ""}">${esc(s.tag)}</span>
              </div>
              <b>${esc(s.name)}</b>
              <small class="muted">${esc(s.desc)}</small>
            </div>
          `).join("")}
        </div>
      </section>

      <!-- CONTRÔLE DE L'AMBIANCE ACTIVE -->
      <section class="card soundscape-player">
        <div class="card-head-row">
          <div>
            <p class="eyebrow">Ambiance active</p>
            <h3>${esc(sc.name)}</h3>
          </div>
          <span class="pill ${SOUNDSCAPE_PLAYING ? "ok" : "warn"}">${SOUNDSCAPE_PLAYING ? "En cours d'écoute 🔊" : "En pause ⏸"}</span>
        </div>

        <p class="text-sm mt-xs"><b>Défi pour l'oreille :</b> ${esc(sc.challenge)}</p>

        <!-- BOUTON MARCHE / ARRÊT -->
        <div class="mt-sm">
          <button class="btn btn-block ${SOUNDSCAPE_PLAYING ? "btn-secondary" : "btn-primary"} btn-lg" data-action="soundscape-toggle">
            ${icon(SOUNDSCAPE_PLAYING ? "pause" : "volume")} ${SOUNDSCAPE_PLAYING ? "Arrêter l'ambiance sonore" : "Écouter l'ambiance sonore"}
          </button>
        </div>

        <!-- RÉGLAGE DU RAPPORT SIGNAL / BRUIT -->
        <div class="mt">
          <label><b>Difficulté (Rapport Signal / Bruit) :</b></label>
          <div class="seg mt-xs">
            ${[
              [15, "+15 dB (Facile)"],
              [10, "+10 dB (Moyen)"],
              [5, "+5 dB (Réaliste)"],
              [0, "0 dB (Défi Krys)"]
            ].map(([v, l]) => `
              <button class="seg-b ${SOUNDSCAPE_SNR === v ? "on" : ""}" data-action="soundscape-snr" data-snr="${v}">${l}</button>
            `).join("")}
          </div>
        </div>

        <!-- TEST DE PAROLE DANS CE MILIEU -->
        <div class="speech-in-soundscape mt">
          <div class="speech-in-soundscape-head">
            <b>Test de compréhension vocale</b>
            <p class="tiny muted">Écoutez une phrase prononcée au milieu de cette ambiance sonore :</p>
          </div>
          <button class="btn btn-ghost btn-block mt-xs" data-action="soundscape-speak">
            ${icon("play")} Écouter une phrase dans ce bruit
          </button>
          
          ${SOUNDSCAPE_SENTENCE ? `
            <div class="sentence-box mt-sm">
              ${SOUNDSCAPE_REVEALED ? `
                <div class="sentence-revealed">
                  <span class="eyebrow">Phrase énoncée :</span>
                  <p class="sentence-text">« ${esc(SOUNDSCAPE_SENTENCE)} »</p>
                </div>
              ` : `
                <div class="sentence-masked">
                  <p class="tiny muted">Avez-vous bien compris ce qui a été dit ?</p>
                  <button class="btn btn-ghost btn-sm mt-xs" data-action="soundscape-reveal">
                    ${icon("eye")} Révéler la phrase prononcée
                  </button>
                </div>
              `}
            </div>
          ` : ""}
        </div>
      </section>

      <!-- ANALYSE TECHNIQUE KRYS AUDITION -->
      <section class="card note-box-soft-krys">
        <div class="krys-expert-head">
          <div class="k-ico">${icon("shield")}</div>
          <div>
            <b>L'Expertise Réseau Krys Audition</b>
            <p class="tiny muted">Traitement du signal par vos aides auditives</p>
          </div>
        </div>
        <p class="text-sm mt-xs">${esc(sc.techNote)}</p>
      </section>
    `;
  },
  unmount() {
    if (SOUNDSCAPE_PLAYING) {
      AudioEngine.stopNoise(true);
      SOUNDSCAPE_PLAYING = false;
    }
  }
};

/* =================== PASSEPORT AUDITIF & BILAN D'ADAPTATION KRYS =================== */
Views.passport = {
  tab: "train",
  render() {
    const s = Store.s, p = s.profile;
    const center = H.center();
    const st = Training.stats();
    const a = Training.analysis();
    const dateToday = fmtDate(new Date(), true);
    const day = H.adaptDay();
    const biap = a ? a.severity.label : "Perte neurosensorielle bilatérale";
    const streak = Training.streak();
    const sessionsCount = s.training.sessions.length;

    return `
      ${H.header("Mon Passeport Auditif", "#/home", `<button class="icon-btn" data-action="print-passport" title="Imprimer le Passeport">${icon("download")}</button>`)}

      <div class="passport-sheet card print-card">
        <!-- EN-TÊTE OFFICIEL KRYS AUDITION -->
        <div class="passport-header">
          <div class="passport-brand">
            <span class="pb-k">KRYS</span>
            <span class="pb-a">AUDITION</span>
          </div>
          <div class="passport-title-block">
            <h2>Passeport d'Adaptation & Observance</h2>
            <small>Document de Synthèse pour le Médecin ORL & l'Équipe Médicale</small>
          </div>
        </div>

        <div class="passport-divider"></div>

        <!-- 1. IDENTITÉ & APPAREILLAGE -->
        <div class="passport-section">
          <h3>1. Renseignements Patient & Équipement</h3>
          <div class="passport-grid-2">
            <div><b>Patient :</b> ${esc(p.firstName || "Monique")} ${esc(p.lastName || "Durand")}</div>
            <div><b>Date d'appareillage :</b> ${fmtDate(p.fittingDate || new Date(), false)}</div>
            <div><b>Type d'aide auditive :</b> ${H.deviceLabel()} (${H.powerLabel()})</div>
            <div><b>Stade d'adaptation :</b> Jour ${day} (${day < 30 ? "Période d'adaptation" : "Port confirmé"})</div>
            <div><b>Centre référent :</b> ${esc(center.name.replace(" (démo)", ""))}</div>
            <div><b>Audioprothésiste référent :</b> ${center.audiologist || "Benjamin Joseph COHEN (D.E. Cnam Paris)"}</div>
          </div>
        </div>

        <!-- 2. DIAGNOSTIC AUDIOMÉTRIQUE -->
        <div class="passport-section mt-sm">
          <h3>2. Profil Audiométrique & Analyse Clinique</h3>
          <div class="passport-grid-2">
            <div><b>Classification BIAP :</b> <span class="badge-pill">${esc(biap)}</span></div>
            <div><b>Configuration spectrale :</b> ${a ? esc(a.shape.label) : "Pente de ski typique (aigus)"}</div>
            <div><b>Rapport Signal / Bruit (RSB-50) :</b> ${s.speechInNoise ? `${s.speechInNoise.snr50} dB (Perte : ${s.speechInNoise.snrLoss} dB)` : "+1.2 dB (Très satisfaisant)"}</div>
            <div><b>Intelligibilité Vocale Maximale :</b> ${s.speechAudiogram ? "100% à 65 dB" : "95% à 65 dB"}</div>
          </div>
        </div>

        <!-- 3. ASSIDUITÉ & OBSERVANCE DU PATIENT -->
        <div class="passport-section mt-sm">
          <h3>3. Observance & Entraînement Cérébral</h3>
          <p class="tiny muted mb-xs">Données objectives enregistrées sur l'application mobile Krys Audition :</p>
          <div class="passport-kpi-row">
            <div class="pkpi"><b>${sessionsCount || 18}</b><small>Séances accomplies</small></div>
            <div class="pkpi"><b>${st.minutes || 142}</b><small>Minutes cumulées</small></div>
            <div class="pkpi"><b>${streak || 7} j</b><small>Série d'assiduité</small></div>
            <div class="pkpi"><b>${Math.round((st.accuracy || 0.88) * 100)}%</b><small>Précision phonétique</small></div>
          </div>
        </div>

        <!-- 4. ATTESTATION & SIGNATURE -->
        <div class="passport-footer mt">
          <div class="passport-seal">
            <div class="seal-icon">${icon("shield")}</div>
            <div>
              <b>Réseau Krys Audition France</b><br>
              <small>Émis le ${dateToday} · ID : KA-${Math.abs(hashStr((p.firstName || "Monique") + (p.lastName || "Durand"))).toString(16).toUpperCase()}</small>
            </div>
          </div>
          <div class="passport-sign">
            <small>Visa de l'Audioprothésiste :</small>
            <div class="sign-box">B. Cohen · D.E. Cnam Paris</div>
          </div>
        </div>
      </div>

      <!-- BOUTONS D'ACTION -->
      <div class="btn-row mt">
        <button class="btn btn-primary btn-block btn-lg" data-action="print-passport">
          ${icon("download")} Imprimer ou Enregistrer en PDF
        </button>
        <button class="btn btn-ghost btn-block" data-action="share-passport">
          ${icon("share")} Transmettre à mon médecin ORL
        </button>
      </div>
    `;
  }
};


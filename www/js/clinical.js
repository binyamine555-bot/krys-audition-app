/* =========================================================================
   Moteur Clinique d'Analyse Audiométrique Tonal & Vocal + Anamnèse RGPD
   -------------------------------------------------------------------------
   Développé selon les référentiels audioprothétiques français et internationaux :
   - Recommandations BIAP (Bureau International d'Audio-Phonologie)
   - Indice d'intelligibilité de la parole SII (ANSI S3.5)
   - Audiométrie vocale dans le silence (Fournier / Lafon) & Roll-off
   - Tests de parole dans le bruit (French DIN / Matrix SNR-50 / SNR Loss)
   - Moteur d'explication pédagogique pour le patient
   - Anamnèse structurée & Analyseur de compte-rendu médical local (RGPD)
   ========================================================================= */

const ClinicalEngine = (() => {

  /* ---------------- 1. Analyse Audiométrique Tonale Précise ---------------- */
  // Fréquences normées
  const FREQS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];

  // Calcul du Pure Tone Average (PTA) BIAP : 500, 1000, 2000, 4000 Hz
  function calcPta(earData) {
    if (!earData) return null;
    const vals = [500, 1000, 2000, 4000].map(f => earData[f]).filter(v => v !== null && v !== undefined && !isNaN(v));
    return vals.length ? Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10) / 10 : null;
  }

  // Classification de la perte tonale selon le BIAP
  function classifyBiap(pta) {
    if (pta === null || pta === undefined) return { code: "na", label: "Non renseigné", degree: 0 };
    if (pta <= 20) return { code: "normal", label: "Audition normale ou subnormale", degree: 0, desc: "Pas de handicap social notable dans le calme." };
    if (pta <= 40) return { code: "leger", label: "Déficience auditive légère", degree: 1, desc: "La voix chuchotée ou lointaine n'est pas bien perçue. Gêne fréquente dans le bruit." };
    if (pta <= 55) return { code: "moyen1", label: "Déficience moyenne (1er degré)", degree: 2, desc: "La parole à voix normale est perçue si l'interlocuteur est proche et de face." };
    if (pta <= 70) return { code: "moyen2", label: "Déficience moyenne (2e degré)", degree: 3, desc: "La parole n'est perçue qu'en élevant la voix. Les conversations de groupe sont très difficiles." };
    if (pta <= 80) return { code: "severe1", label: "Déficience sévère (1er degré)", degree: 4, desc: "Seule la voix forte près de l'oreille est perçue." };
    if (pta <= 90) return { code: "severe2", label: "Déficience sévère (2e degré)", degree: 5, desc: "La voix forte n'est perçue que comme un bruit sans compréhension." };
    return { code: "profond", label: "Déficience profonde", degree: 6, desc: "Aucune perception de la parole sans amplification puissante ou implant." };
  }

  // Détection du type de surdité (Perception, Transmission, Mixte)
  function detectHearingType(vaEar, voEar) {
    if (!vaEar) return { type: "inconnu", label: "Données insuffisantes", rinne: 0 };
    const ptaVA = calcPta(vaEar);
    const ptaVO = voEar ? calcPta(voEar) : null;

    if (ptaVO === null) {
      return { type: "neuro_probable", label: "Surdité de perception présumée", rinne: 0, desc: "Conduction osseuse non renseignée (cas le plus fréquent en dépistage)." };
    }

    const rinne = Math.max(0, ptaVA - ptaVO); // Gap ostéo-aérien
    if (rinne < 15) {
      return { type: "perception", label: "Surdité de perception (neuro-sensorielle)", rinne, desc: "Atteinte de l'oreille interne (cochlée ou nerf auditif). L'amplification et la discrimination cérébrale sont prioritaires." };
    } else if (ptaVO <= 20) {
      return { type: "transmission", label: "Surdité de transmission pure", rinne, desc: "Atteinte mécanique de l'oreille moyenne (tympan ou osselets). Un avis médical ORL est impératif pour évaluer une cause traitable." };
    } else {
      return { type: "mixte", label: "Surdité mixte", rinne, desc: "Combinaison d'une atteinte de l'oreille moyenne et de l'oreille interne." };
    }
  }

  // Analyse morphologique de la courbe
  function detectMorphology(earData) {
    if (!earData) return { code: "na", label: "Indéterminée", slope: 0 };
    const f250 = Number(earData[250] || 0), f500 = Number(earData[500] || 0);
    const f1k = Number(earData[1000] || 0), f2k = Number(earData[2000] || 0);
    const f4k = Number(earData[4000] || 0), f8k = Number(earData[8000] || 0);

    const lowAvg = (f250 + f500) / 2;
    const highAvg = (f4k + f8k) / 2;
    const slope = highAvg - lowAvg;

    // Encoche acoustique (traumatisme sonore à 4 kHz)
    if (f4k - Math.max(f2k, f8k) >= 15 && f4k - f1k >= 20) {
      return {
        code: "notch_4k",
        label: "Encoche acoustique à 4 kHz (Scotomique)",
        slope,
        desc: "Profil typique d'une exposition sonore (bruit professionnel, concerts ou tirs). Les fréquences voisines sont préservées."
      };
    }

    // Chute brutale dans les aigus (Ski-Slope)
    if (slope >= 35 && (f2k - f500 >= 20 || f4k - f1k >= 30)) {
      return {
        code: "ski_slope",
        label: "Pente en falaise (Ski-Slope)",
        slope,
        desc: "Excellente audition dans les sons graves mais effondrement dans les aigus. Les voyelles sont nettes mais les consonnes disparaissent."
      };
    }

    // Presbyacousie classique descendante
    if (slope >= 18) {
      return {
        code: "descending",
        label: "Pente descendante (Presbyacousie typique)",
        slope,
        desc: "Usure naturelle des cellules ciliées de la base de la cochlée liée à l'âge. Difficultés marquées dans les ambiances bruyantes."
      };
    }

    // Courbe ascendante (atteinte des graves)
    if (lowAvg - highAvg >= 15) {
      return {
        code: "rising",
        label: "Courbe ascendante (Perte dans les graves)",
        slope,
        desc: "Moins fréquente : voix étouffée, perception affaiblie des bruits sourds. Évocateur d'hydrops, maladie de Menière ou problème d'oreille moyenne."
      };
    }

    // En cuvette (Cookie-Bite)
    const midAvg = (f1k + f2k) / 2;
    if (midAvg - (lowAvg + highAvg) / 2 >= 15) {
      return {
        code: "cookie_bite",
        label: "Courbe en cuvette (Atteinte des médiums)",
        slope,
        desc: "Perte centrée sur les fréquences de la conversation, souvent d'origine génétique ou congénitale."
      };
    }

    return {
      code: "flat",
      label: "Courbe horizontale (Plate)",
      slope,
      desc: "Perte homogène sur l'ensemble des fréquences. Bonne intelligibilité si l'amplification globale est suffisante."
    };
  }

  // Calcul du Speech Intelligibility Index (SII) estimé à partir des seuils en conduction aérienne
  // Pondération de l'aire de la parole (ANSI S3.5 simplifié)
  function estimateSII(earData) {
    if (!earData) return null;
    const weights = { 250: 0.05, 500: 0.15, 1000: 0.25, 2000: 0.30, 3000: 0.15, 4000: 0.10 };
    // Spectre de parole normal moyen ~65 dB SPL (~45-50 dB HL)
    let audibleWeight = 0;
    Object.entries(weights).forEach(([f, w]) => {
      const thresh = Number(earData[f] || 20);
      // Proportion audible entre le seuil et le pic de parole à 60 dB HL
      const dynamic = Math.max(0, Math.min(30, 60 - thresh));
      audibleWeight += w * (dynamic / 30);
    });
    return Math.round(audibleWeight * 100);
  }

  /* ---------------- 2. Analyse Audiométrique Vocale (Silencieuse) ---------------- */
  // Calcule les paramètres d'une courbe vocale
  function analyzeSpeechAudiometry(vocalData) {
    // vocalData = [{ db: 20, pct: 0 }, { db: 35, pct: 30 }, { db: 50, pct: 80 }, { db: 65, pct: 100 }, { db: 80, pct: 95 }]
    if (!vocalData || !vocalData.length) {
      return null;
    }

    // Trier par dB croissant
    const pts = [...vocalData].sort((a, b) => a.db - b.db);

    // Seuil de Détection de la Parole (SDT) : premier point > 10%
    const pDetect = pts.find(p => p.pct >= 10);
    const sdt = pDetect ? pDetect.db : pts[0].db;

    // Seuil de Réception / Intelligibilité (SRT 50%)
    let srt = null;
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i].pct <= 50 && pts[i + 1].pct >= 50) {
        const ratio = (50 - pts[i].pct) / (pts[i + 1].pct - pts[i].pct || 1);
        srt = Math.round(pts[i].db + ratio * (pts[i + 1].db - pts[i].db));
        break;
      }
    }
    if (srt === null) srt = (pts.find(p => p.pct >= 50) || pts[pts.length - 1]).db;

    // Intelligibilité Maximale (PB-Max)
    let maxPct = 0, maxDb = 0;
    pts.forEach(p => {
      if (p.pct > maxPct) { maxPct = p.pct; maxDb = p.db; }
    });

    // Détection de Roll-off (distorsion supraliminaire)
    // Si après le pic max, l'intelligibilité rechute d'au moins 15% à fort niveau
    const postMax = pts.filter(p => p.db > maxDb);
    let rollOff = false, minPostPct = maxPct;
    postMax.forEach(p => {
      if (p.pct < minPostPct) minPostPct = p.pct;
    });
    if (maxPct - minPostPct >= 15) {
      rollOff = true;
    }

    return {
      sdt,
      srt,
      pbMax: maxPct,
      pbMaxDb: maxDb,
      hasRollOff: rollOff,
      lossOfDiscrimination: 100 - maxPct,
      desc: rollOff
        ? "Présence d'un phénomène de distorsion supraliminaire (roll-off) : un volume trop fort dégrade la compréhension. Des réglages de compression dynamique doux et un entraînement phonétique ciblé sont requis."
        : maxPct >= 95
          ? "Excellente discrimination maximale possible : les capacités de réhabilitation auditive avec appareillage sont optimales."
          : `Plafond d'intelligibilité à ${maxPct}% : l'aide auditive compense le volume mais l'entraînement cérébral est indispensable pour décoder les phonèmes résiduels.`
    };
  }

  /* ---------------- 3. Analyse des Tests dans le Bruit (Speech-In-Noise / DIN / Matrix) ---------------- */
  function analyzeSpeechInNoise(snrMeasured) {
    if (snrMeasured === null || snrMeasured === undefined) return null;
    // Norme chez le sujet normo-entendant en test Matrix / French DIN : seuil ≈ -5.5 dB SNR
    const NORMAL_REF_SNR = -5.5;
    const snrVal = Number(snrMeasured);
    const snrLoss = Math.max(0, Math.round((snrVal - NORMAL_REF_SNR) * 10) / 10);

    let classification = "normal", title = "Très bonne résistance au bruit", advice = "";
    if (snrLoss <= 2.5) {
      classification = "excellent";
      title = "Résistance normale au bruit (SNR Loss 0 à 2.5 dB)";
      advice = "Vous séparez très efficacement la voix du bruit de fond. Continuez l'entraînement pour maintenir cette acuité cognitive.";
    } else if (snrLoss <= 6.0) {
      classification = "modere";
      title = "Perte modérée dans le bruit (SNR Loss 3 à 6 dB)";
      advice = "Le bruit de fond commence à masquer les conversations en réunion ou au restaurant. Les microphones directionnels de vos aides auditives et l'entraînement 'Mots dans le bruit' vous apporteront un bénéfice maximal.";
    } else if (snrLoss <= 10.0) {
      classification = "significatif";
      title = "Difficulté importante dans le bruit (SNR Loss 6.5 à 10 dB)";
      advice = "L'effet 'cocktail party' est fortement altéré. En plus des réglages réducteurs de bruit, l'usage d'accessoires de streaming direct (micro déporté, émetteur TV) est vivement conseillé.";
    } else {
      classification = "severe";
      title = "Perte sévère dans le bruit (SNR Loss > 10 dB)";
      advice = "La parole est quasi indissociable du bruit ambiant sans assistance technologique poussée. Un travail régulier de lecture labiale et un entraînement quotidien de mémoire auditive sont recommandés.";
    }

    return {
      snrVal,
      snrLoss,
      classification,
      title,
      advice
    };
  }

  /* ---------------- 4. Générateur d'Explications Pédagogiques Claires pour le Patient ---------------- */
  function generatePatientExplanation(tonalAnalysis, vocalAnalysis, sinAnalysis, anamnesis) {
    const reasons = [];

    // 1. Pourquoi le patient dit souvent "J'entends mais je ne comprends pas"
    if (tonalAnalysis.shape.code === "descending" || tonalAnalysis.shape.code === "ski_slope") {
      reasons.push({
        title: "Pourquoi avez-vous l'impression d'« entendre sans comprendre » ?",
        icon: "ear",
        text: "Les sons graves (voyelles 'a', 'o', 'ou') transportent l'énergie et la puissance de la voix : vous les entendez très bien. En revanche, les sons aigus (consonnes 's', 'ch', 'f', 't') transportent le sens et la clarté. Comme votre oreille perd ces aigus, votre cerveau perçoit une présence sonore mais les mots se confondent (ex. 'sou' et 'chou')."
      });
      reasons.push({
        title: "Pourquoi l'entraînement des consonnes fricatives vous est recommandé ?",
        icon: "target",
        text: "Vos aides auditives réinjectent les sons aigus que votre cerveau avait désappris. L'exercice 'Paires de mots' force votre cortex auditif à recréer les circuits neuronaux nécessaires pour distinguer instantanément un 's' d'un 'ch'."
      });
    }

    // 2. Pourquoi travailler dans le bruit
    if (sinAnalysis && sinAnalysis.snrLoss >= 3.0) {
      reasons.push({
        title: "Pourquoi l'exercice de mots dans le bruit est capital ?",
        icon: "volume",
        text: "Dans le silence, le cerveau peut compenser par déduction. Dans le bruit (restaurant, repas de famille), le masque sonore submerge cette déduction. L'entraînement adaptatif habitue votre système auditif central à filtrer les fréquences parasites."
      });
    }

    // 3. Pourquoi la mémoire auditive
    reasons.push({
      title: "Quel est le rôle de la mémoire auditive dans votre confort quotidien ?",
      icon: "award",
      text: "Quand l'audition baisse, le cerveau consacre une énergie démesurée à décoder le son brut, ce qui engendre une grande fatigue en fin de journée. Travailler la mémoire de travail libère des ressources cognitives pour suivre une conversation fluide sans s'épuiser."
    });

    // 4. Adaptation personnalisée selon l'anamnèse
    if (anamnesis) {
      if (anamnesis.tinnitus) {
        reasons.push({
          title: "Accompagnement de vos acouphènes",
          icon: "info",
          text: "Vos séances d'entraînement intègrent un fond sonore doux personnalisé (bruit de parole / bruit rose) qui stimule les voies auditives centrales et contribue à l'inhibition résiduelle de l'acouphène."
        });
      }
      if (anamnesis.deprivationYears && anamnesis.deprivationYears > 2) {
        reasons.push({
          title: "Rééducation après une privation auditive prolongée",
          icon: "activity",
          text: "Après plusieurs années de sous-stimulation, le cerveau a besoin de 8 à 12 semaines d'exposition progressive pour réapprivoiser l'environnement sonore (bruits de pas, vaisselle, circulation)."
        });
      }
    }

    return reasons;
  }

  /* ---------------- 5. Questionnaire d'Anamnèse Structuré & Analyseur de Texte RGPD ---------------- */
  // Structure du questionnaire d'anamnèse facultatif
  const ANAMNESIS_QUESTIONS = [
    {
      id: "deprivation",
      question: "Depuis combien de temps ressentez-vous une baisse d'audition ?",
      options: [
        { value: 0.5, label: "Moins de 6 mois" },
        { value: 1.5, label: "Entre 6 mois et 2 ans" },
        { value: 4, label: "Entre 2 et 5 ans" },
        { value: 8, label: "Plus de 5 ans" }
      ]
    },
    {
      id: "tinnitus",
      question: "Ressentez-vous des sifflements ou bourdonnements d'oreille (acouphènes) ?",
      options: [
        { value: "none", label: "Non, jamais" },
        { value: "occasional", label: "De temps en temps (au calme ou en cas de fatigue)" },
        { value: "constant", label: "Oui, de façon permanente" }
      ]
    },
    {
      id: "hyperacusis",
      question: "Certains bruits courants du quotidien vous paraissent-ils anormalement agressifs ou douloureux ?",
      options: [
        { value: false, label: "Non, tolérance normale" },
        { value: true, label: "Oui (vaisselle, sonnette, sirènes, enfants qui crient)" }
      ]
    },
    {
      id: "lifestyle",
      question: "Quelle est votre situation d'écoute la plus fréquente et la plus importante ?",
      options: [
        { value: "calm_home", label: "Principalement au calme chez soi (télévision, lecture, tête-à-tête)" },
        { value: "social_family", label: "Repas de famille et réunions amicales (4 à 8 personnes)" },
        { value: "active_pro", label: "Vie active, réunions professionnelles, conférences ou restaurants fréquents" }
      ]
    },
    {
      id: "fatigue",
      question: "Ressentez-vous une sensation de fatigue auditive ou de maux de tête après une journée sociale ?",
      options: [
        { value: 1, label: "Très rarement" },
        { value: 2, label: "Parfois en fin de journée" },
        { value: 3, label: "Souvent, besoin impératif d'isolement et de silence" }
      ]
    }
  ];

  // Analyseur local de compte-rendu ORL / Anamnèse en texte libre (100% Hors-ligne & RGPD)
  function parseMedicalNotesLocally(text) {
    if (!text || !text.trim()) return null;
    const lower = text.toLowerCase();

    const entities = {
      pathologies: [],
      symptoms: [],
      devices: [],
      earsMentioned: [],
      riskFactors: []
    };

    // Détection de pathologies
    if (lower.includes("presbyacousie") || lower.includes("presbyacous")) entities.pathologies.push("Presbyacousie");
    if (lower.includes("otospongiose")) entities.pathologies.push("Otospongiose");
    if (lower.includes("ménière") || lower.includes("meniere")) entities.pathologies.push("Maladie de Menière");
    if (lower.includes("traumatisme sonore") || lower.includes("blast")) entities.pathologies.push("Traumatisme sonore");
    if (lower.includes("otite") || lower.includes("tympan")) entities.pathologies.push("Antécédent d'otite / tympan");
    if (lower.includes("neurinome")) entities.pathologies.push("Neurinome acoustique");

    // Détection de symptômes
    if (lower.includes("acouphèn") || lower.includes("bourdonnement") || lower.includes("sifflement")) entities.symptoms.push("Acouphènes");
    if (lower.includes("hyperacous") || lower.includes("intolérance aux bruits forts")) entities.symptoms.push("Hyperacousie");
    if (lower.includes("vertige") || lower.includes("instabilité")) entities.symptoms.push("Vertiges ou troubles de l'équilibre");
    if (lower.includes("fatigue") || lower.includes("épuisement")) entities.symptoms.push("Fatigue d'écoute marquée");

    // Détection oreilles
    if (lower.includes("oreille droite") || lower.includes("od ") || lower.includes("od:")) entities.earsMentioned.push("Oreille Droite (OD)");
    if (lower.includes("oreille gauche") || lower.includes("og ") || lower.includes("og:")) entities.earsMentioned.push("Oreille Gauche (OG)");
    if (lower.includes("bilatéral") || lower.includes("deux oreilles")) entities.earsMentioned.push("Bilatéral");

    // Détection d'appareils
    if (lower.includes("ric") || lower.includes("écouteur déporté")) entities.devices.push("Contour RIC");
    if (lower.includes("intra") || lower.includes("cic") || lower.includes("iic")) entities.devices.push("Intra-auriculaire");
    if (lower.includes("bte") || lower.includes("contour classique")) entities.devices.push("Contour BTE classique");
    if (lower.includes("rechargeable")) entities.devices.push("Appareil rechargeable");

    // Extraction de chiffres d'audiogramme si présents (ex: "perte à 45 dB", "PTA 50dB")
    const matchDb = lower.match(/(\d{2})\s*(?:db|décibels)/);
    const estimatedPta = matchDb ? Number(matchDb[1]) : null;

    return {
      entities,
      estimatedPta,
      wordCount: text.trim().split(/\s+/).length,
      privacyGuaranteed: "Ce document a été analysé exclusivement dans votre navigateur (aucune transmission réseau)."
    };
  }

  return {
    FREQS,
    calcPta,
    classifyBiap,
    detectHearingType,
    detectMorphology,
    estimateSII,
    analyzeSpeechAudiometry,
    analyzeSpeechInNoise,
    generatePatientExplanation,
    ANAMNESIS_QUESTIONS,
    parseMedicalNotesLocally
  };
})();

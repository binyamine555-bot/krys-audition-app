/* =========================================================================
   Krys Audition – Mon Parcours Auditif (prototype)
   Données de contenu : corpus d'entraînement, conseils, centres, produits.
   NB : centres, produits et collections sont des données de DÉMONSTRATION
   à remplacer / valider avec le réseau Krys Audition.
   ========================================================================= */

/* ---------- Zones fréquentielles et catégories phonétiques ---------- */
const ZONES = {
  grave:  { label: "Graves (250–500 Hz)",     freqs: [250, 500] },
  medium: { label: "Médiums (1–2 kHz)",       freqs: [1000, 2000] },
  aigu:   { label: "Aigus (3–8 kHz)",         freqs: [3000, 4000, 6000, 8000] }
};

/* Poids de chaque zone dans la perception de chaque catégorie de contraste.
   (Simplification pédagogique des indices acoustiques de la parole.) */
const CATEGORIES = {
  fricatives: {
    label: "Consonnes sifflantes et chuintantes",
    short: "S / CH / F / J",
    desc: "Sons aigus et faibles (s, ch, f, z, j) : souvent les premiers perdus en cas de perte dans les aigus.",
    zones: { grave: 0, medium: 0.25, aigu: 0.75 }
  },
  lieu: {
    label: "Consonnes explosives (lieu)",
    short: "P / T / K",
    desc: "Distinguer p/t/k ou b/d/g : indices dans les médiums-aigus.",
    zones: { grave: 0.1, medium: 0.45, aigu: 0.45 }
  },
  voisement: {
    label: "Consonnes sourdes / sonores",
    short: "P-B / T-D / F-V",
    desc: "Distinguer p/b, t/d, f/v… : indice de voisement dans les graves.",
    zones: { grave: 0.6, medium: 0.35, aigu: 0.05 }
  },
  nasales: {
    label: "Consonnes nasales",
    short: "M / N",
    desc: "Distinguer m/n, m/b, n/d : énergie surtout dans les graves.",
    zones: { grave: 0.6, medium: 0.35, aigu: 0.05 }
  },
  voyelles: {
    label: "Voyelles",
    short: "I / U / OU / AN / ON",
    desc: "Distinguer les voyelles (vie/vue, vent/vont) : graves et médiums.",
    zones: { grave: 0.5, medium: 0.45, aigu: 0.05 }
  }
};

/* ---------- Paires minimales (discrimination phonétique) ---------- */
const MINIMAL_PAIRS = {
  fricatives: [
    ["sou", "chou"], ["seau", "chaud"], ["sang", "champ"], ["basse", "bâche"],
    ["casser", "cacher"], ["sien", "chien"], ["sort", "fort"], ["sable", "fable"],
    ["sou", "fou"], ["soie", "foie"], ["cher", "fer"], ["chaud", "faux"],
    ["case", "cage"], ["rase", "rage"], ["bise", "beige"], ["zone", "jaune"],
    ["sac", "chaque"], ["assez", "haché"]
  ],
  lieu: [
    ["pas", "tas"], ["pente", "tente"], ["pot", "tôt"], ["pomme", "tome"],
    ["tasse", "casse"], ["toi", "quoi"], ["tour", "cour"], ["tache", "cache"],
    ["pas", "cas"], ["port", "corps"], ["pou", "cou"], ["poule", "coule"],
    ["bain", "daim"], ["beau", "dos"], ["bon", "don"], ["balle", "dalle"],
    ["doux", "goût"], ["dalle", "gale"]
  ],
  voisement: [
    ["pain", "bain"], ["poire", "boire"], ["pont", "bon"], ["poule", "boule"],
    ["thé", "dé"], ["tout", "doux"], ["toit", "doigt"], ["ton", "don"],
    ["car", "gare"], ["cou", "goût"], ["classe", "glace"], ["coûter", "goûter"],
    ["fer", "vert"], ["fin", "vin"], ["fou", "vous"], ["poisson", "poison"],
    ["dessert", "désert"], ["chou", "joue"], ["bouche", "bouge"], ["manche", "mange"]
  ],
  nasales: [
    ["mou", "nous"], ["mon", "non"], ["mi", "nid"], ["mage", "nage"],
    ["mal", "bal"], ["mouche", "bouche"], ["main", "bain"], ["masse", "basse"],
    ["nos", "dos"], ["nous", "doux"], ["nez", "dé"], ["nain", "daim"],
    ["mot", "beau"], ["mère", "nerf"]
  ],
  voyelles: [
    ["vie", "vue"], ["riz", "rue"], ["lit", "lu"], ["pire", "pur"],
    ["vu", "vous"], ["rue", "roue"], ["tu", "tout"], ["pur", "pour"],
    ["vent", "vont"], ["banc", "bon"], ["lent", "long"], ["dent", "don"],
    ["bain", "banc"], ["vin", "vent"], ["sein", "sang"],
    ["beau", "bout"], ["mot", "mou"], ["dos", "doux"]
  ]
};

/* ---------- Mots dans le bruit : ensembles fermés de rimes ---------- */
const RHYME_SETS = [
  ["balle", "malle", "salle", "dalle"],
  ["pain", "bain", "main", "nain"],
  ["chou", "sou", "fou", "loup"],
  ["mer", "fer", "vert", "cher"],
  ["dos", "peau", "seau", "mot"],
  ["rue", "vue", "lu", "bu"],
  ["pont", "bon", "son", "long"],
  ["tasse", "casse", "masse", "basse"],
  ["nage", "cage", "page", "rage"],
  ["boule", "poule", "foule", "moule"],
  ["pile", "file", "ville", "mille"],
  ["gare", "car", "phare", "mare"],
  ["tour", "four", "cour", "jour"],
  ["roche", "poche", "moche", "cloche"],
  ["natte", "patte", "chatte", "datte"],
  ["lampe", "rampe", "campe", "tempe"],
  ["sel", "pelle", "belle", "celle"],
  ["vache", "tache", "hache", "cache"],
  ["bise", "mise", "grise", "prise"],
  ["fête", "tête", "bête", "quête"],
  ["poire", "boire", "foire", "noire"],
  ["mouche", "bouche", "douche", "couche"]
];

/* ---------- Chiffres dans le bruit ---------- */
const DIGITS = { 1: "un", 2: "deux", 3: "trois", 4: "quatre", 5: "cinq", 6: "six", 7: "sept", 8: "huit", 9: "neuf" };

/* ---------- Compréhension de phrases ---------- */
const SENTENCES = [
  { s: "Marie a acheté trois pommes au marché.", q: "Combien de pommes Marie a-t-elle achetées ?", a: "Trois", o: ["Deux", "Trois", "Quatre"] },
  { s: "Le rendez-vous chez le dentiste est mardi à dix heures.", q: "Quel jour est le rendez-vous ?", a: "Mardi", o: ["Lundi", "Mardi", "Jeudi"] },
  { s: "Paul a garé sa voiture rouge devant la boulangerie.", q: "De quelle couleur est la voiture ?", a: "Rouge", o: ["Bleue", "Rouge", "Grise"] },
  { s: "Le train pour Lyon partira avec vingt minutes de retard.", q: "Où va le train ?", a: "Lyon", o: ["Lille", "Lyon", "Nantes"] },
  { s: "Ma petite-fille viendra déjeuner dimanche avec son chien.", q: "Avec qui viendra la petite-fille ?", a: "Son chien", o: ["Son chat", "Son chien", "Son mari"] },
  { s: "N'oubliez pas de prendre le pain et le fromage.", q: "Que faut-il prendre avec le pain ?", a: "Le fromage", o: ["Le fromage", "Le beurre", "Le lait"] },
  { s: "La pharmacie ferme à dix-neuf heures ce soir.", q: "À quelle heure ferme la pharmacie ?", a: "Dix-neuf heures", o: ["Dix-huit heures", "Dix-neuf heures", "Vingt heures"] },
  { s: "Il pleuvra demain matin, puis le soleil reviendra l'après-midi.", q: "Quel temps fera-t-il demain matin ?", a: "De la pluie", o: ["Du soleil", "De la pluie", "De la neige"] },
  { s: "Sophie a rangé les clés dans le tiroir de la cuisine.", q: "Où sont les clés ?", a: "Dans la cuisine", o: ["Dans l'entrée", "Dans la cuisine", "Dans la chambre"] },
  { s: "Le film commence à vingt et une heures au cinéma du centre.", q: "Où se passe la séance ?", a: "Au cinéma", o: ["Au théâtre", "Au cinéma", "Au musée"] },
  { s: "Mon voisin joue du piano tous les mercredis.", q: "De quel instrument joue le voisin ?", a: "Du piano", o: ["Du violon", "De la guitare", "Du piano"] },
  { s: "Nous partirons en vacances à la montagne au mois de juillet.", q: "Où partiront-ils ?", a: "À la montagne", o: ["À la mer", "À la montagne", "À la campagne"] },
  { s: "Le facteur a déposé un colis chez la gardienne.", q: "Qui a le colis ?", a: "La gardienne", o: ["La voisine", "La gardienne", "La boulangère"] },
  { s: "Pour le dessert, il y aura une tarte aux fraises.", q: "Quelle tarte y aura-t-il ?", a: "Aux fraises", o: ["Aux pommes", "Aux fraises", "Au citron"] },
  { s: "Jacques prend le bus numéro douze pour aller au travail.", q: "Quel bus prend Jacques ?", a: "Le douze", o: ["Le deux", "Le douze", "Le seize"] },
  { s: "La réunion a été déplacée de jeudi à vendredi.", q: "Quel jour aura lieu la réunion ?", a: "Vendredi", o: ["Jeudi", "Vendredi", "Samedi"] },
  { s: "Elle a offert un bouquet de roses blanches à sa mère.", q: "Quelles fleurs a-t-elle offertes ?", a: "Des roses", o: ["Des tulipes", "Des roses", "Des lys"] },
  { s: "Le médecin conseille de marcher trente minutes par jour.", q: "Combien de temps faut-il marcher ?", a: "Trente minutes", o: ["Quinze minutes", "Trente minutes", "Une heure"] },
  { s: "Les enfants jouent au ballon dans le jardin.", q: "Où jouent les enfants ?", a: "Dans le jardin", o: ["Dans la rue", "Dans le jardin", "Dans le salon"] },
  { s: "J'ai rendez-vous chez l'audioprothésiste le quinze mars.", q: "Quelle est la date du rendez-vous ?", a: "Le quinze mars", o: ["Le cinq mars", "Le quinze mars", "Le quinze mai"] },
  { s: "Le café est trop chaud, attends quelques minutes.", q: "Pourquoi faut-il attendre ?", a: "Le café est chaud", o: ["Le café est froid", "Le café est chaud", "Le café est sucré"] },
  { s: "Notre fils habite à Bordeaux depuis deux ans.", q: "Où habite le fils ?", a: "À Bordeaux", o: ["À Bordeaux", "À Toulouse", "À Marseille"] }
];

/* ---------- Mémoire auditive : vocabulaire ---------- */
const MEMORY_WORDS = [
  "pomme", "maison", "soleil", "chaise", "voiture", "livre", "fleur", "chat",
  "table", "lune", "pain", "bateau", "clé", "jardin", "montre", "verre",
  "robe", "train", "oiseau", "cadeau", "piano", "orange", "tasse", "valise"
];

/* ---------- Conseils (utilisation, entretien, adaptation…) ---------- */
/* tags : "all" | "rechargeable" | "piles" | "ric" | "contour" | "intra" */
const TIPS = [
  /* Adaptation */
  { id: "adapt-1", cat: "adaptation", tags: ["all"], title: "Les premiers jours : tout semble trop fort",
    body: "C'est normal ! Votre cerveau redécouvre des sons qu'il n'entendait plus (froissement de papier, eau du robinet, vos pas…). Portez vos aides auditives un peu plus chaque jour : l'adaptation prend généralement de 4 à 12 semaines." },
  { id: "adapt-2", cat: "adaptation", tags: ["all"], title: "Portez vos aides toute la journée",
    body: "Plus vous les portez, plus le cerveau s'habitue vite. L'objectif est de les porter du lever au coucher, y compris à la maison, dans le calme." },
  { id: "adapt-3", cat: "adaptation", tags: ["all"], title: "Votre propre voix vous paraît bizarre ?",
    body: "Beaucoup de patients trouvent leur voix « dans un tonneau » au début. Parlez-en à votre audioprothésiste : un réglage ou un changement d'embout peut améliorer cette sensation." },
  { id: "adapt-4", cat: "adaptation", tags: ["all"], title: "Commencez par les situations calmes",
    body: "Conversation à deux, radio, lecture à voix haute : progressez du calme vers le bruit (repas de famille, restaurant). Les exercices de l'application suivent la même logique." },

  /* Utilisation */
  { id: "use-1", cat: "utilisation", tags: ["all"], title: "Bien mettre ses aides auditives",
    body: "Repérez la couleur : rouge = oreille droite, bleu = oreille gauche. Faites-le assis, au-dessus d'une table ou d'un lit, pour éviter les chutes." },
  { id: "use-2", cat: "utilisation", tags: ["all"], title: "Au restaurant",
    body: "Placez-vous dos au mur et face à vos interlocuteurs, loin de la cuisine. Activez le programme « bruit » si votre appareil en dispose." },
  { id: "use-3", cat: "utilisation", tags: ["all"], title: "Téléphone et télévision",
    body: "Vos aides peuvent souvent recevoir le son du téléphone ou de la TV directement en Bluetooth (ou via un accessoire TV). Demandez une démonstration en centre." },
  { id: "use-4", cat: "utilisation", tags: ["all"], title: "Vous pouvez faire les exercices en streaming",
    body: "Si vos aides sont connectées au téléphone, le son des exercices sera transmis directement dans vos oreilles. Sinon, utilisez le haut-parleur du téléphone à environ 1 mètre." },

  /* Entretien */
  { id: "care-1", cat: "entretien", tags: ["all"], title: "Le nettoyage quotidien (1 minute)",
    body: "Chaque soir, essuyez vos aides avec une lingette sèche ou spéciale. N'utilisez jamais d'eau, d'alcool ou de produits ménagers." },
  { id: "care-2", cat: "entretien", tags: ["ric", "intra"], title: "Changer le filtre pare-cérumen",
    body: "Si le son devient faible ou absent, le filtre est peut-être bouché. Remplacez-le environ une fois par mois (ou plus si vous produisez beaucoup de cérumen)." },
  { id: "care-3", cat: "entretien", tags: ["ric", "contour"], title: "Changer les dômes",
    body: "Les dômes (petites coupoles souples) se remplacent environ tous les 2 à 3 mois, ou dès qu'ils sont jaunis ou déformés." },
  { id: "care-4", cat: "entretien", tags: ["contour"], title: "Le tube et l'embout",
    body: "Pour un contour avec embout sur mesure : nettoyez l'embout à l'eau tiède savonneuse après l'avoir détaché de l'appareil, et séchez-le bien. Le tube se change tous les 6 mois environ." },
  { id: "care-5", cat: "entretien", tags: ["all"], title: "L'ennemi n°1 : l'humidité",
    body: "Retirez vos aides pour la douche, la piscine, le sèche-cheveux et la laque. Un déshumidificateur nocturne prolonge la durée de vie des appareils." },
  { id: "care-6", cat: "entretien", tags: ["all"], title: "Un entretien en centre tous les 6 mois",
    body: "Votre centre Krys Audition contrôle et nettoie en profondeur vos appareils. Profitez-en pour faire le point sur votre adaptation." },

  /* Énergie */
  { id: "pow-1", cat: "energie", tags: ["rechargeable"], title: "Rechargez chaque nuit",
    body: "Placez vos aides dans le chargeur tous les soirs, même si la batterie n'est pas vide. Une charge complète dure environ 3 à 4 heures." },
  { id: "pow-2", cat: "energie", tags: ["rechargeable"], title: "En voyage",
    body: "Pensez à emporter le chargeur et son câble. Certains chargeurs ont une batterie intégrée pour plusieurs recharges sans prise." },
  { id: "pow-3", cat: "energie", tags: ["piles"], title: "Activez la pile 1 minute",
    body: "Retirez l'adhésif de la pile et attendez environ 1 minute avant de la mettre dans l'appareil : elle durera plus longtemps." },
  { id: "pow-4", cat: "energie", tags: ["piles"], title: "Ouvrez le tiroir pile la nuit",
    body: "Ouvrir le tiroir la nuit éteint l'appareil, économise la pile et laisse l'humidité s'évacuer." },

  /* Entourage */
  { id: "fam-1", cat: "entourage", tags: ["all"], title: "Conseils à partager avec vos proches",
    body: "Parlez face à la personne, sans crier, en articulant normalement. Attirez son attention avant de parler et évitez de parler d'une autre pièce." },
  { id: "fam-2", cat: "entourage", tags: ["all"], title: "Reformuler plutôt que répéter",
    body: "Si un mot n'est pas compris, dites-le autrement plutôt que de répéter plus fort : un autre mot peut être plus facile à percevoir." }
];

const TIP_CATEGORIES = {
  adaptation: "Adaptation",
  utilisation: "Utilisation",
  entretien: "Entretien",
  energie: "Batterie & piles",
  entourage: "Pour vos proches"
};

/* ---------- Dépannage guidé ---------- */
const TROUBLESHOOT = {
  start: { q: "Quel est le problème ?", options: [
    { label: "Je n'entends plus rien", next: "nosound" },
    { label: "Le son est faible ou étouffé", next: "weak" },
    { label: "L'appareil siffle", next: "whistle" },
    { label: "Le son grésille ou coupe", next: "crackle" },
    { label: "Mon appareil me fait mal", next: "pain" }
  ]},
  nosound: { q: "L'appareil est-il allumé et chargé (ou la pile neuve) ?", options: [
    { label: "Non / je ne sais pas", end: "Rechargez l'appareil ou remplacez la pile, puis rallumez-le. Pour un appareil à pile, vérifiez que le tiroir est bien fermé." },
    { label: "Oui", next: "filter" }
  ]},
  weak: { q: "Avez-vous vérifié le dôme ou l'embout ?", options: [
    { label: "Il est sale ou bouché", end: "Nettoyez ou remplacez le dôme / l'embout et changez le filtre pare-cérumen." },
    { label: "Il est propre", next: "filter" }
  ]},
  filter: { q: "Avez-vous changé le filtre pare-cérumen récemment ?", options: [
    { label: "Non", end: "Changez le filtre pare-cérumen : c'est la cause la plus fréquente de perte de son. Une vidéo est disponible dans « Conseils »." },
    { label: "Oui, ça ne change rien", next: "humidity" }
  ]},
  humidity: { q: "L'appareil a-t-il pu prendre l'humidité (pluie, transpiration, douche) ?", options: [
    { label: "Oui, peut-être", end: "Placez l'appareil une nuit dans un déshumidificateur (ou une boîte avec sachet dessicant). Si le problème persiste, contactez votre centre." },
    { label: "Non", contact: true, end: "Votre appareil a besoin d'être vérifié par votre audioprothésiste. Le contrôle est généralement rapide." }
  ]},
  whistle: { q: "Quand l'appareil siffle-t-il ?", options: [
    { label: "Quand je le mets ou l'enlève", end: "C'est normal (effet Larsen) : le son s'arrête une fois l'appareil bien en place." },
    { label: "Quand il est en place", next: "whistle2" }
  ]},
  whistle2: { q: "L'appareil est-il bien enfoncé dans le conduit ?", options: [
    { label: "Je ne suis pas sûr(e)", end: "Retirez-le et remettez-le en poussant doucement vers l'intérieur. Un excès de cérumen peut aussi provoquer des sifflements : consultez votre médecin si besoin." },
    { label: "Oui, il est bien mis", contact: true, end: "Un ajustement du réglage ou de l'embout peut être nécessaire. Prenez rendez-vous avec votre centre." }
  ]},
  crackle: { q: "Le problème apparaît-il surtout en Bluetooth (téléphone, TV) ?", options: [
    { label: "Oui", end: "Rapprochez le téléphone, désactivez puis réactivez le Bluetooth, ou redémarrez les aides auditives (éteindre / rallumer)." },
    { label: "Non, tout le temps", contact: true, end: "Il peut s'agir d'humidité ou d'un écouteur abîmé. Contactez votre centre pour une vérification." }
  ]},
  pain: { q: "La douleur est-elle apparue récemment ?", options: [
    { label: "Oui", contact: true, end: "Retirez l'appareil et contactez votre centre : l'embout ou le dôme doit sans doute être ajusté. En cas d'écoulement ou de douleur forte, consultez un médecin." },
    { label: "Depuis l'appareillage", contact: true, end: "Une gêne persistante n'est pas normale. Votre audioprothésiste peut modifier la taille du dôme ou retoucher l'embout." }
  ]}
};

/* ---------- Centres (DÉMO) ---------- */
const CENTERS = [
  { id: "c1", name: "Krys Audition – Paris Bastille (démo)", address: "12 rue de la Roquette, 75011 Paris", phone: "01 00 00 00 01",
    email: "bastille@exemple-krys-audition.fr", hours: [["Lun", "Fermé"], ["Mar–Ven", "9h30 – 19h00"], ["Sam", "9h30 – 18h00"], ["Dim", "Fermé"]],
    audiologist: "Benjamin Cohen" },
  { id: "c2", name: "Krys Audition – Lyon Part-Dieu (démo)", address: "5 boulevard Vivier-Merle, 69003 Lyon", phone: "04 00 00 00 02",
    email: "lyon@exemple-krys-audition.fr", hours: [["Lun", "14h00 – 19h00"], ["Mar–Sam", "9h30 – 19h00"], ["Dim", "Fermé"]],
    audiologist: "Claire Martin" },
  { id: "c3", name: "Krys Audition – Marseille Prado (démo)", address: "80 avenue du Prado, 13008 Marseille", phone: "04 00 00 00 03",
    email: "marseille@exemple-krys-audition.fr", hours: [["Lun–Ven", "9h00 – 19h00"], ["Sam", "9h00 – 17h00"], ["Dim", "Fermé"]],
    audiologist: "Karim Benali" }
];

/* ---------- Types de rendez-vous ---------- */
const APPT_TYPES = {
  controle: "Contrôle d'adaptation",
  reglage: "Réglage des aides auditives",
  entretien: "Entretien / nettoyage",
  bilan: "Bilan auditif annuel",
  optique: "Examen de vue / optique",
  autre: "Autre"
};

/* Parcours de suivi recommandé après appareillage (jours) */
const FOLLOWUP_PLAN = [
  { days: 7,   type: "controle",  label: "Contrôle J+7" },
  { days: 21,  type: "reglage",   label: "Réglage J+21" },
  { days: 30,  type: "controle",  label: "Fin de période d'essai" },
  { days: 90,  type: "reglage",   label: "Contrôle 3 mois" },
  { days: 180, type: "entretien", label: "Entretien 6 mois" },
  { days: 365, type: "bilan",     label: "Bilan annuel" }
];

/* Rappels d'entretien récurrents (jours) */
const MAINTENANCE = [
  { id: "filtre", label: "Changer le filtre pare-cérumen", every: 30, tags: ["ric", "intra"] },
  { id: "dome",   label: "Changer les dômes",             every: 90, tags: ["ric", "contour"] },
  { id: "tube",   label: "Changer le tube",               every: 180, tags: ["contour"] },
  { id: "deshu",  label: "Nettoyer / changer le dessicant", every: 60, tags: ["all"] }
];

/* ---------- Catalogue Audition (DÉMO, à valider avec Krys) ---------- */
const PRODUCTS_AUDIO = [
  { id: "p1", cat: "Aides auditives", name: "Contour à écouteur déporté (RIC)", desc: "Discret, polyvalent, souvent rechargeable et connecté Bluetooth.", tag: "Le plus choisi" },
  { id: "p2", cat: "Aides auditives", name: "Intra-auriculaire sur mesure", desc: "Logé dans le conduit, presque invisible.", tag: "Discrétion" },
  { id: "p3", cat: "Aides auditives", name: "Offre 100 % Santé (classe I)", desc: "Aides auditives sans reste à charge avec une complémentaire santé responsable.", tag: "0 € de reste à charge" },
  { id: "p4", cat: "Accessoires", name: "Émetteur TV", desc: "Le son de la télévision directement dans vos aides, au volume de votre choix.", tag: "Confort" },
  { id: "p5", cat: "Accessoires", name: "Microphone déporté", desc: "À poser sur la table au restaurant ou à confier à votre interlocuteur.", tag: "Bruit" },
  { id: "p6", cat: "Accessoires", name: "Kit d'entretien & déshumidificateur", desc: "Lingettes, filtres, dômes et boîte de séchage.", tag: "Entretien" },
  { id: "p7", cat: "Protection", name: "Protections auditives sur mesure", desc: "Musique, sommeil, natation, bruit professionnel.", tag: "Sur mesure" },
  { id: "p8", cat: "Services", name: "Bilan auditif", desc: "Test de l'audition en centre, sur rendez-vous.", tag: "Service" },
  { id: "p9", cat: "Services", name: "Suivi et entretien illimités", desc: "Contrôles, réglages et nettoyages pendant toute la durée de vie des appareils (selon offre).", tag: "Service" }
];

/* ---------- Optique : collections réelles Krys & Synergie Audition ---------- */
const FRAMES = [
  {
    id: "f1",
    name: "Krys Signature – Panthéon",
    shape: "pantos",
    colorType: "tortoise",
    lensType: "clear_antireflect",
    collection: "Krys Signature",
    tag: "Origine France Garantie",
    category: "france",
    material: "Acétate d'Italie façon écaille ambrée",
    desc: "L'icône de l'élégance française. Finition polie à la main à Bazainville. Branches ergonomiques ultra-douces compatibles aides auditives.",
    price: "129 € (Verres inclus)",
    badges: ["Origine France Garantie", "Compatible Aides Auditives", "Acétate Mazzucchelli"]
  },
  {
    id: "f2",
    name: "Krys Duo Tech – Alvéole",
    shape: "rect_titanium",
    colorType: "titanium",
    lensType: "blue_block",
    collection: "Krys Duo Tech",
    tag: "Spécial Aides Auditives",
    category: "duo_audio",
    material: "Titane pur japonais ultra-léger (12g)",
    desc: "Branches plates biseautées brevetées Zéro Frottement. Glisse sans contact le long du contour d'oreille RIC sans aucun sifflement larsen.",
    price: "159 € (Verres inclus)",
    badges: ["Zéro Pression Oreille", "Titane Mémoire", "Anti-Lumière Bleue"]
  },
  {
    id: "f3",
    name: "Krys Atelier – Saint-Germain",
    shape: "round",
    colorType: "gold",
    lensType: "clear_antireflect",
    collection: "Krys Atelier",
    tag: "Best-Seller",
    category: "france",
    material: "Acier inoxydable or champagne brossé",
    desc: "Silhouette ronde intellectuelle intemporelle. Plaquettes de nez transparentes en silicone médical pour une tenue sans glissement.",
    price: "139 € (Verres inclus)",
    badges: ["Plaquettes Médicales", "Ultra-Légère 14g", "Verres Clairs HD"]
  },
  {
    id: "f4",
    name: "Krys Urbaine – Rivoli",
    shape: "square",
    colorType: "black",
    lensType: "blue_block",
    collection: "Krys Urbaine",
    tag: "Tendance 2026",
    category: "tendance",
    material: "Acétate noir onyx haute densité",
    desc: "Lignes affirmées et biseaux architecturaux. Équipée en série de verres protecteurs anti-lumière bleue pour écrans et télévision.",
    price: "119 € (Verres inclus)",
    badges: ["Filtre Écrans & TV", "Acétate Noir Onyx", "Charnières Renforcées"]
  },
  {
    id: "f5",
    name: "Krys Solaire – Aéropostale",
    shape: "aviator",
    colorType: "aviator_gold",
    lensType: "polarized_amber",
    collection: "Krys Solaire",
    tag: "Solaire Polarisée",
    category: "solaire",
    material: "Métal doré double-pont & manchons écaille",
    desc: "Légendaire forme pilote aviateur. Verres polarisés catégorie 3 supprimant 99% des reflets parasites sur route et sur l'eau.",
    price: "149 € (Verres solaires)",
    badges: ["100% UV400", "Polarisée Catégorie 3", "Double Pont Pilote"]
  },
  {
    id: "f6",
    name: "Krys Élégance – Concorde",
    shape: "cateye",
    colorType: "bordeaux",
    lensType: "clear_antireflect",
    collection: "Krys Élégance",
    tag: "Coup de Cœur",
    category: "tendance",
    material: "Acétate translucide bordeaux & reflets framboise",
    desc: "Forme papillon gracieuse qui rehausse naturellement le regard. Équilibre parfait et branches souples idéales en double port audio-visuel.",
    price: "139 € (Verres inclus)",
    badges: ["Effet Rehausseur", "Nuance Framboise", "Branches Affinées"]
  },
  {
    id: "f7",
    name: "Krys Essentiel – Vendôme",
    shape: "crystal",
    colorType: "crystal",
    lensType: "clear_antireflect",
    collection: "Krys 100% Santé",
    tag: "100% Santé (0€)",
    category: "sante100",
    material: "Bio-acétate cristal éco-responsable",
    desc: "Offre 100% Santé Panier A Krys : monture esthétique et verres correcteurs traités anti-rayures et anti-reflets sans aucun reste à charge.",
    price: "0 € de reste à charge",
    badges: ["Zéro Reste à Charge", "Bio-Acétate Éco", "Anti-Reflets Inclus"]
  },
  {
    id: "f8",
    name: "Krys Solaire – Croisette",
    shape: "browline",
    colorType: "tortoise",
    lensType: "polarized_smoke",
    collection: "Krys Solaire",
    tag: "Solaire Rétro",
    category: "solaire",
    material: "Face combinée écaille havane & métal or",
    desc: "L'allure vintage iconique des années 60. Verres teintés minéraux bruns contrastants, confort suprême en plein soleil.",
    price: "159 € (Verres solaires)",
    badges: ["Protection Catégorie 3", "Combiné Rétro Chic", "Verres Polarisés"]
  }
];

const OPTIC_SERVICES = [
  {
    name: "Examen de Vue & Réfraction Certifiée",
    desc: "Contrôle visuel approfondi en cabine d'optométrie par nos opticiens diplômés (selon prescription médicale en cours de validité).",
    icon: "eye",
    tag: "En Magasin"
  },
  {
    name: "Verres Progressifs Haute Précision Krys",
    desc: "Champs de vision panoramiques et transition fluide de près comme de loin, individualisés selon votre morphologie faciale.",
    icon: "glasses",
    tag: "Fabrication Française"
  },
  {
    name: "Lentilles de Contact & Contactologie",
    desc: "Apprentissage de la pose, adaptation personnalisée (souples, rigides ou toriques) et suivi régulier de la santé cornéenne.",
    icon: "target",
    tag: "Adaptation Offerte"
  },
  {
    name: "Offre 100% Santé Optique (Zéro Reste à Charge)",
    desc: "Sélection rigoureuse de montures élégantes et verres anti-reflets / anti-rayures intégralement pris en charge par l'Assurance Maladie et votre mutuelle.",
    icon: "shield",
    tag: "Prise en charge 100%"
  },
  {
    name: "Protocole Spécial Duo Lunettes & Aides Auditives",
    desc: "Ajustement sur mesure des branches en magasin par nos équipes mixtes Optique & Audition pour éliminer tout conflit avec vos appareils.",
    icon: "ear",
    tag: "Exclusivité Krys"
  }
];

/* ---------- Audiogrammes types (démo / saisie rapide) ---------- */
const AUDIO_FREQS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];
const AUDIOGRAM_PRESETS = {
  presbyLight: { label: "Presbyacousie légère",
    right: { 250: 15, 500: 20, 1000: 25, 2000: 35, 3000: 40, 4000: 45, 6000: 50, 8000: 55 },
    left:  { 250: 15, 500: 20, 1000: 25, 2000: 30, 3000: 40, 4000: 45, 6000: 55, 8000: 60 } },
  presbyMod: { label: "Presbyacousie moyenne (pente)",
    right: { 250: 25, 500: 30, 1000: 40, 2000: 50, 3000: 55, 4000: 60, 6000: 65, 8000: 70 },
    left:  { 250: 25, 500: 30, 1000: 40, 2000: 55, 3000: 60, 4000: 65, 6000: 70, 8000: 75 } },
  skiSlope: { label: "Chute brutale dans les aigus",
    right: { 250: 10, 500: 15, 1000: 20, 2000: 50, 3000: 65, 4000: 70, 6000: 75, 8000: 80 },
    left:  { 250: 10, 500: 15, 1000: 25, 2000: 55, 3000: 65, 4000: 75, 6000: 80, 8000: 80 } },
  noiseNotch: { label: "Encoche à 4 kHz (traumatisme sonore)",
    right: { 250: 10, 500: 10, 1000: 15, 2000: 25, 3000: 45, 4000: 55, 6000: 45, 8000: 30 },
    left:  { 250: 10, 500: 15, 1000: 15, 2000: 30, 3000: 50, 4000: 60, 6000: 50, 8000: 35 } },
  flat: { label: "Perte plate moyenne",
    right: { 250: 50, 500: 50, 1000: 55, 2000: 55, 3000: 55, 4000: 60, 6000: 60, 8000: 65 },
    left:  { 250: 45, 500: 50, 1000: 50, 2000: 55, 3000: 55, 4000: 55, 6000: 60, 8000: 60 } },
  rising: { label: "Perte dans les graves (ascendante)",
    right: { 250: 55, 500: 50, 1000: 40, 2000: 30, 3000: 25, 4000: 20, 6000: 25, 8000: 25 },
    left:  { 250: 50, 500: 45, 1000: 40, 2000: 30, 3000: 25, 4000: 25, 6000: 25, 8000: 30 } }
};

/* ---------- Journal d'adaptation : situations évaluées ---------- */
const JOURNAL_SITUATIONS = [
  { id: "calme",  label: "Conversation au calme",      icon: "users" },
  { id: "bruit",  label: "Conversation dans le bruit", icon: "volume" },
  { id: "tv",     label: "Télévision / radio",         icon: "tv" },
  { id: "tel",    label: "Téléphone",                  icon: "phone" },
  { id: "confort",label: "Confort / port des appareils", icon: "ear" }
];

/* ---------- Simulateur d'Environnements Sonores Krys ---------- */
const SOUNDSCAPES = [
  {
    id: "babble",
    name: "Restaurant & Déjeuner animé",
    icon: "users",
    type: "babble",
    tag: "Effet Cocktail Party",
    desc: "Brouhaha de voix croisées, conversations multiples et bruits de salle de restaurant.",
    challenge: "Isoler une voix au milieu d'autres conversations simultanées.",
    techNote: "Vos aides auditives Krys activent leurs microphones directifs pour privilégier l'interlocuteur face à vous tout en atténuant le brouhaha latéral."
  },
  {
    id: "traffic",
    name: "Boulevard & Circulation urbaine",
    icon: "map-pin",
    type: "traffic",
    tag: "Bruit sourd & continu",
    desc: "Grondement de la circulation automobile, bus, roulement sur le bitume.",
    challenge: "Conserver un confort d'écoute optimal dans la rue sans être saturé par les basses fréquences.",
    techNote: "L'atténuateur de bruit de roulement Krys compresse les grondements graves tout en maintenant l'audibilité des signaux d'avertissement."
  },
  {
    id: "dishes",
    name: "Cuisine & Bruits de Vaisselle",
    icon: "tool",
    type: "dishes",
    tag: "Chocs impulsionnels",
    desc: "Entrechoc des assiettes, des verres, de l'évier et tintements métalliques des couverts.",
    challenge: "Tolérer les sons aigus et claquants sans crispation ni sensation d'agressivité.",
    techNote: "Le module anti-choc transitoire Krys réagit en moins d'une milliseconde pour amortir les pics sonores métalliques sans altérer la parole."
  },
  {
    id: "pink",
    name: "Salon & Ventilation continue",
    icon: "volume",
    type: "pink",
    tag: "Fond diffus",
    desc: "Souffle continu de climatisation, fond sonore domestique régulier.",
    challenge: "Maintenir une attention fluide sans ressentir de fatigue cognitive en fin de journée.",
    techNote: "Le filtre de bruit stationnaire Krys soustrait le bruit de fond continu pour faire émerger les consonnes fragiles."
  }
];

/* ---------- Badges d'Assiduité & Récompenses Krys ---------- */
const KRYS_BADGES = [
  { id: "start", name: "Premier Pas", icon: "zap", desc: "Avoir commencé son parcours d'adaptation", check: (s) => (s.training && s.training.sessions && s.training.sessions.length >= 1) },
  { id: "streak3", name: "Habitude Prise", icon: "target", desc: "3 jours consécutifs d'entraînement", check: (s) => (typeof Training !== "undefined" && Training.streak() >= 3) },
  { id: "streak7", name: "Oreille d'Or", icon: "star", desc: "7 jours d'assiduité consécutifs", check: (s) => (typeof Training !== "undefined" && Training.streak() >= 7) },
  { id: "audiogram", name: "Bilan Complet", icon: "ear", desc: "Audiogramme tonal ou vocal renseigné", check: (s) => !!s.audiogram },
  { id: "calibration", name: "Mobile Calibré", icon: "sliders", desc: "Smartphone étalonné pour une écoute fidèle", check: (s) => !!(s.calibration && s.calibration.calibrated) },
  { id: "soundscape", name: "Explorateur Sonore", icon: "volume", desc: "Avoir testé les ambiances sonores Krys", check: (s) => !!(s.training && (s.training.soundscapeTested || (s.training.sessions && s.training.sessions.some(x => x.ex === "noise")))) },
  { id: "anamnesis", name: "Anamnèse Réalisée", icon: "shield", desc: "Questionnaire médical complété", check: (s) => !!s.anamnesis },
  { id: "champion", name: "Ambassadeur Krys", icon: "heart", desc: "10 séances d'adaptation accomplies", check: (s) => (s.training && s.training.sessions && s.training.sessions.length >= 10) }
];

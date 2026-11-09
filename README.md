# Krys Audition – Mon Parcours Auditif

> **Application d'accompagnement, d'entraînement auditif personnalisé et de suivi pour les patients appareillés au sein du réseau Krys Audition.**  
> *Projet conçu par **Benjamin Joseph Cohen**, Audioprothésiste diplômé du Cnam Paris.*

---

## 🎯 Vision & Objectifs du Projet

Aujourd'hui, l'adaptation à de nouvelles aides auditives requiert entre 4 et 12 semaines d'habituation cérébrale. Très peu de solutions offrent un accompagnement quotidien et gratuit pour le patient appareillé.

**Mon Parcours Auditif** transforme l'expérience patient en proposant un véritable écosystème de services et de rééducation auditive :
1. **Entraînement auditif personnalisé et gratuit** basé sur l'audiogramme tonal et vocal du patient.
2. **Répertoire complet des centres Krys Audition en France** avec géolocalisation, contact direct et prise de rendez-vous.
3. **Étalonnage acoustique smartphone de haute précision** garantissant la validité scientifique des exercices sur tout appareil mobile.
4. **Analyse clinique précise (Tonal, Vocal, Parole dans le bruit)** et vulgarisation bienveillante pour expliquer à chaque patient pourquoi son entraînement est ciblé.
5. **Questionnaire d'anamnèse & analyseur local de compte-rendu ORL** dans le respect strict des données de santé (RGPD & secret médical).
6. **Passerelle Optique & Audition** pour découvrir les collections de montures et innovations du réseau Krys.

---

## 🔬 Architecture Clinique & Psychoacoustique

### 1. Analyse Audiométrique Tonale & Vocale
- **Conduction Aérienne (VA) & Conduction Osseuse (VO)** avec calcul du GAP ostéo-aérien (Rinne).
- **Classification BIAP** (Bureau International d'Audio-Phonologie) et calcul du Pure Tone Average (PTA 500, 1000, 2000, 4000 Hz).
- **Indice d'Intelligibilité Vocale (SII)** estimé selon la norme ANSI S3.5.
- **Audiométrie Vocale dans le calme** : Seuil de détection (SDT), seuil d'intelligibilité à 50% (SRT), score maximal (PB-Max) et détection de la distorsion supraliminaire (phénomène de *Roll-off*).
- **Compréhension dans le bruit (Speech-In-Noise / French DIN)** : mesure du seuil critique SNR-50 et calcul de la perte de rapport signal/bruit (*SNR Loss*).

### 2. Pourquoi ce programme est recommandé ? (Moteur Pédagogique)
L'application fournit à chaque profil des explications claires et motivantes :
- **Pourquoi le patient dit « J'entends mais je ne comprends pas »** (différence entre l'énergie acoustique des voyelles graves et l'information phonétique des consonnes aiguës).
- **Ce que fait l'aide auditive Krys** (amplification WDRC par canaux fréquentiels) et **ce que le cerveau doit réapprendre** (plasticité synaptique du cortex auditif primaire A1).
- **Pourquoi travailler les fricatives, le bruit de cantine ou la mémoire auditive**.

### 3. Système d'Étalonnage Acoustique Smartphone
Pour surmonter les disparités matérielles entre smartphones Android et iOS, l'application intègre 5 techniques de pointe :
- **Profils de transducteurs** : Streaming direct Bluetooth aides auditives (MFi / ASHA / LE Audio), Casque supra-aural, Écouteurs intra-auriculaires, Haut-parleur téléphone (40 cm).
- **Étalonnage Biologique Normé** : Égalisation sonore sur le froissement d'une feuille de papier A4 standard (~48 dBA à 50 cm).
- **Voix Conversationnelle de Référence** : Réglage sur une phrase standardisée à niveau de parole naturelle (60-65 dB SPL).
- **Son Pur Liminaire 1 000 Hz** : Calibration par la méthode Hughson-Westlake descendante.
- **Sonomètre Ambiant FFT en temps réel** : Contrôle du niveau sonore de la pièce via le microphone pour garantir un environnement calme (< 40 dBA).
- **Balance Inter-aurale G/D** : Test comparatif gauche/droite.

### 4. Anamnèse & Confidentialité RGPD
- Questionnaire d'antécédents (ancienneté de privation, acouphènes, hyperacousie, mode de vie, fatigue auditive).
- **Analyseur local de documents médicaux** : analyse les comptes-rendus ORL **à 100% dans le navigateur** sans transmission vers des serveurs tiers.

---

## 📱 Variété des Entraînements

1. **Paires Minimales de Mots** : Discrimination fine des contrastes phonétiques (fricatives S/CH/F, voisement P-B/T-D, lieu d'articulation P/T/K, nasales M/N, voyelles).
2. **Mots dans le Bruit** : Rimes fermées dans 4 environnements acoustiques réels :
   - *Brouhaha de restaurant / cafeteria*
   - *Circulation urbaine & trafic*
   - *Bruits ménagers (vaisselle, télévision)*
   - *Bruit rose à spectre de parole (ICRA-1)*
3. **Chiffres dans le Bruit (Test DIN adaptatif)** : Mesure objective du seuil SNR-50 au fil des jours.
4. **Compréhension de Phrases du Quotidien** : Phrases contextualisées avec questions de décodage.
5. **Mémoire Auditive & Empan Mnésique** : Rétention séquentielle pour réduire la fatigue d'écoute.
6. **Écoute Binaurale & Démasquage Spatial** : Entraînement au cocktail party.

---

## 📍 Répertoire National des Centres Krys Audition

Base de données intégrée de centres Krys Audition couvrant toute la France métropolitaine et outre-mer :
- Recherche instantanée par **Code Postal** (ex. 75, 69, 13, 31, 59, 33...), ville ou nom.
- Bouton **Autour de moi** (géolocalisation GPS du centre le plus proche).
- Fiche détaillée : adresse, audioprothésiste référent, horaires, services (100% Santé, bilan gratuit, acouphènes, PMR).
- Actions directes en 1 clic : **Appel téléphonique**, **Itinéraire Google Maps**, **Prendre RDV**, **Choisir comme mon centre**.

---

## 🚀 Comment publier sur GitHub et Générer l'APK Android Automatiquement

Le dépôt est prêt pour être compilé en **APK Android natif** automatiquement grâce à GitHub Actions.

### 1. Initialiser et envoyer sur votre compte GitHub

Ouvrez un terminal PowerShell dans le dossier du projet (`krys-audition-app`) :

```bash
# 1. Initialiser le dépôt git
git init

# 2. Ajouter tous les fichiers
git add .

# 3. Créer le commit initial
git commit -m "Krys Audition - Mon Parcours Auditif v1.0 (Clinical & APK Build)"

# 4. Lier à votre dépôt GitHub (remplacez par votre URL de dépôt GitHub)
git remote add origin https://github.com/VOTRE_PSEUDO/krys-audition-app.git

# 5. Envoyer sur GitHub
git branch -M main
git push -u origin main
```

### 2. Récupérer votre fichier APK en 2 minutes

Dès que vous faites `git push` :
1. Allez sur votre dépôt GitHub dans l'onglet **Actions**.
2. Vous verrez le workflow **"Build Android APK (Krys Audition)"** s'exécuter.
3. À la fin de la compilation (environ 2 à 3 minutes), cliquez sur le build terminé.
4. Dans la section **Artifacts**, téléchargez le fichier **`Krys-Audition-APK`** contenant votre **`app-debug.apk`** !
5. Transférez le fichier sur votre smartphone Android pour l'installer immédiatement.

### 3. Utilisation en PWA (Installation instantanée sans APK)
L'application dispose également d'un **Service Worker** (`sw.js`) et d'un **Manifest PWA** (`manifest.json`).
Elle peut être installée en 1 clic directement depuis Google Chrome ou Safari mobile via le menu *"Ajouter à l'écran d'accueil"*, fonctionnant ainsi comme une application native hors-ligne.

---

## 👨‍⚕️ Auteur & Contact

**Benjamin Joseph COHEN**  
*Audioprothésiste diplômé du Cnam Paris*  
- 📞 07 68 15 86 96  
- ✉️ binyamine555@gmail.com  

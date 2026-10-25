# Présentation de MedCare

**MedCare** est un système de gestion hospitalière qui centralise le parcours de soins d'un
établissement, de l'accueil du patient jusqu'à la facturation et aux rapports officiels
(RMA3, DHIS2).

Ce guide s'adresse à **tout le personnel** : médical, paramédical, administratif et direction. Il
présente les objectifs du système, ses modules et la façon dont l'information circule entre les
services. Le détail de chaque écran se trouve dans les [guides des modules](../modules/README.md).

---

## Pourquoi MedCare existe

Beaucoup d'établissements de santé en zone à ressources limitées gèrent encore leurs patients sur
papier ou dans des tableurs dispersés entre les services : dossiers perdus, doubles saisies, aucune
vue d'ensemble pour la direction, aucune traçabilité en cas de litige. MedCare réunit tout le
parcours de soins dans une seule application.

Une contrainte réelle de ce contexte : MedCare doit **rester utilisable quand la connexion internet
est instable ou absente**.

## Modèle de déploiement : une installation par établissement

MedCare n'est **pas** une plateforme partagée entre plusieurs hôpitaux. Chaque établissement
client reçoit **sa propre installation** : sa propre base de données et son propre serveur,
hébergé sur site ou chez l'hébergeur de son choix.

- Deux établissements ne partagent ni serveur, ni base de données, ni donnée patient.
- Un site sans internet fiable fonctionne normalement au quotidien.
- Seules l'activation et le renouvellement de la licence demandent un contact avec l'extérieur,
  bref et ponctuel. Ce contact peut même se faire hors ligne, par échange de fichiers.

## Le lien avec AlphaCorp

**AlphaCorp est l'éditeur qui conçoit, distribue et licencie MedCare.** AlphaCorp n'héberge
jamais les données d'un hôpital et ne s'y connecte pas : les deux systèmes ne communiquent que le
temps d'une activation ou d'un renouvellement de licence.

Depuis sa propre console, AlphaCorp gère pour chaque client :

- sa fiche et ses identifiants d'activation ;
- les modules cliniques inclus dans le contrat, le nombre d'utilisateurs et de lits autorisés ;
- l'émission des licences signées qui activent ou renouvellent l'installation, en ligne ou hors
  ligne ;
- la facturation de chaque licence émise.

Une fois appliquée, la licence est contrôlée **localement** par MedCare : modules activés,
plafond d'utilisateurs et de lits, période de validité, puis période de grâce avant blocage en cas
de retard de renouvellement.

📄 Détail complet : [Licence AlphaCorp](../licence/README.md).

## Rôles et permissions

Chaque établissement définit ses propres rôles (Médecin, Infirmier, Pharmacien, Caissier…) depuis
**Paramètres → Rôles** : MedCare n'impose pas de liste figée.

- Un rôle **administrateur** a un accès complet, y compris aux comptes, aux paramètres et à la
  licence.
- Les autres rôles portent des permissions par module : lecture, création, modification,
  suppression et, pour certains modules, **validation** (signer un résultat, valider un mois RMA3,
  autoriser une sortie d'argent).
- Les permissions d'un rôle sont appliquées à la création d'un utilisateur, puis restent
  ajustables pour chaque personne.

📄 Détail : [Sécurité, rôles et permissions](../securite/README.md).

---

## Les modules

L'accès à chaque module dépend à la fois de la **licence** (le module est-il acheté ?) et des
**permissions** de l'utilisateur.

| Module | Ce qu'il couvre | Utilisateurs typiques |
|---|---|---|
| [Tableau de bord](../modules/tableau-de-bord/README.md) | Indicateurs du jour adaptés au profil, alertes, file d'attente | Tout le personnel |
| [Patients](../modules/patients/README.md) | Identité, IPP, dossier médical complet, détection des doublons | Accueil, soignants |
| [Rendez-vous](../modules/rendez-vous/README.md) | Agenda des médecins, créneaux, récurrences, arrivée du patient | Accueil, médecins |
| [Admissions](../modules/admissions/README.md) | Séjours, triage des urgences, file de consultation, hospitalisation, transferts, sorties | Accueil, infirmiers, médecins |
| [Laboratoire](../modules/laboratoire/README.md) | Prélèvement → saisie → validation, résultats critiques | Techniciens, biologistes |
| [Banque de sang](../modules/banque-de-sang/README.md) | Donneurs, collectes, poches et qualification | Laboratoire |
| [Radiologie](../modules/radiologie/README.md) | Planification → examen → compte rendu → validation | Manipulateurs, radiologues |
| [Chirurgie](../modules/chirurgie/README.md) | Programme opératoire, check-list OMS, compte rendu | Chirurgiens, bloc |
| [Pharmacie](../modules/pharmacie/README.md) | Ordonnances, stock par lots (FEFO), dépôts, rapport mensuel, pharmacovigilance | Pharmaciens |
| [Maternité](../modules/maternite/README.md) | CPN, accouchement et partogramme, nouveau-né, post-natal, planification familiale | Sages-femmes, gynécologues |
| [Programmes de santé](../modules/programmes-de-sante/README.md) | PEV, chaîne du froid, MAPI, paludisme, tuberculose, nutrition, oxygène, maladies chroniques, VIH/hépatites | Infirmiers, responsables de programmes |
| [Facturation](../modules/facturation/README.md) | Factures générées par les actes, paiements (espèces, carte, Mobile Money), remboursements | Caisse, comptabilité |
| [Tiers payant](../modules/tiers-payant/README.md) | Organismes, conventions, adhésions, gratuités, bordereaux, règlements | Facturation, direction |
| [Planning](../modules/planning/README.md) | Gardes et postes du personnel, absences, remplacements | Cadres de santé |
| [Messagerie](../modules/messagerie/README.md) | Messages entre collègues, notifications | Tout le personnel |
| [RMA3 et rapports](../modules/rma3/README.md) | Rapport mensuel MINSANTE, formulaire de saisie, export DHIS2 | Gestionnaire des données, direction |
| [Paramètres](../parametrage/README.md) | Organisation, comptes, rôles, référentiels, tarifs, intégrations, licence | Administrateurs |

---

## Le parcours central d'un patient

Aucun module ne fonctionne seul. Exemple : un patient arrive aux urgences.

1. **Accueil** — le patient est créé dans **Patients** et reçoit son IPP.
2. **Admission** — un séjour d'urgence est ouvert avec une priorité de triage et un acte
   d'admission. Une urgence vitale passe directement au médecin ; sinon, le patient règle l'acte à
   la caisse avant d'entrer dans la file de consultation.
3. **Consultation** — un médecin prend le patient en charge dans la **file de consultation**,
   saisit ses constantes et sa note, prescrit des examens et des médicaments.
4. **Examens** — les examens prescrits sont facturés aussitôt. Après paiement, le
   **Laboratoire** ou la **Radiologie** les réalise, puis un biologiste ou un radiologue valide le
   résultat.
5. **Ordonnance** — la **Pharmacie** valide puis délivre les médicaments en sortant le stock lot
   par lot.
6. **Hospitalisation** — après la consultation signée, le médecin choisit un service, une salle et
   un lit. Une caution est facturée ; le lit est attribué dès qu'elle est réglée.
7. **Sortie** — le médecin fait sortir le patient depuis **Sorties** avec ses diagnostics. La
   caution est régularisée selon la durée réelle, et la fiche de sortie est imprimable.
8. **Facturation et tiers payant** — chaque acte ajoute sa ligne à la facture. Si le patient est
   couvert, la part de l'organisme est déduite puis réclamée par **bordereau**.
9. **Rapports** — ces données alimentent automatiquement le **RMA3** et les indicateurs **DHIS2**.

📄 Les parcours détaillés sont dans [Workflows inter-modules](../workflows/README.md).

---

## Fonctionnalités transversales

- **Recherche et pagination** sur toutes les listes principales.
- **Impression et export PDF** : liste des patients, dossier patient, dossier de séjour, fiche de
  sortie, ordonnance, fiche de posologie du patient, résultat de laboratoire, facture, reçu,
  bordereau de prise en charge, rapport de stock mensuel. Titres, textes d'introduction, notes de
  fin, mention de pied de page et bloc de signature se personnalisent dans Paramètres → Modèles de
  Documents.
- **Export CSV** : bordereaux de prise en charge, programme opératoire, journal d'activité d'un
  utilisateur.
- **Tuiles de synthèse cliquables** : sur la plupart des listes de travail (laboratoire,
  radiologie, chirurgie, facturation, pharmacie), cliquer sur une tuile filtre la liste.
- **Bilingue** français / anglais (sélecteur de langue dans l'en-tête).
- **Version mobile** : navigation adaptée aux téléphones.

## Sécurité et traçabilité

- **Journal d'audit** : les actions sensibles (connexions, modifications, paiements, dérogations,
  ouverture d'un dossier VIH, génération d'un RMA3…) sont tracées. L'administrateur consulte
  l'activité de chaque utilisateur.
- **Contrôle d'accès côté serveur** : chaque opération vérifie la permission de l'utilisateur, pas
  seulement l'affichage des boutons. Une page non autorisée affiche « Accès au module restreint ».
- **Données VIH confidentielles** : réservées au personnel qui en a besoin (sous-module VIH).
- **Licence** : voir [Licence AlphaCorp](../licence/README.md).

---

## Lexique

| Terme | Signification |
|---|---|
| **IPP** | Identifiant permanent du patient, attribué à sa première venue. Il regroupe tout son dossier. |
| **Séjour** | Passage du patient dans l'établissement (urgence, programmé, hôpital de jour, ambulatoire), de l'admission à la sortie. |
| **Triage** | Priorité d'un patient aux urgences : réanimation, urgence vitale, urgent, moins urgent, non urgent. |
| **Caution** | Avance facturée à l'hospitalisation (prix journalier de la salle × jours prévus), régularisée à la sortie. |
| **Ticket modérateur / part patient** | Ce que le patient paie après déduction de la part de l'organisme et des gratuités. |
| **PEC (prise en charge)** | Part d'une facture payée par un organisme (assureur, CNPS, mutuelle, employeur). |
| **Bordereau** | Lot de factures réclamées à un organisme pour une période. |
| **Gratuité** | Programme qui prend en charge tout ou partie de certains actes (enfants de moins de 5 ans, femmes enceintes, indigents…). |
| **CIM-10** | Classification internationale des maladies, utilisée pour coder les diagnostics. |
| **STAT** | « Immédiatement » : priorité absolue d'un examen. |
| **Check-list OMS** | Procédure de sécurité chirurgicale en trois temps (Sign In, Time Out, Sign Out). |
| **CPN** | Consultation prénatale. |
| **PTME** | Prévention de la transmission mère-enfant (du VIH, de la syphilis, de l'hépatite B). |
| **PEV** | Programme élargi de vaccination. |
| **MAPI** | Manifestation adverse post-immunisation. |
| **PCIMA** | Prise en charge intégrée de la malnutrition aiguë (CNA, CNTI). |
| **FEFO** | « Premier périmé, premier sorti » : les lots qui expirent le plus tôt sortent en premier. |
| **CMM** | Consommation moyenne mensuelle d'un article. |
| **RMA3** | Rapport mensuel d'activités des formations sanitaires du MINSANTE (Cameroun). |
| **DHIS2** | Système d'information sanitaire national, qui reçoit les indicateurs agrégés. |
| **PACS** | Système d'archivage et de visualisation des images médicales. MedCare n'en intègre pas : un compte rendu peut seulement pointer vers un lien externe. |

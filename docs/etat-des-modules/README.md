# État des modules

Ce document recense, module par module, ce qui est **réellement fonctionnel**, ce qui est
**partiel** et ce qui **manque**. Il a été établi par lecture du code (routes API, bibliothèques,
écrans), pas par estimation.

**Dernière relecture complète : 2026-10-25**, après la résolution de la dette technique (voir
[Guide développeur](../developpement/README.md#dette-technique-connue)).

Légende : ✅ complet · ⚠️ partiel ou limité · ❌ manquant

## Vue d'ensemble

| Module | Statut | Point d'attention principal |
|---|---|---|
| [Patients](../modules/patients/README.md) | ✅ | Pas de fusion de doublons |
| [Rendez-vous](../modules/rendez-vous/README.md) | ⚠️ | L'arrivée ne propose pas l'acte d'admission (pas de paiement préalable) |
| [Admissions, consultations, sorties](../modules/admissions/README.md) | ✅ | La caution garde le prix de la salle de départ après un changement de salle |
| [Laboratoire](../modules/laboratoire/README.md) | ✅ | — |
| [Banque de sang](../modules/banque-de-sang/README.md) | ✅ | — |
| [Radiologie](../modules/radiologie/README.md) | ⚠️ | Pas de stockage ni de visionneuse d'images (lien externe seulement) |
| [Chirurgie](../modules/chirurgie/README.md) | ✅ | Pas d'export PDF du compte rendu opératoire |
| [Pharmacie et stock](../modules/pharmacie/README.md) | ✅ | Pas de vérification des interactions médicamenteuses (fonction non proposée) |
| [Maternité et planification familiale](../modules/maternite/README.md) | ✅ | — |
| [Programmes de santé](../modules/programmes-de-sante/README.md) | ✅ | Pas de facturation (voulu) ; absents de DHIS2 (présents dans le RMA3) |
| [Facturation](../modules/facturation/README.md) | ⚠️ | Mobile Money non validé en conditions réelles |
| [Tiers payant](../modules/tiers-payant/README.md) | ✅ | — |
| [Planning](../modules/planning/README.md) | ✅ | Pas de circuit de demande de congés |
| [Messagerie](../modules/messagerie/README.md) | ⚠️ | Rafraîchissement périodique, pas de temps réel |
| [RMA3 et rapports](../modules/rma3/README.md) | ✅ | — |
| [Intégration DHIS2](../parametrage/integration-dhis2.md) | ✅ | 18 indicateurs (activité, maternité) |
| [Licence AlphaCorp](../licence/README.md) | ✅ | Re-liaison d'empreinte manuelle côté AlphaCorp |
| [Paramétrage](../parametrage/README.md) | ✅ | Sauvegarde intégrée indisponible sans `pg_dump` sur le serveur (Vercel) |
| Documents PDF | ✅ | Quelques pieds de page encore en anglais en dur |

---

## Détail

### Patients — ✅
- Création avec IPP automatique et détection des doublons probables (nom + prénom + date de
  naissance, ou NSS).
- Fiche patient avec 11 onglets, tous branchés sur de vraies données : séjours avec noms du
  service, du lit et du médecin ; résultats de laboratoire et de radiologie consultables.
- Impression du dossier et de la liste.
- ❌ Pas de fusion de deux dossiers en doublon.

### Rendez-vous — ⚠️
- Réservation sur les disponibilités des médecins, détection des conflits, séries hebdomadaires et
  mensuelles (occurrences en conflit sautées).
- L'arrivée crée un séjour *Programmé* dans la file, de façon atomique.
- ⚠️ L'API d'arrivée accepte l'acte d'admission, mais **l'écran ne le propose pas** : un patient sur
  rendez-vous contourne la règle « payer d'abord ».
- ⚠️ Pas d'action explicite « Terminer » le rendez-vous.

### Admissions, consultations, sorties — ✅
- Séjours, triage, file de consultation triée par gravité, prise en charge exclusive.
- Règle « payer d'abord » avec exceptions d'urgence vitale et dérogation tracée.
- Hospitalisation avec lit réservé, caution, attribution au paiement, régularisation à la sortie ;
  page Sorties, fiche de sortie.
- Diagnostics CIM-10 obligatoires (consultation, sortie d'un hospitalisé, cause de décès).
- Un lit ne s'attribue que par *Hospitaliser* ; l'admission refuse un lit, et le transfert de lit
  est réservé aux patients hospitalisés.
- Les données de démonstration passent par le circuit d'hospitalisation. Pour une base seedée
  avant le 2026-10-25 : `npm run db:backfill-demo-hospitalizations`.
- ⚠️ Un changement de salle en cours d'hospitalisation garde le prix journalier de la caution.

### Laboratoire — ✅
- Circuit paiement → prélèvement → saisie → validation / rejet, réservé à la permission
  `validate`.
- Fiches de résultats par examen, avec indicateurs automatiques et seuils critiques.
- Notification des résultats critiques.
- Alimentation automatique des registres VIH (dépistages, charges virales).
- Confidentialité des résultats VIH.
- Impression du résultat.

### Banque de sang — ✅
- Donneurs, collectes mobiles, poches, qualification sur 4 tests, libération, service, transfusion,
  destruction, avec transitions protégées contre la concurrence.

### Radiologie — ⚠️
- Planification avec conflits, réalisation, compte rendu structuré, validation / rejet,
  notification ACR des résultats critiques.
- Visionneuse du compte rendu validé depuis le dossier patient.
- ❌ Pas de stockage DICOM ni de visionneuse d'images : seul un lien externe (http/https) est
  conservé.

### Chirurgie — ✅
- Programmation avec conflits de salle et de chirurgien ; check-list OMS en 3 phases bloquante ;
  compte rendu signé déposé au séjour ; facturation à la clôture ; report et annulation.
- Export CSV, impression et e-mail du programme.
- ❌ Pas d'export PDF du compte rendu opératoire.

### Pharmacie et stock — ✅
- Stock par lots et par dépôts, FEFO, péremptions, réceptions, pertes, transferts, inventaires,
  mouvements antidatés recalculés.
- Flacons multidoses de vaccins ; rapport mensuel (CMM, ruptures, pertes de vaccins) ;
  pharmacovigilance.
- Ordonnances : validation facturée, délivrance bloquée sans paiement ou sans stock délivrable,
  protégée contre la double délivrance.
- Impression de l'ordonnance, de la **fiche de posologie** du patient et du **rapport de stock
  mensuel**.
- Alertes de péremption des lots sur le tableau de bord.
- ℹ️ Pas de vérification des interactions médicamenteuses : l'ancienne alerte factice est
  retirée. Le champ `Prescription.contraindicationCheck` reste inutilisé.
- ⚠️ Fiche d'ordonnance : les boutons « Annuler » et « Voir » le patient n'ont pas d'action.

### Maternité et planification familiale — ✅
- CPN (avec dose de Td dans le registre de vaccination et sortie de stock), PTME via le
  laboratoire, partogramme graphique OMS, accouchement, nouveau-nés (dossier patient
  automatique), suivi néonatal.
- **Post-natal** (contacts RMA3), issues de grossesse, soins après avortement, décès maternels.
- Planification familiale rattachée au patient.

### Programmes de santé — ✅
- Registres réels : vaccination (avec stock), séances, chaîne du froid, MAPI, paludisme,
  tuberculose (cas, suivis, dépistage actif), nutrition (PCIMA, croissance), oxygène (parc et
  épisodes), maladies chroniques, VIH / PTME / hépatites / IST (`MODULE_HIV`, accès audité).
- Exploités par le RMA3.
- ⚠️ Aucun indicateur DHIS2 ne provient encore de ces registres.
- ℹ️ Ces registres ne facturent pas, par choix. Les gratuités de soins facturés passent par le
  tiers payant.

### Facturation — ⚠️
- Factures générées par les actes, au tarif de la grille ; recalcul serveur.
- Paiements en espèces, carte, virement ; dérogation tracée ; trop-perçus remboursés ou transférés.
- Impression de la facture et du reçu.
- ⚠️ **Mobile Money** : clients Orange (paiement Web) et MTN (Collections) écrits contre les vraies
  API. Orange n'a jamais été validé de bout en bout ; MTN seulement en sandbox.
- Confirmation Mobile Money : statut toujours relu auprès de l'opérateur, crédit unique (webhook
  ou interrogation).

### Tiers payant — ✅
- Organismes, conventions (taux par famille, nomenclature, plafonds par facture et annuels, bon
  requis, limite d'âge des enfants).
- Adhésions familiales avec ayants droit et plafond familial partagé ; bons de prise en charge ;
  gratuités automatiques ou sur inscription.
- Bordereaux (PDF, CSV) ; règlements, affectations, rejets refacturables, annulations,
  remboursements à l'organisme.
- Recalcul des factures ouvertes ; verrous contre la double consommation d'un plafond. Testé
  unitairement (`lib/coverage/*.test.ts`).

### Planning — ✅
- Postes avec conflits, absences sur les postes existants, remplacements, services.
- ⚠️ Pas de modèle de congé : pas de demande ni de validation de congé.

### Messagerie — ⚠️
- Conversations à deux et de groupe, non-lus, notifications.
- ⚠️ Interrogation périodique d'environ 15 secondes, pas de WebSocket ni de SSE. Pas de pièces
  jointes.

### RMA3 et rapports — ✅
- Rapport mensuel calculé depuis les modules et exporté en Word.
- Formulaire mensuel pour les indicateurs manuels, avec validation, verrouillage et réouverture
  motivée.
- Identification MINSANTE, correspondance CIM-10 → rubriques modifiable et tracée, registre du
  personnel, déclarations d'état civil.

### Intégration DHIS2 — ✅
- 18 indicateurs mensuels ; recherche de métadonnées ; historique et relance ; tâche planifiée.
- ⚠️ Pas de `vercel.json` dans le dépôt : la tâche planifiée est à déclarer à l'hébergement.

### Licence AlphaCorp — ✅
- Licence signée Ed25519, activation en ligne ou hors ligne, anti-rejeu, anti-recul d'horloge,
  période de grâce.
- Modules et plafonds (utilisateurs, lits) réellement appliqués.
- ⚠️ La re-liaison d'une empreinte qui a changé reste une opération manuelle côté AlphaCorp.

### Paramétrage — ✅
- Comptes, rôles personnalisés, organisation et tous les référentiels réels (avec import CSV) ;
  prix synchronisés vers la grille tarifaire.
- **Modèles de documents** : éditeur par modèle (titre, introduction, note de fin), mention de
  pied de page, bloc signature, logo, filigrane ; administrateur seulement, validé et tracé.
- **Sauvegarde** : téléchargement d'un `pg_dump` depuis l'écran ; indisponible sans `pg_dump` sur
  le serveur (Vercel).
- Un acte médical et un examen ne peuvent plus partager un code tarifaire.

### Documents PDF — ✅
- Les 10 modèles sont utilisés avec des données réelles :
  - liste des patients, dossier patient ;
  - dossier de séjour et fiche de sortie ;
  - résultat de laboratoire ;
  - ordonnance, fiche de posologie ;
  - facture, reçu, bordereau de prise en charge ;
  - rapport de stock mensuel.
- Textes personnalisables par l'établissement. L'aperçu des paramètres utilise des données
  d'exemple.
- ⚠️ Quelques pieds de page restent en anglais en dur (« Accredited Laboratory Services », « Page
  1 of 1 »).

---

## Notes d'architecture transverses

- **Déploiement** : une installation par établissement. Le schéma `tenant_template` reste
  multi-établissements (colonne `tenant_id`), mais n'en contient qu'un en pratique ; toutes les
  requêtes filtrent par établissement.
- **Permissions** : `requireModulePermission` côté API, `hasPermission` côté interface ;
  administrateur via le drapeau `isSystemAdmin`, jamais via un nom de rôle.
- **Modules** : synchronisés depuis la licence (`syncTenantModulesFromLicense`), sans réglage
  manuel.
- **Code hérité** à nettoyer : voir [Guide développeur → Dette technique](../developpement/README.md#dette-technique-connue).

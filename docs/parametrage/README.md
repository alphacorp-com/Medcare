# Paramétrage de l'établissement

Ce guide décrit tous les réglages de MedCare : profil, organisation, comptes et rôles, modules,
modèles de documents, licence, intégrations, et les **référentiels** (types, actes, examens, lits,
pharmacie, prises en charge, rapports).

- **Accès** : menu **Paramètres** (`/settings`). Les sections et les référentiels se modifient par
  un **administrateur** (rôle `isSystemAdmin`).
- Les référentiels sont **lisibles** par tout utilisateur connecté, car les formulaires des modules
  s'en servent ; **seul l'administrateur les modifie**.

> Ordre conseillé pour une nouvelle installation : Organisation → Rôles → Utilisateurs → Services
> et lits → Actes et examens (avec leurs **prix**) → Pharmacie → Prises en charge → Identification
> RMA3 → Intégrations.

---

## Sections principales (`/settings`)

| Section | Contenu | Qui |
|---|---|---|
| Profil Utilisateur | Vos informations, **changement de mot de passe** | Chacun |
| Personnel & Rôles | Comptes utilisateurs et leurs permissions | Administrateur |
| Rôles | Rôles de l'établissement | Administrateur |
| Organisation | Identité de l'établissement : nom, contacts, logo… | Administrateur |
| Modules Cliniques | Modules actifs selon la licence (**lecture seule**) | Administrateur |
| Modèles de Documents | Habillage des documents imprimés | Administrateur |
| Licence | Activation et état de la licence AlphaCorp | Administrateur |
| Paramètres de Sécurité | Informatif (les accès se gèrent dans Personnel & Rôles) | Administrateur |
| Intégrations Externes | DHIS2, Mobile Money | Administrateur |

### Utilisateurs et rôles

👤 **Créer un rôle** — **Rôles → Nouveau** :
1. Nom libre (Médecin, Infirmier, Caissier…).
2. **Administrateur** : accès complet. À réserver à la direction ou à l'informatique.
3. **Prestataire clinique** : la personne apparaît comme médecin dans les sélecteurs et voit les
   résultats VIH de ses patients.
4. **Permissions par défaut** par module : lecture, création, modification, suppression,
   validation (voir [Sécurité](../securite/README.md#2-les-actions)).

👤 **Créer un utilisateur** — **Personnel & Rôles → Nouveau** :
1. Nom complet, e-mail, **rôle**.
2. **Mot de passe initial** (8 caractères minimum), choisi par l'administrateur et à transmettre de
   façon sûre.
3. Les permissions du rôle sont proposées par défaut ; ajustez-les si besoin.
4. Le nombre d'utilisateurs est **plafonné par la licence**.

Pour **désactiver** un compte, **changer son rôle** ou **réinitialiser son mot de passe** : fiche de
l'utilisateur. Ces actions coupent immédiatement ses sessions. L'**activité** d'un utilisateur se
consulte et s'exporte depuis sa fiche.

Garde-fous : il reste toujours au moins un administrateur actif ; un rôle attribué ne peut pas être
supprimé.

### Organisation
Nom, coordonnées, logo… de l'établissement : ils apparaissent sur les documents imprimés et dans
l'en-tête. L'identification administrative MINSANTE (région, district…) se saisit à part, dans
**RMA3 → Identification MINSANTE** (voir [RMA3](../modules/rma3/README.md)).

### Modules cliniques
Liste des modules activés par la **licence**. Elle n'est pas modifiable ici : pour ajouter un
module, demandez à AlphaCorp une nouvelle licence (voir [Licence](../licence/README.md#5-augmenter-les-utilisateurs-les-lits-ou-changer-les-modules-actifs)).

### Modèles de documents
Options d'habillage des documents PDF : logo, QR code, signature, filigrane. Un **aperçu** de chaque
modèle est disponible.
- ⚠️ Le bouton **Modifier le modèle** n'a pas encore d'action : aucun éditeur de modèle n'existe.
- ⚠️ Ces réglages sont modifiables par tout utilisateur connecté via l'API (constat n°3 de
  l'[audit](../securite/AUDIT_2026-09.md)).

### Licence
Voir [Licence AlphaCorp](../licence/README.md).

### Intégrations
- [DHIS2](integration-dhis2.md) : envoi mensuel des indicateurs agrégés.
- [Mobile Money](mobile-money.md) : Orange Money et MTN MoMo.

---

## Référentiels (menu latéral des Paramètres)

La plupart des référentiels partagent le même écran : liste, **Nouveau**, modification,
activation / désactivation, et **import CSV** (code, libellé français, libellé anglais…). Préférez
**désactiver** un élément plutôt que le supprimer : il disparaît des choix, mais les données
passées le gardent.

### Clinique

| Référentiel | Usage |
|---|---|
| Types d'Admission | Proposés à l'admission |
| Types de Rendez-vous | Proposés à la prise de rendez-vous |
| Disponibilités Médecins | Plages hebdomadaires de chaque médecin (jour, heures, durée des créneaux). Elles remplacent tout le planning de la semaine du médecin |
| Types de Salles | Salles d'hospitalisation, avec leur **prix journalier** (voir ci-dessous) |
| Lits | Lits par service et par salle (voir ci-dessous) |

### Lits, salles et services

👤 **Créer une salle et ses lits**
1. **Types de Salles → Nouveau** : code, libellé, **prix journalier d'hospitalisation**. Ce prix
   sert à calculer la caution et sa régularisation. **Sans prix, impossible d'hospitaliser** dans
   cette salle quand la facturation est active.
2. **Lits → Nouveau** : code, libellé, **service**, **salle**. Le nombre de lits actifs est
   **plafonné par la licence**.
3. Un lit peut être mis **en maintenance** ou **réservé** manuellement. Les statuts *occupé* et
   *libre* ne changent que par les admissions, les hospitalisations, les transferts et les sorties.

Les **services** se gèrent dans **Planning → Services** (voir [Planning](../modules/planning/README.md)).

Désactiver puis réactiver une salle conserve son prix. Renommer son code emporte le prix avec lui ;
l'ancien code n'est plus facturable.

### Prises en charge

| Référentiel | Usage |
|---|---|
| Types d'Assurance | Catégories d'organismes (assurance, mutuelle, CNPS…) |
| Organismes et conventions | Payeurs et leurs conventions : voir [Tiers payant](../modules/tiers-payant/README.md) |
| Programmes de gratuité | Gratuités automatiques ou sur inscription : voir [Tiers payant](../modules/tiers-payant/README.md#gratuités) |

### Actes, tarifs et examens

| Référentiel | Usage |
|---|---|
| Catégories d'Actes | Regroupement des actes, avec leur **rubrique de recette RMA3** |
| Actes Médicaux | Actes facturables (consultations, actes de cardiologie, d'anatomopathologie…) : catégorie, code, libellés, **prix**, unité, **taux de PEC (nomenclature)**, **indicateur RMA3**. Import CSV possible |
| Types d'Examens | Familles d'examens de laboratoire et de radiologie, et leurs **examens** |
| CIM-10 | Codes de diagnostic (code, libellés, chapitre). Import CSV possible |

👤 **Configurer un examen** — **Types d'Examens** → type → **Nouvel examen** :
- code, libellé, **prix** ;
- **fiche de résultats** : paramètres, unités, valeurs de référence, seuils critiques, réponses
  qualitatives. Elle pilote la saisie et les alertes automatiques au laboratoire ;
- pour la radiologie : modalité (types d'imagerie) ;
- lien éventuel vers un **programme** : le résultat validé alimente le registre de dépistage
  (VIH, syphilis, AgHBs…) ou les charges virales, jamais les deux. Un examen dont le résultat est
  confidentiel (VIH) est masqué au personnel non autorisé.

**Les prix** : le prix saisi sur un acte, un examen ou une salle est recopié automatiquement dans la
**grille tarifaire** (Facturation → Grille tarifaire), seule source lue lors de la facturation.
Renommer le code d'un acte ou d'un examen laisse l'ancien tarif orphelin : vérifiez la grille
ensuite. Si la grille a dérivé (après un import, par exemple) : `npm run db:sync-fee-schedule`.

⚠️ Les prix créés par le seed de démonstration (8 000 FCFA par examen de laboratoire,
35 000 FCFA par examen d'imagerie…) **ne sont pas des tarifs officiels** : remplacez-les.

### Pharmacie

| Référentiel | Usage |
|---|---|
| Unités Pharmaceutiques | Unités des articles (comprimé, flacon, ampoule…) |
| Magasins | **Dépôts** de stock. Le dépôt principal est créé automatiquement au premier usage |
| Fournisseurs | Fournisseurs des réceptions |

### Imagerie

| Référentiel | Usage |
|---|---|
| Types d'Imagerie | Modalités (radiographie, échographie, scanner…) |
| Zones Anatomiques | Régions examinées |

### Programmes de santé

| Référentiel | Usage |
|---|---|
| Antigènes Vaccinaux | Antigènes du PEV (avec leur groupe). Relier un **article de pharmacie** à un antigène fait sortir les doses du stock à chaque vaccination |

### Rapports

| Référentiel | Usage |
|---|---|
| Rapport RMA3 | Génération du rapport mensuel (.docx) |
| RMA3 : correspondance CIM-10 | Rubriques RMA3 ↔ codes CIM-10 |
| Personnel (RMA3) | Registre du personnel |

Voir [RMA3 et rapports](../modules/rma3/README.md).

---

## 🛠️ Repères techniques

| Élément | Route |
|---|---|
| Organisation, modèles | `/api/v1/settings/organization`, `/api/v1/settings/templates` |
| Utilisateurs, rôles | `/api/v1/users`, `/api/v1/roles` |
| Référentiels génériques (8 types) | `/api/v1/settings/reference-data/[catalogType]` (+ `/import`) |
| Lits, magasins, fournisseurs | `/api/v1/settings/beds`, `/storage-locations`, `/suppliers` |
| Actes, catégories, CIM-10 | `/api/v1/settings/medical-acts` (+ `/import`), `/act-categories`, `/icd10` (+ `/import`) |
| Examens | `/api/v1/settings/exam-types`, `/exam-types/[id]/entries`, `/exam-entries/[id]` |
| Disponibilités | `/api/v1/settings/doctor-availability` |
| Synchronisation des prix | `lib/billing/syncFeeSchedule.ts`, `lib/billing/roomPricing.ts` |
| Plafonds de licence | `lib/tenant-licensing.ts` (`getTenantSeatLimit`, `getTenantBedLimit`) |

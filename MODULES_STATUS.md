# État des modules — Medcare V2

Ce document recense, module par module, ce qui est **réellement fonctionnel** (CRUD Prisma réel, pas de données fictives, permissions appliquées), ce qui est **à moitié fait** (UI présente mais logique cassée, désactivée ou fictive), et ce qui **manque complètement**. Vérifié en lisant les routes API et le code source — pas une estimation. Dernière relecture complète : 2026-09-12 (mise à jour après le chantier de centralisation des licences côté AlphaCorp — voir [`LICENCE_ACTIVATION.md`](LICENCE_ACTIVATION.md)).

Légende : ✅ Complet et réel · ⚠️ Partiel / à moitié fait · ❌ Manquant

## Vue d'ensemble

| Module | Statut global |
|---|---|
| Patients & Admissions (+ file de Consultations) | ✅ Complet |
| Rendez-vous | ✅ Complet |
| Laboratoire | ✅ Complet |
| Radiologie | ✅ Complet |
| Chirurgie | ✅ Complet |
| Pharmacie | ⚠️ Partiel (alerte d'interaction médicamenteuse factice) |
| Maternité / CPN | ✅ Complet (parcours grossesse → accouchement) |
| Programmes de Santé | ⚠️ Partiel (registres réels mais isolés — pas de facturation, pas de DHIS2) |
| Facturation & Paiements | ⚠️ Partiel (Mobile Money non testable in situ, pas d'export PDF) |
| Planning | ✅ Complet |
| Messagerie | ⚠️ Complet mais en polling (pas de temps réel) |
| Paramètres (tenant) | ⚠️ Partiel (éditeur de modèles de documents non branché) |
| Interopérabilité DHIS2 | ✅ Complet |
| Licence on-prem (AlphaCorp) | ✅ Complet — voir [`LICENCE_ACTIVATION.md`](LICENCE_ACTIVATION.md) |
| Rôles & permissions | ✅ Complet — détail dans *Paramètres (tenant)* |
| Génération PDF / Modèles | ⚠️ Partiel (2 modèles réels sur 7) |

---

## Patients & Admissions

**Statut : ✅ Complet**

- CRUD réel et isolé par tenant sur `Patient`/`Stay`, permissions appliquées (`requireModulePermission(..., "MODULE_CORE_PATIENT", ...)`).
- Admission crée un vrai `Stay` (+ constantes vitales à l'accueil en option) ; sortie/transfert met à jour `status`/`dischargeDate`/`bedId`/`departmentId` pour de vrai.
- Bons de labo, prescriptions et constantes pendant le séjour écrivent dans les vraies tables (`ExamRequest`, `Prescription`, `VitalSigns`).
- Fiche patient : onglets Admissions, Dossiers médicaux, Prescriptions, Labo, Imagerie, Constantes, **Chirurgie**, **Maternité** et Facturation — tous branchés sur de vraies routes API (les deux derniers ajoutés lors du chantier Facturation).

✅ **Mise à jour** : un vrai modèle `Bed` existe désormais (`app/api/v1/settings/beds`) — code, service, type de chambre, statut, actif/inactif, CRUD réel. Le nombre de lits actifs pouvant être créés est plafonné par la licence AlphaCorp (`getTenantBedLimit`, voir *Licence on-prem*). Nuance restante : `Stay.bedId` pointe vers `Bed.id` par convention applicative, mais **sans clé étrangère Prisma déclarée** entre les deux modèles.

**Consultations** : ce n'est pas un module séparé — il n'existe aucun modèle `Consultation` dans le
schéma. C'est une file d'attente/triage réelle posée au-dessus de `Stay`/`MedicalRecord` déjà
documentés ci-dessus : `Stay.consultationStatus` (`waiting`/`claimed`/`completed`),
`GET /api/v1/consultations/queue` (triée par acuité de triage puis temps d'attente), et les actions
« claimer » / « libérer » un patient (`POST /api/v1/stays/[id]/claim` et `/release`) avec
verrouillage anti-double-claim réel (`updateMany` conditionnel). Autorisé via `MODULE_ADMISSION`
(pas de module dédié). La clôture se fait via la signature d'une note médicale de type
`consultation` (`POST /api/v1/patients/[id]/records`), qui bascule le statut à `completed` et
génère une ligne de facture — déjà compté dans la section Facturation.

---

## Rendez-vous (Appointments)

**Statut : ✅ Complet et réel**

- CRUD réel sur `Appointment`, avec détection de conflit réelle (`findAppointmentConflicts`,
  `findAvailabilityConflict`) et confirmation forcée possible, y compris pour les séries
  récurrentes (`seriesId`).
- Permissions cohérentes sur toutes les routes (liste, détail, annulation, no-show, check-in,
  disponibilités) : `requireModulePermission(session, "MODULE_APPOINTMENTS", ...)`.
- Le **check-in** crée un vrai `Stay` (`type: "scheduled"`) relié à `Appointment.stayId` — à partir
  de là, le patient rentre dans la vraie file de consultation/triage/facturation ci-dessus, sans
  logique dupliquée.
- `DoctorAvailability` (créneaux hebdomadaires réels) alimente le calendrier de prise de
  rendez-vous.

⚠️ Pas de route « terminer » explicite pour un rendez-vous — le passage à `completed` n'est pas
vérifié comme explicite dans les routes lues. Aucune facturation n'est générée par le rendez-vous
lui-même : c'est la consultation qui suit (signature de note médicale) qui facture.

---

## Laboratoire

**Statut : ✅ Complet**

- Catalogue de panels réel (`lib/laboratory/panels.ts`), workflow complet : prélèvement en attente → en analyse → en attente de validation → terminé.
- Résultats critiques avec notification au prescripteur, historique des résultats.
- Depuis le chantier Facturation : la validation d'un résultat génère automatiquement une ligne de facture si le module Facturation est actif pour le tenant.
- Intégration Maternité : les tests VIH/Syphilis prescrits depuis une grossesse (PTME) passent par ce module (pas de système de résultats dupliqué).

---

## Radiologie

**Statut : ✅ Complet**

- Reconstruit entièrement cette série sur la base d'une recherche réelle (standards RIS/ACR). Partage le modèle `ExamRequest`/`ExamResult` avec le Laboratoire, différencié par `type`.
- Workflow réel : programmation → démarrage → saisie de compte-rendu → validation, avec notification des résultats critiques.
- Génère une ligne de facture automatique à la validation (même mécanisme que le Laboratoire).

---

## Chirurgie

**Statut : ✅ Complet**

- `SurgicalProcedure` réel, check-list de sécurité chirurgicale OMS en 3 phases (Sign In / Time Out / Sign Out), détection de conflit de programmation (salle/chirurgien) avec confirmation forcée possible.
- Annulation / report réels, clôture du cas dépose un `MedicalRecord` signé si lié à un séjour, et génère une ligne de facture automatique.

❌ Pas d'export PDF du compte-rendu opératoire — ce module n'utilise pas le système de modèles de documents (voir section *Génération PDF*).

---

## Pharmacie

**Statut : ⚠️ Partiel**

✅ Ce qui fonctionne :
- Inventaire (`MedicationInventory`) avec alertes de stock bas, CRUD réel.
- Workflow de prescription en attente → validée → délivrée.
- Corrigé lors du chantier Facturation : les lignes de facture par médicament sont désormais réelles (l'ancien système stockait une pseudo-facture en JSON dans `Prescription.notes`) et les délivrances créent enfin de vrais enregistrements `DrugDispensing` (le modèle existait mais n'était jamais utilisé auparavant).
- Blocage de la délivrance tant que la facture n'est pas payée, mais uniquement si le module Facturation est actif pour le tenant.

⚠️ Ce qui est factice :
- Le badge "Interaction à Haut Risque" / alerte prioritaire sur une prescription est **toujours codé en dur à `false`** — le champ `Prescription.contraindicationCheck` existe dans le schéma mais rien ne le calcule ni ne l'affiche réellement. Aucune vérification d'interaction médicamenteuse n'est en fait exécutée.

---

## Maternité / CPN / Accouchement

**Statut : ✅ Complet** (pour le parcours grossesse → accouchement → nouveau-né)

- Construit entièrement cette série : `Pregnancy`, `AntenatalVisit` (CPN, numéro de visite libre compatible OMS/SNIS), `Delivery` avec **partogramme graphique réel** (SVG natif, lignes d'alerte/action calculées selon les normes OMS), `Newborn`.
- L'enregistrement d'un nouveau-né crée un **vrai dossier `Patient`** (IPP réel), pas juste une ligne de naissance isolée.
- Dépistage PTME (VIH/Syphilis) réutilise le module Laboratoire existant plutôt qu'un système de résultats dupliqué.
- Visite CPN et clôture d'accouchement génèrent chacune une ligne de facture automatique.
- Alimente désormais 8 indicateurs DHIS2/SNIS réels (CPN1, CPN4+, accouchements, césariennes, VAT, TPI, dépistage VIH grossesse, nouveau-nés).

❌ Pas de suivi post-partum (suites de couches après l'accouchement) — le parcours s'arrête à l'accouchement et à l'enregistrement du nouveau-né.

---

## Programmes de Santé (Disease Programs)

**Statut : ⚠️ Partiel — registres réels mais isolés**

- Trois vrais modèles Prisma : `MalariaCase`, `TbCase` (+ `TbFollowUp`), `Immunization`, avec CRUD
  réel côté patient et formulaires de saisie réels dans la fiche patient — pas de données fictives
  constatées.
- La page `disease-programs` est une **liste transversale en lecture seule** (onglets
  Vaccination/Paludisme/Tuberculose) ; toute la saisie se fait depuis la fiche patient, pas depuis
  cette page.
- Permissions correctes partout (`requireModulePermission(..., "MODULE_DISEASE_PROGRAMS", ...)`).

❌ **Aucune intégration facturation** : contrairement au Labo/Radio/Chirurgie/Maternité, aucune des
routes de ce module ne génère de ligne de facture — enregistrer un cas de paludisme, une TB ou une
vaccination reste gratuit dans le système, que le module Facturation soit actif ou non.
❌ **Aucune intégration DHIS2** malgré l'intitulé « Disease Programs » : le catalogue d'indicateurs
DHIS2 ne contient aucun indicateur dérivé de `MalariaCase`/`TbCase`/`Immunization`. Le seul champ
lié à la malaria qui alimente DHIS2 (`malaria_prevention_doses_given`, le TPI en CPN) vient en
réalité du module Maternité (`AntenatalVisit`), sans rapport avec le registre `MalariaCase` de ce
module-ci.

---

## Facturation & Paiements (+ Mobile Money)

**Statut : ⚠️ Partiel** (le cœur fonctionne, deux limites honnêtes à connaître)

✅ Ce qui fonctionne :
- Ancien système `BillingStay`/PMSI (français, jamais fonctionnel — aucune route ne le créait) entièrement retiré et remplacé par un vrai moteur `PatientInvoice`/`PatientInvoiceLine`/`Payment`/`FeeSchedule`.
- Génération automatique d'une ligne de facture à chaque acte facturable terminé (consultation signée, examen labo/radio validé, chirurgie clôturée, visite CPN, accouchement, délivrance pharmacie), si le module Facturation est actif pour le tenant.
- Grille tarifaire configurable par tenant.
- Paiement Espèces/Carte/Assurance/Virement : enregistrement réel et instantané.
- Paiement Mobile Money (Orange Money, MTN MoMo) : vrais clients API (OAuth2 + Web Payment redirigé pour Orange, Collections API en push USSD + polling pour MTN), identifiants chiffrés par tenant, webhooks de confirmation.

⚠️ Limites connues, non contournables sans accès externe :
- **Orange Money n'est pas testable en pratique** : nécessite un compte marchand réel (KYC, 5-10 jours ouvrés), aucun sandbox self-service n'existe côté Orange. Le code est écrit contre la vraie API mais n'a jamais été validé de bout en bout.
- **MTN MoMo est testable** via le sandbox gratuit du portail développeur MTN, mais **n'a pas été testé en conditions réelles** dans le cadre de ce travail — implémenté mais non vérifié en pratique.
- Les webhooks Orange/MTN nécessitent un domaine HTTPS public — inutilisables en développement local (MTN reste utilisable en mode "polling" sans webhook).

❌ Manquant :
- Pas d'export PDF de facture côté module Facturation clinique (le système de modèles PDF existe mais n'est branché nulle part ici — voir *Génération PDF*).
- Pas de workflow de gestion des assureurs/tiers-payants : le champ "Part Assurance" est une simple saisie manuelle, aucun modèle d'assureur ni de soumission de réclamation.

---

## Planning

**Statut : ✅ Complet**

- Détection de conflit réelle (`lib/planning/conflicts.ts`) avant création d'un poste, avec confirmation forcée possible ; contrainte unique en base également appliquée.
- Déclaration d'absence : met à jour de vrais enregistrements `Schedule` (choix de conception assumé : pas de modèle `Leave` séparé).
- Départements avec CRUD complet.

⚠️ Nuance de conception : l'absence de modèle `Leave` signifie qu'il n'y a pas de workflow formel de demande/validation de congé — une absence est juste un poste marqué "absent".

---

## Messagerie

**Statut : ⚠️ Complet mais limité au polling**

- Conversations, participants, messages et notifications réels (`Conversation`/`ConversationParticipant`/`Message`/`Notification`), dédoublonnage des conversations 1:1, compteurs de non-lus réels.
- Fonctionne par **polling toutes les 15 secondes**, pas de WebSocket/SSE — donc pas de mise à jour instantanée entre deux utilisateurs connectés simultanément.

---

## Paramètres (niveau tenant)

**Statut : ⚠️ Partiel**

✅ Réel :
- Gestion des utilisateurs (CRUD complet, mot de passe choisi par l'admin à la création, hachage bcrypt, journal d'audit).
- **Rôles** (nouveau) : rôles entièrement personnalisés par tenant (plus d'enum figé) — CRUD réel (`/api/v1/roles`), flag `isSystemAdmin` (accès complet) et `isClinicalProvider` (apparaît comme médecin dans les sélecteurs de rendez-vous/prescripteur), jeu de permissions par défaut par module appliqué à la création d'un utilisateur. Garde-fous réels : impossible de supprimer un rôle assigné à des utilisateurs, impossible de retirer le dernier rôle administrateur actif.
- Paramètres d'organisation (lecture/écriture réelle sur `Tenant`).
- Profil utilisateur.
- Intégration DHIS2 (voir doc dédiée `DHIS2_INTEGRATION_README.md`).
- Intégration Mobile Money (Orange/MTN — voir section Facturation ci-dessus).
- **Licence** (nouveau) : activation en ligne ou hors-ligne de la licence AlphaCorp, statut/renouvellement — voir [`LICENCE_ACTIVATION.md`](LICENCE_ACTIVATION.md). Configuration des modules cliniques : synchronisée automatiquement depuis la licence appliquée (`syncTenantModulesFromLicense`), non modifiable manuellement côté tenant — ce n'est pas un bug, c'est le design voulu.

⚠️ Partiel :
- **Modèles de documents** : les bascules de branding (logo/QR/signature/filigrane) sont réellement persistées, mais le bouton "Modifier le modèle" sur chaque carte de modèle **n'a aucun gestionnaire de clic** — aucun éditeur de modèle n'existe réellement, seul l'aperçu fonctionne.

---

## Interopérabilité DHIS2

**Statut : ✅ Complet** — voir `DHIS2_INTEGRATION_README.md` pour le détail complet (catalogue de 18 indicateurs, recherche de métadonnées, historique de synchronisation avec relance, correction d'un bug d'isolation tenant qui faisait fuiter les données agrégées entre hôpitaux).

---

## ~~Backoffice SaaS (administration plateforme)~~ — supprimé

L'ancienne console cross-tenant (`app/api/admin/**`, comptes `AdminUser`, gestion de plusieurs
hôpitaux depuis une seule instance MedCare) a été **entièrement retirée**. Le modèle réel de
déploiement est une installation MedCare isolée par hôpital ; la gestion multi-client (licences,
plans, facturation, modules) se fait désormais uniquement depuis la plateforme séparée **AlphaCorp**
(autre repo), qui ne communique avec chaque installation MedCare que le temps d'une activation —
voir *Licence on-prem* ci-dessous et [`LICENCE_ACTIVATION.md`](LICENCE_ACTIVATION.md).

---

## Licence on-prem (AlphaCorp)

**Statut : ✅ Complet**

- Système entièrement reconstruit cette session — remplace l'ancien `LicenseKey`/rédemption manuelle
  (retiré) par une licence signée numériquement (Ed25519), délivrée par AlphaCorp, activable **en
  ligne** (appel direct à l'API AlphaCorp) ou **hors ligne** (échange de 2 fichiers signés, aucun
  réseau requis).
- `lib/onprem-license/{apply,verify,guard,fingerprint}.ts` : vérification de signature, anti-rejeu
  (refuse un jeton qui ferait régresser la date de fin de validité), anti-recul d'horloge, blocage
  matériel après une période de grâce configurable — toutes ces vérifications sont réelles et
  couvrent des cas limites vérifiés, pas juste le chemin nominal.
- La licence pilote réellement l'application, pas juste de la métadonnée d'affichage :
  `syncTenantModulesFromLicense` active/désactive les `TenantModule` à chaque application d'une
  licence, `getTenantSeatLimit`/`getTenantBedLimit` plafonnent la création d'utilisateurs et de lits
  en fonction de la licence en vigueur.
- Autorisation basée sur `session.user.isSystemAdmin`, plus sur un nom de rôle en dur.

⚠️ Point d'attention documenté dans `LICENCE_ACTIVATION.md` : l'activation en ligne exige un
abonnement actif assigné côté AlphaCorp ; sans ça elle échoue avec un message explicite (l'émission
manuelle/hors-ligne permet de contourner en saisissant une période de validité à la main).

---

## Génération PDF / Modèles de documents

**Statut : ⚠️ Partiel — 2 modèles réels sur 7**

- `PDFPreviewModal` est un vrai composant `@react-pdf/renderer`, pas une façade — mais la plupart de ses 7 modèles retombent sur des **données fictives codées en dur** ("John Doe", "Dr. Gregory House", `INV-2024-001`...) dès qu'aucune donnée réelle n'est fournie, ce qui est exactement ce qui se passe dans l'aperçu de Paramètres → Modèles de documents.
- Seuls **2 points d'intégration** passent de vraies données : la liste des patients et le dossier patient individuel (`patients/page.tsx`, `patients/[id]/page.tsx`).
- Les 4 modèles Prescription / Résultat Labo / Rapport de Stock / Guide Médicament ne sont **jamais appelés** en dehors de l'aperçu Paramètres — aucune page Facturation, Pharmacie ou Laboratoire ne les utilise. En pratique, "imprimer une prescription" ou "imprimer un résultat labo" n'existe nulle part dans l'app malgré l'existence de ces composants.
- **Mise à jour** : le modèle Facture (`InvoiceTemplate`) était branché sur de vraies données uniquement pour les factures SaaS du backoffice admin — celui-ci ayant été supprimé, `InvoiceTemplate` n'a désormais **plus aucun point d'intégration réel** ; il ne reste utilisé que par l'aperçu à données fictives de Paramètres → Modèles de documents. Le module Facturation clinique tenant n'a toujours aucun export PDF.

---

## Notes d'architecture transverses (pour contexte, pas un module)

- **Déploiement** : une installation MedCare (application + base) par établissement — pas de multi-tenant partagé entre hôpitaux. Le schéma Postgres `tenant_template` reste techniquement multi-tenant (isolation par colonne `tenant_id`) mais n'héberge en pratique qu'un seul tenant réel par installation.
- **Permissions** : `requireModulePermission(session, moduleId, action)` côté API, `useAppStore().hasModule(...)` côté UI — pattern uniforme partout. Le contournement par `isSystemAdmin` (accès total) a remplacé l'ancien test `role === "tenant_admin"` codé en dur — toute nouvelle route doit utiliser le flag, jamais une comparaison de nom de rôle.
- **Rôles** : `TenantUser.roleId` référence un `Role` propre au tenant (nom libre, `isSystemAdmin`, `isClinicalProvider`, permissions par défaut) — remplace l'ancien enum `TenantUserRole` fixe (9 valeurs figées), entièrement retiré du schéma.
- **Activation de module** : `TenantModule` (catalogue `Module`, toujours présent en base) est désormais synchronisé automatiquement à partir de la licence AlphaCorp appliquée (`syncTenantModulesFromLicense`, appelé à chaque activation/import de licence) — plus aucune UI d'administration ne permet de le modifier manuellement, par design. `TenantUser.modules` reste ce qui accorde l'accès à un utilisateur donné au sein d'un module déjà activé pour le tenant.

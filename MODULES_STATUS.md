# État des modules — Medcare V2

Ce document recense, module par module, ce qui est **réellement fonctionnel** (CRUD Prisma réel, pas de données fictives, permissions appliquées), ce qui est **à moitié fait** (UI présente mais logique cassée, désactivée ou fictive), et ce qui **manque complètement**. Il reflète l'état du code au 2026-08-06, vérifié en lisant les routes API et le code source — pas une estimation.

Légende : ✅ Complet et réel · ⚠️ Partiel / à moitié fait · ❌ Manquant

## Vue d'ensemble

| Module | Statut global |
|---|---|
| Patients & Admissions | ✅ Complet |
| Laboratoire | ✅ Complet |
| Radiologie | ✅ Complet |
| Chirurgie | ✅ Complet |
| Pharmacie | ⚠️ Partiel (alerte d'interaction médicamenteuse factice) |
| Maternité / CPN | ✅ Complet (parcours grossesse → accouchement) |
| Facturation & Paiements | ⚠️ Partiel (Mobile Money non testable in situ, pas d'export PDF) |
| Planning | ✅ Complet |
| Messagerie | ⚠️ Complet mais en polling (pas de temps réel) |
| Paramètres (tenant) | ⚠️ Partiel (éditeur de modèles de documents non branché) |
| Interopérabilité DHIS2 | ✅ Complet |
| Backoffice SaaS (plateforme) | ⚠️ Partiel (onglet Paramètres = stub) |
| Licences (Licensing) | ✅ Complet |
| Génération PDF / Modèles | ⚠️ Partiel (2 modèles réels sur 7) |

---

## Patients & Admissions

**Statut : ✅ Complet**

- CRUD réel et isolé par tenant sur `Patient`/`Stay`, permissions appliquées (`requireModulePermission(..., "MODULE_CORE_PATIENT", ...)`).
- Admission crée un vrai `Stay` (+ constantes vitales à l'accueil en option) ; sortie/transfert met à jour `status`/`dischargeDate`/`bedId`/`departmentId` pour de vrai.
- Bons de labo, prescriptions et constantes pendant le séjour écrivent dans les vraies tables (`ExamRequest`, `Prescription`, `VitalSigns`).
- Fiche patient : onglets Admissions, Dossiers médicaux, Prescriptions, Labo, Imagerie, Constantes, **Chirurgie**, **Maternité** et Facturation — tous branchés sur de vraies routes API (les deux derniers ajoutés lors du chantier Facturation).

⚠️ **Nuance, pas un bug** : il n'existe pas de modèle `Bed` dans le schéma — le champ "lit" (`bedId`) est un simple champ texte libre, pas un inventaire de lits avec capacité/statut. La "gestion des lits" se limite donc à une étiquette, pas un vrai système de disponibilité.

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
- Gestion des utilisateurs (CRUD complet, hachage bcrypt, journal d'audit).
- Paramètres d'organisation (lecture/écriture réelle sur `Tenant`).
- Profil utilisateur.
- Intégration DHIS2 (voir doc dédiée `DHIS2_INTEGRATION_README.md`).
- Intégration Mobile Money (Orange/MTN — voir section Facturation ci-dessus).
- Configuration des modules : intentionnellement **lecture seule** pour l'admin du tenant (l'activation est contrôlée par la plateforme via le backoffice SaaS) — ce n'est pas un bug, c'est le design voulu.

⚠️ Partiel :
- **Modèles de documents** : les bascules de branding (logo/QR/signature/filigrane) sont réellement persistées, mais le bouton "Modifier le modèle" sur chaque carte de modèle **n'a aucun gestionnaire de clic** — aucun éditeur de modèle n'existe réellement, seul l'aperçu fonctionne.

---

## Interopérabilité DHIS2

**Statut : ✅ Complet** — voir `DHIS2_INTEGRATION_README.md` pour le détail complet (catalogue de 18 indicateurs, recherche de métadonnées, historique de synchronisation avec relance, correction d'un bug d'isolation tenant qui faisait fuiter les données agrégées entre hôpitaux).

---

## Backoffice SaaS (administration plateforme)

**Statut : ⚠️ Partiel** — ce module est distinct du module Facturation clinique : c'est la couche où l'opérateur de la plateforme Medcare gère ses clients (hôpitaux) et leurs abonnements.

✅ Réel :
- Gestion des tenants, plans, abonnements, factures SaaS et catalogue de modules : CRUD complet contre de vraies routes `app/api/admin/**`.
- Export PDF des factures SaaS (`InvoiceTemplate` rendu côté serveur avec de vraies données `Invoice`/`Tenant`) — seul export PDF réellement branché dans toute l'application.

❌ Manquant :
- L'onglet **Paramètres** du backoffice est un pur stub : affiche "Settings management coming soon..." et n'a ni état ni route API derrière — mais il est bien visible et cliquable dans la barre d'onglets.

---

## Licences (Licensing)

**Statut : ✅ Complet**

- `lib/tenant-licensing.ts` : résolution d'accès tenant, rédemption de licence, activation de module — tout est réel, transactionnel (`$transaction` Prisma), sans branche fictive.
- Rédemption de licence câblée de bout en bout dans la page Paramètres pour les administrateurs système.

---

## Génération PDF / Modèles de documents

**Statut : ⚠️ Partiel — 2 modèles réels sur 7**

- `PDFPreviewModal` est un vrai composant `@react-pdf/renderer`, pas une façade — mais la plupart de ses 7 modèles retombent sur des **données fictives codées en dur** ("John Doe", "Dr. Gregory House", `INV-2024-001`...) dès qu'aucune donnée réelle n'est fournie, ce qui est exactement ce qui se passe dans l'aperçu de Paramètres → Modèles de documents.
- Seuls **2 points d'intégration** passent de vraies données : la liste des patients et le dossier patient individuel (`patients/page.tsx`, `patients/[id]/page.tsx`).
- Les 4 modèles Prescription / Résultat Labo / Rapport de Stock / Guide Médicament ne sont **jamais appelés** en dehors de l'aperçu Paramètres — aucune page Facturation, Pharmacie ou Laboratoire ne les utilise. En pratique, "imprimer une prescription" ou "imprimer un résultat labo" n'existe nulle part dans l'app malgré l'existence de ces composants.
- Le modèle Facture (`InvoiceTemplate`) n'est branché sur de vraies données que pour les factures **SaaS** (backoffice admin) — le module Facturation clinique tenant n'a aucun export PDF.

---

## Notes d'architecture transverses (pour contexte, pas un module)

- **Multi-tenance** : schéma Postgres partagé (`tenant_template`), isolation par colonne `tenant_id` sur chaque table — appliquée de façon cohérente dans tous les modules audités ci-dessus (le bug DHIS2 corrigé récemment était la seule fuite trouvée).
- **Permissions** : `requireModulePermission(session, moduleId, action)` côté API, `useAppStore().hasModule(...)` côté UI — pattern uniforme partout.
- **Activation de module** : catalogue SaaS (`Module`/`PlanModule`/`TenantModule`, schéma public) contrôlé par la plateforme, distinct de `TenantUser.modules` qui accorde l'accès à un utilisateur donné au sein d'un tenant déjà activé.

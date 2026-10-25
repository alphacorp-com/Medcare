# Guide développeur

Architecture, conventions et outils de MedCare, et dette technique connue. À lire avant de modifier
le code. Le fichier `CLAUDE.md` à la racine fixe en plus les exigences de qualité et de sécurité
attendues pour toute contribution.

---

## Pile technique

| Couche | Technologie |
|---|---|
| Application | Next.js 15 (App Router), React, TypeScript |
| Données | PostgreSQL, Prisma 7 (adaptateur `@prisma/adapter-pg`, schéma `tenant_template`) |
| Authentification | NextAuth (identifiants, JWT de 12 h, version de session vérifiée en base) |
| Interface | Tailwind CSS, composants `components/ui` (style shadcn), lucide-react |
| Données côté client | TanStack Query, `lib/api-client.ts` (`apiFetch`) |
| Internationalisation | next-intl : `messages/fr.json`, `messages/en.json` |
| PDF | `@react-pdf/renderer` (`components/templates/`) |
| Rapport RMA3 | génération `.docx` (`lib/reports/rma3-docx.ts`) |
| Tests | `node:test` via `tsx --test` |

## Organisation du dépôt

```
app/
  [locale]/
    (dashboard)/
      (guarded)/        écrans des modules — protégés par la garde de licence
      settings/         paramètres — hors garde, pour pouvoir toujours réactiver la licence
    login/, setup/
  api/
    v1/                 API REST de l'application (une route = un fichier route.ts)
    cron/               tâches planifiées (DHIS2, ancien contrôle d'abonnements)
    auth/               NextAuth
components/             composants partagés (layout, settings, templates PDF, shared, ui…)
lib/                    logique métier, une bibliothèque par domaine (billing, coverage, stock, reports…)
messages/               traductions fr / en
prisma/                 schema.prisma, migrations, scripts de seed et de maintenance
docs/                   cette documentation
```

Chaque écran suit le même découpage : `page.tsx` (état et chargement), `_components/` (feuilles,
tableaux, dialogues), `types.ts` (types des réponses API).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (port 3001) |
| `npm run build` / `npm run start` | Build et démarrage de production |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Vérification des types |
| `npm test` | Tests unitaires (`lib/**/*.test.ts`, `components/**/*.test.ts`) |
| `npm run db:migrate:dev` | Créer une migration (développement uniquement) |
| `npm run db:migrate:deploy` | Appliquer les migrations |
| `npm run db:migrate:status` | État des migrations et base ciblée |
| `npm run db:studio` | Explorateur Prisma |
| `npm run seed`, `seed-settings`, `seed-journeys` | Voir [SEEDING](../installation/SEEDING.md) |
| `npm run db:sync-fee-schedule` | Resynchroniser la grille tarifaire depuis les catalogues |
| `npm run db:sync-exam-parameters` | Appliquer les fiches de résultats standard aux examens |
| `npm run db:reset-data` | ⚠️ Vide **toutes** les tables (base jetable uniquement) |

Avant de livrer une modification : `npx tsc --noEmit`, `npm run lint` sur les fichiers touchés et
`npm test`. Le build Next.js **ignore ESLint** (`eslint.ignoreDuringBuilds`) : le lint ne bloque
donc pas un déploiement, il faut le lancer soi-même.

---

## Conventions à respecter

### Routes API
Chaque route suit le même schéma :

```ts
const session = await getServerSession(authOptions);
if (!session?.user) return 401;
const perm = requireModulePermission(session, "MODULE_X", "read" | "create" | "update" | "delete" | "validate");
if (!perm.ok) return perm.status;
// toutes les requêtes : where: { ..., tenantId: session.user.tenantId }
```

- **Paramètres de l'établissement** : `requireTenantAdmin(session)`.
- **Jamais** de test sur un nom de rôle : seuls `isSystemAdmin` et `isClinicalProvider` comptent.
- Tout identifiant reçu du navigateur (lit, service, médecin, article, organisme…) est **vérifié
  comme appartenant à l'établissement** avant d'être enregistré.
- Les erreurs connues renvoient un **code** (`{ error: "code" }`) traduit par l'interface ; une
  erreur inattendue est journalisée côté serveur et renvoyée sans détail.
- Validation des entrées côté serveur avec les fonctions pures `parse…` des bibliothèques
  (`lib/coverage/input.ts`, `lib/stock/input.ts`, `lib/maternity/…`), testées unitairement.

### Argent et stock : un seul point d'entrée
- **Stock** : seul `lib/stock/movements.ts` modifie le stock (verrou de l'article, lots, journal,
  soldes recalculés). Il est appelé dans la transaction de l'acte métier.
- **Lignes de facture** : `suggestInvoiceLine(s)` et `recalculateInvoiceTotals`
  (`lib/billing/suggestCharge.ts`). Le prix vient **toujours** de `FeeSchedule`, jamais du client.
- **Tiers payant** : calcul pur dans `lib/coverage/compute.ts`, chargement et verrous dans
  `lib/coverage/apply.ts`.
- **Paiement → libération des soins** : `lib/billing/applyPayment.ts` et
  `lib/billing/release.ts`.

### Concurrence
Les transitions sensibles sont **conditionnelles** (`updateMany` avec le statut attendu dans le
`where`), ou s'exécutent dans une transaction avec `SELECT … FOR UPDATE` ou un verrou consultatif :
- prise en charge d'un patient, attribution d'un lit ;
- validation et délivrance d'une ordonnance ;
- poche de sang, plafonds du tiers payant.

Conservez ce schéma pour toute nouvelle transition. Les transactions interactives ont une limite de
30 s (`lib/prisma.ts`).

### Interface
- Textes uniquement via next-intl : ajouter chaque clé **en français et en anglais**.
- Permissions côté interface : `useAppStore().hasPermission(module, action)`. C'est un confort
  d'affichage : le contrôle réel est côté API.
- Une URL externe saisie par un utilisateur n'est rendue comme lien que si elle est en `http(s)`
  (voir `components/shared/exam-result-sheet.tsx`).

### Base de données
- Toute évolution du schéma passe par une **migration** (`prisma/migrations/`), jamais par
  `db push` sur une base partagée.
- Plusieurs colonnes de référence n'ont **pas de relation Prisma** : `Stay.departmentId`, `bedId`,
  `attendingDoctorId`, `ExamCatalogEntry.imagingCatalogItemId`… Résolvez les libellés par une
  requête groupée, filtrée par établissement (exemple : `app/api/v1/patients/[id]/stays/route.ts`).
- Ajoutez des codes au catalogue RMA3 manuel (`lib/rma3-manual/catalog.ts`), **ne les renommez
  jamais** : les valeurs saisies seraient orphelines.

---

## Dette technique connue

| Sujet | Constat | Impact |
|---|---|---|
| 🔴 Webhooks Mobile Money | Font confiance au statut reçu (`app/api/v1/billing/webhooks/*`) | Paiement falsifiable ; voir l'[audit](../securite/AUDIT_2026-09.md) |
| En-têtes HTTP | Pas de CSP, X-Frame-Options, etc. ; `poweredByHeader` actif | Durcissement manquant |
| `PUT /api/v1/settings/templates` | Pas de contrôle administrateur | Modification d'habillage par tout utilisateur |
| Ancien SaaS multi-établissements | Modèles `Plan`, `Subscription`, `Invoice` (SaaS), `OneTimeCharge`, `LicenseKey` encore dans le schéma ; `lib/subscription-sync.ts` et `/api/cron/check-subscriptions` encore présents sans écran ni route d'administration ; dossier `lib/admin/` vide | Code mort, à retirer par une migration dédiée |
| `.env.example` | `DB_PUBLIC_URL` et `MEDCARE_SERVICE_API_KEY` ne sont plus lus ; le commentaire cite un `lib/admin/service-auth.ts` inexistant | Confusion à l'installation |
| `docker-compose.yml` | Mot de passe PostgreSQL de démonstration en clair ; `NEXTAUTH_SECRET` et `ONPREM_LICENSE_*` non transmis | Ne démarre pas en production tel quel |
| Interactions médicamenteuses | Alerte codée en dur à `false` | Fonctionnalité factice affichée |
| Modèles de documents | Bouton « Modifier le modèle » sans action ; 2 modèles PDF jamais utilisés | Fonctionnalité incomplète |
| Lit à l'admission | `POST /patients/[id]/stays` accepte un lit hors circuit d'hospitalisation | Lit occupé sans caution, absent de Sorties ; règle métier à trancher |
| Seed de démonstration | Les hospitalisations ne renseignent pas `hospitalizationStatus` | Page Sorties vide en démonstration |
| Grille tarifaire | Un acte médical et un examen de même code partagent la même ligne `FeeSchedule` (`lib/billing/syncFeeSchedule.ts`) | Écrasement silencieux d'un prix |
| Lint | Erreurs préexistantes (par exemple `react-hooks/set-state-in-effect` dans `patients/[id]/page.tsx`) | Le lint global n'est pas vert |
| Tests | Tests unitaires des bibliothèques uniquement ; pas de tests des routes API ni de bout en bout | Régressions de permissions non détectées automatiquement |
| Commentaires obsolètes | `dashboard/stock-alerts` (« pas de dates de péremption »), `doctors` (« role=doctor ») | Lecture trompeuse |
| Sauvegarde | `settings/database` (pg_dump) sans écran, inutilisable sans disque persistant | Fonction inaccessible |

Traitez chaque sujet dans une intervention distincte, avec ses tests, plutôt qu'au détour d'une
autre modification.

## Ajouter un module ou un écran : check-list

1. Modèle et **migration** Prisma (colonne `tenantId` indexée).
2. Validation pure des entrées dans `lib/<domaine>/input.ts`, avec ses tests.
3. Routes sous `app/api/v1/<domaine>/` : session, permission, filtre par établissement,
   vérification des identifiants étrangers, transaction si plusieurs écritures, audit des actions
   sensibles.
4. Écran sous `app/[locale]/(dashboard)/(guarded)/<module>/`, entrée de menu dans
   `components/layout/navigation.ts`, traductions fr et en.
5. Facturation : passer par `suggestInvoiceLine` et un tarif `FeeSchedule`.
6. Rapports : brancher le RMA3 (`lib/reports/`) et, si pertinent, DHIS2 (`lib/dhis2/indicators.ts`).
7. Documentation : guide dans `docs/modules/<module>/README.md`, mise à jour de
   l'[état des modules](../etat-des-modules/README.md).

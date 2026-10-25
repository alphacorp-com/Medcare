# Installation et déploiement

Ce guide s'adresse au responsable technique qui installe une instance MedCare pour un
établissement : variables d'environnement, base de données, premier démarrage, hébergement et
sauvegardes.

> Rappel : **une installation = un établissement**. Ne partagez jamais une base MedCare entre deux
> établissements (voir [Présentation](../presentation/README.md)).

---

## 1. Prérequis

| Composant | Version |
|---|---|
| Node.js | 20 (image Docker `node:20-alpine`) |
| PostgreSQL | 16 ou plus (Neon, PostgreSQL local ou conteneur) |
| Identifiants AlphaCorp | ID client et secret client de l'établissement, fournis par AlphaCorp |

Pile logicielle : Next.js 15 (App Router), Prisma 7 (adaptateur `pg`), NextAuth, next-intl.

## 2. Variables d'environnement

Copiez `.env.example` vers `.env`, puis renseignez :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | Oui | Connexion PostgreSQL. Le schéma applicatif est `tenant_template` (`?schema=tenant_template`). |
| `NEXTAUTH_SECRET` | Oui en production | Signe les sessions. En production, l'application **refuse de démarrer** sans lui (`lib/auth-secret.ts`). Générez-le avec `openssl rand -base64 32`. Il sert aussi à chiffrer les identifiants DHIS2 et Mobile Money stockés : **ne le changez pas** après la configuration de ces intégrations. |
| `ONPREM_LICENSE_CLIENT_ID` | Oui | ID client AlphaCorp de l'établissement. |
| `ONPREM_LICENSE_CLIENT_SECRET` | Oui | Secret client AlphaCorp. Il protège aussi la page `/setup`. |
| `ALPHACORP_LICENSE_API_URL` | Pour l'activation en ligne | Exemple : `https://alphacorp.vercel.app/api/license/activate`. Inutile en activation hors ligne. |
| `ONPREM_INSTALL_ID` | Oui en Docker / cloud | Identifiant stable de l'installation (`openssl rand -hex 16`), généré **une fois** et jamais modifié. Sans lui, l'empreinte de licence change à chaque recréation du conteneur ou du déploiement. |
| `ONPREM_LICENSE_PUBLIC_KEY_PEM` | Non | Remplace la clé publique de vérification des licences, uniquement après une rotation de clé AlphaCorp. |
| `CRON_SECRET` | Recommandé | Protège la tâche planifiée DHIS2 (`/api/cron/sync-dhis2`). Sans lui, l'URL est appelable sans authentification. |

`DB_PUBLIC_URL` et `MEDCARE_SERVICE_API_KEY` figurent encore dans `.env.example` mais **ne sont
plus lus par le code** (vestiges de l'ancienne console multi-établissements). Vous pouvez les
laisser vides.

⚠️ Une seule ligne par variable : en cas de doublon, une seule valeur est prise en compte.
Après toute modification, **redémarrez ou redéployez** l'application.

## 3. Base de données

```bash
npm install                  # dépendances + génération du client Prisma
npm run db:migrate:status    # affiche la base ciblée et les migrations en attente
npm run db:migrate:deploy    # applique les migrations
npm run seed                 # catalogue des modules (indispensable)
npm run seed-settings        # référentiels de base de l'établissement (recommandé)
```

- `npm run seed` crée le catalogue des modules : sans lui, la licence ne peut activer aucun module.
- `npm run seed-settings` crée les référentiels (types d'admission, antigènes, actes, examens,
  CIM-10, grille tarifaire de démonstration…). Il ne remplace jamais une valeur déjà modifiée par
  l'établissement. Les **prix de démonstration** doivent ensuite être remplacés par les tarifs
  réels (voir [Paramétrage](../parametrage/README.md)).
- **N'utilisez jamais** `npm run seed-journeys` (patients fictifs) sur une base de production.
  Voir [Données de démonstration](SEEDING.md).

## 4. Premier démarrage : `/setup`

À la première ouverture, aucune personne n'a encore de compte. La page **`/setup`** crée
l'établissement et son premier administrateur.

👤 **Procédure**
1. Ouvrez `https://<votre-domaine>/setup`.
2. Saisissez le **secret client** AlphaCorp (`ONPREM_LICENSE_CLIENT_SECRET`), le nom de
   l'établissement et les informations du premier administrateur.
3. Validez, puis connectez-vous avec ce compte.
4. Activez la licence : **Paramètres → Licence** (voir [Licence](../licence/README.md)).
5. Configurez l'établissement : **Paramètres → Organisation**, puis les rôles, les utilisateurs et
   les référentiels (voir [Paramétrage](../parametrage/README.md)).

🛠️ `/setup` (`app/api/v1/setup/route.ts`) ne fonctionne **qu'une fois** : il se verrouille dès qu'un
utilisateur existe, avec une seconde vérification dans la transaction contre deux soumissions
simultanées. Le secret est comparé en temps constant. Le premier administrateur reçoit un rôle
`isSystemAdmin`, renommable ensuite.

## 5. Hébergement

### Vercel

1. Importez le dépôt dans Vercel.
2. Renseignez les variables de la section 2 dans **Settings → Environment Variables** (environnement
   *Production*). Fixez `ONPREM_INSTALL_ID` : l'empreinte machine de Vercel n'est pas stable.
3. Appliquez les migrations depuis un poste qui pointe sur la base de production
   (`npm run db:migrate:deploy`). Le build Vercel ne le fait pas.
4. Après chaque modification de variable : **Redeploy**.
5. Tâche planifiée DHIS2 (facultatif) : ajoutez un `vercel.json` (il n'y en a pas dans le dépôt) :
   ```json
   { "crons": [{ "path": "/api/cron/sync-dhis2", "schedule": "0 3 1 * *" }] }
   ```

### Docker

Le dépôt fournit un `Dockerfile` (build Next.js *standalone*) et un `docker-compose.yml`
(PostgreSQL 16 + application sur le port 3000).

```bash
npm run docker:build
npm run docker:up
```

⚠️ Avant toute utilisation réelle :
- `docker-compose.yml` contient un **mot de passe PostgreSQL de démonstration** en clair :
  remplacez-le, idéalement par une variable lue depuis `.env`.
- Le service `app` ne transmet que `DATABASE_URL`, `NODE_ENV` et `ONPREM_INSTALL_ID`. Ajoutez
  `NEXTAUTH_SECRET` et les variables `ONPREM_LICENSE_*`, sinon l'application refuse de démarrer
  en production.
- L'image *standalone* ne contient pas la CLI Prisma : appliquez les migrations depuis l'hôte
  (`DATABASE_URL` pointant sur le port 5433 publié), pas avec `npm run docker:migrate`, qui lance
  `migrate dev` (commande réservée au développement).

### Serveur sur site (sans Docker)

```bash
npm ci
npm run db:migrate:deploy
npm run build
npm run start            # port 3000 par défaut ; placez un reverse proxy HTTPS devant
```

## 6. Sauvegardes

- **Neon** : créez une *branch* avant toute opération risquée (migration, seed) ; elle sert de
  point de restauration instantané.
- **PostgreSQL** : sauvegarde régulière avec `pg_dump` :
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --no-owner --file=medcare-$(date +%F).dump
  ```
  Restauration : `pg_restore --clean --no-owner -d "$DATABASE_URL" medcare-AAAA-MM-JJ.dump`.
- Conservez les sauvegardes **hors du serveur**, chiffrées : elles contiennent des données de santé.

🛠️ Une route `app/api/v1/settings/database` (administrateur) sait lancer un `pg_dump` sur le
serveur et lister ou télécharger les sauvegardes. **Aucun écran ne l'utilise aujourd'hui**, et elle
suppose `pg_dump` installé sur le serveur et un disque persistant : elle ne fonctionne pas sur
Vercel.

## 7. Mises à jour

1. Sauvegardez la base (section 6).
2. Récupérez la nouvelle version du code.
3. `npm install`, puis `npm run db:migrate:deploy`.
4. Rebuild et redémarrage (ou redéploiement).
5. Si la version ajoute des paramètres d'examens : `npm run db:sync-exam-parameters`. Si elle
   modifie les prix du catalogue : `npm run db:sync-fee-schedule`.

## 8. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `NEXTAUTH_SECRET must be set in production` | Variable absente | La renseigner et redémarrer. |
| `Module not found` au build Vercel | Fichier source non versionné | Vérifier `git status` et le `.gitignore` (règles ancrées par `/`). |
| `P1001 Can't reach database server` (Neon) | Base suspendue, en cours de réveil | Réessayer après quelques secondes ; vérifier le réseau. |
| `P2028 Transaction API error` | Transaction trop longue sur une base distante | Limite portée à 30 s dans `lib/prisma.ts` ; réessayer. |
| `Invalid site secret` sur `/setup` | Secret saisi différent de `ONPREM_LICENSE_CLIENT_SECRET` | Vérifier la variable (secret, pas l'ID) et redéployer. |
| Toutes les pages renvoient vers Paramètres → Licence | Licence expirée au-delà de la période de grâce | Renouveler la licence ([Licence](../licence/README.md)). |

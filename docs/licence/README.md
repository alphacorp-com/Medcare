# Activation de la licence MedCare (AlphaCorp)

Ce document explique comment une installation MedCare (une par client, sur site ou hébergée) est
activée, renouvelée et contrôlée par AlphaCorp — **sans déplacement physique**. Il s'adresse à la
fois à l'administrateur de l'hôpital qui active sa licence, et au développeur qui doit comprendre
ou faire évoluer le système.

Les sections marquées **👤 Utilisateur** sont les étapes à suivre dans l'interface. Les sections
marquées **🛠️ Développeur** expliquent ce qui se passe techniquement — elles peuvent être ignorées
si vous voulez juste activer une licence.

---

## 1. Vue d'ensemble

Chaque installation MedCare (base de données + application) appartient à **un seul client**
(hôpital). AlphaCorp gère tous ses clients depuis sa propre console d'administration
(`alphacorp/admin/licenses`), indépendamment de chaque installation MedCare — les deux systèmes ne
communiquent que le temps d'une activation, jamais en continu.

Une licence est un **jeton signé** que MedCare vérifie localement à chaque chargement de page. Elle
peut être obtenue de deux façons :

| Flux | Quand l'utiliser | Réseau requis |
|---|---|---|
| **En ligne** | L'installation MedCare a un accès internet sortant | Oui, MedCare → AlphaCorp |
| **Hors ligne** | Pas d'accès internet, ou activation manuelle préférée | Non — juste 2 fichiers à transférer |

Les deux flux produisent exactement le même résultat : un jeton signé appliqué à MedCare. Le choix
est purement une question de commodité réseau.

### Concepts clés

| Terme | Où | Ce que c'est |
|---|---|---|
| **Client (LicenseClient)** | AlphaCorp | La fiche représentant l'hôpital côté AlphaCorp — un identifiant, un secret, les modules/plafonds prévus |
| **ID Client** / **Secret Client** | Les deux | Identifiants uniques à cette installation, générés une fois par AlphaCorp. Servent à la fois de justificatif d'activation en ligne et de clé de signature hors ligne |
| **Empreinte (fingerprint)** | MedCare → AlphaCorp | Un identifiant dérivé de la machine hébergeant MedCare, calculé localement. Lie une licence à *cette* installation précise |
| **Licence (jeton signé)** | AlphaCorp émet, MedCare vérifie | Un bloc de texte signé cryptographiquement contenant : le palier, les modules inclus, le plafond d'utilisateurs/lits, la période de validité, la durée de grâce |
| **OnPremLicense** | MedCare (BDD) | La licence actuellement appliquée sur cette installation — une seule ligne, toujours la plus récente |
| **Période de grâce** | MedCare | Nombre de jours après l'expiration pendant lesquels MedCare reste utilisable, pour laisser le temps de renouveler |

---

## 2. Prérequis : configurer les identifiants (une seule fois)

**👤** Avant toute activation, l'installation MedCare a besoin de 2 ou 3 valeurs dans son fichier
`.env` :

```
ONPREM_LICENSE_CLIENT_ID=<affiché sur la fiche du client dans AlphaCorp>
ONPREM_LICENSE_CLIENT_SECRET=<affiché une seule fois à la création du client, ou après une rotation>
ALPHACORP_LICENSE_API_URL=<uniquement nécessaire pour le flux EN LIGNE>
```

- **Où trouver l'ID Client** : sur la fiche du client dans AlphaCorp (`/admin/licenses/<id>`), affiché
  en haut de page.
- **Où trouver le Secret Client** : affiché **une seule fois**, soit à la création du client, soit
  après un clic sur **"Rotate secret"** sur sa fiche (réservé aux super-admins AlphaCorp). S'il est
  perdu, il faut le régénérer via cette rotation — il n'est jamais stocké en clair, donc personne
  (pas même AlphaCorp) ne peut le retrouver après coup.
- **`ALPHACORP_LICENSE_API_URL`** n'est nécessaire que pour l'activation *en ligne* — c'est l'URL de
  l'endpoint public d'AlphaCorp (ex. `https://alphacorp.example.com/api/license/activate`). Le flux
  hors ligne n'en a pas besoin.

⚠️ Erreur fréquente : coller l'ID Client dans la variable `SECRET`, ou dupliquer une variable dans le
`.env` (seule la première occurrence d'une clé dupliquée est prise en compte — la seconde est
ignorée silencieusement). Toujours vérifier qu'il n'y a qu'une seule ligne par variable.

**Après toute modification du `.env`, redémarrer le serveur MedCare** — ces variables ne sont lues
qu'au démarrage.

**🛠️** Ces trois variables sont lues directement via `process.env` dans les routes API
(`app/api/v1/onprem-license/*`) — pas de cache, pas de valeur par défaut. Le secret brut n'est
jamais journalisé ni renvoyé au client.

---

## 3. Activation en ligne

**👤** Paramètres → **Licence** → section **"Activer en Ligne"** → bouton **Activer en Ligne**.
En cas de succès, la date de validité s'affiche immédiatement.

**Prérequis côté AlphaCorp** : le client doit avoir un **abonnement (plan) actif** assigné sur sa
fiche — sinon l'activation en ligne est refusée avec *"assign a plan before activation"*. C'est la
source d'expiration/validité automatiquement utilisée : pas besoin de ressaisir de dates.

**🛠️ Ce qu'il se passe** :

1. MedCare calcule son empreinte machine (`lib/onprem-license/fingerprint.ts`) et appelle
   `POST /api/v1/onprem-license/activate-online` (route MedCare, protégée par session
   `isSystemAdmin` + limite de débit : 5 tentatives / 10 min).
2. Cette route MedCare appelle l'endpoint public d'AlphaCorp (`ALPHACORP_LICENSE_API_URL`) avec
   `Authorization: Bearer <ID Client>.<Secret Client>` et `{ fingerprint }` dans le corps.
3. Côté AlphaCorp (`app/api/license/activate/route.ts`, sans session admin — authentification
   uniquement par ce Bearer) : vérifie le hash du secret, vérifie que le client n'est pas suspendu,
   lie l'empreinte au client si c'est la première activation (refuse si l'empreinte ne correspond
   pas à une empreinte déjà liée — une licence est verrouillée à une seule machine), récupère la
   période de l'abonnement actif, puis signe un jeton (`lib/licensing/issue.ts` → `issueLicense()`)
   qui crée aussi automatiquement une facture liée.
4. MedCare reçoit le jeton, vérifie sa signature Ed25519 (`lib/onprem-license/verify.ts`), vérifie
   que la période de validité ne régresse pas par rapport à la licence déjà appliquée (anti-rejeu),
   puis l'enregistre dans `OnPremLicense` (`lib/onprem-license/apply.ts`).
5. Cette même étape synchronise aussi `TenantModule` (active/désactive les modules cliniques selon
   la liste de la licence) et rend le plafond d'utilisateurs/lits réellement appliqué.

---

## 4. Activation hors ligne

**👤** Utile sans accès internet sortant depuis le site MedCare. Se fait en 3 allers-retours, avec
seulement 2 petits fichiers `.json` à transporter (clé USB, email, etc.) :

1. **Sur MedCare** — Paramètres → Licence → **"Télécharger le Fichier de Demande"**.
2. **Transférer ce fichier vers AlphaCorp** (il ne contient pas le secret en clair, juste sa
   signature — pas sensible en soi).
3. **Sur AlphaCorp** — fiche du même client → section **"Émettre une licence hors-ligne"** → uploader
   ce fichier → (optionnel : personnaliser la période de validité si le client n'a pas d'abonnement
   assigné) → soumettre.
4. **Télécharger le fichier de réponse** généré par AlphaCorp.
5. **Transférer ce fichier de réponse vers MedCare.**
6. **Sur MedCare** — même page → section import → sélectionner ce fichier → la licence est
   appliquée.

**🛠️ Ce qu'il se passe** :

- **Fichier de demande** (`GET /api/v1/onprem-license/request-file`, MedCare) : construit
  `{ clientId, fingerprint, requestedAt }`, calcule un HMAC-SHA256 de ce JSON avec le Secret Client
  (jamais transmis, seulement sa signature), et renvoie le tout signé en fichier téléchargeable.
- **Traitement côté AlphaCorp** (`issueOfflineLicense` dans `actions/admin/licenses.ts`) : déchiffre
  le secret stocké pour ce client, recalcule le même HMAC et le compare — un fichier altéré ou
  généré pour un autre client est rejeté. Vérifie/lie l'empreinte comme pour le flux en ligne, puis
  signe une licence de la même façon (`issueLicense()`).
- **Fichier de réponse** : le jeton signé lui-même (`ALC1.<payload>.<signature>`), téléchargé comme
  fichier texte.
- **Import côté MedCare** (`POST /api/v1/onprem-license/import`) : appelle exactement la même
  fonction `applyLicenseToken()` que le flux en ligne — donc les mêmes vérifications de signature,
  d'anti-rejeu, et la même synchronisation des modules/plafonds.

---

## 5. Augmenter les utilisateurs, les lits, ou changer les modules actifs

**👤** Sur la fiche du client dans AlphaCorp :
- **Modules** : case à cocher par module, toujours visible, réémet automatiquement la licence
  quand une licence active existe déjà.
- **Mise à jour rapide** (utilisateurs/lits) : n'apparaît **qu'après une première activation**
  réussie (l'installation doit déjà être liée par empreinte).

Dans les deux cas, une nouvelle licence signée est générée automatiquement. Il faut ensuite
l'appliquer côté MedCare — en ligne (réactiver) ou hors ligne (réimporter la réponse) — pour que le
changement prenne effet.

**🛠️** Ces deux actions appellent `updateLicenseClientModules()` / `quickUpdateLicenseEntitlement()`
(`actions/admin/licenses.ts`), qui mettent à jour `LicenseClient.plannedModules` /
`plannedMaxUsers` / `plannedMaxBeds`, puis réémettent une licence (`issueLicenseDirectly`) reprenant
la période de validité de la licence active existante.

---

## 6. Ce qui se passe quand la licence expire

**👤** MedCare ne se bloque pas immédiatement à l'expiration — une **période de grâce** (en jours,
définie par licence) laisse le temps de renouveler. Pendant cette période, l'accès reste normal
mais un bandeau d'avertissement apparaît sur le tableau de bord ("Période de grâce — renouvelez
rapidement"). Une fois la période de grâce dépassée, toutes les pages de l'application redirigent
vers Paramètres → Licence, la seule page qui reste accessible pour réactiver.

**🛠️** L'enforcement est centralisé dans `lib/onprem-license/guard.ts`
(`checkOnPremLicenseGuard()`), appelé par le layout serveur du groupe de routes `(guarded)`
(`app/[locale]/(dashboard)/(guarded)/layout.tsx`) — volontairement séparé du groupe `(dashboard)`
qui contient Paramètres, pour que la garde ne puisse jamais bloquer l'accès à la page qui permet de
la lever. Deux protections supplémentaires :

- **Anti-recul d'horloge** : un horodatage `lastKnownGoodAt` ne peut que progresser ; reculer
  l'horloge système de la machine ne fait pas gagner de temps.
- **Anti-rejeu** : `applyLicenseToken()` refuse un jeton dont la date de fin de validité serait
  *antérieure* à celle déjà appliquée, même signé valablement.

---

## 7. Dépannage

| Message | Cause | Solution |
|---|---|---|
| `Invalid site secret` (à `/setup`) | Le secret saisi ne correspond pas à `ONPREM_LICENSE_CLIENT_SECRET`, ou celui-ci contient une valeur incorrecte (ex. l'ID au lieu du secret) | Vérifier le `.env` — un seul `ONPREM_LICENSE_CLIENT_SECRET`, la bonne valeur (format `base64url`, ~43 caractères, pas un identifiant type `cmxxxxxxxxxxxxxxxxxxxxxxx`) |
| `Online activation is not configured... (missing ONPREM_LICENSE_CLIENT_ID/SECRET or ALPHACORP_LICENSE_API_URL)` | Une des trois variables manque | Compléter le `.env`, redémarrer le serveur |
| `Offline activation is not configured... (missing ONPREM_LICENSE_CLIENT_ID/SECRET)` | ID ou secret manquant (l'URL API n'est pas nécessaire ici) | Idem, sans l'URL |
| `assign a plan before activation` (activation en ligne) | Le client n'a pas d'abonnement actif dans AlphaCorp | Sur la fiche client → section Abonnement → assigner un plan |
| `This client is already bound to a different device` | L'empreinte de la machine a changé (réinstallation, migration serveur) | Contacter AlphaCorp pour délier/relier l'empreinte (opération manuelle en base à ce jour) |
| `This request file's signature is invalid` (import côté AlphaCorp) | Fichier de demande corrompu, modifié, ou généré pour un autre client | Régénérer un nouveau fichier de demande depuis MedCare |
| Panneau licence affiche une erreur rouge "Impossible de vérifier le statut" | Échec technique de la vérification (ex. session expirée) — **ne veut pas dire qu'il n'y a pas de licence** | Réessayer ; si persistant, vérifier les logs serveur |

---

## 8. Annexe technique — repères pour les développeurs

### Fichiers clés

| Fichier | Rôle |
|---|---|
| `lib/onprem-license/fingerprint.ts` | Calcule l'empreinte machine (MedCare) |
| `lib/onprem-license/verify.ts` | Vérifie la signature Ed25519 d'un jeton reçu |
| `lib/onprem-license/apply.ts` | Point unique d'application d'un jeton — anti-rejeu, écriture `OnPremLicense`, synchro modules |
| `lib/onprem-license/guard.ts` | Calcule si l'accès doit être bloqué (période de grâce, anti-recul d'horloge) |
| `lib/tenant-licensing.ts` | `syncTenantModulesFromLicense()`, `getTenantSeatLimit()`, `getTenantBedLimit()` — branchent la licence sur l'enforcement réel (modules, utilisateurs, lits) |
| `app/api/v1/onprem-license/*` | Les 4 routes MedCare : status, activate-online, request-file, import |
| `alphacorp/app/api/license/activate/route.ts` | Endpoint public d'AlphaCorp pour le flux en ligne |
| `alphacorp/actions/admin/licenses.ts` | Logique métier AlphaCorp : émission, rotation de secret, mise à jour modules/plafonds |
| `alphacorp/lib/licensing/{sign,secret,issue}.ts` | Signature du jeton, gestion du secret client, émission + facturation automatique |

### Propriétés de sécurité

- **Signature du jeton** : Ed25519 (`crypto.sign`/`crypto.verify`), format compact
  `ALC1.<base64url(payload)>.<base64url(signature)>`.
- **Secret client** : généré par `crypto.randomBytes(32).toString("base64url")`, stocké côté
  AlphaCorp à la fois hashé (SHA-256, comparaison rapide pour le flux en ligne) et chiffré
  (AES-256-GCM, pour pouvoir le déchiffrer et recalculer le HMAC du flux hors ligne). Jamais stocké
  en clair, jamais renvoyé après sa création/rotation.
- **Comparaisons à temps constant** (`crypto.timingSafeEqual`) partout où un secret/hash est
  comparé, pour éviter les attaques par mesure de temps.
- **Limitation de débit** sur toutes les routes d'activation (5 tentatives / 10 min par
  utilisateur ou par client).
- **Chaque installation MedCare est verrouillée à une seule empreinte machine** dès sa première
  activation — une licence ne peut pas être copiée telle quelle sur une autre machine.

### Points de vigilance connus

- L'activation en ligne exige un abonnement actif côté AlphaCorp ; l'émission manuelle/hors-ligne
  permet de contourner ça en saisissant une période de validité manuellement.
- Le rôle autorisé à gérer la licence côté MedCare est déterminé par `session.user.isSystemAdmin`
  (voir `lib/permissions.ts`) — **jamais** par un nom de rôle en dur (`"tenant_admin"` n'existe plus
  depuis l'introduction des rôles personnalisés). Toute nouvelle route touchant à la licence doit
  utiliser ce flag, pas une comparaison de chaîne.

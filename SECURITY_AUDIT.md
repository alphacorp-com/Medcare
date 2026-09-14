# Audit de sécurité — MedCare (medcare-v2.vercel.app)

**Date** : 2026-09-13
**Méthode** : revue de code white-box (accès complet au code source) + reconnaissance non-intrusive sur le déploiement live. Aucune attaque active agressive (fuzzing, brute-force, scanners automatisés) menée contre l'infrastructure Vercel, tierce.
**Périmètre** : application MedCare déployée sur `https://medcare-v2.vercel.app/`.

---

## Résumé

| # | Constat | Sévérité |
|---|---|---|
| 1 | Webhooks de paiement Mobile Money (Orange/MTN) non authentifiés | 🔴 Haute |
| 2 | En-têtes de sécurité HTTP manquants (CSP, X-Frame-Options, etc.) | 🟠 Moyenne |
| 3 | `PUT /api/v1/settings/templates` sans contrôle de rôle | 🟡 Basse |
| 4 | En-tête `X-Powered-By: Next.js` (divulgation de techno) | 🟡 Basse / Info |

Aucune injection SQL, aucun XSS exploitable, aucun contournement d'authentification ou d'isolation inter-tenant trouvé. Détail des points vérifiés sains en fin de document.

---

## 🔴 1. Webhooks de paiement non authentifiés (intégrité financière)

**Fichiers** : `app/api/v1/billing/webhooks/orange/route.ts`, `app/api/v1/billing/webhooks/mtn/route.ts`

Les deux webhooks de confirmation de paiement Mobile Money ne vérifient **ni signature, ni origine, ni authentification** — ils font entièrement confiance au corps de la requête entrante, y compris au champ `status` fourni par l'appelant :

```
POST /api/v1/billing/webhooks/orange
{ "pay_token": "<token d'un paiement pending>", "status": "SUCCESS" }
```

Ce que fait le code, sans aucune vérification externe :
1. Recherche le `Payment` correspondant au `pay_token`/`referenceId` fourni.
2. Si `status` vaut `"SUCCESS"` (Orange) ou `"SUCCESSFUL"` (MTN), marque le paiement `successful`.
3. Appelle `applySuccessfulPayment()`, qui bascule la **facture patient en "payée"**.

### Scénario d'exploitation

Dans le flux Orange Web Payment, le `pay_token` est exposé au patient payeur pendant la redirection vers la page de paiement. Un patient malveillant peut intercepter ce token et l'envoyer directement au webhook avec `status: "SUCCESS"`, **sans avoir payé**. La facture passe "payée" dans le système.

**Effet de bord aggravant** : côté Pharmacie, la délivrance de médicaments est bloquée tant que la facture n'est pas payée (`isModuleActiveForTenant`/logique de gate sur `MODULE_BILLING`). Une facture falsifiée "payée" débloque donc aussi la délivrance.

Le garde `if (payment.status !== "pending") return { ok: true }` empêche un rejeu multiple sur le même paiement, mais n'empêche pas la falsification initiale.

*Nuance* : au moment de cet audit, l'intégration Orange Money n'a jamais été validée bout-en-bout (nécessite un compte marchand réel) et MTN MoMo tourne en sandbox — donc probablement pas exploitable en conditions réelles aujourd'hui. Mais le code est déployé tel quel, et devient exploitable dès que l'une des deux intégrations passe en production.

### Correctif recommandé

Ne jamais faire confiance au champ `status` du corps du webhook. À réception d'un callback, refaire un appel serveur-à-serveur vers l'API de statut du fournisseur pour confirmer le vrai statut :
- Orange : `GET /transactionstatus` avec le token.
- MTN : `GET /requesttopay/{referenceId}` (l'route de polling `app/api/v1/billing/payments/[id]/status/route.ts` fait déjà cette vérification correctement — le webhook doit réutiliser cette même logique au lieu de croire le body).

À défaut d'API de vérification, valider une signature HMAC si le fournisseur en propose une.

---

## 🟠 2. En-têtes de sécurité HTTP manquants

Le déploiement ne renvoie que `Strict-Transport-Security`. Sont absents :

| En-tête | Risque sans lui |
|---|---|
| `X-Frame-Options` / CSP `frame-ancestors` | Clickjacking sur une app authentifiée à actions sensibles (facturation, prescriptions) |
| `X-Content-Type-Options: nosniff` | MIME-sniffing pouvant faciliter certaines classes de XSS |
| `Content-Security-Policy` | Pas de défense en profondeur si un XSS venait à apparaître ailleurs |
| `Referrer-Policy` | Fuite d'URL internes (avec IDs patients) vers des domaines tiers via le referrer |
| `Permissions-Policy` | Pas de restriction sur camera/microphone/géoloc pour les scripts tiers |

**Correctif** : ajouter un bloc `headers()` dans `next.config.mjs` avec ces en-têtes pour toutes les routes.

---

## 🟡 3. `PUT /api/v1/settings/templates` sans contrôle de rôle

Le endpoint exige une session valide (`session.user.tenantId`) mais, contrairement aux autres routes de configuration tenant, n'appelle **aucun `requireTenantAdmin`**. N'importe quel utilisateur connecté du tenant (infirmier, technicien de labo, etc.) peut modifier les réglages de modèles de documents (logo, filigrane, signature numérique) de tout l'établissement.

Impact limité (configuration de branding, pas de donnée patient), mais incohérent avec le reste de l'application où ce type de réglage est réservé aux administrateurs du tenant.

**Correctif** : ajouter `requireTenantAdmin(session)` avant le `PUT`, comme dans `app/api/v1/settings/organization/route.ts`.

---

## 🟡 4. `X-Powered-By: Next.js`

Divulgation de la stack technique, facilitant le ciblage d'exploits connus pour une version de framework donnée.

**Correctif** : `poweredByHeader: false` dans `next.config.mjs`.

---

## ✅ Points vérifiés et sains

- **Enforcement d'authentification** — testé en direct sur le déploiement : tous les endpoints sensibles (`/api/v1/dashboard/audit`, `/api/v1/users`, `/api/v1/settings/database`, `/api/v1/licensing/status`, `/api/v1/onprem-license/status`) renvoient `401` sans session valide.
- **Isolation multi-tenant / anti-IDOR** — les routes à identifiant (ex. `patients/[id]`) scopent systématiquement par `tenantId: session.user.tenantId` dans la clause `where`, empêchant l'accès au dossier d'un patient d'un autre établissement même en devinant/énumérant un ID.
- **Pas d'injection SQL** — Prisma (ORM) est utilisé partout pour l'accès aux données. Le seul usage de `$executeRawUnsafe` du projet est un script de développement local (`prisma/reset-data.ts`) dont les valeurs proviennent de `pg_tables` système, jamais d'une entrée utilisateur, et qui n'est exposé par aucun endpoint.
- **Changement de mot de passe** (`profile/change-password`) — exige l'ancien mot de passe (vérifié par `bcrypt.compare`), ne peut cibler que le compte de l'appelant (aucun paramètre `userId`), et incrémente `sessionVersion` pour invalider toutes les sessions existantes.
- **IDOR sur les notifications** — `notifications/[id]/read` vérifie que `notification.recipientId === session.user.id` avant toute action (403 sinon).
- **Limitation de débit sur le login** — présente par email et par IP (`lib/auth.ts`), avec journalisation des tentatives échouées/limitées.
- **Bootstrap `/setup`** — protégé par un secret partagé (comparaison à temps constant), verrouillé après le premier admin créé, avec re-vérification transactionnelle contre les conditions de course.
- **Sessions** — JWT avec expiration à 12h, et un `sessionVersion` comparé à la base à chaque requête, permettant une révocation immédiate en cas de changement de mot de passe ou de désactivation de compte.

---

## 🚫 Faux positifs écartés

Deux constats initiaux se sont révélés non exploitables après vérification approfondie — documentés ici pour éviter qu'ils ne soient rouverts par erreur :

- **`GET /.env` renvoie `200`** — à première vue alarmant, mais le corps de la réponse est en réalité la coquille HTML de l'application (`Content-Type: text/html`, `X-Matched-Path: /[locale]`, `<html lang=".env">`). Le routing dynamique `[locale]` de Next.js interprète `.env` comme un segment de locale et rend la page normale — **aucun fichier n'est réellement servi**. Confirmé en inspectant le `Content-Type` et le corps de la réponse, pas seulement le code HTTP.
- **XSS réfléchi via `<html lang={locale}>`** — la valeur brute du paramètre de route atterrit dans l'attribut `lang` du layout racine (`app/[locale]/layout.tsx`), mais React échappe automatiquement les valeurs d'attributs en JSX. Une tentative d'injection (`"><script>...`) est neutralisée (`lang="&quot;&gt;&lt;script&gt;..."`), sans exécution possible.

---

## Recommandation de priorité

Le point réellement critique de cet audit est le **#1 (webhooks de paiement)** — il touche à l'intégrité financière et, indirectement, à la sécurité clinique (déblocage de délivrance pharmaceutique). Les points #2 à #4 sont des durcissements de bon sens, à faible effort et sans risque de régression.

# Intégration DHIS2

MedCare transmet le **RMA3 mensuel** à [DHIS2](https://dhis2.org), le système d'information
sanitaire utilisé par le MINSANTE pour le rapportage de routine des formations sanitaires.

- Envoi **unidirectionnel** (MedCare → DHIS2) et **agrégé** : aucune donnée nominative ne quitte
  MedCare.
- Réglage par l'**administrateur** : **Paramètres → Intégrations Externes → DHIS2**.
- **Un seul circuit**, le RMA3, utilisable de deux façons :

| Situation | Ce qu'on fait |
|---|---|
| **Pas d'accès à l'API DHIS2** | Télécharger le fichier **JSON** ou **CSV** du mois et le faire charger dans l'écran d'import de DHIS2 (district, MINSANTE) |
| **Compte API disponible** | **Simuler** l'envoi (DHIS2 valide sans rien enregistrer), **Envoyer**, ou laisser l'**envoi automatique** transmettre chaque mois validé |

Le fichier contient exactement ce que l'API enverrait : le même calcul sert aux deux.

> **Ancien envoi des 18 indicateurs (retiré).** MedCare envoyait auparavant 18 totaux mensuels
> (admissions, CPN1, accouchements…). Dix d'entre eux étaient des doublons non ventilés
> d'indicateurs du RMA3. Envoyés vers les mêmes éléments de données, ils auraient écrasé les
> valeurs ventilées par âge et par sexe. Les sept autres (admissions par type, sorties, examens de
> biologie et de radiologie, délivrances) n'existent pas dans le RMA3 national. Seul le RMA3 est
> donc envoyé. Ces 18 chiffres restent calculés pour le rapport Word, et les anciennes lignes
> d'envoi restent visibles dans l'historique.

---

## 👤 Configurer la connexion

1. **Paramètres → Intégrations Externes → DHIS2**.
2. Renseignez l'**URL de base** DHIS2 (racine, sans chemin supplémentaire), le **nom d'utilisateur**
   et le **mot de passe** d'un compte qui a les droits de saisie sur l'unité d'organisation et le
   jeu de données.
3. **Tester la connexion**, puis **Enregistrer** : la recherche de métadonnées utilise la connexion
   **enregistrée**, pas le formulaire en cours.
4. **Unité d'organisation** et **jeu de données** : recherchez-les par leur nom.
5. Facultatif : cochez **Envoyer automatiquement par l'API chaque RMA3 validé**.

Sans compte API, renseignez au moins l'**unité d'organisation** (identifiant DHIS2 de
l'établissement) : elle figure dans le fichier exporté.

Le mot de passe DHIS2 est **chiffré** en base (clé dérivée de `NEXTAUTH_SECRET`) et n'est jamais
renvoyé au navigateur.

## Correspondances (indispensables)

Chaque cellule du RMA3 (indicateur × ventilation) doit être reliée à un **élément de données**
DHIS2 et, si besoin, à une **combinaison de catégories**. Ce sont les identifiants du jeu de
données national. Sans eux, rien n'est exporté, ni en fichier ni par l'API. Trois façons de les
renseigner :

1. **Modèle CSV** : télécharger le modèle (une ligne par cellule produite ce mois-là), compléter
   `data_element_id` et `category_option_combo_id`, réimporter. Le fichier est **refusé en
   entier** si une ligne est invalide (identifiant mal formé, cellule inconnue, doublon).
2. **Proposer depuis DHIS2** (nécessite l'API) : lit le jeu de données et propose uniquement les
   correspondances **certaines** (code de l'indicateur retrouvé dans un seul élément, combinaison
   identifiée sans ambiguïté). Aperçu d'abord, application explicite ensuite.
3. **Effacer** tout pour recommencer (jeu de données différent, nouvelle version nationale).

Une cellule est identifiée par **(code, table, cellule)** et non par le code seul : 36 codes du
RMA3 reviennent dans plusieurs tableaux (ex. `II.2-001`, tables PCIMA CNA/CNTI). La colonne
`table_key` du modèle doit être conservée telle quelle.

## Envoyer

Dans **Export du RMA3 vers DHIS2**, choisissez le mois :

- **Fichier JSON / CSV** : possible même sur un mois encore ouvert (brouillon).
- **Simuler l'envoi** : DHIS2 contrôle et compte sans rien enregistrer ; possible sur tout mois.
- **Envoyer à DHIS2** : seulement si le **formulaire mensuel est validé** (erreur 409 sinon).
  DHIS2 importe de façon idempotente : renvoyer un mois met ses valeurs à jour.

## Envoi automatique

Si la case est cochée et qu'un compte API est configuré, la tâche planifiée envoie chaque mois
**validé** qui n'a pas été envoyé **depuis sa validation** :

- un mois rouvert puis revalidé est renvoyé ;
- au plus 3 mois par établissement et par passage, du plus ancien au plus récent ;
- les mois validés il y a plus de 62 jours sont laissés à l'envoi manuel ;
- un échec est retenté au passage suivant (le lendemain avec une tâche quotidienne), et chaque
  tentative est inscrite dans l'historique.

## Historique et relance

La section **Historique** liste les 24 derniers envois : mois et date, **mode** (automatique,
manuel, simulation, ancien envoi des 18 indicateurs), statut, nombre de valeurs et erreur.
Une ligne d'envoi réel échouée propose **Réessayer** pour ce mois (après confirmation).

## Tâche planifiée

`GET /api/cron/sync-dhis2` (ou `POST`) déclenche l'envoi automatique pour tous les établissements
qui l'ont activé.
- **Authentification** : en-tête `Authorization: Bearer $CRON_SECRET`. Si `CRON_SECRET` n'est pas
  défini, l'URL est appelable sans authentification : **définissez-le en production**.
- **Fréquence** : **quotidienne** (par exemple `0 3 * * *`). Un mois déjà envoyé n'est pas
  renvoyé : un appel quotidien n'envoie que les mois validés la veille.
- **Vercel** : ajoutez un `vercel.json` (absent du dépôt) :
  ```json
  { "crons": [{ "path": "/api/cron/sync-dhis2", "schedule": "0 3 * * *" }] }
  ```
- **Test manuel** :
  ```bash
  curl https://votre-domaine/api/cron/sync-dhis2 -H "Authorization: Bearer $CRON_SECRET"
  ```

## Tester sans toucher au DHIS2 national

1. Utilisez une instance de démonstration DHIS2 (voir le
   [DHIS2 Instance Manager](https://im.dhis2.org/public/instances) ; identifiants `admin` /
   `district`). Ces instances sont réinitialisées régulièrement.
2. Configurez la connexion, testez, enregistrez, choisissez une unité d'organisation (par exemple
   « Ngelehun ») et un jeu de données mensuel.
3. Téléchargez le modèle de correspondances, renseignez quelques lignes avec des identifiants
   d'éléments de ce jeu de données, réimportez.
4. **Simuler l'envoi**, puis, sur un mois validé, **Envoyer** ; vérifiez l'historique et les
   valeurs dans l'application de saisie DHIS2.

Ne passez sur l'instance nationale du MINSANTE qu'une fois l'établissement officiellement créé
dans DHIS2.

## Règles de sécurité

- Les valeurs sont **recalculées côté serveur** depuis les registres de l'établissement de la
  session ; rien de ce que le navigateur envoie ne fixe les chiffres exportés.
- Réservé à l'**administrateur** de l'établissement, limité en fréquence ; chaque export, envoi
  (manuel ou automatique) et import de correspondances est **tracé** dans l'audit
  (`dhis2.rma3_*`).
- Deux cellules reliées à la même cible DHIS2 ne s'écrasent pas : la seconde n'est pas envoyée
  et la collision est signalée.

## Limites connues

- Seules les sections qui portent un code RMA3 sont exportées (activité, morbidité, causes,
  VIH/PTME/hépatites, formulaire mensuel). Les anciennes sections libellées sans code
  (activité de l'établissement, santé maternelle, vaccination, paludisme, tuberculose, PEV,
  stock) ne le sont pas encore.
- Sur 955 indicateurs du dictionnaire, l'application en produit une partie (affichée à l'écran).
- Non validé contre le vrai jeu de données national : les identifiants restent à obtenir.

## Dépannage

| Symptôme | Solution |
|---|---|
| Le test de connexion échoue | Vérifier l'URL (racine DHIS2) et que le compte n'est pas verrouillé |
| « Enregistrez d'abord la connexion » à la recherche | Cliquer sur **Enregistrer**, même après un test réussi |
| « Aucune cellule n'est associée à DHIS2 » | Importer le modèle de correspondances complété |
| « Le formulaire mensuel doit être validé » | Valider le mois dans **RMA3 → Saisie du mois** (ou utiliser le fichier / la simulation) |
| Rien n'est envoyé automatiquement | Case cochée ? compte API complet ? mois validé depuis moins de 62 jours ? tâche planifiée déclarée ? |
| Conflits DHIS2 | Unité non rattachée au jeu de données, jeu de données non mensuel, ou combinaison de catégories requise manquante |

## 🛠️ Repères techniques

| Fichier | Rôle |
|---|---|
| `lib/dhis2/config.ts` | Lecture / écriture de la connexion, contrôle « accès API complet » |
| `lib/dhis2/client.ts` | Client HTTP DHIS2 (test, envoi, recherche de métadonnées, structure d'un jeu de données) |
| `lib/dhis2/crypto.ts` | Chiffrement AES-256-GCM du mot de passe |
| `lib/dhis2/rma3-values.ts` | Aplatit le rapport RMA3 en valeurs (code, table, cellule, nombre) |
| `lib/dhis2/rma3-export.ts` | Valeurs → `dataValueSets` JSON / CSV DHIS2, modèle et lecture du CSV de correspondances |
| `lib/dhis2/rma3-mapping.ts` | Propositions de correspondances depuis la structure du jeu de données |
| `lib/dhis2/rma3-sync.ts`, `rma3-route.ts` | Accès base, envoi par lots, garde administrateur et limites |
| `lib/dhis2/rma3-schedule.ts` | Choix des mois dus à l'envoi automatique (testé) |
| `lib/dhis2/sync.ts` | Envoi automatique ; audit `dhis2.rma3_push` (trigger `auto`) |
| `lib/dhis2/rma3-dictionary.*` | Dictionnaire des 955 indicateurs (couverture) |
| `lib/dhis2/indicators.ts`, `types.ts` | 18 chiffres mensuels du rapport Word (plus envoyés à DHIS2) |
| `app/api/v1/settings/dhis2/*` | Réglages, test, recherche, historique |
| `app/api/v1/settings/dhis2/rma3/*` | Résumé, export, modèle, import / effacement des correspondances, proposition, envoi |
| `app/api/cron/sync-dhis2/route.ts` | Tâche planifiée |
| `components/settings/dhis2-integration-settings.tsx`, `dhis2-rma3-panel.tsx`, `dhis2-entity-picker.tsx` | Interface |
| `prisma/migrations/20261104090000_dhis2_rma3_mappings` | Table des correspondances (à appliquer) |

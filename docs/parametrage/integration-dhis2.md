# Intégration DHIS2

MedCare peut envoyer chaque mois des **indicateurs d'activité agrégés** vers
[DHIS2](https://dhis2.org), le système d'information sanitaire utilisé par le MINSANTE pour le
rapportage de routine des formations sanitaires.

- Envoi **unidirectionnel** (MedCare → DHIS2) et **agrégé** : aucune donnée nominative ne quitte
  MedCare.
- Réglage par l'**administrateur** : **Paramètres → Intégrations Externes → DHIS2**.

---

## Indicateurs envoyés

Calculés pour un mois calendaire, sur les seules données de l'établissement :

| Indicateur | Source |
|---|---|
| `admissions_total` | Séjours admis dans le mois |
| `admissions_emergency` / `_scheduled` / `_outpatient` | Séjours par type (urgence, programmé, ambulatoire) |
| `discharges_total` | Séjours sortis dans le mois |
| `deaths_total` | Séjours terminés par un décès, plus les patients décédés sans séjour |
| `surgeries_completed` | Interventions terminées |
| `lab_exams_completed` | Résultats de biologie validés |
| `radiology_exams_completed` | Comptes rendus de radiologie validés |
| `drugs_dispensed_count` | Délivrances de médicaments |
| `anc_first_visit` | CPN1 |
| `anc_fourth_visit_plus` | CPN4 et plus |
| `deliveries_total` | Accouchements |
| `deliveries_cesarean` | Césariennes |
| `tetanus_doses_given` | CPN avec dose de Td (VAT) |
| `malaria_prevention_doses_given` | CPN avec TPI |
| `hiv_tests_pregnancy_completed` | Tests VIH validés liés à une grossesse (PTME) |
| `newborns_total` | Nouveau-nés |

Un indicateur sans correspondance DHIS2 configurée n'est **pas envoyé** (jamais envoyé à zéro) ;
il est signalé dans le résultat de la synchronisation.

Les registres des programmes de santé (paludisme, tuberculose, vaccination…) ne font pas encore
partie de ces indicateurs ; ils figurent dans le [RMA3](../modules/rma3/README.md).

## 👤 Configurer la connexion

1. **Paramètres → Intégrations Externes → DHIS2**.
2. Renseignez l'**URL de base** DHIS2 (racine, sans chemin supplémentaire), le **nom d'utilisateur**
   et le **mot de passe** d'un compte DHIS2 qui a les droits de saisie sur l'unité
   d'organisation et le jeu de données.
3. **Tester la connexion**.
4. **Enregistrer** : la recherche de métadonnées utilise la connexion **enregistrée**, pas le
   formulaire en cours.
5. **Unité d'organisation** et **jeu de données** : recherchez-les par leur nom (pas besoin de
   coller un identifiant).
6. **Correspondance des indicateurs** : pour chaque indicateur MedCare à envoyer, choisissez
   l'**élément de données** DHIS2. La liste est limitée au jeu de données choisi. Le *Category
   Option Combo* se saisit à la main si nécessaire.
7. Cochez **Activer la synchronisation mensuelle** et enregistrez.
8. **Synchroniser maintenant** envoie le dernier mois complet sans attendre la tâche planifiée.

Le mot de passe DHIS2 est **chiffré** en base (clé dérivée de `NEXTAUTH_SECRET`) et n'est jamais
renvoyé au navigateur.

## Historique et relance

La section **Historique** liste les 24 dernières synchronisations : période, statut (réussie,
ignorée, échouée), nombre de valeurs envoyées, erreur ou indicateurs non mappés.
- Une ligne échouée ou ignorée propose **Relancer** pour **cette période précise**.
- DHIS2 importe de façon idempotente : renvoyer une même période est sans risque.
- Il n'y a pas de relance automatique.

## Tâche planifiée

`GET /api/cron/sync-dhis2` envoie le mois précédent pour l'établissement si la synchronisation est
activée.
- **Authentification** : en-tête `Authorization: Bearer $CRON_SECRET`. Si `CRON_SECRET` n'est pas
  défini, l'URL est appelable sans authentification : **définissez-le en production**.
- **Fréquence** : une fois par mois (par exemple `0 3 1 * *`, le 1er à 3 h).
- **Vercel** : ajoutez un `vercel.json` (absent du dépôt) :
  ```json
  { "crons": [{ "path": "/api/cron/sync-dhis2", "schedule": "0 3 1 * *" }] }
  ```
- **Test manuel** :
  ```bash
  curl https://votre-domaine/api/cron/sync-dhis2 -H "Authorization: Bearer $CRON_SECRET"
  ```

## Tester sans toucher au DHIS2 national

1. Utilisez une instance de démonstration DHIS2 (voir le
   [DHIS2 Instance Manager](https://im.dhis2.org/public/instances) ; identifiants `admin` /
   `district`). Ces instances sont réinitialisées régulièrement.
2. Configurez la connexion, testez, enregistrez.
3. Recherchez une unité d'organisation (par exemple « Ngelehun ») et un jeu de données ; mappez 2 ou
   3 indicateurs.
4. **Synchroniser maintenant**, puis vérifiez l'historique et les valeurs dans l'application de
   saisie DHIS2.
5. Pour tester la relance : retirez toutes les correspondances, synchronisez (échec « aucun
   indicateur mappé »), remappez, puis **Relancer** la ligne échouée.

Ne passez sur l'instance nationale du MINSANTE qu'une fois l'établissement officiellement créé
dans DHIS2.

## Export du RMA3 complet (fichier ou API)

Au-delà des 18 indicateurs ci-dessus, MedCare sait transformer le **RMA3 du mois** en valeurs
DHIS2 (un indicateur × une cellule de ventilation = une valeur). Le même calcul sert à deux
usages, selon ce que le MINSANTE autorise :

| Situation | Ce qu'on fait |
|---|---|
| **Pas d'accès API** | Télécharger le fichier **JSON** ou **CSV** et le faire charger dans l'écran d'import de DHIS2 (par le district ou le MINSANTE) |
| **Compte API autorisé** | **Simuler** l'envoi (DHIS2 valide sans rien enregistrer), puis **Envoyer** |

Réglage : **Paramètres → Intégrations Externes → DHIS2 → Export du RMA3 vers DHIS2**.

### Correspondances (indispensables)

Chaque cellule du RMA3 doit être reliée à un élément de données DHIS2 (et une combinaison de
catégories). Ces identifiants sont ceux du jeu de données national : **MedCare ne les connaît
pas** tant que le MINSANTE ne les a pas fournis. Trois façons de les renseigner :

1. **Modèle CSV** : télécharger le modèle (une ligne par cellule produite), compléter
   `data_element_id` et `category_option_combo_id`, réimporter. Le fichier est **refusé en
   entier** si une ligne est invalide (identifiant mal formé, cellule inconnue, doublon).
2. **Proposer depuis DHIS2** (nécessite l'API) : lit le jeu de données et propose uniquement les
   correspondances **certaines** (code de l'indicateur retrouvé dans un seul élément, combinaison
   identifiée sans ambiguïté). Aperçu d'abord, application explicite ensuite.
3. Effacer tout pour recommencer (jeu de données différent, nouvelle version nationale).

Une cellule est identifiée par **(code, table, cellule)** et non par le code seul : 36 codes du
RMA3 reviennent dans plusieurs tableaux (ex. `II.2-001`, tables PCIMA CNA/CNTI).

### Règles de sécurité

- Les valeurs sont **recalculées côté serveur** depuis les registres de l'établissement de la
  session ; rien de ce que le navigateur envoie ne fixe les chiffres exportés.
- Réservé à l'**administrateur** de l'établissement, limité en fréquence, chaque export / envoi /
  import est **tracé** dans l'audit.
- Un **envoi réel** exige le **formulaire mensuel validé** (erreur 409 sinon) ; le fichier et la
  simulation restent possibles sur un mois ouvert.
- Deux cellules reliées à la même cible DHIS2 ne s'écrasent pas : la seconde n'est pas envoyée
  et la collision est signalée.

### Limites connues

- Seules les sections qui portent un code RMA3 sont exportées (activité, morbidité, causes,
  VIH/PTME/hépatites, formulaire mensuel). Les anciennes sections libellées sans code
  (activité de l'établissement, santé maternelle, vaccination, paludisme, tuberculose, PEV,
  stock) ne le sont pas encore.
- Sur 955 indicateurs du dictionnaire, l'application en produit une partie (affichée à l'écran).
- Pas d'envoi automatique du RMA3 par tâche planifiée (seule la synchronisation des 18
  indicateurs l'est).
- Non validé contre le vrai jeu de données national : la disponibilité d'un compte API, le jeu
  de données et les identifiants dépendent du MINSANTE.

---

## Dépannage

| Symptôme | Solution |
|---|---|
| Le test de connexion échoue | Vérifier l'URL (racine DHIS2) et que le compte n'est pas verrouillé |
| « Enregistrez d'abord la connexion » à la recherche | Cliquer sur **Enregistrer**, même après un test réussi |
| « Aucun indicateur mappé » | Mapper au moins un indicateur |
| Conflits DHIS2 | Unité non rattachée au jeu de données, jeu de données non mensuel, ou *Category Option Combo* requis manquant |

## 🛠️ Repères techniques

| Fichier | Rôle |
|---|---|
| `lib/dhis2/types.ts` | Catalogue des indicateurs (`DHIS2_METRIC_KEYS`), types |
| `lib/dhis2/indicators.ts` | Calcul mensuel, filtré par établissement |
| `lib/dhis2/client.ts` | Client HTTP DHIS2 (test, envoi, recherche de métadonnées) |
| `lib/dhis2/sync.ts` | Orchestration ; chaque essai écrit une ligne d'audit `dhis2.sync` |
| `lib/dhis2/crypto.ts` | Chiffrement AES-256-GCM du mot de passe |
| `app/api/v1/settings/dhis2/*` | Réglages, test, recherche, synchronisation, historique |
| `lib/dhis2/rma3-values.ts` | Aplatit le rapport RMA3 en valeurs (code, table, cellule, nombre) |
| `lib/dhis2/rma3-export.ts` | Valeurs → `dataValueSets` JSON / CSV DHIS2, modèle et lecture du CSV de correspondances |
| `lib/dhis2/rma3-mapping.ts` | Propositions de correspondances depuis la structure du jeu de données |
| `lib/dhis2/rma3-sync.ts`, `rma3-route.ts` | Accès base, envoi par lots, garde administrateur et limites |
| `lib/dhis2/rma3-dictionary.*` | Dictionnaire des 955 indicateurs (couverture) |
| `app/api/v1/settings/dhis2/rma3/*` | Résumé, export, modèle, import/effacement des correspondances, proposition, envoi |
| `components/settings/dhis2-rma3-panel.tsx` | Panneau d'export du RMA3 |
| `prisma/migrations/20261104090000_dhis2_rma3_mappings` | Table des correspondances (à appliquer) |
| `app/api/cron/sync-dhis2/route.ts` | Tâche planifiée |
| `components/settings/dhis2-integration-settings.tsx`, `dhis2-entity-picker.tsx` | Interface |

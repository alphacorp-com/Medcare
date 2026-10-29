# RMA3 et rapports

Le **RMA3** est le rapport mensuel d'activités des formations sanitaires du MINSANTE. MedCare le
**calcule automatiquement** à partir des données saisies dans les modules, et complète par un
**formulaire mensuel** les indicateurs qu'aucun module n'enregistre. Le rapport s'exporte au format
**Word (.docx)**.

- **Utilisateurs** : gestionnaire des données, responsable de la formation sanitaire, direction.
- **Où** :
  - menu **RMA3** (`/rma3-entry`) : formulaire du mois, identification MINSANTE, déclarations
    d'état civil ;
  - Paramètres → **Rapports** : **Rapport RMA3** (génération), **RMA3 : correspondance CIM-10**,
    **Personnel (RMA3)**.
- **Permissions** :
  - formulaire mensuel : sous-module **`MODULE_RMA3`** (lecture et modification pour saisir,
    **validation** pour verrouiller le mois) ;
  - génération du rapport, correspondance CIM-10, registre du personnel : **administrateur** ;
  - réouverture d'un mois validé : **administrateur**.

---

## D'où viennent les chiffres

| Partie du RMA3 | Source dans MedCare |
|---|---|
| Identification | Paramètres → Organisation + onglet *Identification MINSANTE* |
| Activités (consultations, hospitalisations, examens, interventions…) | Séjours, notes signées, examens validés, chirurgie |
| Morbidité et mortalité (causes) | Diagnostics **CIM-10** des consultations, des sorties et des décès, classés selon la **correspondance CIM-10 → rubriques RMA3** |
| Santé de la mère et de l'enfant | Maternité (CPN, accouchements, nouveau-nés, post-natal, avortements, décès maternels), planification familiale |
| Vaccination, chaîne du froid, MAPI | Programmes de santé |
| Paludisme, tuberculose, VIH / hépatites, nutrition, maladies chroniques, oxygène | Programmes de santé |
| Médicaments, rupture, CMM | Pharmacie (rapport de stock, catégories RMA3 des articles) |
| Banque de sang | Banque de sang |
| Actes (indicateurs d'actes) | Actes médicaux marqués d'un indicateur RMA3 |
| Recettes | Facturation (rubrique de recette RMA3 des catégories d'actes) |
| Personnel | Registre du personnel (Paramètres → Personnel (RMA3)) |
| État civil | Déclarations de naissance et de décès transmises |
| Activités communautaires, supervisions, dépenses… | **Formulaire mensuel** (saisie manuelle) |

**Saisir correctement dans les modules, c'est remplir le RMA3.** En particulier :
- le **diagnostic principal CIM-10** est obligatoire pour signer une consultation et pour la sortie
  d'un patient hospitalisé ;
- la **cause du décès** est obligatoire pour un décès.

---

## 👤 Procédures

### Renseigner l'identification MINSANTE (une fois, puis à mettre à jour)
**RMA3 → Identification MINSANTE** : région, département, arrondissement, district de santé, aire
de santé, responsable de la formation sanitaire, gestionnaire des données et son téléphone,
villages ou quartiers desservis (dont en stratégie avancée à plus de 5 km), statut (public, privé,
confessionnel, communautaire, autre).

### Saisir le formulaire du mois
1. **RMA3 → Saisie du mois** → choisissez le mois.
2. Remplissez les cases. Le compteur « X / Y cases saisies » suit l'avancement. Une case vide
   s'imprime « — », jamais 0.
3. **Enregistrer** : seules les cases modifiées sont envoyées, et chaque modification est tracée.
4. **Valider le mois** (`MODULE_RMA3` validation) : le mois est **verrouillé** et plus aucune case ne
   peut changer.
5. Pour corriger un mois validé, un administrateur le **rouvre** avec un **motif** (5 à 500
   caractères), conservé dans le journal d'audit.

### Déclarer une naissance ou un décès transmis à l'état civil
**RMA3 → Déclarations d'état civil → Nouvelle déclaration** : type (naissance ou décès), nom de la
personne, patient éventuel, date de l'évènement, date de transmission à l'état civil, référence.

### Tenir le registre du personnel (administrateur)
Paramètres → **Personnel (RMA3)** : nom, sexe, cadre, payeur (État ou collectivité), en poste, dates
de naissance, d'embauche, de retraite, de départ, compte utilisateur éventuel. Un départ se note
par sa date : l'historique est conservé, rien n'est supprimé.

### Ajuster la correspondance CIM-10 → RMA3 (administrateur)
Paramètres → **RMA3 : correspondance CIM-10** : pour chaque rubrique (cause de consultation,
d'hospitalisation, de décès…), la liste des codes CIM-10 qui la composent.
- On peut modifier le libellé, les plages CIM-10, l'ordre et l'activation d'une rubrique, ou la
  **restaurer** aux valeurs standard.
- Les codes CIM-10 revendiqués par deux rubriques sont signalés : seule la première les compte.
- Chaque modification est tracée (avant / après), car elle change les chiffres du RMA3.

### Générer le rapport RMA3 (administrateur)
Paramètres → **Rapport RMA3** → choisissez le mois (le mois précédent par défaut) → téléchargez le
document **Word**. Chaque génération est tracée : le rapport contient des données de santé
(VIH, hépatites…).

Les tableaux VIH du document Word sont condensés ; le détail complet par âge et par sexe est dans
Programmes de santé → VIH / Hépatites.

---

## DHIS2

En plus du RMA3, MedCare peut pousser chaque mois des **indicateurs agrégés** vers DHIS2 :
voir [Intégration DHIS2](../../parametrage/integration-dhis2.md).

Le **RMA3 lui-même** peut aussi être exporté vers DHIS2, en fichier JSON/CSV (sans accès API) ou
par l'API, une fois les correspondances renseignées : même page, section « Export du RMA3
complet ». Les sections sans code RMA3 ne sont pas encore exportées.

## 🛠️ Repères techniques

| Besoin | Route / fichier |
|---|---|
| Formulaire du mois | `GET/PUT /api/v1/rma3-entry/[period]`, `POST .../validate`, `POST .../reopen` |
| Identification | `GET/PUT /api/v1/rma3-entry/identification` |
| État civil | `GET/POST /api/v1/rma3-entry/civil-declarations` |
| Génération du rapport (.docx) | `GET /api/v1/settings/reports/rma3?period=AAAAMM` → `lib/reports/rma3.ts`, `lib/reports/rma3-docx.ts` |
| Correspondance CIM-10 | `/api/v1/settings/rma3-rubrics` → `lib/reports/rma3-rubrics*.ts` |
| Registre du personnel | `/api/v1/settings/staff` |
| Catalogue des indicateurs saisis à la main | `lib/rma3-manual/catalog.ts` (ajouter des codes, ne jamais les renommer) |

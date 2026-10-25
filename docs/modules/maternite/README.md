# Maternité et planification familiale

Suivi de la grossesse (CPN), dépistage PTME, accouchement avec **partogramme**, nouveau-nés,
consultations post-natales, issues de grossesse et décès maternels, et **planification
familiale**. Ces données alimentent le RMA3 (santé de la mère et de l'enfant) et DHIS2.

- **Utilisateurs** : sages-femmes, gynécologues-obstétriciens, infirmiers de SMI.
- **Menu** : Maternité → **Grossesses**, **Planification familiale** (`/maternity`).
- **Permission** : `MODULE_MATERNITY` (lecture, création, modification). Le statut PTME détaillé
  relève en plus de `MODULE_HIV`.

---

## Cycle d'une grossesse

```
En cours ──CPN──CPN──…──► Accouchement (partogramme) ──► Accouchée ──► Post-natal
    │
    └──► Fausse couche / Interruption (avec soins après avortement éventuels)
```

Le statut **Accouchée** n'est posé que par l'enregistrement de l'accouchement.

---

## Écrans

### Liste des grossesses (`/maternity`)
Recherche par patiente (nom, IPP), filtre par statut, bouton **Nouvelle grossesse**.

### Dossier de grossesse (`/maternity/<id>`) — onglets

| Onglet | Contenu |
|---|---|
| CPN | Consultations prénatales : âge gestationnel, tension, poids, hauteur utérine, BCF, hémoglobine, fer / acide folique, TPI, MILDA, **dose de Td**, stratégie (fixe ou avancée) |
| Accouchement | Ouverture du travail, **partogramme graphique** (lignes d'alerte et d'action OMS), clôture de l'accouchement |
| Nouveau-nés | Naissances, Apgar, réanimation, suivi néonatal (kangourou, couveuse, décès) |
| Post-natal | Consultations post-natales de la mère et du nouveau-né |

Actions du dossier : **prescrire le dépistage PTME** (VIH, syphilis…), **issue de grossesse /
décès maternel**.

### Planification familiale (`?tab=family-planning`)
Registre mensuel des consultations PF : nouvelles acceptantes, utilisateurs par méthode. Historique
PF par patient(e).

---

## 👤 Procédures

### Ouvrir un dossier de grossesse
**Nouvelle grossesse** → patiente, **date des dernières règles**, gestité, parité, date prévue
d'accouchement (facultative), facteurs de risque, notes.

### Enregistrer une CPN
Dossier → **CPN → Nouvelle visite** :
- âge gestationnel en semaines (obligatoire) ;
- constantes : tension, poids, hauteur utérine, bruits du cœur fœtal, hémoglobine ;
- soins : fer / acide folique, TPI (prévention du paludisme), MILDA ;
- **dose de Td** : le rang suivant est proposé d'après les doses déjà reçues. Si le vaccin Td est
  géré en stock, choisissez le **lot** (une dose sort du stock) ; sinon, saisissez le lot à la
  main. La dose est inscrite dans le **registre de vaccination** ;
- stratégie : fixe (au centre) ou avancée.

Une CPN génère une ligne de facture automatique.

### Prescrire le dépistage PTME
Dossier → **Prescrire PTME** : les tests VIH et syphilis passent par le **laboratoire** (même
circuit que tout examen : paiement, prélèvement, validation). Les résultats validés alimentent le
registre de dépistage.

### Suivre le travail et l'accouchement
1. **Accouchement → Ouvrir** (lié au séjour éventuel).
2. Saisissez régulièrement les **points du partogramme** : dilatation du col, BCF, contractions
   (nombre en 10 min et durée), pouls, tension maternelle, liquide amniotique. Le graphique trace
   les **lignes d'alerte et d'action** de l'OMS.
3. **Clôturer l'accouchement** :
   - **mode** : voie basse, voie basse assistée, césarienne ;
   - complications et leur prise en charge sur place ;
   - GATPA, délivrance du placenta, pertes de sang ;
   - mise au sein ;
   - état de la mère : vivante ou décédée. Un décès maternel est daté sur la grossesse ; la cause
     et la revue s'ajoutent depuis le dossier.

L'accouchement génère une ligne de facture automatique.

### Enregistrer un nouveau-né
**Nouveau-nés → Nouveau** :
- prénom, sexe, poids de naissance, Apgar à 1 et 5 minutes ;
- vitamine K, réanimation, ventilation au masque et ballon ;
- issue : **vivant**, **mort-né** (type frais ou macéré obligatoire) ou **décès néonatal** (date et
  cause obligatoires, dans les 28 jours).

Le nouveau-né reçoit automatiquement **un dossier patient avec son propre IPP**, pour son suivi
pédiatrique.

Suivi ultérieur : méthode kangourou, couveuse, décès, revue du décès.

### Consultation post-natale
**Post-natal → Nouvelle consultation post-natale** : date, vitamine A, fer / acide folique,
counseling allaitement, nouveau-né examiné. Le **contact RMA3** (0-48 h, J6-J10, 6 semaines) est
déduit de la date d'accouchement.

### Grossesse terminée sans accouchement, décès maternel
Dossier → **Issue / décès maternel** :
- statut : fausse couche ou interruption, avec la date de fin ;
- soins après avortement : non compliqué ou compliqué ;
- décès maternel : date, cause (hémorragie, dystocie, pré-éclampsie / éclampsie, rupture utérine,
  infection puerpérale, suites d'avortement, autre) et date de revue.

### Consultation de planification familiale
Maternité → **Planification familiale → Nouvelle consultation PF** :
- patient(e), date ;
- **nouvel ou ancien utilisateur** ;
- conseil PF donné, **méthode**, acte (pose ou retrait d'implant ou de DIU) ;
- post-partum, référé par un agent de santé communautaire ;
- contre-indications, effets indésirables ;
- **prochaine échéance**.

La planification familiale est rattachée au **patient**, pas à une grossesse : les femmes sans
suivi prénatal et les hommes sont suivis aussi.

---

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Grossesses | `GET/POST /api/v1/maternity/pregnancies`, `GET/PATCH /api/v1/maternity/pregnancies/[id]` |
| CPN, Td | `POST /api/v1/maternity/pregnancies/[id]/visits`, `GET .../td` |
| Accouchement | `POST /api/v1/maternity/pregnancies/[id]/delivery`, `GET/POST /api/v1/maternity/deliveries/[id]/partograph`, `PATCH .../complete` |
| Nouveau-nés | `POST /api/v1/maternity/deliveries/[id]/newborns`, `PATCH /api/v1/maternity/newborns/[id]` |
| Post-natal | `POST /api/v1/maternity/pregnancies/[id]/postnatal-visits` |
| Statut PTME | `PUT /api/v1/hiv/pregnancies/[id]` (`MODULE_HIV`) |
| Planification familiale | `GET/POST /api/v1/family-planning/visits` |
| Validation des saisies | `lib/maternity/`, `lib/family-planning/` |

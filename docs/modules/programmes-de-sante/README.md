# Programmes de santé

Registres des programmes nationaux de santé publique : **vaccination (PEV)**, séances de
vaccination, **chaîne du froid**, **MAPI**, **paludisme**, **tuberculose**, **nutrition (PCIMA)**,
**oxygénothérapie**, **maladies chroniques**, et **VIH / PTME / hépatites / IST**. Ces registres
alimentent le RMA3.

- **Utilisateurs** : infirmiers, vaccinateurs, responsables de programmes, médecins.
- **Menu** : Programmes de Santé (`/disease-programs`), un sous-menu par onglet.
- **Permission** : `MODULE_DISEASE_PROGRAMS`. L'onglet VIH demande en plus le sous-module
  `MODULE_HIV` (voir [VIH, PTME et hépatites](vih.md)).

La page affiche en tête trois compteurs (vaccinations, cas de paludisme, cas de tuberculose), puis
un onglet par programme. Certains actes se saisissent depuis la **fiche patient** (onglet
*Programmes*), d'autres directement depuis l'onglet du programme.

---

## Vaccination (PEV)

**Où saisir** : fiche patient → *Programmes* → **Nouvelle vaccination**. L'onglet *Vaccinations*
liste les doses, filtrables par antigène et par période.

👤 **Enregistrer une dose**
1. Antigène, rang de la dose, date d'administration (jamais dans le futur ; aujourd'hui = l'heure
   actuelle).
2. **Lot** :
   - si l'antigène est **géré en stock** (un article de pharmacie lui est relié), choisissez un lot
     non périmé : la dose sort du stock (unité, ou dose d'un flacon multidose ouvert) ;
   - sinon, saisissez le n° de lot et la péremption à la main.
3. Stratégie (fixe ou avancée) et **groupe de population** (général, nomade, pygmée, réfugié).
   Sans groupe saisi, celui de la dose précédente du patient est repris.
4. Séance de vaccination éventuelle : elle impose sa stratégie et passe automatiquement « tenue ».
5. Hors calendrier, notes.

## Séances de vaccination

Onglet **Séances** : planification des séances du mois (date, stratégie fixe ou avancée, site),
avec leur nombre de doses.
- Statuts : planifiée, tenue, annulée.
- Une séance qui a déjà des doses ne peut pas être annulée.

## Chaîne du froid

Onglet **Chaîne du froid** :
- **Équipements** : réfrigérateur, congélateur, glacière, porte-vaccins, avec leur code, leur dépôt
  et leur plage de température (la plage standard du type par défaut), et leur état (fonctionnel, à
  réparer, hors service). Un équipement retiré garde ses relevés pour les rapports passés.
- **Relevés de température** : deux par jour, recommandé. Un relevé hors plage est signalé en
  **alarme**.

## MAPI (manifestations adverses post-immunisation)

Fiche patient → *Programmes* → dose → **Déclarer une MAPI** :
- date de début (le jour de la dose ou après) ;
- gravité (mineure ou grave), hospitalisation, description.

Suivi depuis l'onglet **MAPI** : évolution (inconnue, en cours de guérison, guéri, séquelles,
décès), gravité, hospitalisation. La dose, la date de début et la description restent telles que
déclarées.

## Paludisme

Fiche patient → *Programmes* → **Nouveau cas de paludisme** :
- type de test (TDR, microscopie, clinique seul) et résultat ;
- espèce (si test positif), gravité (simple ou grave), grossesse au diagnostic ;
- traitement choisi dans la liste (ASAQ, AL, DHA-PPQ, artésunate injectable…), date du
  traitement ;
- hospitalisation, gratuité ;
- lien éventuel au résultat de laboratoire qui confirme le cas.

L'onglet **Paludisme** liste les cas, filtrables par résultat, grossesse et période.

## Tuberculose

- **Cas** : fiche patient → *Programmes* → **Nouveau cas de tuberculose** :
  - type de cas (nouveau, rechute, reprise après échec ou perdu de vue, transfert entrant) ;
  - classification (pulmonaire confirmée bactériologiquement, pulmonaire clinique,
    extrapulmonaire) ;
  - statut VIH, poids, examen de confirmation, date de notification ;
  - régime et début du traitement ;
  - compléments RMA3 : TB-RR, seconde ligne, cotrimoxazole, cas chez un agent de santé.
- **Suivis** : contrôle (M2, M3, M5, M6, autre), résultat de crachat, poids. Saisir une **issue**
  (guéri, traitement terminé, échec, décédé, perdu de vue, non évalué, transféré) met à jour le
  cas.
- **Dépistage actif** (onglet *Tuberculose*) : patient dépisté, cas présumé, envoi au laboratoire,
  test et résultat, début du traitement préventif (TPT).

## Nutrition (PCIMA)

Onglet **Nutrition** :
- **Cas de malnutrition aiguë** :
  - programme CNA (ambulatoire) ou CNTI (hospitalier) ;
  - type d'admission ;
  - critère (rapport poids/taille, périmètre brachial, œdèmes) et mesures ;
  - résidence, test VIH, conseil ANJE.

  Un seul cas ouvert par patient et par programme. Sortie : guéri, abandon, décédé, non
  répondant, transfert. Un cas peut être rouvert.
- **Visites de croissance** (enfants de moins de 5 ans) :
  - poids, taille, périmètre brachial ;
  - counseling, allaitement exclusif, alimentation de complément ;
  - supplémentation en multivitamines.

## Oxygénothérapie

Onglet **Oxygène** :
- **Parc d'équipements** : oxymètres, concentrateurs, respirateurs, bouteilles de 7 500 L, avec leur
  état (fonctionnel, en panne, en maintenance, réformé), modifiable directement dans la liste.
- **Épisodes d'hypoxémie / détresse respiratoire** (SpO₂ < 90 % ou détresse) :
  - patient, SpO₂, salle d'accouchement, oxygène administré ;
  - issue : guéri, référé, sorti contre avis, décédé.

## Maladies chroniques

Onglet **Maladies chroniques** : suivi du **diabète** et de l'**hypertension**.
- Inscription : une inscription ouverte par patient et par pathologie.
- Visites de suivi : sous traitement, tension, HbA1c, éducation individuelle ou de groupe.
- Sortie du programme : perdu de vue, transféré, décédé, autre. Elle peut être annulée.

## VIH, PTME, hépatites, IST

Voir le guide dédié : [VIH, PTME et hépatites](vih.md).

---

## Limites connues

- Les registres de programmes **ne génèrent pas de facture** : une vaccination ou un cas de
  paludisme est gratuit dans MedCare. La gratuité de soins *facturés* se gère par les
  [programmes de gratuité](../tiers-payant/README.md#gratuités).
- Les indicateurs **DHIS2** ne couvrent pas encore ces registres. En revanche, le **RMA3** les
  exploite.

## 🛠️ Repères techniques

| Programme | Routes |
|---|---|
| Vaccination | `/api/v1/patients/[id]/immunizations`, `/api/v1/immunizations`, `/api/v1/stock/vaccine-lots` |
| Séances | `/api/v1/vaccination-sessions` |
| Chaîne du froid | `/api/v1/cold-chain/equipment`, `/api/v1/cold-chain/readings` |
| MAPI | `/api/v1/aefi` |
| Paludisme | `/api/v1/patients/[id]/malaria-cases`, `/api/v1/malaria-cases` |
| Tuberculose | `/api/v1/patients/[id]/tb-cases`, `/api/v1/tb-cases`, `/api/v1/tb-screenings` |
| Nutrition | `/api/v1/nutrition/cases`, `/api/v1/nutrition/growth-visits` |
| Oxygène | `/api/v1/oxygen/equipment`, `/api/v1/oxygen/episodes` |
| Maladies chroniques | `/api/v1/chronic-care/enrolments` |
| Logique métier | `lib/epi/`, `lib/programs/`, `lib/stock/vaccines.ts` |

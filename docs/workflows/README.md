# Workflows inter-modules

Les parcours qui traversent plusieurs modules : qui fait quoi, dans quel ordre, et ce que MedCare
déclenche automatiquement. Le détail de chaque écran est dans les
[guides des modules](../modules/README.md).

1. [Payer d'abord, soigner ensuite](#1-payer-dabord-soigner-ensuite)
2. [Du triage aux urgences à la sortie](#2-du-triage-aux-urgences-à-la-sortie)
3. [Hospitalisation : caution, lit et régularisation](#3-hospitalisation--caution-lit-et-régularisation)
4. [De la prescription d'examen au résultat validé](#4-de-la-prescription-dexamen-au-résultat-validé)
5. [De l'ordonnance à la délivrance](#5-de-lordonnance-à-la-délivrance)
6. [Tiers payant : de la facture au règlement de l'organisme](#6-tiers-payant--de-la-facture-au-règlement-de-lorganisme)
7. [Vaccination et stock de vaccins](#7-vaccination-et-stock-de-vaccins)
8. [De la grossesse au nouveau-né](#8-de-la-grossesse-au-nouveau-né)
9. [Clôture du mois : RMA3 et DHIS2](#9-clôture-du-mois--rma3-et-dhis2)

---

## 1. Payer d'abord, soigner ensuite

Quand le module Facturation est actif, les soins **attendent le paiement de la part patient**.
Trois points d'arrêt :

| Ce qui attend | Facturé à | Débloqué par |
|---|---|---|
| L'entrée dans la file de consultation | l'admission (acte d'admission) | le paiement de l'acte |
| Le prélèvement (labo) ou la planification (radio) | la prescription | le paiement de l'examen |
| L'attribution du lit | la demande d'hospitalisation (caution) | le paiement de la caution |
| La délivrance des médicaments | la validation de l'ordonnance | le paiement de la facture |

```
Acte / examen / caution facturé ──► Caisse : la part patient est réglée ──► MedCare libère automatiquement
                     │                                                     (file, labo, radio, lit)
                     └──► Dérogation « Autoriser sans paiement » (motif, audit) ──► libéré, facture toujours due
```

**Exceptions :**
- **Urgence vitale** (triage *Réanimation* ou *Urgence vitale*) : la consultation, les examens
  **STAT** et l'hospitalisation ne sont jamais bloqués. Ils sont facturés et réglés ensuite. Un
  patient re-trié en urgence vitale pendant son attente à la caisse est libéré tout de suite.
- **Acte à 0 FCFA** ou **part patient nulle** (gratuité, prise en charge totale) : libéré
  immédiatement.
- **Facturation désactivée** : rien n'est bloqué.

Seule la **part patient** compte : la part de l'organisme payeur ne bloque jamais les soins.

🛠️ `lib/billing/paymentGate.ts`, `lib/billing/release.ts`, `lib/billing/applyPayment.ts`.

---

## 2. Du triage aux urgences à la sortie

| Étape | Qui | Où | Ce qui se passe |
|---|---|---|---|
| 1. Accueil | Accueil | Patients | Recherche, sinon création du patient (contrôle des doublons) → IPP |
| 2. Admission | Accueil / infirmier | Admissions → Nouvelle admission | Séjour *Urgence*, **priorité de triage**, acte d'admission, constantes |
| 3. Caisse | Caissier | Facturation | Paiement de l'acte (sauf urgence vitale) → le patient entre dans la file |
| 4. Prise en charge | Médecin | Consultations | **Prendre en charge** (un seul médecin à la fois) |
| 5. Consultation | Médecin | Écran de consultation | Constantes, examens, ordonnance, note, **diagnostic CIM-10** |
| 6. Examens | Labo / radio | Laboratoire, Radiologie | Voir [§4](#4-de-la-prescription-dexamen-au-résultat-validé) |
| 7. Signature | Médecin | Écran de consultation | **Signer et terminer** → le patient sort de la file |
| 8a. Retour à domicile | Médecin / infirmier | Fiche de séjour → Sortie | Issue, résumé, diagnostics de sortie → séjour *Sorti* |
| 8b. Hospitalisation | Médecin | Fiche de séjour → Hospitaliser | Voir [§3](#3-hospitalisation--caution-lit-et-régularisation) |
| 9. Ordonnance | Pharmacie | Pharmacie | Voir [§5](#5-de-lordonnance-à-la-délivrance) |

Un patient sur **rendez-vous** entre au point 4 : l'arrivée crée un séjour *Programmé* déjà dans la
file. L'écran d'arrivée ne propose pas encore l'acte d'admission, donc pas de paiement préalable.

---

## 3. Hospitalisation : caution, lit et régularisation

```
Consultation signée (ou urgence vitale)
   │ Hospitaliser : service → salle → lit, jours prévus   (seul moyen d'attribuer un lit)
   ▼
Lit RÉSERVÉ + caution facturée (prix journalier de la salle × jours prévus)
   │ caution réglée / dérogée            │ Annuler (avant paiement)
   ▼                                     ▼
Lit OCCUPÉ, patient « Hospitalisé »      Lit libéré, caution retirée
   │ (visible dans Sorties → Hospitalisés)
   │ Faire sortir : issue, diagnostics (principal obligatoire), cause du décès si décès
   ▼
Lit libéré · caution RÉGULARISÉE sur la durée réelle · fiche de sortie générée
```

- **Durée facturée** : nombre de périodes de 24 h commencées depuis l'hospitalisation, au minimum
  une.
- Séjour **plus long** que prévu : un reste à payer apparaît sur la facture. Séjour **plus court** :
  un trop-perçu à rembourser (voir [Facturation](../modules/facturation/README.md#rembourser-ou-transférer-un-trop-perçu)).
- L'onglet **Sorties → Hospitalisés** affiche l'état de la facture de chaque patient avant la
  sortie.
- Prérequis : la salle doit avoir un **prix journalier** (Paramètres → Types de Salles).
- Un patient hospitalisé peut changer de lit (**Transfert**) : le lit d'hospitalisation suit, mais
  la caution garde le prix journalier de la salle de départ.

---

## 4. De la prescription d'examen au résultat validé

```
Médecin : Prescrire (consultation)  ──►  Ligne « Examen » sur la facture
                                                │ paiement (sauf STAT en urgence vitale)
             ┌──────────────────────────────────┴───────────────────────────┐
        LABORATOIRE                                                   RADIOLOGIE
   Prélever → Saisir les résultats                          Planifier → Démarrer → Compte rendu
   (indicateurs automatiques)                               (technique, constatations, conclusion, lien images)
             │                                                                │
   Biologiste : Valider / Rejeter                              Radiologue : Valider / Rejeter
             └──────────────────────────────────┬───────────────────────────┘
                                                ▼
          Résultat visible : consultation, fiche de séjour, dossier patient, impression du dossier
          Résultat critique → Notifier (qui, comment, quand)
          Dépistage VIH / syphilis / AgHBs, charge virale → registres du programme VIH
```

- Rejet au laboratoire : nouveau prélèvement. Rejet en radiologie : seul le compte rendu est à
  refaire.
- Un examen non payé qu'on annule disparaît de la facture.
- Les actes médicaux hors labo et radio (cardiologie…) passent directement de *demandé* à
  *terminé* et sont facturés à ce moment-là.

---

## 5. De l'ordonnance à la délivrance

| Étape | Qui | Ce qui se passe |
|---|---|---|
| 1. Prescription | Médecin | Lignes tirées du **stock** (article + quantité, stock délivrable affiché) ou **hors stock** (texte libre) |
| 2. Validation | Pharmacien | Les lignes du stock sont **facturées** au prix de l'article |
| 3. Paiement | Caissier | Part patient réglée |
| 4. Délivrance | Pharmacien | Refusée si la facture n'est pas payée ou si le stock délivrable manque. Sortie **FEFO** lot par lot, dans le journal de stock |
| 5. Suivi | Pharmacien | Rapport mensuel (consommation, CMM, ruptures) ; pharmacovigilance si effet indésirable |

Les lignes hors stock ne sont ni facturées ni délivrées par la pharmacie.

---

## 6. Tiers payant : de la facture au règlement de l'organisme

```
Paramétrage : organisme → convention (taux, plafonds, bon requis, limite d'âge) ; gratuités
       │
Fiche patient → Tiers payant : adhésion (titulaire ou ayant droit), bon de prise en charge
       │
Facture : gratuité → part organisme → part patient (plafonds, bon) — recalcul automatique
       │ le patient paie sa part à la caisse
       ▼
Créances et bordereaux : bordereau (brouillon → transmis, PDF) ──► Règlement de l'organisme
       │                                                             (affecté aux factures les plus anciennes)
       ├── Rejet partiel : passé en perte OU refacturé au patient (réversible)
       ├── Reliquat : affecté plus tard, ou remboursé à l'organisme
       └── Bordereau soldé → Clôturer
```

- Toute modification des conditions (convention, gratuité, adhésion, bon) **recalcule les factures
  encore ouvertes**. Les factures soldées ou déjà réclamées ne bougent pas.
- Un trop-perçu du patient (couverture appliquée après paiement, rejet annulé…) se **rembourse**
  ou se **transfère** sur une autre facture.

Détail : [Tiers payant](../modules/tiers-payant/README.md).

---

## 7. Vaccination et stock de vaccins

1. **Paramétrage** : antigène (Paramètres → Antigènes Vaccinaux), article de pharmacie relié à
   l'antigène (doses par flacon, durée d'utilisation après ouverture).
2. **Réception** des lots de vaccin en pharmacie.
3. **Séance** planifiée (Programmes → Séances), fixe ou avancée.
4. **Vaccination** depuis la fiche patient : choix du lot. Un flacon unidose sort une unité ; un
   flacon multidose est ouvert à la première dose, puis ses doses sont consommées jusqu'à
   épuisement ou péremption du flacon ouvert. La séance passe *tenue*.
5. **Fin de séance** : jeter les flacons ouverts restants. Les doses perdues alimentent le taux de
   perte du rapport mensuel.
6. **Chaîne du froid** : deux relevés de température par jour, alarmes hors plage.
7. **MAPI** : déclaration rattachée à la dose, puis suivi de l'évolution.

La **dose de Td** des CPN suit le même circuit depuis la maternité.

---

## 8. De la grossesse au nouveau-né

1. **Dossier de grossesse** (DDR, gestité, parité, risques).
2. **CPN** successives : constantes, fer / acide folique, TPI, MILDA, dose de Td (registre de
   vaccination), dépistage **PTME** prescrit au laboratoire. Chaque CPN est facturée.
3. **Accouchement** : ouverture, **partogramme**, clôture (mode, complications, GATPA, état de la
   mère). Facturé.
4. **Nouveau-né** : dossier patient créé automatiquement avec son IPP ; suivi néonatal.
5. **Post-natal** : contacts 0-48 h, J6-J10, 6 semaines.
6. **Planification familiale** ensuite, rattachée à la patiente.
7. Le tout alimente le RMA3 (santé de la mère et de l'enfant), transmis ensuite à DHIS2.

---

## 9. Clôture du mois : RMA3 et DHIS2

Check-list du gestionnaire des données, en début de mois, pour le mois écoulé :

1. **Vérifier la complétude** dans les modules :
   - consultations signées avec leur diagnostic ;
   - séjours terminés avec leurs diagnostics de sortie ;
   - examens validés ;
   - registres des programmes à jour ;
   - pharmacie : réceptions, pertes et inventaires saisis.
2. **RMA3 → Saisie du mois** : compléter les indicateurs non couverts par les modules, puis
   **Valider le mois**.
3. **Déclarations d'état civil** transmises dans le mois.
4. **Paramètres → Rapport RMA3** : générer le document Word et le transmettre au district.
5. **DHIS2** (Paramètres → Intégrations Externes → DHIS2) :
   - sans accès API : télécharger le **fichier** du mois et le remettre au district ;
   - avec l'API : l'**envoi automatique** part après la validation du mois, ou **Envoyer à DHIS2** ;
     vérifier l'**historique** et réessayer en cas d'échec.
6. En cas d'erreur sur un mois validé : un administrateur le **rouvre** avec un motif, puis on
   corrige et on revalide.

Détail : [RMA3 et rapports](../modules/rma3/README.md), [DHIS2](../parametrage/integration-dhis2.md).

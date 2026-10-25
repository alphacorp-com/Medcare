# Admissions, consultations et sorties

Ce module suit le patient depuis son arrivée jusqu'à sa sortie : **séjour**, triage des urgences,
**file de consultation**, prescriptions pendant le séjour, **hospitalisation** dans un lit,
transferts et **sortie**.

- **Utilisateurs** : accueil, infirmiers, médecins.
- **Menu** : Admissions → **Séjours** (`/stays`), **Consultations** (`/consultations`),
  **Sorties** (`/discharges`).
- **Permission** : `MODULE_ADMISSION`. Créer un séjour depuis la fiche patient demande aussi
  `MODULE_CORE_PATIENT` (création).

> Ce module applique la règle **« payer d'abord, soigner ensuite »** lorsque la facturation est
> active. Voir le [workflow détaillé](../../workflows/README.md#1-payer-dabord-soigner-ensuite).

---

## Notions

| Notion | Valeurs |
|---|---|
| **Type de séjour** | Urgence, Programmé, Hôpital de jour, Ambulatoire |
| **Statut du séjour** | Pré-admission, En cours, Sorti, Transféré, Décédé |
| **Priorité de triage** (urgences) | Réanimation, Urgence vitale, Urgent, Moins urgent, Non urgent |
| **Statut de consultation** | En attente de paiement → En attente → Pris en charge → Terminée |
| **Statut d'hospitalisation** | En attente de paiement (lit réservé) → Admis (lit occupé) |

**Urgence vitale** = triage *Réanimation* ou *Urgence vitale*. Ces patients ne sont jamais
bloqués par un paiement : les soins passent d'abord, la facture est réglée ensuite.

---

## Écrans

### Séjours (`/stays`)
- Liste paginée des séjours, avec recherche (nom, IPP, n° de séjour) et filtres par statut et par
  type.
- Tri « acuité » pour la vue triage : le plus grave en tête, puis le plus ancien.
- Bouton **Nouvelle Admission**.

### Fiche de séjour (`/stays/<id>`)
- **En-tête** : patient, n° de séjour, type, triage, date d'admission, hospitalisation en cours.
  Les boutons dépendent de l'état du séjour :

| Bouton | Visible quand |
|---|---|
| Imprimer le dossier | Toujours |
| Note complémentaire | Séjour en cours |
| Hospitaliser | Séjour en cours, sans hospitalisation, **consultation signée** (ou urgence vitale) |
| Constantes | Séjour non sorti |
| Re-trier | Urgence en cours |
| Transfert / Affectation de Lit | Toujours |
| Sortie du Patient | Séjour non sorti |

- **Onglets** :
  - *Chronologie* : notes, constantes, événements ;
  - *Examens et actes* : demandes de laboratoire, de radiologie et actes médicaux, avec accès au
    résultat validé ;
  - *Médicaments* : ordonnances.

### File de consultation (`/consultations`)
- Tous les séjours en cours dont la consultation n'est pas terminée, **du plus urgent au moins
  urgent** (priorité de triage, puis temps d'attente).
- Les patients **en attente de paiement** apparaissent en fin de liste. Le médecin les voit
  arriver, mais ne peut pas les prendre en charge.
- Boutons **Prendre en charge**, ou **Continuer** pour un patient déjà pris en charge par soi.

### Écran de consultation (`/consultations/<stayId>`)
- Motif saisi à l'admission, acte facturé à l'admission.
- Constantes.
- Examens (bouton **Prescrire**) et médicaments (bouton **Prescrire**).
- Note de consultation avec diagnostics CIM-10. Le brouillon est conservé sur le poste jusqu'à la
  signature.
- Notes signées précédentes, note complémentaire.
- Boutons **Signer et terminer la consultation** et **Libérer le patient**.

### Sorties (`/discharges`)
- Onglet **Hospitalisés** : patients hospitalisés (caution réglée ou dérogée), encore dans leur
  lit. Pour chacun : service, salle et lit, date d'hospitalisation, durée, et état de la facture
  (réglée, reste à payer, à rembourser).
- Onglet **Sortis** : historique des hospitalisations terminées, avec la **Fiche de sortie**.
- Recherche par nom, IPP ou n° de séjour.

> La page Sorties liste les patients passés par le **circuit d'hospitalisation** (bouton
> *Hospitaliser*). C'est le seul moyen d'obtenir un lit : une consultation terminée sans
> hospitalisation n'y figure donc pas.

---

## 👤 Procédures

### Admettre un patient
1. Admissions → Séjours → **Nouvelle Admission**, ou fiche patient → **Nouvelle admission**.
2. Choisissez le patient et le **type de séjour**.
3. Pour une **urgence**, la **priorité de triage** est obligatoire.
4. Choisissez l'**acte médical** facturé à l'admission (consultation, par exemple). Il est
   obligatoire quand la facturation est active, sauf urgence vitale.
5. Facultatif :
   - motif d'admission ;
   - service et médecin responsable ;
   - constantes d'accueil (tension, pouls, température, poids, taille, SpO₂).

   **Pas de lit à l'admission** : un lit s'attribue en hospitalisant le patient (voir plus bas),
   ce qui facture la caution et fait apparaître le patient dans **Sorties**. L'API refuse un lit
   envoyé à l'admission (`bed_requires_hospitalization`).
6. Validez. Le séjour reçoit un numéro `STAYnnnnnn`.
   - **Facturation active, cas normal** : le séjour attend le paiement. Le patient passe à la
     caisse, puis entre dans la file de consultation.
   - **Urgence vitale ou acte gratuit** : le patient entre directement dans la file.

### Prendre en charge un patient (médecin)
1. Admissions → **Consultations**.
2. **Prendre en charge** sur le patient. Si un collègue l'a pris au même instant, MedCare refuse
   le second : « Ce patient a déjà été pris en charge par un autre médecin ».
3. Pour le remettre dans la file commune : **Libérer le patient**. Seul le médecin qui le détient
   ou un administrateur peut le faire.

### Mener la consultation
1. Vérifiez le motif et les constantes ; ajoutez des constantes si besoin.
2. **Examens → Prescrire** : choisissez dans le catalogue des examens de laboratoire, de
   radiologie ou des actes médicaux, avec une urgence (Routine, Urgent, STAT).
   - Les examens de laboratoire et de radiologie sont **facturés tout de suite** et restent
     « en attente de paiement » jusqu'au règlement. Le laboratoire ne peut pas prélever avant.
   - Exception : un examen **STAT** prescrit pour une urgence vitale n'attend pas le paiement.
   - Un acte médical (cardiologie, anatomopathologie…) est facturé quand il est réalisé.
3. **Médicaments → Prescrire** : choisissez l'article dans le stock de la pharmacie (avec la
   quantité délivrable affichée) ou saisissez un médicament hors stock en texte libre. Chaque
   ligne porte posologie, fréquence, durée et instructions.
4. Rédigez la **note de consultation** et codez le **diagnostic principal CIM-10** (obligatoire
   pour signer), plus d'éventuels diagnostics secondaires. Indiquez si la prise en charge suit le
   protocole national.
5. **Signer et terminer la consultation**. Le patient sort de la file. Si le séjour n'avait pas
   d'acte d'admission, la consultation est facturée à ce moment-là.

### Hospitaliser un patient
1. Après la consultation signée (ou immédiatement pour une urgence vitale), fiche de séjour →
   **Hospitaliser**.
2. Choisissez le **service**, puis la **salle** (seules les salles qui ont un lit libre sont
   proposées), puis le **lit**.
3. Indiquez la **durée prévue** en jours. Le montant de la caution affiché est indicatif : le
   serveur le recalcule (prix journalier de la salle × jours prévus).
4. Validez : le lit passe **réservé** et la caution part à la caisse.
5. Dès que la caution est réglée (ou dérogée), le lit passe **occupé** et devient le lit du séjour.
   Pour une urgence vitale, ou si la facturation est désactivée, le patient prend le lit aussitôt.
6. Tant que la caution n'est pas payée, le bandeau d'hospitalisation propose **Annuler** : le lit
   est libéré et la caution retirée de la facture.

⚠️ Une salle sans **prix journalier** configuré ne peut pas recevoir d'hospitalisation quand la
facturation est active (voir [Paramétrage → Lits et salles](../../parametrage/README.md#lits-salles-et-services)).

### Re-trier un patient des urgences
Fiche de séjour → **Re-trier** → nouvelle priorité. Un patient re-trié en **urgence vitale**
pendant qu'il attend à la caisse est libéré tout de suite vers le médecin.

### Transférer un patient de service ou de lit
Fiche de séjour → **Transfert / Affectation de Lit** :
- pour **tout séjour** : nouveau service et médecin responsable ;
- pour un patient **hospitalisé** uniquement : nouveau **lit**. L'ancien lit est libéré, et le lit
  d'hospitalisation suit (la page Sorties affiche le nouvel emplacement). Le changement est refusé
  si le nouveau lit a été pris entre-temps.

Un séjour non hospitalisé ne peut pas recevoir de lit par ce formulaire : utilisez
**Hospitaliser**. La caution garde le prix journalier de la salle de départ, même après un
changement de salle.

### Faire sortir un patient
Depuis **Sorties → Hospitalisés → Faire sortir**, ou depuis la fiche de séjour → **Sortie du
Patient** :
1. Choisissez l'issue : **sorti**, **transféré** (vers un autre établissement) ou **décédé**.
2. Renseignez la date et l'heure de sortie, et le **résumé de sortie**.
3. Codez les **diagnostics de sortie** CIM-10. Le diagnostic principal est **obligatoire pour un
   patient hospitalisé**. En cas de décès, la **cause du décès** est obligatoire.
4. Validez. MedCare :
   - libère le lit ;
   - **régularise la caution** selon la durée réelle (chaque période de 24 h commencée compte, au
     minimum un jour) : un séjour plus long ajoute un reste à payer, un séjour plus court ouvre un
     remboursement ;
   - enregistre le décès sur la fiche du patient le cas échéant ;
   - génère la **fiche de sortie**, imprimable.
5. Si la sortie intervient avant le paiement de la caution, l'hospitalisation en attente est
   simplement annulée.

### Imprimer le dossier du séjour
Fiche de séjour → **Imprimer le dossier** : identification, admission, notes, médicaments et
examens avec leurs **résultats validés** (les résultats validés depuis l'ouverture de la page sont
inclus).

---

## Règles

- Le numéro de séjour est unique dans l'établissement, même si deux admissions sont enregistrées
  au même instant.
- Un lit ne peut être attribué qu'à un seul séjour : deux admissions simultanées sur le même lit,
  la seconde est refusée (« Bed was just taken by another admission »).
- Un lit ne s'attribue que par l'**hospitalisation** ; il ne change ensuite que par un transfert
  (patient hospitalisé) ou la sortie. Les paramètres ne peuvent que mettre un lit en maintenance
  ou en réserve.
- Service, lit et médecin envoyés par le navigateur sont vérifiés comme appartenant à
  l'établissement.
- Une sortie déjà enregistrée ne régularise pas une seconde fois la facture si on la ré-enregistre.

## Limites connues

- L'écran d'arrivée d'un **rendez-vous** ne propose pas encore le choix de l'acte d'admission : un
  patient sur rendez-vous entre directement dans la file, sans paiement préalable.
- Un changement de salle en cours d'hospitalisation ne change pas le prix journalier de la caution.
- Des séjours créés avant le 2026-10-25 ont pu recevoir un lit directement à l'admission : ils
  n'apparaissent pas dans Sorties. Pour les données de démonstration, voir
  `npm run db:backfill-demo-hospitalizations` ([SEEDING](../../installation/SEEDING.md)).

## 🛠️ Repères techniques

| Besoin | Route / fichier |
|---|---|
| Liste des séjours | `GET /api/v1/stays` |
| Créer un séjour | `POST /api/v1/patients/[id]/stays` |
| Fiche, transfert, sortie, re-triage | `GET/PATCH /api/v1/stays/[id]` |
| File de consultation | `GET /api/v1/consultations/queue` |
| Prendre en charge / libérer | `POST /api/v1/stays/[id]/claim`, `/release` |
| Examens et actes, ordonnances | `POST /api/v1/stays/[id]/orders`, `/prescriptions` |
| Hospitaliser / annuler | `POST/DELETE /api/v1/stays/[id]/hospitalization` |
| Sorties | `GET /api/v1/discharges` |
| Règle « payer d'abord » | `lib/billing/paymentGate.ts`, `lib/billing/release.ts` |
| Jours facturés | `lib/billing/hospitalizedDays.ts` |
| Numérotation | `lib/stays/numbering.ts` |

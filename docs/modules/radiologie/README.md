# Radiologie

Suivi des examens d'imagerie : demande, planification, réalisation, compte rendu structuré,
validation par le radiologue et communication des résultats critiques (recommandations ACR).

- **Utilisateurs** : manipulateurs radio, radiologues, prescripteurs.
- **Menu** : Radiologie (`/radiology`).
- **Permission** : `MODULE_RADIOLOGY`.
  - lecture : consulter la liste de travail ;
  - création : prescrire un examen ;
  - modification : planifier, démarrer, saisir le compte rendu, notifier un résultat critique,
    annuler ;
  - **validation** : valider ou rejeter le compte rendu (radiologue).

---

## Cycle d'un examen

```
En attente de paiement ─(paiement)─► En attente de planification ─Planifier─► Planifié
                                                                                 │ Démarrer
                                                                                 ▼
                                Rejet du compte rendu (radiologue) ──────►  En cours
                                                                                 │ Saisir le compte rendu
                                                                                 ▼
                                                              En attente de validation
                                                                                 │ Valider et publier
                                                                                 ▼
                                                                              Terminé
```

- L'examen est **facturé à la prescription**. La planification est refusée tant que la facture
  n'est pas réglée, sauf examen STAT d'une urgence vitale.
- Un **rejet** supprime le compte rendu non validé, mais l'examen reste *En cours* : les images
  existent déjà, seule l'interprétation est à refaire (contrairement au laboratoire).

---

## Écran (`/radiology`)

- Onglets d'état avec compteurs : en attente de paiement, à planifier, planifiés, en cours, en
  attente de validation, terminés, **résultats critiques**.
- Recherche par patient ou par examen ; pagination.
- **Nouvelle Demande** : prescription directe.
- Fiche de l'examen : prescripteur, examens antérieurs, compte rendu, actions.

---

## 👤 Procédures

### Prescrire un examen
**Nouvelle Demande** → patient → séjour actif éventuel → examen du catalogue (ou « Personnalisé /
Autre » avec un libellé) → priorité (Routine, Urgent, STAT) → notes cliniques → **Soumettre la
Demande**. En consultation, le médecin prescrit depuis l'écran de consultation.

### Planifier
Examen *En attente de planification* → **Planifier l'Examen** → date et heure, **appareil / salle**
(Paramètres → Appareils d'imagerie) et **durée prévue** (20 minutes par défaut). MedCare signale un
**conflit** quand le patient est déjà programmé à cette heure, ou quand l'appareil est déjà réservé
pendant la durée prévue ; **Planifier quand même** force le créneau.

À la planification, l'examen reçoit son **n° d'accession** (ex. `A2610291234567`), l'identifiant
qui le relie à ses images dans un PACS.

### Réaliser l'examen : contrôle avant examen
À l'arrivée du patient → **Démarrer l'Examen** ouvre le **contrôle avant examen**. MedCare décide
des questions à poser selon le patient et l'examen ; le serveur les vérifie de nouveau :

| Contrôle | Quand | Réponse attendue |
|---|---|---|
| **Grossesse** | Femme de 10 à 55 ans et examen irradiant (tout sauf échographie, IRM, ECG ; un examen personnalisé compte comme irradiant) | Pas enceinte, enceinte ou inconnu ; si enceinte ou inconnu, **justification** obligatoire |
| **Fonction rénale** | Examen avec produit de contraste | Vérification confirmée ; créatinine et DFG facultatifs. La dernière créatinine validée au laboratoire est affichée, signalée si elle a plus de 90 jours |
| **Allergie au contraste** | Examen avec contraste et allergie évocatrice | Prise en compte confirmée |

Les réponses sont enregistrées avec le nom et l'heure, et rappelées dans la fiche de l'examen.

### Saisir le compte rendu
**Saisir le Compte-rendu** :
- **Technique** (obligatoire, contrôlé par le serveur) ;
- **Constatations** : texte libre, ou résultats par paramètre (organe par organe) proposés par la
  fiche de l'examen ;
- **Conclusion** (obligatoire) ;
- examens antérieurs comparés ;
- **URL du compte rendu / des images** : lien vers un PACS ou un serveur d'images, facultatif ;
  seules les adresses `http://` ou `https://` sont acceptées ;
- **Dose reçue** (facultative, telle qu'affichée par l'appareil) : PDS, IDSV / CTDIvol, PDL, temps
  de scopie ;
- **Marquer comme résultat critique** si besoin.

→ **Enregistrer le Compte-rendu**. L'examen attend la validation.

### Valider ou rejeter (radiologue)
- **Valider et Publier** : le compte rendu devient officiel, visible dans le dossier patient
  (onglet *Imagerie* → **Ouvrir Visionneuse**) et dans la consultation. Le **prescripteur** reçoit
  une notification.
- **Rejeter le Compte-rendu** : motif obligatoire. Le brouillon rejeté (contenu, auteur, date) est
  conservé dans le journal d'audit.
- **Double lecture** (si activée dans Paramètres → Appareils d'imagerie) : l'auteur d'un compte
  rendu ne peut pas le valider lui-même.

### Ajouter un addendum (radiologue)
Sur un examen **terminé** → **Ajouter un addendum** : une correction ou un complément est ajouté
**à la suite** du compte rendu validé, qui n'est jamais modifié. L'addendum (texte, auteur, date)
apparaît partout où le compte rendu est lu (fiche de l'examen, dossier patient, séjour) ; le
prescripteur est notifié.

### Voir les images
Si l'établissement a un **PACS**, renseignez l'adresse de sa visionneuse dans Paramètres →
Appareils d'imagerie, avec `{accession}` à la place du n° d'accession (par exemple
`https://pacs.local/ohif/viewer?AccessionNumber={accession}`). La fiche de l'examen affiche alors
**Ouvrir dans le PACS**. Le n° d'accession doit être celui transmis à l'appareil (saisi sur la
console ou par liste de travail DICOM, selon l'appareil).

### Communiquer un résultat critique
**Notifier** → **à qui** (obligatoire) et **comment** (appel téléphonique, en personne, message
sécurisé). MedCare enregistre qui a été prévenu, comment et quand, comme le recommande l'ACR,
et notifie dans l'application l'équipe de radiologie **et le prescripteur**.

### Annuler
**Annuler l'Examen** → motif obligatoire. Refusé tant qu'un compte rendu attend la validation : le
radiologue le valide ou le rejette d'abord.

### Allergie aux produits de contraste
À la prescription d'un examen avec contraste, MedCare avertit si une allergie du patient évoque
l'iode, un produit de contraste, le gadolinium ou les fruits de mer / crustacés (en français ou
en anglais, sans tenir compte des accents). C'est un avertissement, pas un blocage.

## Contrôles et traçabilité

- Chaque route n'agit que sur un examen de **radiologie** de l'établissement : un identifiant
  d'examen de laboratoire est refusé (et inversement dans le module Laboratoire).
- Chaque étape (planification, démarrage avec le contrôle avant examen, compte rendu, validation,
  rejet, addendum, résultat critique, annulation) écrit une ligne d'audit `radiology.*`.
- Une action sur un examen modifié entre-temps est refusée au lieu d'écraser l'autre action ; deux
  comptes rendus simultanés ne peuvent pas être créés.

---

## Limites connues

- **MedCare ne stocke pas les images DICOM** : elles restent dans le PACS de l'établissement,
  ouvert par le lien ci-dessus. Sans PACS, il n'y a pas de visionneuse dans MedCare.
- Pas d'envoi automatique de liste de travail DICOM (MWL) aux appareils : le n° d'accession est
  reporté sur la console.
- La saisie de la modalité et de la région se fait via le catalogue d'examens (Paramètres → Types
  d'imagerie, Zones anatomiques).

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Liste de travail, prescription | `GET/POST /api/v1/radiology` |
| Détail | `GET /api/v1/radiology/[id]` |
| Planifier / démarrer | `PATCH /schedule`, `GET /pre-exam`, `PATCH /start` |
| Compte rendu / valider / rejeter / addendum | `POST /report`, `PATCH /validate`, `PATCH /reject`, `POST /addenda` |
| Appareils, PACS, double lecture | `/api/v1/settings/imaging-devices`, `/api/v1/settings/radiology` |
| Contrôle avant examen, dose, n° d'accession, lien PACS | `lib/radiology/safety.ts`, `exam-context.ts` |
| Critique, annulation | `PATCH /notify-critical`, `PATCH /cancel` |
| Catalogue | `GET /api/v1/exam-catalog?domain=radiology` |
| Modèle de compte rendu | `lib/radiology/report` |

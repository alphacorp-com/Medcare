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
Examen *En attente de planification* → **Planifier l'Examen** → date et heure. En cas de
**conflit de planification**, MedCare l'affiche ; **Planifier quand même** force le créneau.

### Réaliser l'examen
À l'arrivée du patient → **Démarrer l'Examen** (acquisition des images).

### Saisir le compte rendu
**Saisir le Compte-rendu** :
- **Technique** (obligatoire) ;
- **Constatations** : texte libre, ou résultats par paramètre (organe par organe) proposés par la
  fiche de l'examen ;
- **Conclusion** (obligatoire) ;
- examens antérieurs comparés ;
- **URL du compte rendu / des images** : lien vers un PACS ou un serveur d'images, facultatif ;
- **Marquer comme résultat critique** si besoin.

→ **Enregistrer le Compte-rendu**. L'examen attend la validation.

### Valider ou rejeter (radiologue)
- **Valider et Publier** : le compte rendu devient officiel, visible dans le dossier patient
  (onglet *Imagerie* → **Ouvrir Visionneuse**) et dans la consultation.
- **Rejeter le Compte-rendu** : motif obligatoire.

### Communiquer un résultat critique
**Notifier** → **à qui** (obligatoire) et **comment** (appel téléphonique, en personne, message
sécurisé). MedCare enregistre qui a été prévenu, comment et quand, comme le recommande l'ACR.

### Annuler
**Annuler l'Examen** → motif obligatoire.

---

## Limites connues

- **Pas de stockage ni de visionneuse d'images DICOM.** MedCare conserve le compte rendu et, au
  plus, un lien externe (affiché seulement s'il commence par `http://` ou `https://`). Voir les
  images dans l'application demanderait un PACS ou un stockage d'images et une visionneuse (par
  exemple OHIF).
- La saisie de la modalité et de la région se fait via le catalogue d'examens (Paramètres → Types
  d'imagerie, Zones anatomiques).

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Liste de travail, prescription | `GET/POST /api/v1/radiology` |
| Détail | `GET /api/v1/radiology/[id]` |
| Planifier / démarrer | `PATCH /schedule`, `PATCH /start` |
| Compte rendu / valider / rejeter | `POST /report`, `PATCH /validate`, `PATCH /reject` |
| Critique, annulation | `PATCH /notify-critical`, `PATCH /cancel` |
| Catalogue | `GET /api/v1/exam-catalog?domain=radiology` |
| Modèle de compte rendu | `lib/radiology/report` |

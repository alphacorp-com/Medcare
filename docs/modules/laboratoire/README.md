# Laboratoire

Suivi des analyses biologiques, de la demande au résultat validé : prélèvement, saisie des
paramètres avec indicateurs automatiques, validation par le biologiste, alerte sur résultat
critique.

- **Utilisateurs** : techniciens de laboratoire (saisie), biologistes (validation), prescripteurs.
- **Menu** : Laboratoire → **Examens** (`/laboratory`).
- **Permission** : `MODULE_LAB`.
  - lecture : consulter la liste de travail ;
  - création : prescrire un examen ;
  - modification : prélever, saisir les résultats, notifier un résultat critique, annuler ;
  - **validation** : valider ou rejeter les résultats (biologiste).

---

## Cycle d'un examen

```
En attente de paiement ──(paiement à la caisse)──► Prélèvement en attente
        │                                                  │ Prélever
        │                                                  ▼
        │                                             En analyse ──► Saisie des résultats
        │                                                  ▲                │
        │                                    Rejet (biologiste)              ▼
        │                                                  └──────── En attente de validation
        │                                                                   │ Valider et publier
        ▼                                                                   ▼
     Annulé  ◄──── (annulation possible tant que non terminé)            Terminé
```

- Un examen prescrit pendant une consultation est **facturé à la prescription**. Le prélèvement
  est **refusé** tant que la facture n'est pas réglée.
- Exception : un examen **STAT** prescrit pour une **urgence vitale** n'attend pas le paiement.
- Annuler un examen non payé retire sa ligne de la facture.

---

## Écran (`/laboratory`)

- Onglets d'état avec compteurs :
  - En attente de paiement ;
  - Prélèvement en attente ;
  - En analyse ;
  - En attente de validation ;
  - Terminé ;
  - **Résultats critiques**.
- Recherche par patient (nom, IPP) ou par libellé d'examen ; pagination.
- **Prescrire un Examen** : prescription directe depuis le laboratoire.
- Fiche de détail de l'examen : prescripteur, urgence, notes cliniques, résultats, actions,
  **Imprimer le Détail** (PDF du résultat).

---

## 👤 Procédures

### Prescrire un examen depuis le laboratoire
1. **Prescrire un Examen**.
2. Recherchez le **patient** et, si besoin, liez l'examen à un **séjour actif**.
3. Choisissez l'analyse dans le **catalogue** de l'établissement, ou « Personnalisé / Autre » avec
   un libellé.
4. Priorité (Routine, Urgent, STAT) et notes cliniques → **Prescrire**.

En consultation, le médecin prescrit depuis l'écran de consultation (voir
[Admissions](../admissions/README.md#mener-la-consultation)).

### Prélever
Onglet *Prélèvement en attente* → examen → **Marquer comme Prélevé**. L'examen passe *En analyse*.

### Saisir les résultats (technicien)
1. Examen *En analyse* → **Saisir les Résultats**.
2. La **fiche de résultats** de l'examen (paramètres, unités, valeurs de référence) est pré-remplie
   depuis le catalogue. Saisissez les valeurs : l'indicateur (normal, bas, élevé, critique) est
   **calculé automatiquement**. **Ajouter un Paramètre** permet d'ajouter une ligne libre.
3. Cochez « résultat critique » si nécessaire → **Enregistrer les Résultats**. L'examen passe *En
   attente de validation*.

### Valider ou rejeter (biologiste)
- **Valider et Publier** : le résultat devient officiel, l'examen est *Terminé*, et le résultat
  devient visible dans le dossier du patient et dans la consultation.
- **Rejeter les Résultats** (motif obligatoire) : le brouillon est supprimé et l'examen revient en
  attente de prélèvement, pour un nouveau prélèvement.

### Traiter un résultat critique
Onglet **Résultats critiques** → examen → **Notifier** après avoir prévenu le prescripteur (appel,
en personne). La date de communication est enregistrée.

### Annuler un examen
Fiche de l'examen → **Annuler l'Examen** → motif obligatoire.

---

## Liens avec les autres modules

- **Programmes VIH / hépatites** : un examen de dépistage (VIH, syphilis, AgHBs…) validé alimente
  automatiquement le **registre de dépistage**. Une charge virale validée alimente le suivi des
  charges virales. Le lien se règle dans **Paramètres → Types d'examens**.
- **Maternité (PTME)** : les tests VIH et syphilis prescrits depuis une grossesse passent par ce
  module.
- **Paludisme / tuberculose** : un cas peut être relié au résultat d'examen qui le confirme.
- **Facturation** : prix lu dans la grille tarifaire (synchronisée avec le prix du catalogue).

## Règles

- La validation est **réservée** à la permission `validate` : celui qui saisit n'est pas forcément
  celui qui valide.
- Les **résultats VIH** ne sont visibles que par le personnel de laboratoire, les prescripteurs,
  les titulaires de `MODULE_HIV` et les administrateurs.
- Valider un examen déjà facturé ne le refacture pas.

## Cloisonnement avec la radiologie

Les routes du laboratoire n'agissent que sur les examens de **biologie** de l'établissement : un
identifiant d'examen de radiologie est refusé (et inversement), car les permissions des deux
modules sont distinctes. Une notification de résultat critique ne peut être enregistrée qu'une
fois.

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Liste de travail, prescription | `GET/POST /api/v1/laboratory` |
| Détail | `GET /api/v1/laboratory/[id]` |
| Prélever / résultats / valider / rejeter | `PATCH /collect`, `POST /results`, `PATCH /validate`, `PATCH /reject` |
| Critique, annulation | `PATCH /notify-critical`, `PATCH /cancel` |
| Catalogue d'examens | `GET /api/v1/exam-catalog?domain=laboratory` |
| Paramètres standard | `lib/exam-catalog/standard-parameters.ts` (`npm run db:sync-exam-parameters`) |
| Lien registres VIH | `lib/hiv/lab-link` |

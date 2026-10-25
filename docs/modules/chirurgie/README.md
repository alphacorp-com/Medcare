# Chirurgie

Programme opératoire et traçabilité du bloc : planification sans conflit de salle ni de
chirurgien, **check-list de sécurité chirurgicale OMS** obligatoire, compte rendu opératoire signé.

- **Utilisateurs** : chirurgiens, anesthésistes, équipe du bloc, secrétariat.
- **Menu** : Chirurgie (`/surgery`).
- **Permission** : `MODULE_SURGERY`.

---

## Cycle d'une intervention

```
Programmée ──Sign In + Time Out validés──► Démarrer ──► Au bloc (en cours)
   │   ▲                                                    │ Sign Out validé
   │   └── Replanifier ── Reportée ◄── Reporter              ▼
   │                                              Terminer & Signer ──► Terminée
   └──► Annulée (depuis Programmée ou Reportée, définitif)
```

---

## Écran (`/surgery`)

- Liste paginée, avec tuiles par statut : programmées, au bloc, terminées, reportées, annulées.
- Filtres : recherche (patient, IPP, intervention), chirurgien, période.
- Les interventions à venir sont triées de la plus proche à la plus lointaine.
- **Programmer une Intervention**.
- Export CSV, impression et envoi par e-mail du programme.

---

## 👤 Procédures

### Programmer une intervention
1. **Programmer une Intervention**.
2. Patient, séjour actif éventuel, **chirurgien**, anesthésiste.
3. Libellé et code de l'acte, **salle**, date et heure, **score ASA**.
4. En cas de conflit (« Chirurgien déjà occupé », « Salle déjà occupée »), **Planifier quand même**
   force la programmation.

### Remplir la check-list OMS
**Valider Check-list**, en trois temps :

| Phase | Moment | Exemples de points |
|---|---|---|
| Sign In | Avant l'induction anesthésique | Site opératoire marqué, oxymètre fonctionnel, allergies revues |
| Time Out | Avant l'incision | Confirmation de l'équipe, du patient, de l'intervention |
| Sign Out | Avant la sortie du bloc | Intervention enregistrée, prélèvements étiquetés, problèmes d'équipement traités |

- Sign In et Time Out se remplissent pendant que l'intervention est **programmée**.
- Sign Out se remplit pendant qu'elle est **en cours**.

### Démarrer
**Démarrer l'Assise** : refusé tant que **Sign In et Time Out** ne sont pas complets.

### Terminer et signer
**Terminer & Signer** :
- refusé tant que le **Sign Out** n'est pas complet ;
- **compte rendu opératoire** obligatoire, compte rendu d'anesthésie et complications (saignement,
  infection, réaction anesthésique, lésion d'organe, aucune) facultatifs.

À la clôture :
- si l'intervention est liée à un séjour, un **compte rendu opératoire signé** est déposé dans le
  dossier du séjour ;
- une **ligne de facture** est générée automatiquement.

### Reporter, replanifier, annuler
- **Reporter** (motif obligatoire), depuis *Programmée* uniquement.
- **Replanifier** : modifier la date d'une intervention reportée la remet *Programmée*.
- **Annuler** (motif obligatoire), depuis *Programmée* ou *Reportée*. C'est définitif.

## Limites connues

- Pas d'export PDF du compte rendu opératoire : il est consultable dans le dossier du séjour.

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Liste, programmation | `GET/POST /api/v1/surgeries` |
| Modification / replanification | `PATCH /api/v1/surgeries/[id]` |
| Check-list | `PATCH /api/v1/surgeries/[id]/checklist` |
| Démarrer / terminer | `PATCH /start`, `PATCH /complete` |
| Reporter / annuler | `PATCH /postpone`, `PATCH /cancel` |
| Logique métier | `lib/surgery/` |

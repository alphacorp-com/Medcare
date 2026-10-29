# Chirurgie

Programme opératoire et traçabilité du bloc :
- planification sans conflit de salle ni de chirurgien, sur la **durée prévue** ;
- **consentement éclairé** et **consultation pré-anesthésique** avant de démarrer ;
- **check-list de sécurité chirurgicale OMS** obligatoire ;
- **compte rendu opératoire signé** par le chirurgien, avec horaires opératoires, complications,
  **consommables et implants** (sortie de stock, facturation, traçabilité).

- **Utilisateurs** : chirurgiens, anesthésistes, équipe du bloc, secrétariat.
- **Menu** : Chirurgie (`/surgery`).
- **Permission** : `MODULE_SURGERY`.

---

## Cycle d'une intervention

```
Programmée ──Consentement + pré-anesthésie (sauf urgence) + Sign In + Time Out──► Démarrer ──► Au bloc
   │   ▲                                                                              │ Sign Out validé
   │   └── Replanifier ── Reportée ◄── Reporter                                        ▼
   │                                                          Terminer & Signer (chirurgien) ──► Terminée
   └──► Annulée (depuis Programmée, Reportée, ou En cours avec « Interrompre » ; définitif)
```

---

## Écran (`/surgery`)

- Liste paginée, avec tuiles par statut : programmées, au bloc, terminées, reportées, annulées.
- Filtres : recherche (patient, IPP, intervention), chirurgien, période.
- Les interventions à venir sont triées de la plus proche à la plus lointaine.
- Une intervention **en urgence** porte une icône rouge ; le **motif** d'un report ou d'une
  annulation s'affiche sous le statut.
- Le bouton **Pré-op** est orange tant que le consentement ou la consultation pré-anesthésique
  manque.
- Export CSV, impression et envoi par e-mail du programme.

Tous les panneaux (programmation, pré-opératoire, check-list, clôture) ont la même structure :
- un en-tête qui rappelle le patient, l'intervention, la date, la salle et la durée ;
- des sections ;
- des boutons d'action toujours visibles en bas.

---

## 👤 Procédures

### Programmer une intervention
**Programmer une Intervention**, puis quatre sections :
1. **Patient** et séjour actif éventuel.
2. **Intervention** : libellé, code de l'acte, **score ASA** (1 à 6), case **Urgence**.
3. **Créneau** : date et heure, **salle d'opération** (lits de type « Chirurgie », Paramètres →
   Lits), **durée prévue** (raccourcis de 30 min à 4 h, ou valeur libre).
4. **Équipe opératoire** : chirurgien, anesthésiste, puis autant de membres que nécessaire
   (aide-opératoire, instrumentiste, circulant, infirmier anesthésiste…).

Un conflit est signalé quand le chirurgien ou la salle est déjà pris **pendant la durée prévue**
(90 minutes par défaut) ; **Planifier quand même** force la programmation.

### Pré-opératoire
**Pré-op** (intervention programmée ou reportée) :
- **Prêt à démarrer ?** : les quatre conditions (consentement, pré-anesthésie, Sign In, Time Out),
  cochées au fur et à mesure.
- **Consentement éclairé** : enregistré par l'utilisateur qui l'a recueilli, avec des précisions
  facultatives.
- **Consultation pré-anesthésique** : par un **clinicien**, conclusions obligatoires.
- Chacun est enregistré une seule fois (nom et heure), puis n'est plus modifiable.
- En **urgence**, ces deux étapes peuvent manquer (« Dispensé »).

### Remplir la check-list OMS
**Valider Check-list** : les trois temps, avec leur progression. Chaque point se coche un par un
(pas de « tout cocher ») ; **Valider ce temps** n'est possible qu'une fois tous les points cochés.

| Phase | Moment | Exemples de points |
|---|---|---|
| Sign In | Avant l'induction anesthésique | Site opératoire marqué, oxymètre fonctionnel, allergies revues |
| Time Out | Avant l'incision | Confirmation de l'équipe, du patient, de l'intervention |
| Sign Out | Avant la sortie du bloc | Intervention enregistrée, prélèvements étiquetés, problèmes d'équipement traités |

### Démarrer
**Démarrer l'intervention** : refusé tant que Sign In et Time Out ne sont pas complets, et — sauf
urgence — tant que le consentement et la consultation pré-anesthésique ne sont pas enregistrés.

### Terminer et signer
**Terminer & Signer**, réservé au **chirurgien de l'intervention** (le bouton reste visible pour les
autres, avec un avertissement) et refusé tant que le Sign Out n'est pas complet :
- **Horaires opératoires** (facultatifs, dans l'ordre) : début d'anesthésie, incision, fermeture,
  fin d'anesthésie.
- **Compte rendu** opératoire (obligatoire), compte rendu d'anesthésie, **complications**
  (« Aucune » exclut les autres).
- **Consommables et implants** :
  - un consommable est un article du stock ; il sort du stock (lots qui périment en premier) ;
  - un implant est un article du stock, ou un implant extérieur tracé par son **n° de lot ou de
    série** (fabricant facultatif) ;
  - un stock insuffisant refuse la clôture, avec la quantité disponible.

À la clôture, en une seule opération :
- le compte rendu signé est versé au dossier du séjour (si l'intervention y est liée) ;
- le matériel est enregistré (une ligne par lot) et sort du stock ;
- l'acte et les articles du stock utilisés sont facturés.

### Reporter, replanifier, annuler, interrompre
- **Reporter** (motif obligatoire), depuis *Programmée* uniquement ; le motif est rappelé à la
  replanification.
- **Replanifier** : modifier la date d'une intervention reportée la remet *Programmée*.
- **Annuler** (motif obligatoire), depuis *Programmée* ou *Reportée*. C'est définitif.
- **Interrompre** (motif obligatoire) une intervention *en cours* abandonnée : elle passe
  *Annulée*, avec son heure de fin réelle.
- Le dernier motif est affiché ; tous sont conservés dans le **journal d'audit**.

## Contrôles et traçabilité

- **Vérifications côté serveur** :
  - le patient et le séjour (qui doit être celui du patient) ;
  - le chirurgien et l'anesthésiste (soignants actifs de l'établissement) ;
  - les membres de l'équipe (comptes actifs de l'établissement) ;
  - la salle, le score ASA, la durée, les horaires et le matériel.
- **Conflits** : leur détection ne regarde que les interventions de l'établissement.
- **Audit** : chaque étape écrit une ligne `surgery.*` (programmation, modification, consentement,
  pré-anesthésie, check-list, démarrage, clôture, report, annulation).
- **Concurrence** : une action sur une intervention modifiée entre-temps par quelqu'un d'autre est
  refusée (« reload it ») au lieu d'écraser son travail.
- **RMA3** : une intervention interrompue n'est pas comptée parmi les interventions réalisées
  (V.1-007), mais un décès dans les 30 jours qui suivent est compté comme péri-opératoire (V.1-008).

## Limites connues

- Pas d'export PDF du compte rendu opératoire : il est consultable dans le dossier du séjour.
- Les implants extérieurs au stock ne sont pas facturés (pas de prix connu).

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Liste, programmation | `GET/POST /api/v1/surgeries` |
| Modification / replanification | `PATCH /api/v1/surgeries/[id]` |
| Consentement, pré-anesthésie | `PATCH /api/v1/surgeries/[id]/preop` |
| Check-list | `PATCH /api/v1/surgeries/[id]/checklist` |
| Démarrer / terminer | `PATCH /start`, `PATCH /complete` |
| Reporter / annuler / interrompre | `PATCH /postpone`, `PATCH /cancel` |
| Salles d'opération | `GET /api/v1/surgeries/rooms` |
| Logique métier | `lib/surgery/` : check-list, validation des saisies (équipe, durée, horaires, matériel, conditions de démarrage), références |
| Données | `surgical_procedures` (+ colonnes de la migration `20261105090000_surgery_radiology_safety`), `surgical_supply_uses` |

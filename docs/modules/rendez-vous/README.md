# Rendez-vous

Agenda des consultations programmées : prise de rendez-vous sur les créneaux des médecins, séries
récurrentes, arrivée du patient et passage dans la file de consultation.

- **Utilisateurs** : accueil, secrétariat médical, médecins.
- **Menu** : Rendez-vous (`/appointments`).
- **Permission** : `MODULE_APPOINTMENTS` — lecture, création (prendre un rendez-vous), modification
  (reprogrammer, enregistrer l'arrivée, annuler, absence).

---

## Notions

| Statut | Signification |
|---|---|
| Réservé | Rendez-vous pris |
| Confirmé | Confirmé auprès du patient |
| Arrivé | Le patient est arrivé ; un séjour a été créé |
| Terminé | Consultation réalisée |
| Absent (no-show) | Le patient n'est pas venu |
| Annulé | Annulé, avec un motif |

Les **disponibilités hebdomadaires** de chaque médecin (jours, plages horaires, durée des
créneaux) sont définies par l'administrateur dans **Paramètres → Disponibilités Médecins**.
Elles alimentent les créneaux proposés à la réservation.

---

## Écran (`/appointments`)

- Agenda d'une journée (aujourd'hui par défaut), avec navigation entre les jours et bouton
  **Aujourd'hui**.
- Tuiles de synthèse : rendez-vous du jour, en attente, arrivés, absents.
- Chaque rendez-vous s'ouvre dans une fiche de détail. Un lien depuis le tableau de bord ouvre
  directement le bon rendez-vous.

---

## 👤 Procédures

### Prendre un rendez-vous
1. **Nouveau Rendez-vous**.
2. **Patient** : recherchez-le.
3. **Praticien** : choisissez le médecin. Seuls les rôles marqués « prestataire clinique » sont
   proposés.
4. **Date et créneau** : choisissez un créneau parmi les **créneaux disponibles**. Ceux déjà
   réservés sont signalés « Déjà réservé ». **Autre heure** permet une heure libre.
5. Choisissez le **type de rendez-vous** et la **durée**, puis saisissez le **motif** et
   d'éventuelles notes internes.
6. **Récurrence** (facultatif) : chaque semaine ou chaque mois, avec un nombre d'occurrences. Les
   dates prévues s'affichent avant validation.
7. **Prendre le rendez-vous**.

En cas de **conflit** (médecin indisponible ou déjà réservé), MedCare l'affiche ; **Réserver quand
même** force la réservation. Pour une série, les occurrences en conflit sont **sautées** et
signalées, sans bloquer le reste de la série (sauf réservation forcée).

### Reprogrammer
Fiche du rendez-vous → **Reprogrammer** : nouvelle date, nouveau créneau ou nouveau médecin.
Possible tant que le rendez-vous est réservé ou confirmé ; le nouveau créneau est revérifié.

### Enregistrer l'arrivée du patient
Fiche du rendez-vous → **Enregistrer l'arrivée** :
- un **séjour** de type *Programmé* est créé et relié au rendez-vous ;
- le patient entre dans la **file de consultation** (voir [Admissions](../admissions/README.md)) ;
- deux clics simultanés ne créent qu'un seul séjour.

### Annuler / déclarer une absence
- **Annuler le Rendez-vous** : motif facultatif.
- **Absent** : pour un rendez-vous réservé ou confirmé où le patient n'est pas venu.

---

## Règles

- Le rendez-vous lui-même ne génère **aucune facture** : c'est la consultation qui suit qui est
  facturée.
- Une série mensuelle garde le même jour du mois (le 31 devient le dernier jour des mois plus
  courts).

## Limites connues

- L'API d'arrivée accepte un acte d'admission (paiement avant consultation), mais **l'écran ne le
  propose pas encore** : le patient sur rendez-vous entre directement dans la file, sans passer par
  la caisse.
- Il n'y a pas d'action explicite « Terminer » le rendez-vous.

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Liste, création (avec récurrence) | `GET/POST /api/v1/appointments` |
| Détail, reprogrammation | `GET/PATCH /api/v1/appointments/[id]` |
| Créneaux disponibles | `GET /api/v1/appointments/availability` |
| Arrivée, absence, annulation | `POST /api/v1/appointments/[id]/check-in`, `/no-show`, `/cancel` |
| Disponibilités des médecins | `GET/PUT /api/v1/settings/doctor-availability` |
| Détection des conflits | `lib/scheduling/` |

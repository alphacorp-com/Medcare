# Planning du personnel

Planification des postes et des gardes par service, avec détection des conflits, déclaration des
absences et remplacements. Gère aussi la liste des services (départements).

- **Utilisateurs** : cadres de santé, responsables de service, direction.
- **Menu** : Planning → **Plannings**, **Services** (`/planning`).
- **Permission** : `MODULE_PLANNING`.

---

## Notions

| Notion | Valeurs |
|---|---|
| **Type de poste** | Matin, Après-midi, Nuit, Astreinte, Repos |
| **Statut d'un poste** | Planifié, Confirmé, Modifié, Absent, Remplacé |

---

## Écrans

- **Plannings** : grille des postes d'un service sur une période ; cliquer sur un poste ouvre son
  détail.
- **Services** : liste des services (code, nom, type, responsable, téléphone, localisation,
  actif / inactif).

---

## 👤 Procédures

### Affecter un poste
**Plannings** → choisissez le service → **Affecter** : membre du personnel, date, type de poste,
notes. En cas de **conflit** (la personne a déjà un poste ce jour-là), MedCare l'affiche ; la
confirmation forcée reste possible.

### Modifier ou supprimer un poste
Détail du poste → changer le statut (confirmé, modifié…) ou les notes. **Supprimer** retire un poste
affecté par erreur.

### Déclarer une absence
**Déclarer une absence** : personne, période (du… au…), motif. Les postes **déjà planifiés** de la
période passent *Absent*. Un jour sans poste planifié n'a rien à marquer.

### Remplacer une personne
Détail du poste → **Remplacer** → remplaçant. Le poste d'origine passe *Remplacé* et le remplaçant
reçoit son propre poste, confirmé, à la même date, avec le même type et dans le même service.

### Gérer les services
**Services → Nouveau service** : nom, code, type (urgences, chirurgie, réanimation, médecine,
pédiatrie, radiologie, laboratoire, pharmacie, maternité, administration, autre), responsable,
téléphone, localisation. Un service peut être désactivé : il disparaît alors des listes de choix,
mais reste visible dans la gestion.

Les services servent aussi aux admissions, aux lits et aux rendez-vous.

## Limites connues

- Pas de circuit de demande et de validation des congés : une absence marque simplement des postes
  existants.

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Postes d'un service | `GET/POST /api/v1/planning/schedules` |
| Modifier / supprimer un poste | `PATCH/DELETE /api/v1/planning/schedules/[id]` |
| Remplacement | `PATCH /api/v1/planning/schedules/[id]/replace` |
| Absence | `POST /api/v1/planning/schedules/absence` |
| Services | `GET/POST /api/v1/departments`, `PATCH /api/v1/departments/[id]` |
| Conflits | `lib/planning/conflicts.ts` |

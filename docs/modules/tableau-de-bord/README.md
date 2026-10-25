# Tableau de bord

Page d'accueil après connexion (`/`). Chaque utilisateur voit les indicateurs et les listes de
travail **correspondant à ses permissions** : un caissier voit les factures, un technicien de
laboratoire les examens à réaliser, un médecin ses patients et ses résultats.

- **Accès** : tout utilisateur connecté. Le contenu dépend des permissions, jamais du nom du rôle.

---

## Widgets disponibles

| Widget | Visible avec | Rafraîchi toutes les |
|---|---|---|
| Consultations en cours | Admissions (lecture) | 1 min |
| Attente aux urgences | Admissions (lecture) | 1 min |
| Admissions du jour | Admissions (lecture) | 5 min |
| Occupation des lits | Admissions (lecture) | 5 min |
| File des patients | Admissions (lecture) | 30 s |
| Mes patients hospitalisés | Admissions (lecture), prestataire clinique | 1 min |
| Rendez-vous du jour | Rendez-vous (lecture) | 5 min |
| Mes rendez-vous du jour | Rendez-vous (lecture), prestataire clinique | 2 min |
| Examens de laboratoire en attente | Laboratoire (lecture) | 2 min |
| Examens de laboratoire à réaliser | Laboratoire (modification) | 1 min |
| Résultats de laboratoire à valider | Laboratoire (validation) | 1 min |
| Mes résultats récents | Laboratoire (lecture), prestataire clinique | 2 min |
| Radiologie à réaliser | Radiologie (modification) | 1 min |
| Comptes rendus de radiologie à valider | Radiologie (validation) | 1 min |
| Ordonnances en attente | Pharmacie (lecture) | 1 min |
| Alertes de stock (stock faible, rupture, lots périmés ou qui expirent sous 30 jours) | Pharmacie (lecture) | 10 min |
| Factures impayées (montant et liste) | Facturation (lecture) | 5 min |
| Encaissements du jour | Facturation (lecture) | 5 min |
| État de la licence | Administrateur | — |
| Activité récente (24 h) | Administrateur | 5 min |

- Les éléments des listes sont cliquables et ouvrent directement l'écran concerné (une ordonnance,
  un rendez-vous, un examen…).
- Un widget en erreur, ou non autorisé, n'empêche pas les autres de s'afficher.
- Pendant la **période de grâce** de la licence, un bandeau invite à la renouveler (voir
  [Licence](../../licence/README.md)).

## 👤 Adapter le tableau de bord d'un profil

Le tableau de bord se règle par les **permissions** : donner la permission *validation* du
laboratoire à un rôle fait apparaître « Résultats à valider » sur le tableau de bord de ses
utilisateurs. Voir [Sécurité, rôles et permissions](../../securite/README.md).

## 🛠️ Repères techniques

| Élément | Fichier / route |
|---|---|
| Liste des widgets et règles de visibilité | `lib/dashboard/widgets.ts` (`canViewWidget`) |
| Chargement des données | `lib/dashboard/loaders.ts`, `GET /api/v1/dashboard/widgets?ids=…` |
| Widgets spécifiques | `/api/v1/dashboard/queue`, `/stock-alerts`, `/audit`, `/api/v1/licensing/status` |

La même fonction `canViewWidget` décide de l'affichage et de l'envoi des données : un widget
masqué ne peut pas être lu par l'API.

# Messagerie et notifications

Messagerie interne entre membres du personnel de l'établissement, et notifications des événements
des modules.

- **Utilisateurs** : tout le personnel.
- **Accès** : menu **Messages** (`/messages`) et **cloche** de l'en-tête. Aucune permission de
  module n'est requise.

---

## Messagerie

### Écran (`/messages`)
- Liste des conversations, les plus récentes en tête, avec l'aperçu du dernier message et le
  nombre de messages non lus.
- Fil de la conversation sélectionnée ; les messages plus anciens se chargent en remontant.
- Le nombre total de non-lus s'affiche sur le menu.

### 👤 Procédures
- **Nouvelle conversation** : choisissez un ou plusieurs collègues dans l'annuaire de
  l'établissement. Une conversation à deux est réutilisée si elle existe déjà ; une conversation de
  groupe peut avoir un titre.
- **Envoyer** : saisissez le message et envoyez.
- Ouvrir une conversation la marque comme lue.

### Règles
- Les participants doivent appartenir au même établissement.
- L'annuaire ne montre que le nom, l'e-mail et le rôle des collègues, jamais leurs permissions.

## Notifications

- La **cloche** affiche le nombre de notifications non lues : événements des modules, messages,
  messages système.
- Cliquer sur une notification la marque comme lue ; **Tout marquer comme lu** les marque toutes.
- Chacun ne voit que ses propres notifications.

## Limites connues

- **Pas de temps réel** : les messages et les compteurs se rafraîchissent par interrogation
  périodique (toutes les 15 secondes environ), pas instantanément.
- Pas de pièces jointes.

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Conversations | `GET/POST /api/v1/conversations` |
| Messages | `GET/POST /api/v1/conversations/[id]/messages` |
| Marquer lu, non-lus | `POST /api/v1/conversations/[id]/read`, `GET /api/v1/conversations/unread-count` |
| Annuaire | `GET /api/v1/directory` |
| Notifications | `GET /api/v1/notifications`, `/unread-count`, `PATCH /[id]/read`, `POST /read-all` |
| Logique | `lib/messaging/`, `lib/notifications/` |

# Banque de sang

Gestion des donneurs, des collectes (fixes et mobiles) et des poches de sang, de la mise en
quarantaine jusqu'à la transfusion ou à la destruction. Alimente le RMA3 (activités de
transfusion).

- **Utilisateurs** : laboratoire, responsables de la banque de sang.
- **Menu** : Laboratoire → **Banque de sang** (`/blood-bank`).
- **Permission** : `MODULE_LAB` (lecture, création, modification).

---

## Cycle d'une poche

```
Quarantaine ──(4 tests négatifs : VIH, VHB, VHC, syphilis)──► Disponible ──► Servie ──► Transfusée
     │                                                             │
     └────────────────────────── Détruite (motif) ◄────────────────┘
```

---

## Écran (`/blood-bank`) — trois onglets

| Onglet | Contenu |
|---|---|
| Poches | Stock de la banque par statut, poches collectées dans le mois |
| Donneurs | Registre des donneurs (code, nom, groupe sanguin, type, nombre de dons) |
| Collectes | Collectes mobiles (date, lieu) |

---

## 👤 Procédures

### Enregistrer un donneur
**Donneurs → Nouveau** : code, nom complet, sexe, date de naissance, téléphone, groupe sanguin,
type de donneur (**volontaire** ou **familial**). Le donneur peut être relié à un patient existant.

### Organiser une collecte mobile
**Collectes → Nouvelle** : date et lieu. Les poches collectées pendant cette sortie y sont
rattachées.

### Enregistrer un don (nouvelle poche)
**Poches → Nouvelle** : donneur, collecte mobile éventuelle, **numéro de poche**, date de
collecte, et les résultats de qualification s'ils sont déjà connus. La poche entre en
**quarantaine**.

### Qualifier puis libérer une poche
1. Saisissez les résultats des 4 tests : VIH, hépatite B, hépatite C, syphilis.
2. **Libérer** : la poche ne devient **disponible** que si les 4 tests sont négatifs.

### Servir, transfuser ou détruire
- **Servir** : poche disponible remise au service.
- **Transfuser** : avec la date et, si possible, le patient receveur.
- **Détruire** : motif obligatoire (test positif, péremption, poche endommagée…).

## Règles

- Chaque changement de statut est conditionnel au statut lu : deux actions simultanées sur la même
  poche ne peuvent pas s'appliquer toutes les deux.

## 🛠️ Repères techniques

| Besoin | Route |
|---|---|
| Donneurs | `GET/POST /api/v1/blood-bank/donors` |
| Collectes mobiles | `GET/POST /api/v1/blood-bank/sessions` |
| Poches : liste, création | `GET/POST /api/v1/blood-bank/donations` |
| Poches : tests, libération, service, transfusion, destruction | `PATCH /api/v1/blood-bank/donations/[id]` |
| Contrôle d'accès | `lib/blood-bank/route-auth.ts` |

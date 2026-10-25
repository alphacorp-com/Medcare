# Sécurité, rôles et permissions

Ce guide explique qui peut faire quoi dans MedCare, comment les accès sont contrôlés et ce qui est
tracé. Il s'adresse aux administrateurs de l'établissement et aux développeurs.

📄 [Audit de septembre 2026](AUDIT_2026-09.md) : constats et correctifs (les 4 constats sont corrigés, avec une réserve sur la CSP).

---

## 1. Deux niveaux d'accès : licence et permissions

Pour utiliser un module, il faut **les deux** :

1. **Le module est actif pour l'établissement.** C'est la licence AlphaCorp qui l'active : les
   modules ne s'activent pas à la main. Leur liste est visible dans **Paramètres → Modules
   Cliniques**, en lecture seule.
2. **L'utilisateur a la permission sur ce module**, dans sa fiche (**Paramètres → Personnel &
   Rôles**).

### Modules sous licence

| Code | Module |
|---|---|
| `MODULE_CORE_PATIENT` | Patients (toujours actif) |
| `MODULE_ADMISSION` | Admissions, consultations, sorties |
| `MODULE_APPOINTMENTS` | Rendez-vous |
| `MODULE_LAB` | Laboratoire et banque de sang |
| `MODULE_RADIOLOGY` | Radiologie |
| `MODULE_SURGERY` | Chirurgie |
| `MODULE_PHARMACY` | Pharmacie et stock |
| `MODULE_MATERNITY` | Maternité et planification familiale |
| `MODULE_DISEASE_PROGRAMS` | Programmes de santé |
| `MODULE_BILLING` | Facturation et tiers payant |
| `MODULE_PLANNING` | Planning du personnel |

### Sous-modules (permissions plus fines, sans licence séparée)

| Code | Rattaché à | Rôle |
|---|---|---|
| `MODULE_HIV` | Programmes de santé | Accès aux dossiers VIH, PTME, hépatites et IST, très sensibles. Le personnel qui ne suit que les autres programmes n'y a pas accès. |
| `MODULE_RMA3` | Patients | Formulaire mensuel RMA3 : lecture et modification pour saisir, **validation** pour verrouiller un mois. |

Un sous-module n'est actif que si son module parent l'est.

## 2. Les actions

Chaque permission est un ensemble d'actions sur un module :

| Action | Exemples |
|---|---|
| `read` | Consulter les listes et les fiches |
| `create` | Créer un patient, une admission, une demande d'examen |
| `update` | Modifier, faire avancer un workflow (prélever, encaisser, délivrer) |
| `delete` | Supprimer (rare : la plupart des données s'annulent au lieu de s'effacer) |
| `validate` | Action de responsabilité, détaillée ci-dessous |

Ce qui exige `validate` :

- **Laboratoire / Radiologie** : valider ou rejeter un résultat. C'est la décision du biologiste ou
  du radiologue, pas du technicien qui a saisi.
- **Facturation** :
  - rembourser un patient, ou rembourser un organisme payeur (sortie d'argent) ;
  - inscrire un patient à une gratuité, ou lever cette inscription.
- **RMA3** : valider (verrouiller) un mois.

## 3. Les rôles

Les rôles sont **définis par l'établissement** (**Paramètres → Rôles**) : aucun nom n'est imposé.

- **Administrateur** (`isSystemAdmin`) : accès complet à tous les modules actifs, aux paramètres,
  aux comptes, aux rôles et à la licence.
- **Prestataire clinique** (`isClinicalProvider`) : la personne apparaît comme médecin dans les
  sélecteurs (rendez-vous, prescripteur, médecin responsable) et voit les résultats VIH de ses
  patients.
- **Permissions par défaut** : appliquées à la création d'un utilisateur avec ce rôle, puis
  ajustables pour chaque personne.

**Prescrire demande plusieurs droits à la fois.** Un médecin qui prescrit un examen ou un
médicament pendant une consultation a besoin de `MODULE_ADMISSION` (accéder à la consultation) **et**
de `MODULE_CORE_PATIENT` en **création** (écrire au dossier du patient), plus `MODULE_LAB` /
`MODULE_RADIOLOGY` / `MODULE_PHARMACY` pour suivre l'examen ou l'ordonnance. Le prescripteur est
toujours le compte connecté : le serveur ignore tout prescripteur envoyé par le navigateur.

Garde-fous :
- impossible de supprimer un rôle attribué à des utilisateurs ;
- impossible de retirer le dernier rôle administrateur actif, ou de rétrograder le dernier
  administrateur (l'établissement se verrouillerait hors de ses propres paramètres) ;
- seul un administrateur peut modifier les permissions d'un utilisateur : un utilisateur ne peut
  pas s'en accorder lui-même.

👤 **Créer un rôle et un utilisateur** : voir [Paramétrage → Utilisateurs et rôles](../parametrage/README.md#utilisateurs-et-rôles).

## 4. Authentification et sessions

- Connexion par e-mail et mot de passe, haché avec bcrypt.
- **Limitation des tentatives** de connexion par e-mail et par adresse IP ; les échecs sont tracés.
- **Sessions** : jeton valable 12 heures. Chaque requête compare la version de session du jeton à
  celle de la base : changer de mot de passe, réinitialiser le mot de passe d'un collègue ou
  désactiver un compte **coupe immédiatement** toutes ses sessions.
- **Changer son mot de passe** : Paramètres → Profil Utilisateur. L'ancien mot de passe est exigé.

## 5. Cloisonnement des données

- Chaque requête est filtrée par l'établissement de la session (`tenantId`), jamais par un
  identifiant envoyé par le navigateur. Deviner l'identifiant d'un patient ne donne pas accès à son
  dossier.
- Les identifiants que le navigateur envoie (lit, service, médecin, article de stock, organisme…)
  sont vérifiés comme appartenant à l'établissement avant d'être enregistrés.
- Le **prix** d'un acte ne vient jamais du navigateur : il est lu dans la grille tarifaire de
  l'établissement. La caisse encaisse, mais ne fixe pas les prix.

## 6. Données confidentielles VIH

- Le **résultat** d'un examen VIH (test VIH, PCR du nourrisson, charge virale) n'est visible que
  par :
  - le personnel de laboratoire qui le saisit ou le valide ;
  - les prescripteurs (rôles « prestataire clinique ») ;
  - les titulaires de `MODULE_HIV` et les administrateurs.
- Les autres utilisateurs voient que l'examen existe et son statut, jamais son résultat.
- L'ouverture du dossier VIH d'un patient est tracée dans le journal d'audit.

## 7. Journal d'audit

Les actions sensibles sont enregistrées : connexions, modifications de comptes et de rôles,
paiements, dérogations de paiement, remboursements, rejets d'organismes, modifications du tiers
payant, saisie et validation du RMA3, génération d'un rapport RMA3, synchronisations DHIS2,
ouverture d'un dossier VIH, modification des modèles de documents, téléchargement d'une
sauvegarde de la base…

👤 **Consulter l'activité d'un utilisateur** : Paramètres → Personnel & Rôles → menu de
l'utilisateur → activité (`/settings/users/<id>/activity`), avec export CSV. Le tableau de bord de
l'administrateur affiche aussi l'activité des dernières 24 heures.

## 8. Protections du navigateur

Chaque réponse porte des en-têtes de sécurité (`next.config.ts`) :
- **Content-Security-Policy** : les ressources ne viennent que du site lui-même, et le site ne
  peut pas être intégré dans le cadre d'un autre site. Réserve : les scripts en ligne restent
  autorisés (contrainte de Next.js sans nonces).
- **X-Frame-Options**, **X-Content-Type-Options**, **Referrer-Policy** (les adresses, qui
  contiennent des identifiants de patients, ne sont pas transmises aux autres sites),
  **Permissions-Policy** (caméra, micro, géolocalisation et paiement désactivés).

## 9. Bonnes pratiques pour l'établissement

- Un compte **nominatif** par personne ; ne partagez jamais un compte.
- Désactivez immédiatement le compte d'une personne qui quitte l'établissement.
- Donnez le minimum de permissions nécessaire, en particulier `validate`, `MODULE_HIV` et le
  statut d'administrateur.
- Après une démonstration, changez les mots de passe des comptes de démonstration ou désactivez-les
  (voir [SEEDING](../installation/SEEDING.md)).
- Ne transmettez jamais `NEXTAUTH_SECRET` ni le secret client AlphaCorp par un canal non sécurisé.

## 🛠️ Repères techniques

| Élément | Fichier |
|---|---|
| Contrôle des permissions côté API | `lib/permissions.ts` (`requireModulePermission`, `requireTenantAdmin`) |
| Validation des permissions stockées | `lib/module-permissions.ts` |
| Catalogue des modules et sous-modules | `lib/module-catalog.ts`, `lib/sub-modules.ts` |
| Authentification, sessions, limitation | `lib/auth.ts`, `lib/auth-secret.ts`, `lib/rate-limit.ts` |
| Confidentialité VIH | `lib/hiv/confidential-results.ts` |
| Journal d'audit | `lib/audit.ts` |

Règle pour toute nouvelle route : vérifier la session, puis `requireModulePermission(session,
module, action)` (ou `requireTenantAdmin` pour un paramètre), et filtrer chaque requête par
`session.user.tenantId`. Ne jamais tester un nom de rôle : seul le drapeau `isSystemAdmin` compte.

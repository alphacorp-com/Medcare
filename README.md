# MedCare

Système de gestion hospitalière : dossier patient, admissions, consultations, laboratoire,
radiologie, chirurgie, pharmacie, maternité, programmes de santé publique, facturation et tiers
payant, rapports RMA3 et DHIS2.

Chaque établissement dispose de sa propre installation (application + base de données), licenciée
par AlphaCorp.

## Démarrage rapide (développement)

```bash
npm install                 # installe les dépendances et génère le client Prisma
cp .env.example .env        # puis renseigner DATABASE_URL, NEXTAUTH_SECRET, ONPREM_LICENSE_*
npm run db:migrate:deploy   # applique le schéma
npm run dev                 # http://localhost:3001 — terminer ensuite /setup
```

## Documentation

Toute la documentation est dans [`docs/`](docs/README.md) :

- [Présentation de MedCare](docs/presentation/README.md)
- [Installation, déploiement et données de démonstration](docs/installation/README.md)
- [Guide de chaque module](docs/modules/README.md)
- [Parcours inter-modules (workflows)](docs/workflows/README.md)
- [Paramétrage de l'établissement](docs/parametrage/README.md)
- [Licence AlphaCorp](docs/licence/README.md)
- [Sécurité, rôles et permissions](docs/securite/README.md)
- [État des modules](docs/etat-des-modules/README.md)
- [Guide développeur](docs/developpement/README.md)

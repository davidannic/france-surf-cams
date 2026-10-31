# France Surf Cams

Les webcams surf et plage de toutes les côtes françaises sur une seule page, triées par zone : Pays Basque, Landes, Gironde, Charentes, Pays de la Loire, Bretagne, Normandie, Hauts-de-France, Languedoc, Côte d'Azur et La Réunion.

Sources : [Viewsurf](https://www.viewsurf.com/univers/surf) (rubriques surf et plage, caméras côtières uniquement) et les caméras de la [ville de Biarritz](https://www.biarritz.fr/).

## Utilisation

En ligne : https://france-surf-cams.pages.dev, protégé par mot de passe. En local : double-clic sur `index.html` (pas de mot de passe en local).

### Hébergement

- **Cloudflare Pages**, relié à ce dépôt GitHub (privé) : chaque push sur `main` republie le site. Réglages : aucune commande de build, dossier de sortie `/`.
- **Mot de passe** : `functions/_middleware.js` bloque tout le site tant qu'on n'a pas saisi le mot de passe, puis garde la connexion 30 jours (cookie). Le mot de passe est le secret `SITE_PASSWORD` du projet Pages : Settings → Variables and Secrets. Sans ce secret, le site affiche « mot de passe non configuré ».
- **Changer le mot de passe** (par exemple pour retirer l'accès à quelqu'un) : modifie `SITE_PASSWORD`, puis Deployments → dernier déploiement → *Retry deployment*. Tout le monde est déconnecté et doit saisir le nouveau.
- Le lien « Se déconnecter » en bas de page supprime la connexion sur l'appareil.

- **Zones** : les pastilles en haut. La dernière zone choisie est mémorisée.
- **Recherche** : tape un spot (« hossegor », « lacanau »…), les accents sont ignorés.
- **★** : ajoute aux favoris (pastille « ★ Favoris »).
- **Lancer visibles** : lance toutes les vidéos de la zone affichée.
- **Auto** : lance automatiquement les vidéos qui apparaissent à l'écran.
- Les vidéos hors écran, ou quand l'onglet passe en arrière-plan, sont coupées pour économiser batterie et data.

Badges : **LIVE** = direct, **REPLAY** = dernière séquence enregistrée, **PHOTO 360°** = panorama photo (s'ouvre sur Viewsurf), **LIEN** = caméra sans lecteur intégrable (s'ouvre sur la source).

### Sur le téléphone

- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu ⋮ → « Ajouter à l'écran d'accueil » ou « Installer l'application ».

Le site s'ouvre alors en plein écran avec sa propre icône.

## Mise à jour de la liste des caméras

En ligne, une action GitHub (`.github/workflows/update-cams.yml`) régénère `cams.js` chaque lundi et publie le changement s'il y en a un. On peut aussi la lancer à la main depuis l'onglet **Actions** du dépôt.

En local (Node 18 ou plus) :

```bash
node scripts/update-cams.mjs
```

Le script refuse d'écraser `cams.js` s'il trouve beaucoup moins de caméras que la fois précédente (site indisponible, par exemple).

- Une nouvelle ville d'Aquitaine que le script ne sait pas classer : l'ajouter dans `AQUITAINE_TOWNS`.
- Une caméra hors littoral à écarter : l'ajouter dans `EXCLUDE`.
- Une caméra intégrée ailleurs avec le lecteur `pv.viewsurf.com` : l'ajouter dans `EXTRA`.

L'icône se régénère avec `node scripts/make-icons.mjs`.

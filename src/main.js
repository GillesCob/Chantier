import { Viewer, WebIFCLoaderPlugin, SectionPlanesPlugin } from "@xeokit/xeokit-sdk";
import * as WebIFC from "web-ifc";

const loadingOverlay = document.getElementById("loadingOverlay");
const niveauxList = document.getElementById("niveauxList");
const maquettesList = document.getElementById("maquettesList");
const fichePlaceholder = document.getElementById("fichePlaceholder");
const ficheContent = document.getElementById("ficheContent");
const recenterBtn = document.getElementById("recenterBtn");
const niveauxResetBtn = document.getElementById("niveauxResetBtn");
const coupeBtn = document.getElementById("coupeBtn");
const coupeToggleVisibilityBtn = document.getElementById("coupeToggleVisibilityBtn");
const coupeInvertBtn = document.getElementById("coupeInvertBtn");
const ficheDocs = document.getElementById("ficheDocs");
const docModalOverlay = document.getElementById("docModalOverlay");
const docModalClose = document.getElementById("docModalClose");
const docModalName = document.getElementById("docModalName");
const docModalVersion = document.getElementById("docModalVersion");
const docModalLot = document.getElementById("docModalLot");
const docModalType = document.getElementById("docModalType");
const docModalDownload = document.getElementById("docModalDownload");
const downloadModalOverlay = document.getElementById("downloadModalOverlay");
const downloadModalOk = document.getElementById("downloadModalOk");
const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const viewerWrap = document.getElementById("viewerWrap");
const viewViewer = document.getElementById("view-viewer");
const infoPanel = document.getElementById("infoPanel");
const collisionRecap = document.getElementById("collisionRecap");
const collisionDetail = document.getElementById("collisionDetail");
const collisionViewerSlot = document.getElementById("collisionViewerSlot");
const collisionDiscussion = document.getElementById("collisionDiscussion");
const discussionMessages = document.getElementById("discussionMessages");
const detectionsList = document.getElementById("detectionsList");
const detectionsEmpty = document.getElementById("detectionsEmpty");
const collisionMaquettesList = document.getElementById("collisionMaquettesList");
const collisionsList = document.getElementById("collisionsList");
const collisionBackBtn = document.getElementById("collisionBackBtn");
const discussionReplyForm = document.getElementById("discussionReplyForm");
const discussionReplyInput = document.getElementById("discussionReplyInput");
const discussionsThreadsList = document.getElementById("discussionsThreadsList");
const discussionsThreadsEmpty = document.getElementById("discussionsThreadsEmpty");
const discussionsListPane = document.getElementById("discussionsListPane");
const discussionsDetailPane = document.getElementById("discussionsDetailPane");
const discussionsDetailTitle = document.getElementById("discussionsDetailTitle");
const discussionsDetailMessages = document.getElementById("discussionsDetailMessages");
const discussionsReplyForm = document.getElementById("discussionsReplyForm");
const discussionsReplyInput = document.getElementById("discussionsReplyInput");
const discussionsBackBtn = document.getElementById("discussionsBackBtn");
const threadSnapshotPane = document.getElementById("threadSnapshotPane");
const threadViewerPane = document.getElementById("threadViewerPane");
const threadToggleBtns = Array.from(document.querySelectorAll("#threadVisualToggle .thread-toggle-btn"));
const discussionsFilterBtns = Array.from(document.querySelectorAll("#discussionsTypeFilter .thread-toggle-btn"));
const newDiscussionBtn = document.getElementById("newDiscussionBtn");
const newDiscussionModalOverlay = document.getElementById("newDiscussionModalOverlay");
const newDiscussionClose = document.getElementById("newDiscussionClose");
const newDiscussionForm = document.getElementById("newDiscussionForm");
const newDiscussionZone = document.getElementById("newDiscussionZone");
const newDiscussionComment = document.getElementById("newDiscussionComment");
const newDiscussionRecipients = document.getElementById("newDiscussionRecipients");

function activateView(viewName) {
  navLinks.forEach((l) => l.classList.toggle("active", l.dataset.view === viewName));
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== "view-" + viewName;
  });
  if (viewName === "viewer") {
    viewViewer.insertBefore(viewerWrap, infoPanel);
    window.dispatchEvent(new Event("resize"));
    recenterTarget = null;
    newDiscussionBtn.hidden = false;
    coupeBtn.hidden = false;
  }
  try {
    localStorage.setItem("chantier-active-view", viewName);
  } catch (e) {
    // localStorage indisponible (navigation privee...), pas bloquant.
  }

  // replaceState plutot que location.hash= pour ne pas empiler une entree
  // d'historique a chaque clic (meme pattern que Boutiques/suivi.html dans
  // le vault) : permet un lien direct depuis le CDC vers un onglet precis
  // (#collision, #discussions) ouvert dans un nouvel onglet.
  if (history.replaceState) {
    history.replaceState(null, "", "#" + viewName);
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => activateView(link.dataset.view));
});

// Capture avant qu'activateView() ne le reecrive (replaceState) : necessaire
// plus bas pour retrouver un fil precis (#discussions/<id>) au chargement.
const initialHash = location.hash;

// Le hash d'URL (lien direct depuis le CDC) prime sur le dernier onglet
// visite (localStorage) : un lien explicite doit toujours gagner. Le hash
// peut aussi cibler un fil precis (#discussions/<id>), seule la base avant
// le "/" compte pour choisir l'onglet ici.
const hashView = initialHash.replace("#", "").split("/")[0];
const validViews = navLinks.map((l) => l.dataset.view);

let savedView = "viewer";
if (validViews.includes(hashView)) {
  savedView = hashView;
} else {
  try {
    savedView = localStorage.getItem("chantier-active-view") || "viewer";
  } catch (e) {
    // localStorage indisponible, on reste sur "viewer" par defaut.
  }
}
if (savedView !== "viewer") {
  activateView(savedView);
}

// Donnees simulees : ce POC ne branche aucune GED reelle (cf CDC, un doc reste
// un pointeur vers la GED du chantier, jamais une copie). Cles alignees sur les
// noms de niveaux reels de Projet_Archi.ifc.
const DOCS_BY_NIVEAU = {
  "Base Mur soubassement": [
    { nom: "Plan fondations.pdf", lot: "Structure", type: "Plan", version: "Indice B" },
    { nom: "Note de calcul soubassement.pdf", lot: "Structure", type: "Note", version: "v1.2" }
  ],
  "Structure R+0": [
    { nom: "Plan structure R+0.pdf", lot: "Structure", type: "Plan", version: "Indice C" },
    { nom: "Plan CVC R+0.pdf", lot: "CVC", type: "Plan", version: "v2.0" },
    { nom: "PV réception gros œuvre.pdf", lot: "Structure", type: "PV", version: "v1.0" }
  ],
  "Structure R+1": [
    { nom: "Plan structure R+1.pdf", lot: "Structure", type: "Plan", version: "Indice C" },
    { nom: "Plan électricité R+1.pdf", lot: "Électricité", type: "Plan", version: "v1.4" }
  ],
  "Niveau R+2": [
    { nom: "Plan plomberie R+2.pdf", lot: "Plomberie", type: "Plan", version: "v1.1" },
    { nom: "Photo chantier R+2.jpg", lot: "Structure", type: "Photo", version: "—" }
  ],
  "Niveau R+3": [
    { nom: "Plan architecte R+3.pdf", lot: "Architecture", type: "Plan", version: "Indice A" }
  ],

  // Entrees temporaires (04/09), le temps de la bascule dev sur Projet_structure.ifc
  // (cf MAQUETTES). A retirer en meme temps que le retour sur Projet_Archi.ifc.
  "Niveau 0": [
    { nom: "Plan fondations.pdf", lot: "Structure", type: "Plan", version: "Indice B" }
  ],
  "Niveau 1": [
    { nom: "Plan structure Niveau 1.pdf", lot: "Structure", type: "Plan", version: "Indice C" },
    { nom: "Plan CVC Niveau 1.pdf", lot: "CVC", type: "Plan", version: "v2.0" }
  ],
  "Niveau 2": [
    { nom: "Plan structure Niveau 2.pdf", lot: "Structure", type: "Plan", version: "Indice C" }
  ]
};

// Docs par element IFC (guid -> docs) : pas encore peuple pour ce POC, un
// element clique n'a donc aujourd'hui jamais de doc associe (comportement
// attendu, cf CDC fonctionnalite 2).
const DOCS_BY_ELEMENT = {};

const viewer = new Viewer({
  canvasId: "viewerCanvas",
  transparent: false
});

viewer.scene.canvas.backgroundColor = [0.051, 0.055, 0.063];

const sectionPlanes = new SectionPlanesPlugin(viewer);

// Point de vue vise par "Recentrer" : par defaut la position initiale exacte
// de la camera (capturee une fois le premier cadrage termine, pas juste un
// fit generique qui peut donner un angle different), mais reoriente vers le
// point de vue d'un clash/fil de discussion des qu'on en consulte un
// (contexte porte par le meme bouton, deplace avec viewerWrap).
let recenterTarget = null;
let initialCameraState = null;

recenterBtn.addEventListener("click", () => {
  if (recenterTarget) {
    recenterTarget();
  } else if (initialCameraState) {
    viewer.cameraFlight.flyTo(initialCameraState);
  } else {
    viewer.cameraFlight.flyTo(viewer.scene);
  }
});

// Bascule temporaire du 04/09 : Projet_Archi.ifc (27 Mo) remplace par
// Projet_structure.ifc (2,6 Mo) pour accelerer les rechargements en dev.
// A remettre sur Projet_Archi.ifc avant tout envoi a Eric (niveaux reels
// "Base Mur soubassement"/R+0.../R+3, cf DOCS_BY_NIVEAU).
const MAQUETTES = [
  { id: "archi", src: "/models/Projet_structure.ifc", label: "Projet_structure.ifc (temp, léger)", color: "#c9d1d9", isReference: true },
  { id: "toit", src: "/models/Toit_Metal_2.ifc", label: "Toit_Metal_2.ifc", color: "#e8935c", colorize: [0.91, 0.58, 0.36] }
];

// Detections + clashs simules (pas de vrai moteur de detection geometrique
// pour ce POC). guid des paires structure/toit verifiees par script (AABB
// des 2 elements reellement en intersection, cf script Node jetable du
// 04/09, distance 0.000m mesuree), pas choisies au hasard : le "zoom sur la
// collision" doit cibler un vrai point de croisement, pas de l'espace vide.
// Statuts (nouveau/confirme/ecarte) : reflete le champ `statut` deja prevu
// dans le CDC (carte Detection de conflits), pas piloté par un vrai
// recalcul de diff entre versions pour cette demo.
const DETECTIONS = [
  { id: "structure-toiture", modeles: ["archi", "toit"], label: "Structure ↔ Toiture métallique" }
];

const CLASHES = [
  {
    id: "clash-1",
    detectionId: "structure-toiture",
    zone: "Poteau / poutre toiture, zone nord",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "Bloquant",
    statut: "nouveau",
    angle: 40,
    auteur: "Julie Martin (BE Structure)",
    tagged: ["Vous", "Karim Haddad (Charpente)"],
    entityIds: ["0w5mREx295pe_ygZN$MU87", "3SWCa1Nkb6shp6EZ_X2tqm"],
    discussion: [
      { auteur: "Julie Martin (BE Structure)", texte: "Le poteau intersecte la panne de toiture à cet endroit, à revoir avec le charpentier." },
      { auteur: "Karim Haddad (Charpente)", texte: "Confirmé, on décale la panne de 15 cm côté nord." }
    ]
  },
  {
    id: "clash-2",
    detectionId: "structure-toiture",
    zone: "Membrure / poteau, zone est",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "Moyen",
    statut: "confirme",
    angle: 170,
    auteur: "Karim Haddad (Charpente)",
    tagged: ["Vous"],
    entityIds: ["0w5mREx295pe_ygZN$MU9m", "3SWCa1Nkb6shp6EZ_X2trE"],
    discussion: [
      { auteur: "Julie Martin (BE Structure)", texte: "Détection remontée sur la membrure est, à côté du poteau de refend." },
      { auteur: "Karim Haddad (Charpente)", texte: "Léger recouvrement, sans impact structurel." },
      { auteur: "Julie Martin (BE Structure)", texte: "Confirmé de mon côté, la tolérance de pose reste dans la marge acceptée." },
      { auteur: "Sofia Benali (Coordination BIM)", texte: "Merci, je marque ce clash comme confirmé/traité dans le suivi." },
      { auteur: "Karim Haddad (Charpente)", texte: "Validé, pas d'action nécessaire." }
    ]
  },
  {
    id: "clash-3",
    detectionId: "structure-toiture",
    zone: "Poteau / poutre toiture, zone sud",
    disciplineA: "Structure",
    disciplineB: "Toiture métallique",
    severite: "Faible",
    statut: "ecarte",
    angle: 280,
    auteur: "Sofia Benali (Coordination BIM)",
    tagged: ["Vous"],
    entityIds: ["0w5mREx295pe_ygZN$MU9f", "3SWCa1Nkb6shp6EZ_X2trs"],
    discussion: []
  }
];

const STATUT_LABELS = { nouveau: "Nouveau", confirme: "Confirmé", ecarte: "Écarté" };

// Utilisateur courant simule (pas de vraie auth dans ce POC, cf MOC-chantier.md).
const CURRENT_USER = "Vous";

// Fils de discussion generaux (pas rattaches a un clash), meme mecanisme que
// la discussion Collision : fil de messages epingle a un point de la
// maquette, avec createur + personnes taggees (cibleIntervenantId/
// cibleGroupeId dans le CDC). disc-3 n'implique pas l'utilisateur courant,
// pour demontrer que le filtre par defaut l'exclut bien.
const DISCUSSIONS = [
  {
    id: "disc-1",
    zone: "Niveau 1, entrée principale",
    auteur: "Vous",
    tagged: ["Julie Martin (BE Structure)"],
    open: true,
    discussion: [
      { auteur: "Vous", texte: "Le passage de gaine ici est bien validé avec le BE ?" },
      { auteur: "Julie Martin (BE Structure)", texte: "Oui, validé la semaine dernière." }
    ]
  },
  {
    id: "disc-2",
    zone: "Niveau 2, local technique",
    auteur: "Sofia Benali (Coordination BIM)",
    tagged: ["Vous"],
    open: true,
    discussion: [
      { auteur: "Sofia Benali (Coordination BIM)", texte: "Peux-tu confirmer l'emplacement du tableau électrique sur ce niveau ?" }
    ]
  },
  {
    id: "disc-3",
    zone: "Toiture, zone sud",
    auteur: "Karim Haddad (Charpente)",
    tagged: ["Julie Martin (BE Structure)"],
    open: false,
    discussion: [
      { auteur: "Karim Haddad (Charpente)", texte: "Point réglé lors de la réunion de chantier." }
    ]
  }
];

// Pas de vrai annuaire de contacts pour ce POC : liste fixe des personnes
// deja utilisees dans les fils simules.
const KNOWN_PEOPLE = ["Julie Martin (BE Structure)", "Karim Haddad (Charpente)", "Sofia Benali (Coordination BIM)"];

// Un clash EST un fil de discussion (meme mecanisme), pas une copie : on
// garde les references reelles vers CLASHES/DISCUSSIONS pour qu'une reponse
// postee ici reste visible depuis la page Collision, et inversement.
function threadType(thread) {
  return CLASHES.includes(thread) ? "collision" : "discussion";
}
function threadIsOpen(thread) {
  return threadType(thread) === "collision" ? thread.statut !== "ecarte" : thread.open;
}

let discussionsTypeFilterValue = "tout";

function renderDiscussionsPage() {
  const threads = [...CLASHES, ...DISCUSSIONS]
    .filter((t) => t.auteur === CURRENT_USER || (t.tagged || []).includes(CURRENT_USER))
    .filter((t) => discussionsTypeFilterValue === "tout" || threadType(t) === discussionsTypeFilterValue);

  discussionsThreadsList.innerHTML = "";
  discussionsThreadsEmpty.hidden = threads.length > 0;

  threads.forEach((thread) => {
    const type = threadType(thread);

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thread-item";
    btn.addEventListener("click", () => openThreadDetail(thread));

    const main = document.createElement("div");
    main.className = "thread-main";
    const titre = document.createElement("span");
    titre.textContent = thread.zone;
    const meta = document.createElement("span");
    meta.className = "thread-meta";
    meta.textContent = "Créé par " + thread.auteur + " · " + thread.discussion.length + " message" + (thread.discussion.length > 1 ? "s" : "");
    main.append(titre, meta);

    const badge = document.createElement("span");
    badge.className = "thread-type-badge " + type;
    badge.textContent = type === "collision" ? "Collision" : "Discussion";

    btn.append(main, badge);
    li.appendChild(btn);
    discussionsThreadsList.appendChild(li);
  });
}

function setThreadVisualMode(mode, thread) {
  threadToggleBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));

  if (mode === "avant") {
    threadSnapshotPane.hidden = false;
    threadViewerPane.hidden = true;
    return;
  }

  threadSnapshotPane.hidden = true;
  threadViewerPane.hidden = false;
  threadViewerPane.appendChild(viewerWrap);
  newDiscussionBtn.hidden = true;
  coupeBtn.hidden = true;
  window.dispatchEvent(new Event("resize"));

  const goToThreadView = () => {
    if (threadType(thread) === "collision") {
      flyToClash(thread);
    } else if (thread.camera) {
      restoreViewerState(thread);
      viewer.cameraFlight.flyTo({ eye: thread.camera.eye, look: thread.camera.look, up: thread.camera.up, duration: 1 });
    } else {
      viewer.cameraFlight.flyTo(viewer.scene);
    }
  };
  goToThreadView();
  recenterTarget = goToThreadView;
}

threadToggleBtns.forEach((btn) => {
  btn.addEventListener("click", () => setThreadVisualMode(btn.dataset.mode, currentThread));
});

let currentThread = null;

function openThreadDetail(thread) {
  discussionsListPane.hidden = true;
  discussionsDetailPane.hidden = false;
  discussionsDetailTitle.textContent = thread.zone;
  currentThread = thread;
  setThreadVisualMode("apres", thread);

  // Hash specifique au fil (#discussions/<id>) pour qu'un rechargement de
  // page reste sur ce fil precis, pas juste sur l'onglet Discussions.
  if (history.replaceState) {
    history.replaceState(null, "", "#discussions/" + thread.id);
  }

  discussionsDetailMessages.innerHTML = "";
  thread.discussion.forEach((msg) => {
    const li = document.createElement("li");
    li.className = "discussion-message";
    const auteur = document.createElement("div");
    auteur.className = "discussion-auteur";
    auteur.textContent = msg.auteur;
    const texte = document.createElement("div");
    texte.className = "discussion-texte";
    texte.textContent = msg.texte;
    li.append(auteur, texte);
    discussionsDetailMessages.appendChild(li);
  });

  discussionsReplyForm.hidden = !threadIsOpen(thread);
  discussionsReplyInput.value = "";
  discussionsReplyForm.onsubmit = (e) => {
    e.preventDefault();
    const texte = discussionsReplyInput.value.trim();
    if (!texte) return;
    thread.discussion.push({ auteur: CURRENT_USER, texte });
    openThreadDetail(thread);
  };
}

discussionsFilterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    discussionsFilterBtns.forEach((b) => b.classList.toggle("active", b === btn));
    discussionsTypeFilterValue = btn.dataset.filter;
    renderDiscussionsPage();
  });
});

discussionsBackBtn.addEventListener("click", () => {
  discussionsDetailPane.hidden = true;
  discussionsListPane.hidden = false;
  recenterTarget = null;
  renderDiscussionsPage();
  if (history.replaceState) {
    history.replaceState(null, "", "#discussions");
  }
});

renderDiscussionsPage();

// Creation d'un nouveau fil depuis le Viewer, a partir du point de vue et de
// l'etat (niveaux/maquettes affiches) mis en place par l'utilisateur.
function captureViewerState() {
  return {
    camera: {
      eye: viewer.camera.eye.slice(),
      look: viewer.camera.look.slice(),
      up: viewer.camera.up.slice()
    },
    niveaux: niveauxState.map((n) => ({ name: n.name, checked: n.checked })),
    maquettes: MAQUETTES.map((m) => ({ id: m.id, visible: m.model ? m.model.visible : true })),
    coupe: activeCoupeId ? capturedCoupeState() : null
  };
}

function capturedCoupeState() {
  const sectionPlane = viewer.scene.sectionPlanes[activeCoupeId];
  return {
    pos: sectionPlane.pos.slice(),
    dir: sectionPlane.dir.slice(),
    active: sectionPlane.active
  };
}

function restoreViewerState(snapshot) {
  snapshot.niveaux.forEach(({ name, checked }) => {
    const niveau = niveauxState.find((n) => n.name === name);
    if (niveau) {
      niveau.checked = checked;
      niveau.checkboxEl.checked = checked;
      viewer.scene.setObjectsVisible(niveau.objectIds, checked);
    }
  });
  snapshot.maquettes.forEach(({ id, visible }) => {
    const maquette = MAQUETTES.find((m) => m.id === id);
    if (maquette && maquette.model) {
      maquette.model.visible = visible;
    }
  });
  renderMaquetteRows(maquettesList, MAQUETTES);

  destroyActiveCoupe();
  if (snapshot.coupe) {
    activeCoupeId = "coupe-surface";
    sectionPlanes.createSectionPlane({ id: activeCoupeId, pos: snapshot.coupe.pos, dir: snapshot.coupe.dir });
    viewer.scene.sectionPlanes[activeCoupeId].active = snapshot.coupe.active;
    sectionPlanes.showControl(activeCoupeId);
    coupeBtn.textContent = "Désactiver la coupe";
    coupeBtn.classList.add("active");
    coupeToggleVisibilityBtn.hidden = false;
    coupeToggleVisibilityBtn.textContent = "Masquer le plan";
    coupeInvertBtn.hidden = false;
  }
}

let pendingSnapshot = null;

newDiscussionRecipients.innerHTML = "";
KNOWN_PEOPLE.forEach((person) => {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = person;
  label.append(checkbox, document.createTextNode(person));
  newDiscussionRecipients.appendChild(label);
});

newDiscussionBtn.addEventListener("click", () => {
  pendingSnapshot = captureViewerState();
  newDiscussionForm.reset();
  newDiscussionModalOverlay.hidden = false;
});

function closeNewDiscussionModal() {
  newDiscussionModalOverlay.hidden = true;
  pendingSnapshot = null;
}
newDiscussionClose.addEventListener("click", closeNewDiscussionModal);
newDiscussionModalOverlay.addEventListener("click", (e) => {
  if (e.target === newDiscussionModalOverlay) closeNewDiscussionModal();
});

newDiscussionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!pendingSnapshot) return;

  const tagged = Array.from(newDiscussionRecipients.querySelectorAll("input:checked")).map((el) => el.value);

  const thread = {
    id: "disc-" + Date.now(),
    zone: newDiscussionZone.value.trim(),
    auteur: CURRENT_USER,
    tagged,
    open: true,
    camera: pendingSnapshot.camera,
    niveaux: pendingSnapshot.niveaux,
    maquettes: pendingSnapshot.maquettes,
    coupe: pendingSnapshot.coupe,
    discussion: [{ auteur: CURRENT_USER, texte: newDiscussionComment.value.trim() }]
  };
  DISCUSSIONS.push(thread);

  closeNewDiscussionModal();
  activateView("discussions");
  renderDiscussionsPage();
  openThreadDetail(thread);
});

// Lien direct vers un fil precis (#discussions/<id>), rechargement de page
// inclus : prime sur le simple onglet "discussions" du hash.
{
  const hashParts = initialHash.replace("#", "").split("/");
  if (hashParts[0] === "discussions" && hashParts[1]) {
    const targetThread = [...CLASHES, ...DISCUSSIONS].find((t) => t.id === hashParts[1]);
    if (targetThread) {
      openThreadDetail(targetThread);
    }
  }
}

function renderDetections() {
  detectionsList.innerHTML = "";
  if (DETECTIONS.length === 0) {
    detectionsEmpty.hidden = false;
    return;
  }
  detectionsEmpty.hidden = true;

  DETECTIONS.forEach((detection) => {
    const count = CLASHES.filter((c) => c.detectionId === detection.id).length;

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "detection-item";
    btn.addEventListener("click", () => openDetection(detection));

    const label = document.createElement("span");
    label.textContent = detection.label;

    const badge = document.createElement("span");
    badge.className = "detection-count";
    badge.textContent = count + (count > 1 ? " clashs" : " clash");

    btn.append(label, badge);
    li.appendChild(btn);
    detectionsList.appendChild(li);
  });
}

function openDetection(detection) {
  collisionRecap.hidden = true;
  collisionDetail.hidden = false;

  collisionViewerSlot.appendChild(viewerWrap);
  window.dispatchEvent(new Event("resize"));

  const subset = MAQUETTES.filter((m) => detection.modeles.includes(m.id));
  renderMaquetteRows(collisionMaquettesList, subset);

  renderCollisionsList(CLASHES.filter((c) => c.detectionId === detection.id));

  collisionDiscussion.hidden = true;
  discussionMessages.innerHTML = "";
  discussionReplyForm.hidden = true;
  currentClash = null;
  recenterTarget = null;
}

function buildCollisionItem(clash) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "collision-item";
  btn.addEventListener("click", () => {
    collisionsList.querySelectorAll(".collision-item").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    selectClash(clash);
  });

  const zone = document.createElement("span");
  zone.className = "collision-zone";
  zone.textContent = clash.zone;

  const meta = document.createElement("span");
  meta.className = "collision-meta";
  const badge = document.createElement("span");
  badge.className = "status-badge " + clash.statut;
  badge.textContent = STATUT_LABELS[clash.statut] || clash.statut;
  const disciplines = document.createElement("span");
  disciplines.textContent = clash.disciplineA + " / " + clash.disciplineB;
  meta.append(badge, disciplines);

  btn.append(zone, meta);
  li.appendChild(btn);
  return li;
}

function renderCollisionsList(clashes) {
  collisionsList.innerHTML = "";

  const actives = clashes.filter((c) => c.statut !== "ecarte");
  const ecartes = clashes.filter((c) => c.statut === "ecarte");

  actives.forEach((clash) => collisionsList.appendChild(buildCollisionItem(clash)));

  if (ecartes.length > 0) {
    const wrapperLi = document.createElement("li");
    wrapperLi.className = "collision-ecartes-wrapper";

    const details = document.createElement("details");
    details.className = "collision-ecartes";
    const summary = document.createElement("summary");
    summary.textContent = "Écartés (" + ecartes.length + ")";
    details.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "info-list";
    ecartes.forEach((clash) => list.appendChild(buildCollisionItem(clash)));
    details.appendChild(list);

    wrapperLi.appendChild(details);
    collisionsList.appendChild(wrapperLi);
  }
}

function flyToClash(clash) {
  // Centre sur le milieu des 2 elements impliques (approximation du point de
  // croisement, pas de vraie geometrie d'intersection calculee pour ce POC).
  const aabbs = clash.entityIds.map((id) => viewer.scene.getAABB([id]));
  const centers = aabbs.map((a) => [(a[0] + a[3]) / 2, (a[1] + a[4]) / 2, (a[2] + a[5]) / 2]);
  const center = [
    (centers[0][0] + centers[1][0]) / 2,
    (centers[0][1] + centers[1][1]) / 2,
    (centers[0][2] + centers[1][2]) / 2
  ];
  // Distance fixe et courte (unites du modele = metres) plutot qu'un calcul
  // base sur la taille des elements : un poteau/une poutre peut etre long,
  // mais on veut un plan rapproche sur le point de croisement, pas sur
  // l'element entier.
  const dist = 2.2;
  const rad = (clash.angle || 0) * Math.PI / 180;

  const eye = [
    center[0] + Math.sin(rad) * dist,
    center[1] + dist * 0.3,
    center[2] + Math.cos(rad) * dist
  ];

  viewer.cameraFlight.flyTo({ eye, look: center, up: [0, 1, 0], duration: 1.2 });
}

let currentClash = null;

function renderDiscussionMessages(clash) {
  discussionMessages.innerHTML = "";
  clash.discussion.forEach((msg) => {
    const li = document.createElement("li");
    li.className = "discussion-message";
    const auteur = document.createElement("div");
    auteur.className = "discussion-auteur";
    auteur.textContent = msg.auteur;
    const texte = document.createElement("div");
    texte.className = "discussion-texte";
    texte.textContent = msg.texte;
    li.append(auteur, texte);
    discussionMessages.appendChild(li);
  });
}

function selectClash(clash) {
  flyToClash(clash);
  currentClash = clash;
  recenterTarget = () => flyToClash(clash);

  const isOpen = clash.statut !== "ecarte";

  if (clash.discussion.length === 0 && !isOpen) {
    collisionDiscussion.hidden = true;
    return;
  }

  collisionDiscussion.hidden = false;
  renderDiscussionMessages(clash);

  discussionReplyForm.hidden = !isOpen;
  discussionReplyInput.value = "";
}

discussionReplyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const texte = discussionReplyInput.value.trim();
  if (!texte || !currentClash) return;

  currentClash.discussion.push({ auteur: "Vous", texte });
  renderDiscussionMessages(currentClash);
  discussionReplyInput.value = "";
});

collisionBackBtn.addEventListener("click", () => {
  collisionDetail.hidden = true;
  collisionRecap.hidden = false;
  viewViewer.insertBefore(viewerWrap, infoPanel);
  recenterTarget = null;
});

renderDetections();

const maquetteCountEls = new Map();

function renderMaquetteRows(targetList, maquettesSubset) {
  targetList.innerHTML = "";
  maquettesSubset.forEach((maquette) => {
    const li = document.createElement("li");
    li.className = "maquette-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = maquette.model ? maquette.model.visible : true;
    checkbox.addEventListener("change", () => {
      if (maquette.model) {
        maquette.model.visible = checkbox.checked;
      }
    });

    const swatch = document.createElement("span");
    swatch.className = "maquette-swatch";
    swatch.style.background = maquette.color;

    const name = document.createElement("span");
    name.className = "maquette-name";
    name.textContent = maquette.label;

    const count = document.createElement("span");
    count.className = "maquette-count";
    count.textContent = maquette.model ? maquette.model.numEntities.toLocaleString("fr-FR") + " éléments" : "…";

    li.append(checkbox, swatch, name, count);
    targetList.appendChild(li);

    if (!maquetteCountEls.has(maquette.id)) maquetteCountEls.set(maquette.id, []);
    maquetteCountEls.get(maquette.id).push(count);
  });
}

const niveauxState = [];

function renderNiveaux() {
  const archiMetaModel = viewer.metaScene.metaModels["archi"];
  if (!archiMetaModel) return;

  const storeyObjects = Object.values(viewer.metaScene.metaObjectsByType["IfcBuildingStorey"] || {})
    .filter((metaObject) => metaObject.metaModels.some((m) => m.id === "archi"));

  niveauxList.innerHTML = "";
  storeyObjects.forEach((metaObject) => {
    const objectIds = viewer.metaScene.getObjectIDsInSubtree(metaObject.id);
    const niveau = { name: metaObject.name, objectIds, checked: true, checkboxEl: null };
    niveauxState.push(niveau);

    const li = document.createElement("li");
    li.className = "niveau-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.addEventListener("change", () => {
      niveau.checked = checkbox.checked;
      viewer.scene.setObjectsVisible(niveau.objectIds, checkbox.checked);
    });
    niveau.checkboxEl = checkbox;

    const name = document.createElement("button");
    name.type = "button";
    name.className = "niveau-name";
    name.textContent = metaObject.name;
    name.addEventListener("click", () => soloNiveau(niveau));

    li.append(checkbox, name);
    niveauxList.appendChild(li);
  });
}

function soloNiveau(target) {
  niveauxState.forEach((niveau) => {
    const visible = niveau === target;
    niveau.checked = visible;
    niveau.checkboxEl.checked = visible;
    viewer.scene.setObjectsVisible(niveau.objectIds, visible);
  });

  showSelection([["Niveau", target.name]], DOCS_BY_NIVEAU[target.name] || []);
}

niveauxResetBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  niveauxState.forEach((niveau) => {
    niveau.checked = true;
    niveau.checkboxEl.checked = true;
    viewer.scene.setObjectsVisible(niveau.objectIds, true);
  });
});

function openDocModal(doc) {
  docModalName.textContent = doc.nom;
  docModalVersion.textContent = doc.version;
  docModalLot.textContent = doc.lot;
  docModalType.textContent = doc.type;
  docModalOverlay.hidden = false;
}

function closeDocModal() {
  docModalOverlay.hidden = true;
}

function closeAllModals() {
  downloadModalOverlay.hidden = true;
  docModalOverlay.hidden = true;
}

docModalClose.addEventListener("click", closeDocModal);
docModalOverlay.addEventListener("click", (e) => {
  if (e.target === docModalOverlay) closeDocModal();
});
docModalDownload.addEventListener("click", () => {
  downloadModalOverlay.hidden = false;
});
downloadModalOk.addEventListener("click", closeAllModals);

function labelForMaquette(maquetteId) {
  const maquette = MAQUETTES.find((m) => m.id === maquetteId);
  return maquette ? maquette.label : maquetteId;
}

function showSelection(rows, docs) {
  ficheContent.innerHTML = "";
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    ficheContent.append(dt, dd);
  });

  fichePlaceholder.hidden = true;
  ficheContent.hidden = false;

  ficheDocs.innerHTML = "";
  if (docs && docs.length > 0) {
    const docsByLot = new Map();
    docs.forEach((doc) => {
      if (!docsByLot.has(doc.lot)) docsByLot.set(doc.lot, []);
      docsByLot.get(doc.lot).push(doc);
    });

    docsByLot.forEach((lotDocs, lot) => {
      const lotTitle = document.createElement("p");
      lotTitle.className = "doc-lot";
      lotTitle.textContent = lot;
      ficheDocs.appendChild(lotTitle);

      lotDocs.forEach((doc) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "doc-item";
        btn.addEventListener("click", () => openDocModal(doc));

        const version = document.createElement("span");
        version.className = "doc-version";
        version.textContent = doc.version;

        const name = document.createElement("span");
        name.className = "doc-name";
        name.textContent = doc.nom;

        btn.append(version, name);
        ficheDocs.appendChild(btn);
      });
    });
  }
}

function showFiche(entity) {
  const metaObject = viewer.metaScene.metaObjects[entity.id];
  const rows = [
    ["Nom", metaObject ? metaObject.name : entity.id],
    ["Type IFC", metaObject ? metaObject.type : "—"],
    ["Maquette", metaObject && metaObject.metaModels[0] ? labelForMaquette(metaObject.metaModels[0].id) : "—"]
  ];
  showSelection(rows, DOCS_BY_ELEMENT[entity.id] || []);
}

function clearFiche() {
  fichePlaceholder.hidden = false;
  ficheContent.hidden = true;
  ficheContent.innerHTML = "";
  ficheDocs.innerHTML = "";
}

let selectedEntity = null;

// Coupe par surface : clic sur "Créer une coupe" arme le mode, le prochain
// clic sur la maquette pose le plan a cet endroit avec la normale de la
// surface visee (pas une position/orientation inventee). Un seul plan de
// coupe actif a la fois.
let coupePickingMode = false;
let activeCoupeId = null;

function setCoupePickingMode(on) {
  coupePickingMode = on;
  coupeBtn.classList.toggle("active", on);
  coupeBtn.textContent = on ? "Cliquez sur une surface..." : (activeCoupeId ? "Désactiver la coupe" : "Créer une coupe");
}

function destroyActiveCoupe() {
  if (activeCoupeId) {
    sectionPlanes.destroySectionPlane(activeCoupeId);
    sectionPlanes.hideControl();
    activeCoupeId = null;
  }
  coupeToggleVisibilityBtn.hidden = true;
  coupeToggleVisibilityBtn.textContent = "Masquer le plan";
  coupeInvertBtn.hidden = true;
  coupeBtn.textContent = "Créer une coupe";
  coupeBtn.classList.remove("active");
}

coupeInvertBtn.addEventListener("click", () => {
  if (!activeCoupeId) return;
  sectionPlanes.flipSectionPlanes();
});

coupeBtn.addEventListener("click", () => {
  if (activeCoupeId) {
    destroyActiveCoupe();
    return;
  }
  // Retire le 04/09 : reutiliser un element deja selectionne ne donnait pas
  // une position fiable. On repasse par un clic explicite sur la maquette
  // a chaque fois, dans tous les cas.
  setCoupePickingMode(!coupePickingMode);
});

coupeToggleVisibilityBtn.addEventListener("click", () => {
  if (!activeCoupeId) return;
  // Masque/affiche le widget 3D (rectangle + poignees de rotation/translation),
  // pas l'effet de coupe lui-meme : le batiment reste tranche dans les 2 cas,
  // ca sert juste a degager la vue une fois le plan bien positionne.
  if (sectionPlanes.getShownControl() === activeCoupeId) {
    sectionPlanes.hideControl();
    coupeToggleVisibilityBtn.textContent = "Afficher le plan";
  } else {
    sectionPlanes.showControl(activeCoupeId);
    coupeToggleVisibilityBtn.textContent = "Masquer le plan";
  }
});

// Position + orientation = donnees reelles du pick sur la surface visee
// (pickSurface), pas une approximation (ni entity.aabb, ni direction
// camera, qui donnaient tous les deux un plan errone, cf incidents du
// 04/09).
function createCoupeFromHit(hit) {
  activeCoupeId = "coupe-surface";
  // Sens inverse de la normale de surface par defaut (demande explicite du
  // 04/09) : coupe ce qui est devant la surface visee, pas derriere.
  const dir = [-hit.worldNormal[0], -hit.worldNormal[1], -hit.worldNormal[2]];
  sectionPlanes.createSectionPlane({ id: activeCoupeId, pos: hit.worldPos, dir });
  sectionPlanes.showControl(activeCoupeId);
  coupeBtn.textContent = "Désactiver la coupe";
  coupeBtn.classList.add("active");
  coupeToggleVisibilityBtn.hidden = false;
  coupeToggleVisibilityBtn.textContent = "Masquer le plan";
  coupeInvertBtn.hidden = false;
}

viewer.scene.input.on("mouseclicked", (canvasCoords) => {
  if (coupePickingMode) {
    const hit = viewer.scene.pick({ canvasPos: canvasCoords, pickSurface: true, pickSurfaceNormal: true });
    setCoupePickingMode(false);
    if (hit && hit.worldPos && hit.worldNormal) {
      createCoupeFromHit(hit);
    }
    return;
  }

  const hit = viewer.scene.pick({ canvasPos: canvasCoords });

  if (selectedEntity) {
    selectedEntity.selected = false;
    selectedEntity = null;
  }

  if (hit && hit.entity) {
    hit.entity.selected = true;
    selectedEntity = hit.entity;
    showFiche(hit.entity);
  } else {
    clearFiche();
  }
});

renderMaquetteRows(maquettesList, MAQUETTES);

const IfcAPI = new WebIFC.IfcAPI();
IfcAPI.SetWasmPath("/wasm/");

IfcAPI.Init().then(() => {
  const ifcLoader = new WebIFCLoaderPlugin(viewer, { WebIFC, IfcAPI });
  let loadedCount = 0;

  MAQUETTES.forEach((maquette) => {
    const model = ifcLoader.load({
      id: maquette.id,
      src: maquette.src,
      excludeTypes: ["IfcSpace"],
      edges: true
    });

    maquette.model = model;

    model.on("loaded", () => {
      if (maquette.colorize) {
        model.colorize = maquette.colorize;
      }

      const countText = model.numEntities.toLocaleString("fr-FR") + " éléments";
      (maquetteCountEls.get(maquette.id) || []).forEach((el) => { el.textContent = countText; });

      if (maquette.isReference) {
        renderNiveaux();
      }

      loadedCount++;
      if (loadedCount === MAQUETTES.length) {
        loadingOverlay.classList.add("hidden");
        viewer.cameraFlight.flyTo(viewer.scene, () => {
          initialCameraState = {
            eye: viewer.camera.eye.slice(),
            look: viewer.camera.look.slice(),
            up: viewer.camera.up.slice()
          };
        });
      }
    });

    model.on("error", (msg) => {
      loadingOverlay.textContent = "Erreur de chargement (" + maquette.label + ") : " + msg;
    });
  });
});

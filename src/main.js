import { Viewer, WebIFCLoaderPlugin } from "@xeokit/xeokit-sdk";
import * as WebIFC from "web-ifc";

const loadingOverlay = document.getElementById("loadingOverlay");

const viewer = new Viewer({
  canvasId: "viewerCanvas",
  transparent: false
});

viewer.scene.canvas.backgroundColor = [0.106, 0.118, 0.133];

const IfcAPI = new WebIFC.IfcAPI();
IfcAPI.SetWasmPath("/wasm/");

IfcAPI.Init().then(() => {
  const ifcLoader = new WebIFCLoaderPlugin(viewer, {
    WebIFC,
    IfcAPI
  });

  const model = ifcLoader.load({
    id: "projetArchi",
    src: "/models/Projet_Archi.ifc",
    excludeTypes: ["IfcSpace"],
    edges: true
  });

  model.on("loaded", () => {
    loadingOverlay.classList.add("hidden");
    viewer.cameraFlight.flyTo(model);
  });

  model.on("error", (msg) => {
    loadingOverlay.textContent = "Erreur de chargement : " + msg;
  });
});

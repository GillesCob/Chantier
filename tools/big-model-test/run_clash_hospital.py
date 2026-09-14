import json
import logging
import os
import time

from ifcclash.ifcclash import Clasher, ClashSettings

BASE = os.path.dirname(os.path.abspath(__file__))

logging.basicConfig(level=logging.INFO)

settings = ClashSettings()
settings.logger = logging.getLogger("ifcclash")
settings.output = os.path.join(BASE, "clashes-hospital.json")

clasher = Clasher(settings)
clasher.clash_sets = [
    {
        "name": "Architecture vs Mechanical (WestRiverSide Hospital)",
        "a": [{"file": os.path.join(BASE, "WestRiverSide-Architecture-IFC4.ifc")}],
        "b": [{"file": os.path.join(BASE, "WestRiverSide-Mechanical-IFC4.ifc")}],
        "mode": "collision",
        "allow_touching": False,
    }
]

start = time.time()

clasher.clash()
clasher.export()
elapsed = time.time() - start

with open(settings.output, encoding="utf-8") as f:
    data = json.load(f)

for clash_set in data:
    print(f"\n=== {clash_set['name']} : {len(clash_set['clashes'])} clash(es) en {elapsed:.1f}s ===")
    for i, (key, clash) in enumerate(clash_set["clashes"].items()):
        if i >= 20:
            print(f"... et {len(clash_set['clashes']) - 20} de plus")
            break
        print(
            f"- {clash['a_ifc_class']} ({clash['a_name']}) x "
            f"{clash['b_ifc_class']} ({clash['b_name']}) "
            f"distance={clash['distance']:.4f}"
        )

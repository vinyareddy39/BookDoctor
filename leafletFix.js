
import fs from "fs";

const file = "client/src/App.jsx";
let code = fs.readFileSync(file, "utf8");

if (!code.includes("leaflet/dist/images/marker-icon.png")) {
  const injection = `
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;
`;

  code = code.replace(`import { Toaster } from "react-hot-toast";`, `import { Toaster } from "react-hot-toast";${injection}`);
  fs.writeFileSync(file, code);
}



import fs from "fs";
const file = "client/src/pages/EmergencyTracking.jsx";
let code = fs.readFileSync(file, "utf8");

const oldStr = `<div>
                    {!isUberMode && <><span className="text-xs text-slate-400 font-bold uppercase block">Ambulance Location</span>
                      <span className="text-sm font-mono bg-amber-50 px-2 py-1 rounded text-amber-700">
                        {ambulance?.lat?.toFixed(5) || "--"}, {ambulance?.lng?.toFixed(5) || "--"}
                      </span>
                    </div></>}`;

const newStr = `{!isUberMode && (
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase block">Ambulance Location</span>
                      <span className="text-sm font-mono bg-amber-50 px-2 py-1 rounded text-amber-700">
                        {ambulance?.lat?.toFixed(5) || "--"}, {ambulance?.lng?.toFixed(5) || "--"}
                      </span>
                    </div>
                  )}`;

code = code.replace(oldStr, newStr);
fs.writeFileSync(file, code);


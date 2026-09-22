
import fs from "fs";

const file = "client/src/components/common/SOSButton.jsx";
let code = fs.readFileSync(file, "utf8");

const catchBlock = `        } catch (err) {
          toast.dismiss(loadingToast);
          toast.error(err.response?.data?.message || "Failed to trigger SOS. No responders found.");`;

const fallbackLogic = `        } catch (err) {
          toast.dismiss(loadingToast);
          toast.error(err.response?.data?.message || "Failed to trigger SOS. No responders found.");
          
          // CLIENT-SIDE UBER FALLBACK
          // If the backend completely fails or returns 404, forcefully redirect to Uber
          toast.loading("Redirecting to Uber as a fallback...", { duration: 3000 });
          setTimeout(() => {
            const { latitude, longitude } = position.coords;
            // Fallback destination (AIIMS Bibinagar / nearest demo ER) since backend failed
            const hospLat = 17.4721;
            const hospLng = 78.7993;
            const hospName = "AIIMS Bibinagar Emergency";
            
            const uberUrl = \`https://m.uber.com/ul/?action=setPickup&pickup[latitude]=\${latitude}&pickup[longitude]=\${longitude}&dropoff[latitude]=\${hospLat}&dropoff[longitude]=\${hospLng}&dropoff[nickname]=\${encodeURIComponent(hospName)}\`;
            
            window.location.href = uberUrl;
          }, 2000);`;

code = code.replace(catchBlock, fallbackLogic);
fs.writeFileSync(file, code);


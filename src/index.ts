import { makeApp } from "./app";
import { getConnectionUrls, getAllLocalIps } from "./utils/networkUtils";

const port = Number(process.env.PORT ?? 4001);
const app = makeApp();

app.listen(port, "0.0.0.0", () => {
  const urls = getConnectionUrls(port);
  const allIps = getAllLocalIps();
  
  console.log("\n✓ Server started");
  console.log(`  Local:   ${urls.localhost}`);
  if (urls.network) {
    console.log(`  Network: ${urls.network}`);
  }
  
  if (allIps.length > 0) {
    console.log("\n  Available network interfaces:");
    for (const ip of allIps) {
      console.log(`    ${ip.interface} (${ip.family}): http://${ip.address}:${port}`);
    }
  }
  
  console.log("\n  Diagnostic endpoint: http://localhost:4001/api/network-info");
  console.log("");
});

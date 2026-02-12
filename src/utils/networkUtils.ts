import os from "os";

/**
 * Get all local IP addresses of this machine
 * Returns both IPv4 and useful interface names
 */
export function getAllLocalIps(): Array<{ interface: string; address: string; family: string }> {
  const interfaces = os.networkInterfaces();
  const addresses: Array<{ interface: string; address: string; family: string }> = [];

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      // Skip internal addresses
      if (addr.internal) continue;
      
      addresses.push({
        interface: name,
        address: addr.address,
        family: addr.family,
      });
    }
  }

  return addresses;
}

/**
 * Get the first local IPv4 address of this machine
 * Useful for connecting from other devices
 */
export function getLocalIp(): string | null {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const addr of iface) {
      // Skip internal and non-IPv4 addresses
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }

  return null;
}

/**
 * Get connection URLs for both localhost and local network
 */
export function getConnectionUrls(port: number): { localhost: string; network: string | null } {
  const localIp = getLocalIp();
  return {
    localhost: `http://localhost:${port}`,
    network: localIp ? `http://${localIp}:${port}` : null,
  };
}

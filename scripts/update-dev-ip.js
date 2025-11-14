#!/usr/bin/env node

/**
 * Auto-detect Mac's local IP address and update .env.local
 * This runs automatically before starting the dev server
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ENV_FILE = path.join(__dirname, '..', '.env.local');

/**
 * Get Mac's local IP address (non-localhost)
 */
function getLocalIP() {
  try {
    const interfaces = os.networkInterfaces();

    // Look for active Wi-Fi or Ethernet connection
    for (const name of Object.keys(interfaces)) {
      if (name.toLowerCase().includes('en') || name.toLowerCase().includes('wi-fi')) {
        for (const iface of interfaces[name]) {
          // Skip internal (127.0.0.1) and IPv6 addresses
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error detecting IP:', error.message);
    return null;
  }
}

/**
 * Ensure .env.local points at a reachable development server
 * Uses LAN IP when available so physical devices just work.
 */
function ensureReachableServer() {
  // Check if .env.local exists
  if (!fs.existsSync(ENV_FILE)) {
    console.log('⚠️  .env.local not found');
    console.log('💡 Run: cp .env.example .env.local');
    return;
  }

  // Read current .env.local
  let envContent = fs.readFileSync(ENV_FILE, 'utf8');

  // Extract current server URL
  const lines = envContent.split('\n');
  const serverLineIndex = lines.findIndex(line =>
    line.startsWith('EXPO_PUBLIC_DEV_JELLYFIN_SERVER=http')
  );

  const detectedIp = getLocalIP();
  const targetHost = detectedIp || 'localhost';
  const targetServer = `http://${targetHost}:8096`;
  const currentServer = serverLineIndex >= 0
    ? lines[serverLineIndex].split('=')[1].trim()
    : '';

  // Check if already set correctly
  if (currentServer === targetServer) {
    console.log('✅ Development server: localhost:8096');
    return;
  }

  // Update to localhost
  if (serverLineIndex >= 0) {
    lines[serverLineIndex] = `EXPO_PUBLIC_DEV_JELLYFIN_SERVER=${targetServer}`;
    envContent = lines.join('\n');
  } else {
    // Server line doesn't exist, add it
    envContent += `\nEXPO_PUBLIC_DEV_JELLYFIN_SERVER=${targetServer}\n`;
  }

  // Write updated file
  fs.writeFileSync(ENV_FILE, envContent, 'utf8');

  console.log(`✅ Development server set to ${targetServer}`);
  if (!detectedIp) {
    console.log('   (LAN IP not detected, defaulting to localhost)');
  }
  if (currentServer && currentServer !== targetServer) {
    console.log('   (previous:', currentServer + ')');
  }
}

// Run the check
console.log('\n🔄 Configuring development server...\n');
ensureReachableServer();
console.log('💡 Physical devices can now use the detected LAN IP without manual edits.\n');

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Non-standard port to avoid conflicts when running multiple Metro projects simultaneously.
// RCT_METRO_PORT env var is set in ios/.xcode.env.local (via plugins/withMetroPort.js)
// so the native build picks this up too.
config.server = {
  ...config.server,
  port: 8031,
};

module.exports = config;

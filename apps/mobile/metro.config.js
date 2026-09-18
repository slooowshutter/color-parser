const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The parser lives outside this standalone Expo package — keep native dependency resolution local
config.watchFolders = [path.resolve(__dirname, '../../lib')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;

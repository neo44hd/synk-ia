// node-startup.cjs — Hook de carga para inyectar dotenv antes de ESM imports
// Node --require carga este archivo ANTES de cualquier módulo
// Equivale a: node --require dotenv/config ...
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });
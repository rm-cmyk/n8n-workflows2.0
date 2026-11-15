/* Lädt alle Spielmodule in Node (ohne Browser) */
const path = require('path');
const files = ['core', 'gen', 'cal', 'team', 'econ', 'match', 'transfer', 'events', 'euro', 'game', 'world', 'data'];
for (const f of files) require(path.join(__dirname, '..', 'js', f + '.js'));
module.exports = globalThis.FM;

const path = require('path');
const express = require('express');
const app = express();

app.use(express.json());

// <<< EINZIGE Freigabe für statische Dateien >>>
const buildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(buildPath));
//
// // Falls du React Router verwendest: Fallback erst NACH den API-Routen
// app.get('*', (req, res) => {
//     res.sendFile(path.join(buildPath, 'index.html'));
// });

app.get('/*splat', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

// --- API-Routen ---
app.post('/api/write', (req, res) => res.sendStatus(201));
app.get('/api/read',  (req, res) => res.json({ data: 'result' }));

app.listen(10500, () => console.log('Backend läuft auf :10500'));

// CommonJS wrapper for mounting Carrot Roll in main-server.js
// This file allows main-server.js to require and mount the Carrot Roll Express app

const path = require('path');
const fs = require('fs');

const distAppPath = path.join(__dirname, 'dist', 'server', 'app.cjs');
const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(distAppPath);

let carrotrollApp = null;

if (isProduction && fs.existsSync(distAppPath)) {
  try {
    const appModule = require(distAppPath);
    carrotrollApp = appModule.default || appModule;
    // Express app is a function (req, res, next); do not call it, use as-is for mounting
  } catch (error) {
    console.error('Error loading built Carrot Roll app:', error);
  }
} else {
  // Fallback: minimal Express app that serves static only (no API)
  // For full API + static, run "npm run build" so dist/server/app.cjs exists
  const express = require('express');
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const staticPath = path.join(__dirname, 'dist', 'public');
  const clientPath = path.join(__dirname, 'client');

  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath, { redirect: false }));
    app.get('*', (req, res) => {
      const ext = path.extname(req.path);
      if (ext && ext !== '.html') {
        const filePath = path.join(staticPath, req.path);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  } else {
    console.warn('⚠️  Carrot Roll: dist/public not found. Serving from client directory.');
    console.warn('   For full API + static, run: npm run build');
    app.use(express.static(clientPath, { redirect: false }));
    app.get('*', (req, res) => {
      const ext = path.extname(req.path);
      if (ext && ext !== '.html') {
        const filePath = path.join(clientPath, req.path);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  }

  carrotrollApp = app;
}

module.exports = carrotrollApp || require('express')();

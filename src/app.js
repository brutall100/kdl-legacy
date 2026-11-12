'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config');
const { icon } = require('./icons');
const { thumbName } = require('./uploads');
const { escapeHtml } = require('./helpers');

const ASSET_VERSION = Date.now().toString(36);

function createApp() {
  const app = express();

  app.set('trust proxy', config.TRUST_PROXY);
  app.set('view engine', 'ejs');
  app.set('views', path.join(config.ROOT, 'views'));
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ['https://www.google.com', 'https://maps.google.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      // HSTS įjungiamas tik produkcijoje (už HTTPS proxy).
      strictTransportSecurity: config.IS_PROD ? { maxAge: 15552000 } : false,
    })
  );
  app.use(compression());

  // Bendros šablonų funkcijos
  app.locals.icon = icon;
  app.locals.asset = (p) => `${p}?v=${ASSET_VERSION}`;
  app.locals.img = (name) => (name ? `/uploads/${name}` : '');
  app.locals.thumb = (name) => (name ? `/uploads/${thumbName(name)}` : '');
  // Vektorinis KD Legacy logotipas (simbolis iš views/partials/logo-sprite.ejs)
  app.locals.logoSvg = (cls = '', label = '') =>
    `<svg class="kd-logo ${cls}" viewBox="0 0 2560 1215" ${
      label ? `role="img" aria-label="${escapeHtml(label)}"` : 'aria-hidden="true"'
    } focusable="false"><use href="#kd-logo" width="2560" height="1215"/></svg>`;
  app.locals.dancerSvg = (cls = '') =>
    `<svg class="kd-dancer ${cls}" viewBox="0 0 1220 1220" aria-hidden="true" focusable="false"><use href="#kd-dancer" width="1220" height="1220"/></svg>`;

  app.use(
    express.static(path.join(config.ROOT, 'public'), {
      maxAge: config.IS_PROD ? '30d' : 0,
      index: false,
    })
  );
  app.use(
    '/uploads',
    express.static(config.UPLOAD_DIR, {
      maxAge: '365d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
      fallthrough: false,
    }),
    // express.static su fallthrough:false klaidas perduoda toliau – grąžinam paprastą 404
    (err, req, res, next) => {
      res.status(404).type('text').send('Not found');
    }
  );

  app.use('/admin', require('./routes/admin'));
  app.use(require('./routes/public'));

  return app;
}

module.exports = { createApp };

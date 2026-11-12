'use strict';

const config = require('./config');

let transport = null;

function getTransport() {
  if (!config.SMTP.host) return null;
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      host: config.SMTP.host,
      port: config.SMTP.port,
      secure: config.SMTP.secure,
      auth: config.SMTP.user ? { user: config.SMTP.user, pass: config.SMTP.pass } : undefined,
    });
  }
  return transport;
}

/** Išsiunčia pranešimą apie naują registraciją (jei sukonfigūruotas SMTP). */
async function notifyInquiry(inquiry, settings) {
  const t = getTransport();
  const to = (settings.notify_email || settings.email || '').trim();
  if (!t || !to) return false;
  const lines = [
    `Vardas: ${inquiry.name}`,
    `Telefonas: ${inquiry.phone || '—'}`,
    `El. paštas: ${inquiry.email || '—'}`,
    `Amžius: ${inquiry.age || '—'}`,
    `Stilius: ${inquiry.class_name || '—'}`,
    `Kalba: ${inquiry.lang}`,
    '',
    inquiry.message || '(be žinutės)',
    '',
    '— Išsiųsta iš svetainės registracijos formos',
  ];
  await t.sendMail({
    from: config.SMTP.from || config.SMTP.user,
    to,
    replyTo: inquiry.email || undefined,
    subject: `Nauja registracija: ${inquiry.name}`,
    text: lines.join('\n'),
  });
  return true;
}

module.exports = { notifyInquiry };

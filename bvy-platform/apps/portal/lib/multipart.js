'use strict';

/**
 * Lecture d'un envoi multipart/form-data (téléversement d'un fichier), sans dépendance.
 * Le corps entier est gardé en mémoire : la taille est bornée par l'appelant (20 Mo + marge).
 */

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) { req.resume(); return reject(Object.assign(new Error('taille'), { status: 413 })); }
    const chunks = []; let size = 0; let done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; req.resume(); reject(Object.assign(new Error('taille'), { status: 413 })); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

function boundaryOf(contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType || ''));
  return m ? (m[1] || m[2]).trim() : null;
}

// → { fields: { nom: valeur }, files: [{ field, filename, contentType, data }] }
function parseMultipart(body, boundary) {
  const fields = {};
  const files = [];
  const delim = Buffer.from(`--${boundary}`);
  let pos = body.indexOf(delim);
  if (pos !== 0) throw Object.assign(new Error('multipart'), { status: 400 });
  for (let parts = 0; parts < 20; parts++) {
    pos += delim.length;
    if (body.subarray(pos, pos + 2).toString() === '--') return { fields, files };
    if (body.subarray(pos, pos + 2).toString() !== '\r\n') break;
    pos += 2;
    const headEnd = body.indexOf('\r\n\r\n', pos);
    if (headEnd < 0) break;
    const headers = body.subarray(pos, headEnd).toString('utf8');
    const next = body.indexOf(Buffer.concat([Buffer.from('\r\n'), delim]), headEnd + 4);
    if (next < 0) break;
    const data = body.subarray(headEnd + 4, next);
    const disp = /content-disposition:\s*form-data;([^\r\n]*)/i.exec(headers);
    if (disp) {
      const name = (/\bname="([^"]*)"/i.exec(disp[1]) || [])[1];
      const filename = (/\bfilename="([^"]*)"/i.exec(disp[1]) || [])[1];
      const type = (/content-type:\s*([^\r\n]+)/i.exec(headers) || [])[1];
      if (name && filename !== undefined) {
        if (filename) files.push({ field: name, filename, contentType: type || '', data: Buffer.from(data) });
      } else if (name) {
        fields[name] = data.toString('utf8');
      }
    }
    pos = next + 2;
  }
  throw Object.assign(new Error('multipart'), { status: 400 });
}

module.exports = { readBody, boundaryOf, parseMultipart };

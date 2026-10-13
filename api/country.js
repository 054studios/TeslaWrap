// Het land van de bezoeker, uit de IP-herkenning van Vercel. Alleen de landcode gaat terug; er wordt niets opgeslagen.
module.exports = (req, res) => {
  const code = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ country: /^[A-Z]{2}$/.test(code) ? code : null }));
};

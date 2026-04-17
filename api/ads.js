import {
  createAd,
  getRandomAd,
  handleClick
} from "../adController.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CDN Script
  if (url.pathname === "/applyAds.js") {
    const ad = await getRandomAd();

    const script = `
      (function(){
        fetch('/api/ad')
        .then(res => res.json())
        .then(ad => {
          if(!ad) return;

          const a = document.createElement('a');
          a.href = '/api/click?key=' + ad.key;
          a.target = '_blank';
          a.innerText = "🔥 Sponsored Ad";
          a.style = "position:fixed;bottom:10px;right:10px;background:#000;color:#fff;padding:10px;z-index:9999";

          document.body.appendChild(a);
        });
      })();
    `;

    res.setHeader("content-type", "application/javascript");
    return res.send(script);
  }

  // Create Ad
  if (url.pathname === "/api/create" && req.method === "POST") {
    const body = req.body || {};
    const ad = await createAd(body);
    return res.json(ad);
  }

  // Get Random Ad
  if (url.pathname === "/api/ad") {
    const ad = await getRandomAd();
    return res.json(ad);
  }

  // Click
  if (url.pathname === "/api/click") {
    const result = await handleClick({
      query: Object.fromEntries(url.searchParams),
      headers: req.headers
    });

    if (result.redirect) {
      return res.redirect(result.redirect);
    }

    return res.status(result.status).send(result.body);
  }

  res.status(404).send("Not found");
}

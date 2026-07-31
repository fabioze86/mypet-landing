// Service worker minimo: existe apenas para satisfazer o criterio de
// instalabilidade do Chrome. Nao intercepta nem cacheia nenhuma resposta -
// toda requisicao segue direto para a rede.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intencionalmente vazio: nao intercepta a resposta, so a rede responde.
});

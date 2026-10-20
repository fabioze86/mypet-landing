// Navegação com recarga completa. Separada para os testes poderem trocar
// (jsdom não deixa sobrescrever window.location).
export function goTo(url: string): void {
  window.location.assign(url);
}

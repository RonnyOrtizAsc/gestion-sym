// Perrito guía (chihuahua): aparece, señala dónde tocar y da la indicación en un globito.
// Uso: guia.mostrar("Texto", { objetivo: elemento, boton: { texto, alTocar }, tocarParaSeguir: fn }) · guia.ocultar()

const PERRO = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity=".12"/>
  <path d="M40 112c-2-18 4-34 20-34s22 16 20 34z" fill="#d9a066"/>
  <path d="M52 112c0-10 3-18 8-18s8 8 8 18z" fill="#f6ead8"/>
  <path d="M44 84h32l-3 6H47z" fill="#d23b3b"/><circle cx="60" cy="91" r="3" fill="#f2c230"/>
  <path d="M26 20l18 30-26 6z" fill="#d9a066"/><path d="M29 28l11 20-15 4z" fill="#f2b8b0"/>
  <path d="M94 20l-18 30 26 6z" fill="#d9a066"/><path d="M91 28l-11 20 15 4z" fill="#f2b8b0"/>
  <ellipse cx="60" cy="58" rx="30" ry="26" fill="#d9a066"/>
  <path d="M60 38c-6 0-9 6-9 14 0 6 4 8 9 8s9-2 9-8c0-8-3-14-9-14z" fill="#f6ead8"/>
  <ellipse cx="60" cy="70" rx="14" ry="10" fill="#f6ead8"/>
  <ellipse cx="47" cy="56" rx="7.5" ry="8.5" fill="#2a1d14"/><ellipse cx="73" cy="56" rx="7.5" ry="8.5" fill="#2a1d14"/>
  <circle cx="49.5" cy="53" r="2.6" fill="#fff"/><circle cx="75.5" cy="53" r="2.6" fill="#fff"/>
  <ellipse cx="60" cy="66" rx="4.5" ry="3.2" fill="#2a1d14"/>
  <path d="M55 72q5 4 10 0" stroke="#2a1d14" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M58 74q2 6 4 0" fill="#e86f7a"/>
</svg>`;

let raiz = null, foco = null, quitarToque = null;
function limpiar() {
  foco?.classList.remove("guia-foco"); foco = null;
  quitarToque?.(); quitarToque = null;
}
export function ocultar() { limpiar(); if (raiz) { raiz.classList.add("sale"); const r = raiz; raiz = null; setTimeout(() => r.remove(), 250); } }

export function mostrar(texto, { objetivo = null, boton = null, tocarParaSeguir = null, cerrar = null } = {}) {
  limpiar();
  if (!raiz) { raiz = document.createElement("div"); raiz.className = "perrito"; raiz.setAttribute("role", "status"); document.body.appendChild(raiz); }
  raiz.classList.remove("sale", "arriba", "abajo");
  raiz.innerHTML = `<div class="perrito-globo"><p>${texto}</p>${boton ? `<button class="btn small primary" data-perro-ok>${boton.texto}</button>` : ""}
      ${tocarParaSeguir ? `<small>Toca la pantalla para seguir</small>` : ""}</div>
    <div class="perrito-cuerpo">${PERRO}</div><button class="perrito-x" aria-label="Cerrar ayuda">×</button>`;
  raiz.querySelector(".perrito-x").onclick = (e) => { e.stopPropagation(); ocultar(); cerrar?.(); };
  if (boton) raiz.querySelector("[data-perro-ok]").onclick = (e) => { e.stopPropagation(); boton.alTocar(); };
  // vuelve a aparecer (animación de "salir de la nada")
  raiz.classList.remove("entra"); void raiz.offsetWidth; raiz.classList.add("entra");
  if (objetivo) {
    foco = objetivo; objetivo.classList.add("guia-foco");
    objetivo.scrollIntoView({ behavior: "smooth", block: "center" });
    // cuando termina de bajar: el perrito se pone del lado donde hay espacio y su globito apunta al objetivo
    setTimeout(() => { if (!raiz || foco !== objetivo) return; const r = objetivo.getBoundingClientRect();
      raiz.classList.add(r.top + r.height / 2 > innerHeight / 2 ? "arriba" : "abajo"); }, 450);
  }
  if (tocarParaSeguir) {
    const fn = (e) => { if (raiz?.contains(e.target) && e.target.closest(".perrito-x")) return; tocarParaSeguir(); };
    setTimeout(() => { document.addEventListener("click", fn, { once: true, capture: true }); quitarToque = () => document.removeEventListener("click", fn, { capture: true }); }, 50);
  }
}
export const activo = () => !!raiz;

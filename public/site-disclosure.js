const siteDisclosureText = "Parchar te ayuda a descubrir sitios. Su aparición en la app no implica una recomendación ni una certificación de seguridad o calidad. Los servicios, cuando se ofrecen, son prestados directamente por cada establecimiento.";

window.renderSiteDisclosure = () => `
  <div class="site-disclosure">
    <p>${siteDisclosureText}</p>
    <button type="button" class="site-disclosure-link" data-site-disclosure-open>Sobre la información de los sitios</button>
  </div>
`;

let siteDisclosurePreviousFocus = null;

function closeSiteDisclosure() {
  const modal = document.querySelector("#site-disclosure-modal");
  if (!modal) return;
  modal.hidden = true;
  siteDisclosurePreviousFocus?.focus();
  siteDisclosurePreviousFocus = null;
}

function openSiteDisclosure() {
  let modal = document.querySelector("#site-disclosure-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "site-disclosure-modal";
    modal.className = "ad-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="ad-modal-card site-disclosure-modal-card" role="dialog" aria-modal="true" aria-labelledby="site-disclosure-title">
        <div class="ad-modal-head">
          <h2 id="site-disclosure-title">Sobre la información de los sitios</h2>
          <button type="button" class="icon-ghost ad-close" aria-label="Cerrar" data-site-disclosure-close>&times;</button>
        </div>
        <p>Parchar funciona como un buscador de sitios y no tiene vínculo comercial con los establecimientos publicados. Cuando contactas o contratas un servicio, lo haces directamente con el establecimiento.</p>
        <p>La información puede cambiar. Confirma con el establecimiento sus horarios, ubicación, precios y condiciones antes de visitarlo o contratar.</p>
        <p>Cuando Parchar indique una verificación, esta comprende únicamente los aspectos expresamente señalados. La revisión de documentos o ubicación no certifica la seguridad, calidad del servicio ni las condiciones actuales del lugar.</p>
        <p>Esta aclaración no limita los derechos de los usuarios ni las obligaciones legales que correspondan a Parchar.</p>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-site-disclosure-close]")) {
        closeSiteDisclosure();
      }
    });
  }
  siteDisclosurePreviousFocus = document.activeElement;
  modal.hidden = false;
  modal.querySelector("[data-site-disclosure-close]").focus();
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-site-disclosure-open]")) openSiteDisclosure();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.querySelector("#site-disclosure-modal")?.hidden) {
    closeSiteDisclosure();
  }
});

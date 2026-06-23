const adBanner = document.querySelector(".ad-banner");
const AD_REFRESH_MS = 18000;
let adRefreshTimer = null;

function readStoredClient() {
  try {
    const raw = localStorage.getItem(
      "parchar_client_session"
    );
    const parsed = JSON.parse(raw || "{}");
    return parsed.client || null;
  } catch {
    return null;
  }
}

function setAdFeedback(
  element,
  message,
  isError = false
) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle(
    "error",
    isError
  );
  element.classList.toggle(
    "success",
    Boolean(message) && !isError
  );
}

function ensureAdModal() {
  let modal = document.querySelector(
    "#ad-request-modal"
  );

  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = "ad-request-modal";
  modal.className = "ad-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="ad-modal-card" role="dialog" aria-modal="true" aria-labelledby="ad-request-title">
      <div class="ad-modal-head">
        <h2 id="ad-request-title">Solicitar pauta</h2>
        <button type="button" class="icon-ghost ad-close" aria-label="Cerrar" data-ad-close>&times;</button>
      </div>

      <p>
        Dejanos tus datos y el equipo de Parchar te contactara para activar publicidad.
      </p>

      <section class="ad-spec-card" aria-label="Formato recomendado para pauta">
        <strong>Formato recomendado del anuncio</strong>
        <p>
          Envia imagen o video horizontal tipo banner, no vertical. Medida sugerida: 1600 x 600 px o 1920 x 720 px. Video MP4 de 6 a 12 segundos, maximo 15 MB, sin audio importante.
        </p>
        <p>
          Mantén producto, logo y texto principal en el centro. Evita letras pequenas y bordes con informacion, porque el banner se adapta a celular y PC.
        </p>
      </section>

      <form id="ad-request-form" class="form-grid">
        <label>
          Nombre
          <input name="fullName" required />
        </label>

        <label>
          Negocio o marca
          <input name="businessName" required />
        </label>

        <label>
          Telefono
          <input name="phone" />
        </label>

        <label>
          Correo
          <input name="email" type="email" />
        </label>

        <label class="full-row">
          Mensaje
          <textarea name="message" rows="3" required>Quiero recibir informacion para pautar publicidad en Parchar.</textarea>
        </label>

        <button type="submit" class="submit-btn">Enviar solicitud</button>
        <button type="button" class="ghost-btn" data-ad-close>Cerrar</button>
      </form>

      <p id="ad-request-feedback" class="feedback"></p>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (
      event.target === modal ||
      event.target.closest("[data-ad-close]")
    ) {
      modal.hidden = true;
    }
  });

  const form = modal.querySelector(
    "#ad-request-form"
  );
  const feedback = modal.querySelector(
    "#ad-request-feedback"
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAdFeedback(
      feedback,
      "Enviando solicitud..."
    );

    const formData = new FormData(form);
    const payload = Object.fromEntries(
      formData.entries()
    );
    payload.sourcePage =
      window.location.pathname +
      window.location.search;

    try {
      const response = await fetch(
        "/api/ads/requests",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload
          ),
        }
      );
      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo enviar la solicitud."
        );
      }

      form.reset();
      setAdFeedback(
        feedback,
        data.message ||
          "Solicitud enviada correctamente."
      );
    } catch (error) {
      setAdFeedback(
        feedback,
        error.message,
        true
      );
    }
  });

  return modal;
}

function openAdRequestModal() {
  const modal = ensureAdModal();
  const form = modal.querySelector(
    "#ad-request-form"
  );
  const feedback = modal.querySelector(
    "#ad-request-feedback"
  );
  const client = readStoredClient();

  setAdFeedback(
    feedback,
    ""
  );

  if (client && form) {
    form.elements.fullName.value =
      client.fullName || "";
    form.elements.email.value =
      client.email || "";
    form.elements.phone.value =
      client.phone || "";
  }

  modal.hidden = false;
  form?.elements.businessName?.focus();
}

function trackAdClick(campaignId) {
  if (!campaignId) {
    return;
  }

  fetch(
    `/api/ads/campaigns/${campaignId}/click`,
    {
      method: "POST",
      keepalive: true,
    }
  ).catch(() => {});
}

function openAdTarget(
  targetUrl,
  campaignId,
  isCampaign = false
) {
  if (!targetUrl) {
    if (isCampaign) {
      return;
    }

    openAdRequestModal();
    return;
  }

  trackAdClick(campaignId);
  window.open(
    targetUrl,
    "_blank",
    "noopener,noreferrer"
  );
}

function bindAdBannerClick() {
  if (
    !adBanner ||
    adBanner.dataset.adBannerBound
  ) {
    return;
  }

  adBanner.dataset.adBannerBound =
    "true";

  adBanner.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest(
          ".ad-cta, .ad-media"
        )
      ) {
        return;
      }

      const opensRequest =
        adBanner.dataset
          .adOpenRequest === "true";
      const opensCampaign =
        adBanner.dataset
          .adCampaignActive ===
          "true" &&
        adBanner.dataset.adTargetUrl;

      if (
        !opensRequest &&
        !opensCampaign
      ) {
        return;
      }

      openAdTarget(
        adBanner.dataset.adTargetUrl,
        adBanner.dataset.adCampaignId,
        adBanner.dataset
          .adCampaignActive === "true"
      );
    }
  );

  adBanner.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      event.preventDefault();
      const opensRequest =
        adBanner.dataset
          .adOpenRequest === "true";
      const opensCampaign =
        adBanner.dataset
          .adCampaignActive ===
          "true" &&
        adBanner.dataset.adTargetUrl;

      if (
        !opensRequest &&
        !opensCampaign
      ) {
        return;
      }

      openAdTarget(
        adBanner.dataset.adTargetUrl,
        adBanner.dataset.adCampaignId,
        adBanner.dataset
          .adCampaignActive === "true"
      );
    }
  );
}

function bindAdRequestButtons() {
  document
    .querySelectorAll(
      ".ad-cta, [data-open-ad-request]"
    )
    .forEach((button) => {
      if (button.dataset.adRequestBound) {
        return;
      }

      button.dataset.adRequestBound =
        "true";
      button.addEventListener(
        "click",
        () => {
          openAdTarget(
            button.dataset.adTargetUrl,
            button.dataset.adCampaignId,
            button.dataset
              .adCampaignActive ===
              "true"
          );
        }
      );
    });
}

async function loadAdBanner() {
  if (!adBanner) {
    return;
  }

  const pill = adBanner.querySelector(
    ".ad-pill"
  );
  const text =
    adBanner.querySelector("p");
  const button =
    adBanner.querySelector(
      ".ad-cta"
    );

  document.body.classList.remove(
    "ad-disabled"
  );
  adBanner.hidden = false;
  adBanner.classList.remove(
    "is-clickable"
  );
  adBanner.classList.remove(
    "has-media"
  );
  adBanner.removeAttribute("style");
  [pill, text, button].forEach(
    (element) => {
      element?.removeAttribute("style");
    }
  );
  adBanner.removeAttribute("role");
  adBanner.removeAttribute("tabindex");
  delete adBanner.dataset.adTargetUrl;
  delete adBanner.dataset.adCampaignId;
  delete adBanner.dataset
    .adCampaignActive;
  delete adBanner.dataset
    .adOpenRequest;

  if (button) {
    button.textContent = "Anunciar";
    button.disabled = false;
    delete button.dataset.adTargetUrl;
    delete button.dataset.adCampaignId;
    delete button.dataset.adCampaignActive;
  }

  try {
    const response = await fetch(
      `/api/ads/banner?t=${Date.now()}`,
      {
        cache: "no-store",
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo cargar publicidad."
      );
    }

    const banner =
      data.banner || {};

    if (
      banner.enabled &&
      banner.targetUrl
    ) {
      adBanner.classList.add(
        "is-clickable"
      );
      adBanner.setAttribute(
        "role",
        "link"
      );
      adBanner.tabIndex = 0;
      adBanner.dataset.adTargetUrl =
        banner.targetUrl;
      adBanner.dataset.adCampaignId =
        banner.id || "";
      adBanner.dataset
        .adCampaignActive = "true";
    } else if (!banner.enabled) {
      adBanner.classList.add(
        "is-clickable"
      );
      adBanner.setAttribute(
        "role",
        "button"
      );
      adBanner.tabIndex = 0;
      adBanner.dataset.adOpenRequest =
        "true";
    }

    if (pill) {
      pill.textContent = "Anuncio";
    }

    if (text) {
      text.textContent =
        banner.enabled
          ? `${
              banner.advertiserName
                ? `${banner.advertiserName}: `
                : ""
            }${
              banner.message ||
              "Conoce nuestros aliados."
            }`
          : "Pauta tu marca en Parchar";
      text.classList.toggle(
        "ad-link-copy",
        Boolean(
          banner.enabled &&
            banner.targetUrl
        )
      );
      text.onclick = null;
    }

    if (button) {
      button.textContent =
        banner.ctaLabel || "Anunciar";
      button.disabled = false;

      if (
        banner.enabled
      ) {
        button.dataset.adCampaignId =
          banner.id || "";
        button.dataset.adCampaignActive =
          "true";

        if (banner.targetUrl) {
          button.dataset.adTargetUrl =
            banner.targetUrl;
        } else {
          button.textContent =
            "Sin enlace";
          button.disabled = true;
          delete button.dataset
            .adTargetUrl;
        }
      } else {
        delete button.dataset
          .adTargetUrl;
        delete button.dataset
          .adCampaignId;
        delete button.dataset
          .adCampaignActive;
      }
    }

    let mediaContainer =
      adBanner.querySelector(
        ".ad-media"
      );
    mediaContainer?.removeAttribute(
      "style"
    );

    if (
      banner.enabled &&
      banner.mediaPath
    ) {
      adBanner.classList.add(
        "has-media"
      );

      if (!mediaContainer) {
        mediaContainer =
          document.createElement(
            banner.targetUrl
              ? "a"
              : "div"
          );
        mediaContainer.className =
          "ad-media";
        adBanner.insertBefore(
          mediaContainer,
          pill
        );
      } else if (
        banner.targetUrl &&
        mediaContainer.tagName !== "A"
      ) {
        const replacement =
          document.createElement("a");
        replacement.className =
          "ad-media";
        mediaContainer.replaceWith(
          replacement
        );
        mediaContainer = replacement;
      }

      mediaContainer.replaceChildren();
      Object.assign(
        adBanner.style,
        {
          background: "#130227",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) auto",
          gridTemplateAreas:
            '"pill cta" "text cta"',
          alignItems: "center",
          gap: "7px 14px",
          overflow: "hidden",
        }
      );
      Object.assign(
        mediaContainer.style,
        {
          position: "absolute",
          inset: "0",
          zIndex: "0",
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: "inherit",
          opacity: "1",
          pointerEvents: "none",
        }
      );
      [pill, text, button].forEach(
        (element) => {
          if (!element) {
            return;
          }
          Object.assign(element.style, {
            position: "relative",
            zIndex: "1",
          });
        }
      );
      if (pill) {
        Object.assign(pill.style, {
          gridArea: "pill",
          justifySelf: "start",
        });
      }
      if (text) {
        text.style.gridArea = "text";
      }
      if (button) {
        Object.assign(button.style, {
          gridArea: "cta",
          justifySelf: "end",
        });
      }

      if (banner.targetUrl) {
        mediaContainer.href =
          banner.targetUrl;
        mediaContainer.target =
          "_blank";
        mediaContainer.rel =
          "noopener noreferrer";
        mediaContainer.onclick = (event) => {
          trackAdClick(
            banner.id
          );
          event.stopPropagation();
        };
      }

      const media =
        document.createElement(
          String(
            banner.mediaType || ""
          ).startsWith("video/")
            ? "video"
            : "img"
        );
      media.src = banner.mediaPath;
      media.setAttribute(
        "aria-label",
        banner.advertiserName ||
          "Anuncio"
      );

      if (media.tagName === "VIDEO") {
        media.muted = true;
        media.autoplay = true;
        media.loop = true;
        media.playsInline = true;
      } else {
        media.alt =
          banner.advertiserName ||
          "Anuncio";
      }

      mediaContainer.appendChild(media);
      mediaContainer.hidden = false;
    } else if (mediaContainer) {
      mediaContainer.hidden = true;
    }
  } catch {
    if (pill) {
      pill.textContent = "Anuncio";
    }
    if (text) {
      text.textContent =
        "Pauta tu marca en Parchar";
    }
  }
}

function initializeAds() {
  bindAdRequestButtons();
  bindAdBannerClick();
  loadAdBanner();

  if (!adRefreshTimer) {
    adRefreshTimer = window.setInterval(
      loadAdBanner,
      AD_REFRESH_MS
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAds
  );
} else {
  initializeAds();
}

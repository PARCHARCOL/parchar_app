const adBanner = document.querySelector(".ad-banner");
const AD_REFRESH_MS = 18000;
const AD_TEMPLATE_REFRESH_MS = 14000;
const AD_VIDEO_FALLBACK_MS = 45000;
let adRefreshTimer = null;
let adRequestSeq = 0;

function clearAdRefreshTimer() {
  if (adRefreshTimer) {
    window.clearTimeout(adRefreshTimer);
    adRefreshTimer = null;
  }
}

function scheduleAdRefresh(delayMs) {
  clearAdRefreshTimer();
  adRefreshTimer = window.setTimeout(
    loadAdBanner,
    delayMs
  );
}

function getAdTemplateStyle(value) {
  const normalized = String(
    value || ""
  ).toLowerCase();
  return [
    "spotlight",
    "slide",
    "premium",
    "food",
    "event",
  ].includes(normalized)
    ? normalized
    : "spotlight";
}

function getAdAccentColor(value) {
  const raw = String(value || "");
  return /^#[0-9a-f]{6}$/i.test(raw)
    ? raw
    : "#ff8d38";
}

function isTemplateBanner(banner) {
  return (
    banner?.creativeType ===
    "template"
  );
}

function appendTemplateImage(
  wrapper,
  className,
  src,
  alt
) {
  if (!src) {
    return null;
  }

  const image =
    document.createElement("img");
  image.className = className;
  image.src = src;
  image.alt = alt;
  image.loading = "lazy";
  wrapper.appendChild(image);
  return image;
}

function configureAdVideo(
  video,
  loop = false
) {
  video.muted = true;
  video.autoplay = true;
  video.loop = loop;
  video.playsInline = true;
  video.preload = "metadata";
}

function createAdaptiveMediaStage(
  banner,
  mediaTag
) {
  const stage =
    document.createElement("div");
  stage.className =
    "ad-media-stage";

  const backdrop =
    document.createElement(mediaTag);
  backdrop.className =
    "ad-media-fill";
  backdrop.src = banner.mediaPath;
  backdrop.setAttribute(
    "aria-hidden",
    "true"
  );

  const media =
    document.createElement(mediaTag);
  media.className =
    "ad-media-main";
  media.src = banner.mediaPath;
  media.setAttribute(
    "aria-label",
    banner.advertiserName ||
      "Anuncio"
  );

  if (mediaTag === "video") {
    configureAdVideo(backdrop, true);
    configureAdVideo(media, false);
  } else {
    backdrop.alt = "";
    media.alt =
      banner.advertiserName ||
      "Anuncio";
  }

  stage.append(backdrop, media);

  return {
    stage,
    media,
    backdrop,
  };
}

function createAdTemplateElement(banner) {
  const template =
    document.createElement("div");
  template.className = `ad-template ad-template-${getAdTemplateStyle(
    banner.templateStyle
  )}`;
  template.style.setProperty(
    "--ad-accent",
    getAdAccentColor(
      banner.accentColor
    )
  );

  const glow =
    document.createElement("div");
  glow.className = "ad-template-glow";
  template.appendChild(glow);

  appendTemplateImage(
    template,
    "ad-template-bg",
    banner.productPath ||
      banner.logoPath,
    ""
  );

  const layout =
    document.createElement("div");
  layout.className =
    "ad-template-layout";

  const logoZone =
    document.createElement("div");
  logoZone.className =
    "ad-template-logo-zone";

  const productZone =
    document.createElement("div");
  productZone.className =
    "ad-template-product-zone";

  const copy =
    document.createElement("div");
  copy.className = "ad-template-copy";

  const brand =
    document.createElement("span");
  brand.textContent =
    banner.advertiserName ||
    "Anunciante";

  const title =
    document.createElement("strong");
  title.textContent =
    banner.title &&
    banner.title.toLowerCase() !==
      "publicidad"
      ? banner.title
      : "Oferta";

  const message =
    document.createElement("em");
  message.textContent =
    banner.message ||
    "Promocion activa en Parchar";

  copy.append(
    brand,
    title,
    message
  );
  layout.appendChild(logoZone);
  layout.appendChild(copy);
  layout.appendChild(productZone);
  template.appendChild(layout);

  appendTemplateImage(
    logoZone,
    "ad-template-logo",
    banner.logoPath,
    banner.advertiserName ||
      "Logo del anunciante"
  );
  appendTemplateImage(
    productZone,
    "ad-template-product",
    banner.productPath ||
      "",
    banner.title || "Producto"
  );

  const ribbon =
    document.createElement("div");
  ribbon.className =
    "ad-template-ribbon";
  template.appendChild(ribbon);

  return template;
}

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
          Si no tienes el banner listo, envia logo en PNG/WEBP, una foto del producto o local, frase corta y oferta. Parchar puede armar una pieza animada para el espacio horizontal.
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

  const requestSeq = ++adRequestSeq;
  clearAdRefreshTimer();

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
  adBanner.classList.remove(
    "has-template"
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

    const isTemplate =
      isTemplateBanner(banner);
    const hasCreative =
      banner.enabled &&
      (banner.mediaPath ||
        (isTemplate &&
          (banner.logoPath ||
            banner.productPath)));

    if (hasCreative) {
      adBanner.classList.add(
        "has-media"
      );
      adBanner.classList.toggle(
        "has-template",
        isTemplate
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
      } else if (
        !banner.targetUrl &&
        mediaContainer.tagName === "A"
      ) {
        const replacement =
          document.createElement("div");
        replacement.className =
          "ad-media";
        mediaContainer.replaceWith(
          replacement
        );
        mediaContainer = replacement;
      }

      mediaContainer.replaceChildren();
      mediaContainer.onclick = null;
      mediaContainer.removeAttribute(
        "href"
      );
      mediaContainer.removeAttribute(
        "target"
      );
      mediaContainer.removeAttribute(
        "rel"
      );
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

      if (isTemplate) {
        mediaContainer.appendChild(
          createAdTemplateElement(
            banner
          )
        );
        mediaContainer.hidden = false;
        scheduleAdRefresh(
          AD_TEMPLATE_REFRESH_MS
        );
        return;
      }

      const mediaTag = String(
        banner.mediaType || ""
      ).startsWith("video/")
        ? "video"
        : "img";
      const {
        stage,
        media,
        backdrop,
      } = createAdaptiveMediaStage(
        banner,
        mediaTag
      );

      if (mediaTag === "video") {
        media.addEventListener(
          "ended",
          () => {
            if (requestSeq !== adRequestSeq) {
              return;
            }

            scheduleAdRefresh(400);
          },
          { once: true }
        );
        media.addEventListener(
          "error",
          () => {
            if (requestSeq !== adRequestSeq) {
              return;
            }

            scheduleAdRefresh(AD_REFRESH_MS);
          },
          { once: true }
        );
      } else {
        scheduleAdRefresh(AD_REFRESH_MS);
      }

      mediaContainer.appendChild(stage);
      mediaContainer.hidden = false;

      if (mediaTag === "video") {
        media.addEventListener(
          "loadedmetadata",
          () => {
            if (requestSeq !== adRequestSeq) {
              return;
            }

            const durationMs =
              Number.isFinite(
                media.duration
              ) && media.duration > 0
                ? Math.ceil(
                    media.duration * 1000
                  ) + 800
                : AD_VIDEO_FALLBACK_MS;
            scheduleAdRefresh(
              Math.max(
                durationMs,
                5000
              )
            );
          },
          { once: true }
        );

        backdrop
          .play?.()
          .catch(() => {});
        media.play?.().catch(() => {
          if (requestSeq !== adRequestSeq) {
            return;
          }

          scheduleAdRefresh(
            AD_VIDEO_FALLBACK_MS
          );
        });
      }
    } else if (mediaContainer) {
      mediaContainer.hidden = true;
      scheduleAdRefresh(AD_REFRESH_MS);
    } else {
      scheduleAdRefresh(AD_REFRESH_MS);
    }
  } catch {
    if (pill) {
      pill.textContent = "Anuncio";
    }
    if (text) {
      text.textContent =
        "Pauta tu marca en Parchar";
    }
    scheduleAdRefresh(AD_REFRESH_MS);
  }
}

function initializeAds() {
  bindAdRequestButtons();
  bindAdBannerClick();
  loadAdBanner();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAds
  );
} else {
  initializeAds();
}

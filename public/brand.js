const PARCHAR_DEFAULT_LOGO =
  "/assets/parchar-logo.png";

function isBrandVideo(path, type) {
  const value = String(
    `${type || ""} ${path || ""}`
  ).toLowerCase();

  return (
    value.includes("video/") ||
    /\.(mp4|webm|mov)(?:$|\?)/i.test(
      value
    )
  );
}

function copyBrandAttributes(
  source,
  target
) {
  target.className =
    source.className || "brand-logo";

  for (const { name, value } of [
    ...source.attributes,
  ]) {
    if (
      [
        "src",
        "alt",
        "class",
        "poster",
      ].includes(name)
    ) {
      continue;
    }

    target.setAttribute(name, value);
  }

  target.setAttribute(
    "data-brand-logo",
    ""
  );
}

function renderBrandLogo(
  element,
  path,
  type
) {
  const source =
    path || PARCHAR_DEFAULT_LOGO;
  const needsVideo =
    isBrandVideo(source, type);
  const currentIsVideo =
    element.tagName.toLowerCase() ===
    "video";

  if (needsVideo) {
    const video = currentIsVideo
      ? element
      : document.createElement(
          "video"
        );

    if (!currentIsVideo) {
      copyBrandAttributes(
        element,
        video
      );
      element.replaceWith(video);
    }

    video.src = source;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute(
      "aria-label",
      "Parchar"
    );
    video
      .play()
      .catch(() => {});
    return;
  }

  const image =
    currentIsVideo
      ? document.createElement("img")
      : element;

  if (currentIsVideo) {
    copyBrandAttributes(
      element,
      image
    );
    element.replaceWith(image);
  }

  image.src = source;
  image.alt = "Parchar";
}

function updateAppleIconLink(
  brand
) {
  const link =
    document.querySelector(
      'link[rel="apple-touch-icon"]'
    );

  if (!link) {
    return;
  }

  const updated =
    encodeURIComponent(
      brand?.updatedAt || "default"
    );
  link.href = `${
    brand?.appleTouchIconUrl ||
    "/assets/icons/apple-touch-icon-180.png"
  }?brand=${updated}`;
}

async function loadParcharBrand() {
  try {
    const response = await fetch(
      "/api/brand",
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        "brand unavailable"
      );
    }

    const data = await response.json();
    const brand = data.brand || {};

    document
      .querySelectorAll(
        "[data-brand-logo]"
      )
      .forEach((element) => {
        renderBrandLogo(
          element,
          brand.homeLogoPath,
          brand.homeLogoType
        );
      });
    updateAppleIconLink(brand);
    window.ParcharBrand = brand;
  } catch {
    document
      .querySelectorAll(
        "[data-brand-logo]"
      )
      .forEach((element) => {
        renderBrandLogo(
          element,
          PARCHAR_DEFAULT_LOGO,
          "image/png"
        );
      });
  }
}

if (
  document.readyState === "loading"
) {
  window.addEventListener(
    "DOMContentLoaded",
    loadParcharBrand
  );
} else {
  loadParcharBrand();
}

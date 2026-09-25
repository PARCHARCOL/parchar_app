(() => {
  const VISITOR_KEY = "parchar-trend-visitor-v1";
  let fallbackVisitorKey = "";
  let cardObserver = null;

  function makeVisitorKey() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (digit) => {
      const random = Math.floor(Math.random() * 16);
      return (digit === "x" ? random : (random & 0x3) | 0x8).toString(16);
    });
  }

  function getVisitorKey() {
    try {
      let key = sessionStorage.getItem(VISITOR_KEY);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key || "")) {
        key = makeVisitorKey();
        sessionStorage.setItem(VISITOR_KEY, key);
      }
      return key;
    } catch {
      fallbackVisitorKey ||= makeVisitorKey();
      return fallbackVisitorKey;
    }
  }

  function track(entityType, entityId, eventType) {
    if (!entityType || !entityId || !eventType) return;

    fetch("/api/recommendations/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        entityType,
        entityId: Number(entityId),
        eventType,
        visitorKey: getVisitorKey(),
      }),
    }).catch(() => {});
  }

  function observeCards(root = document) {
    cardObserver?.disconnect();
    const cards = root.querySelectorAll("[data-trend-entity][data-trend-id]");
    if (!cards.length) return;

    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => {
        track(card.dataset.trendEntity, card.dataset.trendId, "view");
      });
      return;
    }

    cardObserver ||= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const card = entry.target;
          track(card.dataset.trendEntity, card.dataset.trendId, "view");
          cardObserver.unobserve(card);
        }
      }
    }, { threshold: 0.5 });

    cards.forEach((card) => cardObserver.observe(card));
  }

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-trend-event]");
    if (!control) return;
    const card = control.closest("[data-trend-entity][data-trend-id]");
    if (!card) return;
    track(card.dataset.trendEntity, card.dataset.trendId, control.dataset.trendEvent);
  });

  window.ParcharTrends = Object.freeze({ observeCards, track });
})();

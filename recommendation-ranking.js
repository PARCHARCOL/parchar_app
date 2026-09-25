const EVENT_WEIGHTS = Object.freeze({
  view: 0.25,
  route: 5,
  call: 5,
  save: 4,
  open: 3,
  parchar: 4,
});

function eventScoreMap(events) {
  const scores = new Map();

  for (const event of events) {
    const weight = EVENT_WEIGHTS[event.event_type];
    if (!weight) continue;

    const key = `${event.entity_type}:${event.entity_id}`;
    scores.set(
      key,
      (scores.get(key) || 0) + weight * Number(event.event_count || 0)
    );
  }

  return scores;
}

function timestamp(value) {
  const result = new Date(value || "").getTime();
  return Number.isFinite(result) ? result : 0;
}

function rankTrendingRecommendations(sites, businesses, events, limit = 4) {
  const scores = eventScoreMap(events);
  const candidates = [
    ...sites
      .filter((site) => site.status === "activo")
      .map((site) => ({
        id: Number(site.id),
        entityType: "site",
        name: site.name,
        category: site.site_type || "sitio",
        description: site.description || "",
        address: site.address || "",
        city: site.city || "",
        mediaPath: site.media_path || "",
        mediaType: site.media_type || "",
        createdAt: site.created_at || null,
      })),
    ...businesses
      .filter((business) => business.status === "activo")
      .map((business) => ({
        id: Number(business.id),
        entityType: "business",
        name: business.business_name,
        category: business.category || "local",
        description: business.description || "",
        address: business.address || "",
        city: business.city || "",
        mediaPath: business.video_path || "",
        mediaType: business.video_path ? "video/mp4" : "",
        createdAt: business.created_at || null,
      })),
  ]
    .filter((item) => item.id && item.name)
    .map((item) => ({
      ...item,
      trendScore:
        scores.get(`${item.entityType}:${item.id}`) || 0,
    }))
    .sort((a, b) =>
      b.trendScore - a.trendScore ||
      timestamp(b.createdAt) - timestamp(a.createdAt)
    );

  const selected = [];
  const categories = new Set();

  for (const item of candidates) {
    if (selected.length >= limit) break;
    if (categories.has(item.category)) continue;
    categories.add(item.category);
    selected.push(item);
  }

  if (selected.length < limit) {
    for (const item of candidates) {
      if (selected.length >= limit) break;
      if (!selected.some((chosen) => chosen.entityType === item.entityType && chosen.id === item.id)) {
        selected.push(item);
      }
    }
  }

  return {
    items: selected,
    hasTrendSignals: selected.some((item) => item.trendScore >= 2),
  };
}

module.exports = {
  rankTrendingRecommendations,
};

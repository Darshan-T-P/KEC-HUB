import { CrawlMeta, Opportunity, User } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Deterministic (non-AI) realtime opportunity extraction.
 * Calls the FastAPI backend which scrapes configured sources and ranks by profile.
 */
export const crawlActiveOpportunities = async (user: Pick<User, "email" | "role">): Promise<Opportunity[]> => {
  try {
    const res = await fetch(
      `${API_BASE_URL}/opportunities/realtime/${encodeURIComponent(user.email)}?role=${encodeURIComponent(user.role)}`
    );
    const data = await res.json();
    if (!data?.success) return [];

    const items = Array.isArray(data?.opportunities) ? data.opportunities : [];
    return items.map((it: any) => {
      const deadline = typeof it.deadline === "string" && it.deadline.trim() ? it.deadline : "Open";
      return {
        id: it.id,
        title: it.title || "",
        company: it.company || "",
        type: it.type || "Other",
        source: it.source || "",
        matchMethod: it.matchMethod || undefined,
        deadline,
        description: it.description || "",
        tags: Array.isArray(it.tags) ? it.tags : [],
        location: it.location || "",
        postedDate: it.postedDate || "",
        eligibility: it.eligibility || "See source page",
        requirements: Array.isArray(it.requirements) ? it.requirements : [],
        sourceUrl: it.sourceUrl || "#",
      } as Opportunity;
    });
  } catch (error) {
    console.error("Realtime extractor error:", error);
    return [];
  }
};

export const crawlActiveOpportunitiesWithMeta = async (
  user: Pick<User, "email" | "role">
): Promise<{ opportunities: Opportunity[]; meta: CrawlMeta }> => {
  try {
    const res = await fetch(
      `${API_BASE_URL}/opportunities/realtime/${encodeURIComponent(user.email)}?role=${encodeURIComponent(user.role)}`
    );
    const data = await res.json();
    if (!data?.success) {
      return { opportunities: [], meta: { groqEnabled: false, groqUsed: false } };
    }

    const items = Array.isArray(data?.opportunities) ? data.opportunities : [];
    const opportunities = items.map((it: any) => {
      const deadline = typeof it.deadline === "string" && it.deadline.trim() ? it.deadline : "Open";
      return {
        id: it.id,
        title: it.title || "",
        company: it.company || "",
        type: it.type || "Other",
        source: it.source || "",
        matchMethod: it.matchMethod || undefined,
        deadline,
        description: it.description || "",
        tags: Array.isArray(it.tags) ? it.tags : [],
        location: it.location || "",
        postedDate: it.postedDate || "",
        eligibility: it.eligibility || "See source page",
        requirements: Array.isArray(it.requirements) ? it.requirements : [],
        sourceUrl: it.sourceUrl || "#",
      } as Opportunity;
    });

    return {
      opportunities,
      meta: {
        groqEnabled: !!data?.groqEnabled,
        groqUsed: !!data?.groqUsed,
        webSearchEnabled: !!data?.webSearchEnabled,
        webSearchProvider: data?.webSearchProvider ?? null,
        webSearchUsed: !!data?.webSearchUsed,
        webSearchError: data?.webSearchError ?? null,
      },
    };
  } catch (error) {
    console.error("Realtime extractor error:", error);
    return { opportunities: [], meta: { groqEnabled: false, groqUsed: false } };
  }
};

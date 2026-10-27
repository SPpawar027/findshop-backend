import { LegalDocument } from "./legal.model";
import { DEFAULT_LEGAL_DOCS, DefaultLegalDoc } from "./legal.defaults";

let isTableSynced = false;

async function ensureTableReady() {
  if (!isTableSynced) {
    try {
      await LegalDocument.sync({ alter: false });
      isTableSynced = true;
    } catch (err) {
      console.warn("LegalDocument table sync warning:", err);
    }
  }
}

export interface FormattedLegalDoc {
  id: string;
  slug: string;
  title: string;
  content: string;
  contentHtml: string;
  version: string;
  lastUpdatedBy?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export class LegalService {
  /**
   * Fetch a specific legal document by ID (e.g. 'privacy-policy' or 'terms-and-conditions').
   * If not found in database, returns the compliant default and auto-persists it.
   */
  async getLegalDoc(id: string): Promise<FormattedLegalDoc> {
    const normalizedId = id.trim().toLowerCase();
    const defaultDoc = DEFAULT_LEGAL_DOCS[normalizedId];

    try {
      await ensureTableReady();
      const doc = await LegalDocument.findByPk(normalizedId);

      if (doc) {
        return {
          id: doc.id,
          slug: doc.id,
          title: doc.title,
          content: doc.content,
          contentHtml: doc.content,
          version: doc.version,
          lastUpdatedBy: doc.lastUpdatedBy,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      }
    } catch (dbErr) {
      console.warn(`[LegalService] DB read failed for ${normalizedId}, using static fallback:`, dbErr);
    }

    if (defaultDoc) {
      // Auto-persist in background if table exists
      LegalDocument.create({
        id: defaultDoc.id,
        title: defaultDoc.title,
        content: defaultDoc.content,
        version: defaultDoc.version,
        lastUpdatedBy: defaultDoc.lastUpdatedBy || "System (Default Compliant)",
      }).catch(() => {
        // Ignore duplicate insert race condition or offline DB
      });

      return {
        id: defaultDoc.id,
        slug: defaultDoc.slug,
        title: defaultDoc.title,
        content: defaultDoc.content,
        contentHtml: defaultDoc.contentHtml,
        version: defaultDoc.version,
        lastUpdatedBy: defaultDoc.lastUpdatedBy,
        createdAt: defaultDoc.updatedAt || new Date().toISOString(),
        updatedAt: defaultDoc.updatedAt || new Date().toISOString(),
      };
    }

    // Fallback if completely unknown id
    return {
      id: normalizedId,
      slug: normalizedId,
      title: "Document",
      version: "1.0.0",
      content: `<h2>${normalizedId}</h2><p>Content coming soon.</p>`,
      contentHtml: `<h2>${normalizedId}</h2><p>Content coming soon.</p>`,
      lastUpdatedBy: "System",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Return all legal documents
   */
  async getAllLegalDocs(): Promise<FormattedLegalDoc[]> {
    try {
      await ensureTableReady();
      let docs = await LegalDocument.findAll({ order: [["id", "ASC"]] });

      if (docs.length === 0) {
        // Seed all defaults
        for (const key of Object.keys(DEFAULT_LEGAL_DOCS)) {
          const item = DEFAULT_LEGAL_DOCS[key];
          await LegalDocument.upsert({
            id: item.id,
            title: item.title,
            content: item.content,
            version: item.version,
            lastUpdatedBy: "System Initializer",
          }).catch(() => {});
        }
        docs = await LegalDocument.findAll({ order: [["id", "ASC"]] });
      }

      if (docs.length > 0) {
        return docs.map((doc) => ({
          id: doc.id,
          slug: doc.id,
          title: doc.title,
          content: doc.content,
          contentHtml: doc.content,
          version: doc.version,
          lastUpdatedBy: doc.lastUpdatedBy,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }));
      }
    } catch (dbErr) {
      console.warn("[LegalService] DB getAll failed, falling back to static defaults:", dbErr);
    }

    return Object.values(DEFAULT_LEGAL_DOCS).map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      content: item.content,
      contentHtml: item.contentHtml,
      version: item.version,
      lastUpdatedBy: item.lastUpdatedBy,
      createdAt: item.updatedAt,
      updatedAt: item.updatedAt,
    }));
  }

  /**
   * Update or create a legal document (Super Admin only)
   */
  async updateLegalDoc(
    id: string,
    payload: {
      title?: string;
      content?: string;
      contentHtml?: string;
      version?: string;
      lastUpdatedBy?: string;
    }
  ): Promise<FormattedLegalDoc> {
    await ensureTableReady();

    const normalizedId = id.trim().toLowerCase();
    const defaultFallback = DEFAULT_LEGAL_DOCS[normalizedId];

    const title = payload.title?.trim() || defaultFallback?.title || normalizedId;
    const rawContent = payload.contentHtml ?? payload.content ?? defaultFallback?.content ?? "";
    const version = payload.version?.trim() || "1.0.0";
    const lastUpdatedBy = payload.lastUpdatedBy || "Super Admin";

    const [doc] = await LegalDocument.upsert({
      id: normalizedId,
      title,
      content: rawContent,
      version,
      lastUpdatedBy,
    });

    return {
      id: doc.id,
      slug: doc.id,
      title: doc.title,
      content: doc.content,
      contentHtml: doc.content,
      version: doc.version,
      lastUpdatedBy: doc.lastUpdatedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const legalService = new LegalService();

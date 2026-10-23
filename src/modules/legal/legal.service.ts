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

export class LegalService {
  /**
   * Fetch a specific legal document by ID (e.g. 'privacy-policy' or 'terms-and-conditions').
   * If not found in database, returns the compliant default and auto-persists it.
   */
  async getLegalDoc(id: string): Promise<LegalDocument | DefaultLegalDoc> {
    await ensureTableReady();

    const normalizedId = id.trim().toLowerCase();
    const doc = await LegalDocument.findByPk(normalizedId);

    if (doc) {
      return doc;
    }

    // Check defaults
    const defaultDoc = DEFAULT_LEGAL_DOCS[normalizedId];
    if (defaultDoc) {
      // Auto-persist in background so it's queryable in database
      LegalDocument.create({
        id: defaultDoc.id,
        title: defaultDoc.title,
        content: defaultDoc.content,
        version: defaultDoc.version,
        lastUpdatedBy: "System (Default Compliant)",
      }).catch((e) => {
        // Ignore duplicate insert race condition
      });

      return defaultDoc;
    }

    // Fallback if completely unknown id
    return {
      id: normalizedId,
      title: "Document",
      version: "1.0.0",
      content: `# ${normalizedId}\n\nContent coming soon.`,
    };
  }

  /**
   * Return all legal documents
   */
  async getAllLegalDocs(): Promise<LegalDocument[]> {
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
        });
      }
      docs = await LegalDocument.findAll({ order: [["id", "ASC"]] });
    }

    return docs;
  }

  /**
   * Update or create a legal document (Super Admin only)
   */
  async updateLegalDoc(
    id: string,
    payload: {
      title?: string;
      content: string;
      version?: string;
      lastUpdatedBy?: string;
    }
  ): Promise<LegalDocument> {
    await ensureTableReady();

    const normalizedId = id.trim().toLowerCase();
    const defaultFallback = DEFAULT_LEGAL_DOCS[normalizedId];

    const title = payload.title?.trim() || defaultFallback?.title || normalizedId;
    const version = payload.version?.trim() || "1.0.0";
    const lastUpdatedBy = payload.lastUpdatedBy || "Super Admin";

    const [doc] = await LegalDocument.upsert({
      id: normalizedId,
      title,
      content: payload.content,
      version,
      lastUpdatedBy,
    });

    return doc;
  }
}

export const legalService = new LegalService();

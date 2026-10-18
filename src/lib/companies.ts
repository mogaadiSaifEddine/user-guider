// Users are grouped by company (in the CMS: the publisher) using two
// identify() attributes. A workspace can name them in Settings; otherwise the
// first attribute present from these lists is used.

export const DEFAULT_COMPANY_ID_KEYS = ["company_id", "companyId", "publisher", "publisher_id", "organization_id", "org_id", "account_id"];
export const DEFAULT_COMPANY_NAME_KEYS = ["company_name", "companyName", "publisher_alias", "publisher_name", "organization_name", "account_name", "company"];

export type CompanyConfig = { companyIdAttribute: string | null; companyNameAttribute: string | null };

function pick(attributes: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = attributes[k];
    if (v === null || v === undefined || typeof v === "object") continue;
    const s = String(v).trim();
    if (s) return s.slice(0, 191);
  }
  return null;
}

export function companyFrom(attributes: Record<string, unknown>, config: CompanyConfig) {
  const id = pick(attributes, config.companyIdAttribute ? [config.companyIdAttribute] : DEFAULT_COMPANY_ID_KEYS);
  const name = pick(attributes, config.companyNameAttribute ? [config.companyNameAttribute] : DEFAULT_COMPANY_NAME_KEYS);
  // A name alone still groups users; it doubles as the id.
  return { companyId: id ?? name, companyName: name };
}

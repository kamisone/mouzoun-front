/**
 * The French seller's identity and the consumer mediator, edited in Admin › Settings › Legal
 * entity (`/v1/admin/settings/legal-entity`). Invoices, checkout, emails, the footer and the
 * legal pages (tokens) read them; an issued invoice keeps its own copy.
 */
export interface LegalEntityForm {
  legal_name: string
  legal_form: string
  share_capital_minor: number | null
  address: { line1: string, line2: string, postal_code: string, city: string }
  country_code: string
  email: string
  phone: string
  registration: { siren: string, siret: string, rcs_city: string, vat_number: string, ape_code: string }
  publication_director: string
  mediator: { name: string, url: string, address: string }
}

export interface LegalEntityResponse {
  entity: LegalEntityForm
  /** Field codes the compliance checklist still needs. */
  missing: string[]
  mediator_missing: string[]
  changed?: string[]
}

/** Field code (`registration.siren`) → i18n key part (`registration_siren`). */
export const fieldKey = (code: string) => code.replace('.', '_')

import {
  CLAIMS_SQL_TEMPLATES,
  coerceSqlParamValue,
  type SqlTemplate,
} from "@/lib/query/templates";

export type TemplateMatch = {
  templates: string;
  params: Record<string, string | number>;
  explanation: string;
};

export type TemplateNoMatch = {
  template: null;
};

export type TemplateSelection = TemplateMatch | TemplateNoMatch;

export function catalogForPrompt(templates: SqlTemplate[] = CLAIMS_SQL_TEMPLATES) {
  return templates.map((template) => ({
    id: template.id,
    description: template.description,
    parameters: template.parameters.map((param) => ({
      name: param.name,
      type: param.type,
      defaultValue: param.defaultValue,
    })),
  }));
}

export function buildSelectPrompt(
  question: string,
  today: string,
  templates: SqlTemplate[] = CLAIMS_SQL_TEMPLATES,
): string {
  return `You select a claims reporting template for a user question.
Never write SQL. Only choose one template id from the list and fill its parameters.

Today's date: ${today}

Templates:
${JSON.stringify(catalogForPrompt(templates), null, 2)}

User question:
${question}

Return JSON only, with no extra keys:
- If a template fits: {"templates":"<id>","params":{...},"explanation":"<plain language of how the result is calculated>"}
- If none fit: {"template":null}

Rules:
- "templates" must be an id from the list above.
- "params" keys must match that template's parameter names.
- date values are YYYY-MM-DD. integer values are whole numbers. numeric values are numbers.
- Use today's date when the question says YTD, last 12 months, or omits dates.
- paid means plan paid, not member_paid.
- Members and claims are distinct counts, not row counts.
- explanation must be simple English.`;
}

export function normalizeGeminiSelection(raw: unknown): TemplateSelection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { template: null };
  }

  const body = raw as Record<string, unknown>;

  if (body.template === null && body.templates == null) {
    return { template: null };
  }

  const id =
    typeof body.templates === "string"
      ? body.templates
      : typeof body.template === "string"
        ? body.template
        : null;

  const template = CLAIMS_SQL_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    return { template: null };
  }

  const rawParams =
    body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? (body.params as Record<string, unknown>)
      : {};

  const params: Record<string, string | number> = {};
  for (const param of template.parameters) {
    const value = rawParams[param.name] ?? param.defaultValue;
    params[param.name] = coerceSqlParamValue(param.type, value);
  }

  return {
    templates: template.id,
    params,
    explanation: typeof body.explanation === "string" ? body.explanation : "",
  };
}

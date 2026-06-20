import type { HallucinationFlag } from '@shared/types.js';

const URL_RE = /https?:\/\/[^\s"'<>]+/g;
const SELECTOR_RE = /#[\w-]+|\.[\w-]+|\[[\w-="']+\]/g;
const ENDPOINT_RE = /\/api\/[\w/-]+/g;

function extractTokens(text: string): Set<string> {
  const lower = text.toLowerCase();
  return new Set(
    lower.split(/[\s,;:()"'`\[\]{}<>]+/).filter((w) => w.length > 3),
  );
}

export class HallucinationDetector {
  detect(agentOutput: string, requirement: string): HallucinationFlag[] {
    const flags: HallucinationFlag[] = [];
    const reqTokens = extractTokens(requirement);

    // Check URLs mentioned in output but not in requirement
    const outputUrls = agentOutput.match(URL_RE) ?? [];
    const reqUrls = requirement.match(URL_RE) ?? [];
    const reqUrlSet = new Set(reqUrls.map((u) => u.toLowerCase()));

    for (const url of outputUrls) {
      if (!reqUrlSet.has(url.toLowerCase())) {
        flags.push({
          content: url,
          reason: `URL "${url}" appears in generated output but was not mentioned in the requirement`,
        });
      }
    }

    // Check CSS selectors / element references not grounded in requirement
    const outputSelectors = agentOutput.match(SELECTOR_RE) ?? [];
    for (const sel of outputSelectors) {
      const selName = sel.replace(/^[#.\[]/, '').replace(/["'\]=]/g, '').toLowerCase();
      if (!reqTokens.has(selName) && selName.length > 3) {
        flags.push({
          content: sel,
          reason: `Element selector "${sel}" references a UI element not described in the requirement`,
        });
      }
    }

    // Check API endpoints in output not grounded in requirement
    const outputEndpoints = agentOutput.match(ENDPOINT_RE) ?? [];
    const reqEndpoints = new Set((requirement.match(ENDPOINT_RE) ?? []).map((e) => e.toLowerCase()));
    for (const ep of outputEndpoints) {
      if (!reqEndpoints.has(ep.toLowerCase())) {
        flags.push({
          content: ep,
          reason: `API endpoint "${ep}" appears in generated output but was not mentioned in the requirement`,
        });
      }
    }

    return flags;
  }
}

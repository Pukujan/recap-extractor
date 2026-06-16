const MOTION_TYPE_PATTERNS = [
  { pattern: /motion\s+to\s+compel/i, value: "motion_to_compel" },
  { pattern: /moves?\s+to\s+compel/i, value: "motion_to_compel" },
  { pattern: /motion\s+(?:for\s+)?summary\s+judgment/i, value: "motion_for_summary_judgment" },
  { pattern: /motion\s+to\s+dismiss/i, value: "motion_to_dismiss" },
  { pattern: /motion\s+to\s+strike/i, value: "motion_to_strike" },
  { pattern: /motion\s+to\s+amend/i, value: "motion_to_amend" },
  { pattern: /motion\s+for\s+(?:a\s+)?protective\s+order/i, value: "motion_for_protective_order" },
  { pattern: /motion\s+for\s+(?:a\s+)?temporary\s+restraining\s+order/i, value: "motion_for_tro" },
  { pattern: /motion\s+for\s+preliminary\s+injunction/i, value: "motion_for_preliminary_injunction" },
  { pattern: /motion\s+for\s+(?:leave\s+to\s+)?(?:file\s+)?(?:an?\s+)?(?:amended|supplemental)/i, value: "motion_to_amend" },
  { pattern: /notice\s+of\s+motion/i, value: "notice_of_motion" },
  { pattern: /cross.motion/i, value: "cross_motion" },
];

const PARTY_PATTERNS = [
  { role: "plaintiff", pattern: /(?:plaintiff|petitioner)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "defendant", pattern: /(?:defendant|respondent)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "third_party_plaintiff", pattern: /third.party\s+(?:plaintiff|petitioner)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "third_party_defendant", pattern: /third.party\s+(?:defendant|respondent)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "intervenor", pattern: /intervenor\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "interpleader", pattern: /interpleader\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "claimant", pattern: /claimant\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "counter_claimant", pattern: /counter.claimant\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "counter_defendant", pattern: /counter.defendant\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
  { role: "defendant", pattern: /against\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i },
];

const ATTORNEY_PATTERNS = [
  /(?:attorney|esq\.|esquire|law\s+firm)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i,
  /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*),\s+(?:Esq\.|Attorney|P\.?A\.?|LLC|LLP|P\.?C\.?)/i,
  /[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+&\s+[A-Z][a-zA-Z]+)*,\s+(?:LLC|LLP|P\.?A\.?|P\.?C\.?)/i,
];

const JUDGE_PATTERNS = [
  /(?:Honorable|Hon\.|Judge)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i,
  /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*),\s+(?:U\.?S\.?\s+)?(?:District|Magistrate|Circuit)\s+Judge/i,
  /Chief\s+Judge\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i,
];

const DATE_PATTERNS = [
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
  /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/g,
  /\b(\d{1,2})\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/g,
];

const LEGAL_TERM_PATTERNS = [
  /\bdiscovery\b/gi,
  /\bdeposition\b/gi,
  /\binterrogatories?\b/gi,
  /\brequest\s+for\s+production\b/gi,
  /\brequest\s+for\s+admission\b/gi,
  /\bsubpoena\b/gi,
  /\bprivilege\b/gi,
  /\bwork\s+product\b/gi,
  /\battorney.client\s+privilege\b/gi,
  /\bconfidential\b/gi,
  /\bprotective\s+order\b/gi,
  /\bsanctions?\b/gi,
  /\bcontempt\b/gi,
  /\bjurisdiction\b/gi,
  /\bvenue\b/gi,
  /\bstatute\s+of\s+limitations\b/gi,
  /\bcomplaint\b/gi,
  /\banswer\b/gi,
  /\breply\b/gi,
  /\bcounterclaim\b/gi,
  /\bcrossclaim\b/gi,
  /\bthird.party\s+(?:complaint|claim)\b/gi,
  /\bclass\s+action\b/gi,
  /\bpro\s+se\b/gi,
  /\bpro\s+bono\b/gi,
  /\bin\s+forma\s+pauperis\b/gi,
  /\bnotice\s+of\s+(?:removal|appearance|related\s+case)\b/gi,
  /\bstipulation\b/gi,
  /\border\s+to\s+show\s+cause\b/gi,
  /\bdefault\s+(?:judgment)?\b/gi,
  /\bdismissal\b/gi,
  /\bremand\b/gi,
  /\bremoval\b/gi,
  /\barbitration\b/gi,
  /\bmediation\b/gi,
  /\bsettlement\b/gi,
  /\bexhibit\b/gi,
  /\baffidavit\b/gi,
  /\bdeclaration\b/gi,
  /\bverification\b/gi,
];

function findSpan(text, value) {
  const idx = text.indexOf(value);
  if (idx === -1) return null;
  return { start: idx, end: idx + value.length };
}

function findPage(fullText, pages, span) {
  let offset = 0;
  for (const page of pages) {
    const pageText = page.text || "";
    const pageEnd = offset + pageText.length;
    if (span.start >= offset && span.end <= pageEnd) {
      return { page: page.page, span: { start: span.start - offset, end: span.end - offset } };
    }
    offset = pageEnd;
  }
  return { page: 1, span };
}

export class LegalAnnotationAgent {
  constructor({ writer }) {
    this.writer = writer;
  }

  async run(input) {
    const { parsed, metadata, review, folders } = input;
    const fullText = parsed.text || "";
    const pages = parsed.pages || [];
    const annotations = [];
    const seenValues = new Set();

    for (const mp of MOTION_TYPE_PATTERNS) {
      const match = fullText.match(mp.pattern);
      if (match) {
        const value = mp.value;
        if (!seenValues.has(`motion_type:${value}`)) {
          seenValues.add(`motion_type:${value}`);
          const span = findSpan(fullText, match[0]);
          if (span) {
            const pageInfo = findPage(fullText, pages, span);
            annotations.push({
              type: "motion_type",
              value,
              confidence: 0.85,
              source: pageInfo,
            });
          }
        }
      }
    }

    for (const pp of PARTY_PATTERNS) {
      const regex = new RegExp(pp.pattern.source, "gi");
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        if (match[1] && match[1].trim().length > 0) {
          const partyValue = match[1].trim();
          const key = `party:${partyValue}`;
          if (!seenValues.has(key)) {
            seenValues.add(key);
            const span = findSpan(fullText, match[0]);
            if (span) {
              const pageInfo = findPage(fullText, pages, span);
              annotations.push({
                type: "party",
                value: partyValue,
                confidence: 0.75,
                source: pageInfo,
              });
            }
          }
        }
      }
    }

    for (const ap of ATTORNEY_PATTERNS) {
      const regex = new RegExp(ap.source, "gi");
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        if (match[1] && match[1].trim().length > 0) {
          const attorneyValue = match[1].trim();
          const key = `attorney:${attorneyValue}`;
          if (!seenValues.has(key)) {
            seenValues.add(key);
            const span = findSpan(fullText, match[0]);
            if (span) {
              const pageInfo = findPage(fullText, pages, span);
              annotations.push({
                type: "attorney",
                value: attorneyValue,
                confidence: 0.7,
                source: pageInfo,
              });
            }
          }
        }
      }
    }

    for (const jp of JUDGE_PATTERNS) {
      const regex = new RegExp(jp.source, "gi");
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        if (match[1] && match[1].trim().length > 0) {
          const judgeValue = match[1].trim();
          const key = `judge:${judgeValue}`;
          if (!seenValues.has(key)) {
            seenValues.add(key);
            const span = findSpan(fullText, match[0]);
            if (span) {
              const pageInfo = findPage(fullText, pages, span);
              annotations.push({
                type: "judge",
                value: judgeValue,
                confidence: 0.8,
                source: pageInfo,
              });
            }
          }
        }
      }
    }

    for (const dp of DATE_PATTERNS) {
      const regex = new RegExp(dp.source, "gi");
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        const dateValue = match[0].trim();
        const key = `date:${dateValue}`;
        if (!seenValues.has(key)) {
          seenValues.add(key);
          const span = findSpan(fullText, dateValue);
          if (span) {
            const pageInfo = findPage(fullText, pages, span);
            annotations.push({
              type: "date",
              value: dateValue,
              confidence: 0.9,
              source: pageInfo,
            });
          }
        }
      }
    }

    for (const lp of LEGAL_TERM_PATTERNS) {
      let match;
      while ((match = lp.exec(fullText)) !== null) {
        const termValue = match[0].trim().toLowerCase();
        const key = `legal_term:${termValue}`;
        if (!seenValues.has(key)) {
          seenValues.add(key);
          const span = findSpan(fullText, match[0]);
          if (span) {
            const pageInfo = findPage(fullText, pages, span);
            annotations.push({
              type: "legal_term",
              value: termValue,
              confidence: 0.65,
              source: pageInfo,
            });
          }
        }
      }
    }

    const annotationsPath = `${folders.documentFolderPath}extracted/legal_annotations.json`;
    await this.writer.writeJson(annotationsPath, annotations);

    return { annotations };
  }
}

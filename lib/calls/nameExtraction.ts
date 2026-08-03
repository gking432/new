const CONVERSATIONAL_WORDS =
  /^(that|this|those|these|sounds?|works?|working|work|good|great|fine|okay|sure|yeah|yes|yep|no|nope|well|maybe|probably|actually|really|just|hoping|calling|checking|looking|thinking|think|need|want|would|could|can|have|has|had|getting|going|happening|morning|afternoon|evening|today|tomorrow)$/i;

export function sanitizeCustomerName(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value
    .replace(/^(?:sure|yeah|yes|yep|okay|ok|hi|hello|hey)[,.\s]+/i, "")
    .replace(
      /^(?:my name(?:\s+is|'?s|s)?|names?|name(?:\s+is|'?s)?|it'?s|this is|i'?m|i am)\s+/i,
      ""
    )
    .split(/[,.]/)[0]
    .replace(/\b(?:speaking|here|calling)\b.*$/i, "")
    .replace(/\b(?:my|the)?\s*(?:phone|number|cell|email|address)\b.*$/i, "")
    .trim();
  const words = cleaned.match(/[a-z]+(?:['-][a-z]+)?/gi) ?? [];
  if (words.some((word) => CONVERSATIONAL_WORDS.test(word))) return null;
  const filtered = words.filter(
    (word) =>
      !/^(the|a|an|and|my|name|names|phone|number|cell|email|address|storm|damage|roof|leak|water|lakeview|court|street|avenue|drive|road|wisconsin|pewaukee)$/i.test(
        word
      )
  );
  if (filtered.length < 1 || filtered.length > 3) return null;
  return filtered
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

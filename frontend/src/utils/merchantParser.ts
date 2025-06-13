/**
 * Extract a readable merchant name from transaction description
 */
export function extractMerchantName(description: string): string {
  if (!description) return 'Unknown Merchant';
  
  // First, remove REF# and the following word/number
  let cleanedDescription = description.replace(/REF#\s*\S+\s*/g, '');
  
  // Common patterns to extract merchant names
  const patterns = [
    // Pattern: Direct merchant name after cleaning
    /^([A-Z][A-Z0-9\s&\-\.]+?)(?:\s+\d{2}\/\d{2}\/\d{2}|$)/i,
    
    // Pattern: "FOL# ... HOTEL_NAME MM/DD/YY"
    /FOL#\s*[\w-]+\s*([A-Z][A-Z0-9\s&\-\.]+?)\s+\d{2}\/\d{2}\/\d{2}/i,
    
    // Pattern: "R/A# ... RENTAL_COMPANY MM/DD/YY"
    /R\/A#\s*[\w-]+\s*([A-Z][A-Z0-9\s&\-\.]+?)\s+\d{2}\/\d{2}\/\d{2}/i,
    
    // Pattern: Numbers followed by merchant (like "38623862 7610205/20/25")
    /^\d+\s+\d+\/\d+\/\d+\s*\|?\s*[\d\-]+\s+[\d\s]+\|\s*([^|]+)/,
    
    // Pattern: Look for known merchant indicators after pipes
    /\|\s*([A-Za-z][A-Za-z0-9\s&\-\.]+(?:HOTEL|RESTAURANT|RENTAL|STORE|MARKET|AIRLINES?|AIRWAYS?|CAR|GAS|FUEL|HARDWARE|EQUIPMENT|SUPPLIES|SERVICES?|INC|LLC|CORP|CO\.|COMPANY))/i,
  ];
  
  // Try each pattern on cleaned description first
  for (const pattern of patterns) {
    const match = cleanedDescription.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // If no match on cleaned, try original description
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Fallback: Look for common merchant keywords in the full description
  const merchantKeywords = [
    'HOTEL', 'RESTAURANT', 'RENTAL', 'AIRLINES', 'AIRWAYS', 'STORE', 'MARKET',
    'GAS', 'FUEL', 'HARDWARE', 'EQUIPMENT', 'SUPPLIES', 'SERVICES'
  ];
  
  // Split by common delimiters and look for parts with merchant keywords
  const parts = description.split(/[|]/);
  for (const part of parts) {
    for (const keyword of merchantKeywords) {
      if (part.toUpperCase().includes(keyword)) {
        // Extract the phrase containing the keyword
        const words = part.trim().split(/\s+/);
        const keywordIndex = words.findIndex(w => w.toUpperCase().includes(keyword));
        if (keywordIndex >= 0) {
          // Take a few words around the keyword
          const start = Math.max(0, keywordIndex - 2);
          const end = Math.min(words.length, keywordIndex + 3);
          const merchantName = words.slice(start, end).join(' ').trim();
          if (merchantName.length > 3) {
            return merchantName;
          }
        }
      }
    }
  }
  
  // Final fallback: Take the first meaningful part
  const cleanParts = parts
    .map(p => p.trim())
    .filter(p => p.length > 3 && !/^[\d\s\-\/]+$/.test(p));
  
  if (cleanParts.length > 0) {
    // Skip reference numbers and dates
    for (const part of cleanParts) {
      if (!/^(REF#|FOL#|R\/A#|\d+)/.test(part)) {
        return part.substring(0, 50); // Limit length
      }
    }
  }
  
  // If all else fails, return the cleaned description truncated
  return cleanedDescription.substring(0, 30) + (cleanedDescription.length > 30 ? '...' : '');
}
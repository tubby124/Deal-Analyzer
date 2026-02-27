/**
 * extractFromPDF.js
 * Reads an MLS listing copy PDF in the browser (via pdfjs-dist) and
 * extracts property fields to pre-populate the Deal Analyzer form.
 *
 * Tuned for the standard WEBForms / SK/AB MLS full listing copy format:
 *   LP: $339,900   Location: Saskatoon   Tax Amt/Yr: $3,380 / 2024
 *   SubType: Detached   Beds: 3   Baths: 3   Nghbrhood: Fairhaven
 */

import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ─── Text Extraction ───────────────────────────────────────────────────────────
export async function extractTextFromPDF(file) {
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(it => it.str).join(" ") + "\n";
  }
  return fullText;
}

// ─── MLS-specific Field Parsers ────────────────────────────────────────────────

/** List price: "LP: $339,900" or "List Price: $339,900" */
function findPrice(text) {
  const patterns = [
    /\bLP:\s*\$\s*([\d,]+)/i,
    /\bList\s*Price:\s*\$\s*([\d,]+)/i,
    /\bAsking\s*Price:\s*\$\s*([\d,]+)/i,
    // fallback: first large dollar amount
    /\$\s*([\d]{3,}(?:,\d{3})*)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (n > 50000 && n < 5000000) return n;
    }
  }
  return null;
}

/**
 * Address: in MLS listing copy the address appears before the MLS # pattern.
 * e.g. "19 Barr Place SK008012 Sold LP: ..."
 * Also builds a full address by appending city + postal code.
 */
function findAddress(text, city, postalCode) {
  // MLS # patterns: SK######, AB######, or similar
  let addr = null;

  // Try: text before MLS-style number (SK/AB + 6 digits)
  const mlsM = text.match(/^(.*?)\s+(?:SK|AB)\d{6}/i);
  if (mlsM) {
    // The last word(s) before the MLS # that look like an address
    const candidate = mlsM[1].trim().replace(/^.*(?:Listing\s*Photos?\s*)/i, "").trim();
    if (candidate.length > 3 && candidate.length < 80) {
      addr = candidate;
    }
  }

  // Fallback: first token that looks like a civic address (number + street words)
  if (!addr) {
    const m = text.match(/\b(\d{1,5}\s+[A-Za-z][A-Za-z0-9 ]{2,35}(?:Ave|St|Rd|Dr|Blvd|Cres|Way|Lane|Place|Pl|Ct|Court|Bay|Terrace|Trail|Gate|Park|View|Walk|Grove|Row|Square|Green|Hill|Manor|Mews|Path|Ridge|Run|Wood))\b/i);
    if (m) addr = m[1].trim().replace(/\s+/g, " ");
  }

  // Build full address string
  if (addr) {
    const parts = [addr];
    if (city) parts.push(city);
    if (postalCode) parts.push(postalCode);
    return parts.join(", ");
  }
  return null;
}

/** Location field: "Location: Saskatoon" → market key */
function findMarket(text) {
  // MLS listing copy has "Location: <City>"
  const locM = text.match(/\bLocation:\s*([A-Za-z\s]+?)(?:\s{2,}|$|\n)/i);
  if (locM) {
    const loc = locM[1].trim().toLowerCase();
    if (loc.includes("calgary"))       return "calgary";
    if (loc.includes("edmonton"))      return "edmonton";
    if (loc.includes("prince albert")) return "princeAlbert";
    if (loc.includes("saskatoon"))     return "saskatoon";
  }
  // Fallback: scan full text
  const t = text.toLowerCase();
  if (t.includes("calgary"))       return "calgary";
  if (t.includes("edmonton"))      return "edmonton";
  if (t.includes("prince albert")) return "princeAlbert";
  if (t.includes("saskatoon"))     return "saskatoon";
  // Postal code prefix: S = SK, T = AB
  const postM = text.match(/Postal\s*Code:\s*([A-Z])/i);
  if (postM) {
    if (postM[1].toUpperCase() === "T") return "calgary";
    if (postM[1].toUpperCase() === "S") return "saskatoon";
  }
  return null;
}

/** City name from "Location:" field (used in address assembly) */
function findCity(text) {
  const m = text.match(/\bLocation:\s*([A-Za-z][A-Za-z\s]+?)(?:\s{2,}|$|\n)/i);
  return m ? m[1].trim() : null;
}

/** Postal code from "Postal Code: S7M 4G1" */
function findPostalCode(text) {
  const m = text.match(/Postal\s*Code:\s*([A-Z]\d[A-Z]\s*\d[A-Z]\d)/i);
  return m ? m[1].trim() : null;
}

/**
 * Property type: "SubType: Detached" → house, "SubType: Apartment" → condo
 * Also checks "Bldg Type"
 */
function findPropType(text) {
  const subM = text.match(/\bSubType:\s*([A-Za-z\s]+?)(?:\s{2,}|$|\n)/i);
  if (subM) {
    const st = subM[1].trim().toLowerCase();
    if (st.match(/apartment|condo|condominium|strata/)) return "condo";
    if (st.match(/detached|semi-?detached|bungalow|house|bi-?level|two\s*stor/)) return "house";
    if (st.match(/townhouse|town\s*house|row\s*house/)) return "condo";
  }
  const t = text.toLowerCase();
  if (t.match(/\bcondo\b|\bcondominium\b|\bapartment\b|\bstrata\b/)) return "condo";
  return "house";
}

/** Beds: "Beds: 3" */
function findBeds(text) {
  const m = text.match(/\bBeds?:\s*(\d)/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Baths: "Baths: 3" */
function findBaths(text) {
  const m = text.match(/\bBaths?:\s*(\d(?:\.\d)?)/i);
  return m ? parseFloat(m[1]) : null;
}

/** SqFt: "SqFt: 1,160" */
function findSqFt(text) {
  const m = text.match(/\bSq\.?\s*Ft\.?:\s*([\d,]+)/i)
    || text.match(/([\d,]+)\s*(?:sq\.?\s*ft|square\s*feet)/i);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}

/** Year Built: "Year Built: 1977" */
function findYearBuilt(text) {
  const m = text.match(/\bYear\s*Built:\s*(\d{4})/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Annual property tax: "Tax Amt/Yr: $3,380 / 2024" */
function findTax(text) {
  // Primary MLS pattern
  const m = text.match(/Tax\s*Amt\s*\/\s*Yr:\s*\$?\s*([\d,]+)/i)
    || text.match(/(?:Property\s*)?Tax(?:es)?\s*(?:Amt|Amount)?[^$\d]*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:\/\s*\d{4}|\/\s*yr|per\s*year|annually)?/i);
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (n > 500 && n < 30000) return Math.round(n);
  }
  return null;
}

/** Condo/strata fee: "Condo Fee: $380/mo" */
function findCondoFee(text) {
  const m = text.match(/(?:Condo|Strata|Maint(?:enance)?)\s*Fee[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:\/\s*mo|per\s*month|monthly)?/i);
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (n > 50 && n < 3000) return Math.round(n);
  }
  return null;
}

/** Neighbourhood: "Nghbrhood: Fairhaven" */
function findNeighbourhood(text) {
  const m = text.match(/\bNghbrhood:\s*([A-Za-z\s\/]+?)(?:\s{2,}|\n|$)/i)
    || text.match(/\bNeighbou?rhood:\s*([A-Za-z\s\/]+?)(?:\s{2,}|\n|$)/i);
  return m ? m[1].trim() : null;
}

/** Suite detection from description text */
function findSuites(text) {
  const units = [];
  const t = text.toLowerCase();

  if (t.match(/legal\s*suite|basement\s*suite|in-?law\s*suite|secondary\s*suite/)) {
    // Check for "Bsmt Ste #: 1" or similar
    const bsmtM = text.match(/Bsmt\s*Ste\s*#:\s*(\d)/i);
    const count = bsmtM ? parseInt(bsmtM[1]) : 1;
    for (let i = 0; i < count; i++) {
      units.push({ type: "2bed_nc", rent: null, isNc: true });
    }
  }
  if (t.match(/garage\s*suite/)) {
    units.push({ type: "1bed_nc", rent: null, isNc: true });
  }

  // Extract stated rental income if available
  const rentM = text.match(/(?:rental\s*income|rent(?:ed)?\s*for)[^\d$]*\$?\s*([\d,]+)/i);
  if (rentM && units.length > 0) {
    const r = parseInt(rentM[1].replace(/,/g, ""), 10);
    if (r > 300 && r < 5000) units[0].rent = r;
  }

  return units;
}

// ─── Main Extractor ───────────────────────────────────────────────────────────
export async function extractFromPDF(file) {
  const text = await extractTextFromPDF(file);

  const city       = findCity(text);
  const postalCode = findPostalCode(text);
  const price      = findPrice(text);
  const address    = findAddress(text, city, postalCode);
  const beds       = findBeds(text);
  const baths      = findBaths(text);
  const sqft       = findSqFt(text);
  const yearBuilt  = findYearBuilt(text);
  const tax        = findTax(text);
  const condo      = findCondoFee(text);
  const market     = findMarket(text);
  const propType   = findPropType(text);
  const hood       = findNeighbourhood(text);
  const units      = findSuites(text);

  const extracted = {};
  if (address)  extracted.address  = address;
  if (market)   extracted.market   = market;
  if (price)    extracted.price    = price;
  if (propType) extracted.propType = propType;
  if (tax)      extracted.taxOvr   = tax;
  if (condo)    extracted.condoOvr = condo;
  if (units.length > 0) extracted.units = units;

  // Build human-readable summary of what was found
  const found = [];
  if (address)   found.push(`Address: ${address}`);
  if (price)     found.push(`List Price: $${price.toLocaleString()}`);
  if (market)    found.push(`Market: ${market}`);
  if (hood)      found.push(`Neighbourhood: ${hood}`);
  if (propType)  found.push(`Type: ${propType}`);
  if (beds)      found.push(`Beds: ${beds}`);
  if (baths)     found.push(`Baths: ${baths}`);
  if (sqft)      found.push(`Size: ${sqft.toLocaleString()} sq ft`);
  if (yearBuilt) found.push(`Year Built: ${yearBuilt}`);
  if (tax)       found.push(`Property Tax: $${tax.toLocaleString()}/yr`);
  if (condo)     found.push(`Condo Fee: $${condo}/mo`);
  if (units.length > 0) found.push(`Suite detected: ${units.map(u => u.type).join(", ")} (set rent manually)`);

  // Warn about anything we couldn't find
  const missing = [];
  if (!price)   missing.push("list price");
  if (!address) missing.push("address");
  if (!market)  missing.push("market (defaulting to Saskatoon)");
  if (!tax)     missing.push("property tax");

  extracted._summary  = found;
  extracted._missing  = missing;
  extracted._rawText  = text.slice(0, 3000);

  return extracted;
}

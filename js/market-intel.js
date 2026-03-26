// BuyDirectFromUSA — Market Intelligence Module
// Lightweight compliance/market hints per country

const MARKET_DATA = {
  SA: { name:'Saudi Arabia', region:'GCC', notes:'Halal certification required for food products. Arabic labeling mandatory. SASO conformity mark needed.', labels:['Arabic'], certs:['Halal','SASO','SFDA'], docs:['COO','Commercial Invoice','Packing List','Halal Certificate'] },
  AE: { name:'UAE', region:'GCC', notes:'ESMA conformity required. Halal for food. Arabic + English labeling.', labels:['Arabic','English'], certs:['Halal','ESMA'], docs:['COO','Halal Certificate','Health Certificate'] },
  QA: { name:'Qatar', region:'GCC', notes:'Similar to Saudi requirements. QS marking for some products.', labels:['Arabic'], certs:['Halal','QS'], docs:['COO','Halal Certificate'] },
  KW: { name:'Kuwait', region:'GCC', notes:'KUCAS conformity. Halal required for food.', labels:['Arabic'], certs:['Halal','KUCAS'], docs:['COO','Halal Certificate'] },
  KE: { name:'Kenya', region:'Africa', notes:'KEBS standards. EAC mark for some products. English labeling.', labels:['English','Swahili'], certs:['KEBS'], docs:['COO','Import License','Phytosanitary Certificate'] },
  NG: { name:'Nigeria', region:'Africa', notes:'NAFDAC registration for food/pharma. SON conformity. English labeling.', labels:['English'], certs:['NAFDAC','SON'], docs:['COO','NAFDAC Registration','Form M'] },
  GH: { name:'Ghana', region:'Africa', notes:'FDA Ghana registration. GSA standards. English labeling.', labels:['English'], certs:['FDA Ghana','GSA'], docs:['COO','FDA Registration'] },
  ZA: { name:'South Africa', region:'Africa', notes:'NRCS compulsory specs. English labeling. Some products need SABS mark.', labels:['English'], certs:['NRCS','SABS'], docs:['COO','Commercial Invoice'] },
  GB: { name:'United Kingdom', region:'Europe', notes:'UKCA marking post-Brexit. English labeling. Food standards via FSA.', labels:['English'], certs:['UKCA'], docs:['COO','Commercial Invoice','Customs Declaration'] },
  DE: { name:'Germany', region:'Europe', notes:'CE marking. EU regulations. German + EU labeling requirements.', labels:['German'], certs:['CE'], docs:['COO','EUR.1','Commercial Invoice'] },
  IN: { name:'India', region:'Asia', notes:'BIS certification for many products. FSSAI for food. English + Hindi labeling.', labels:['English','Hindi'], certs:['BIS','FSSAI'], docs:['COO','Commercial Invoice','Import License'] },
  BR: { name:'Brazil', region:'Latin America', notes:'INMETRO certification. ANVISA for food/pharma. Portuguese labeling.', labels:['Portuguese'], certs:['INMETRO','ANVISA'], docs:['COO','Commercial Invoice','Import License'] },
};

export function getMarketIntel(countryCode) {
  return MARKET_DATA[countryCode?.toUpperCase()] || null;
}

export function getComplianceHints(countryCode) {
  const data = getMarketIntel(countryCode);
  if (!data) return { notes: 'No specific compliance data available for this market.', certs: [], docs: [], labels: [] };
  return data;
}

export function getAllMarketData() {
  return MARKET_DATA;
}

export function flagComplianceIssues(deal) {
  const issues = [];
  const intel = getMarketIntel(deal.target_country);
  if (!intel) { issues.push('No market intelligence for ' + (deal.target_country || 'unknown country')); return issues; }
  if (intel.certs.includes('Halal') && !deal.certifications?.toLowerCase().includes('halal')) {
    issues.push('Halal certification likely required for ' + intel.name);
  }
  if (intel.labels.length > 0 && !deal.special_notes?.toLowerCase().includes('label')) {
    issues.push('Labeling in ' + intel.labels.join('/') + ' may be required');
  }
  return issues;
}

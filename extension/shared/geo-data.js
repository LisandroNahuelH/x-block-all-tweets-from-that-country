/**
 * Geo data from xaitax/x-account-location-device (MIT).
 * Canonical English keys for matching X AboutAccountQuery locations.
 */
(function (global) {
  'use strict';

  const COUNTRY_FLAGS = {
    'afghanistan': '🇦🇫', 'albania': '🇦🇱', 'algeria': '🇩🇿', 'andorra': '🇦🇩', 'angola': '🇦🇴',
    'antigua and barbuda': '🇦🇬', 'argentina': '🇦🇷', 'armenia': '🇦🇲', 'australia': '🇦🇺', 'austria': '🇦🇹',
    'azerbaijan': '🇦🇿', 'bahamas': '🇧🇸', 'bahrain': '🇧🇭', 'bangladesh': '🇧🇩', 'barbados': '🇧🇧',
    'belarus': '🇧🇾', 'belgium': '🇧🇪', 'belize': '🇧🇿', 'benin': '🇧🇯', 'bhutan': '🇧🇹',
    'bolivia': '🇧🇴', 'bosnia and herzegovina': '🇧🇦', 'bosnia': '🇧🇦', 'botswana': '🇧🇼', 'brazil': '🇧🇷',
    'brunei': '🇧🇳', 'bulgaria': '🇧🇬', 'burkina faso': '🇧🇫', 'burundi': '🇧🇮', 'cambodia': '🇰🇭',
    'cameroon': '🇨🇲', 'canada': '🇨🇦', 'cape verde': '🇨🇻', 'central african republic': '🇨🇫', 'chad': '🇹🇩',
    'chile': '🇨🇱', 'china': '🇨🇳', 'colombia': '🇨🇴', 'comoros': '🇰🇲', 'congo': '🇨🇬',
    'costa rica': '🇨🇷', 'croatia': '🇭🇷', 'cuba': '🇨🇺', 'cyprus': '🇨🇾', 'czech republic': '🇨🇿',
    'czechia': '🇨🇿', 'democratic republic of the congo': '🇨🇩', 'denmark': '🇩🇰', 'djibouti': '🇩🇯', 'dominica': '🇩🇲',
    'dominican republic': '🇩🇴', 'east timor': '🇹🇱', 'ecuador': '🇪🇨', 'egypt': '🇪🇬', 'el salvador': '🇸🇻',
    'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'equatorial guinea': '🇬🇶', 'eritrea': '🇪🇷', 'estonia': '🇪🇪', 'eswatini': '🇸🇿',
    'ethiopia': '🇪🇹', 'europe': '🇪🇺', 'european union': '🇪🇺', 'fiji': '🇫🇯', 'finland': '🇫🇮',
    'france': '🇫🇷', 'gabon': '🇬🇦', 'gambia': '🇬🇲', 'georgia': '🇬🇪', 'germany': '🇩🇪',
    'ghana': '🇬🇭', 'greece': '🇬🇷', 'grenada': '🇬🇩', 'guatemala': '🇬🇹', 'guinea': '🇬🇳',
    'guinea-bissau': '🇬🇼', 'guyana': '🇬🇾', 'haiti': '🇭🇹', 'honduras': '🇭🇳', 'hong kong': '🇭🇰',
    'hungary': '🇭🇺', 'iceland': '🇮🇸', 'india': '🇮🇳', 'indonesia': '🇮🇩', 'iran': '🇮🇷',
    'iraq': '🇮🇶', 'ireland': '🇮🇪', 'israel': '🇮🇱', 'italy': '🇮🇹', 'ivory coast': '🇨🇮',
    'jamaica': '🇯🇲', 'japan': '🇯🇵', 'jordan': '🇯🇴', 'kazakhstan': '🇰🇿', 'kenya': '🇰🇪',
    'kiribati': '🇰🇮', 'korea': '🇰🇷', 'kosovo': '🇽🇰', 'kuwait': '🇰🇼', 'kyrgyzstan': '🇰🇬',
    'laos': '🇱🇦', 'latvia': '🇱🇻', 'lebanon': '🇱🇧', 'lesotho': '🇱🇸', 'liberia': '🇱🇷',
    'libya': '🇱🇾', 'liechtenstein': '🇱🇮', 'lithuania': '🇱🇹', 'luxembourg': '🇱🇺', 'macao': '🇲🇴',
    'macau': '🇲🇴', 'madagascar': '🇲🇬', 'malawi': '🇲🇼', 'malaysia': '🇲🇾', 'maldives': '🇲🇻',
    'mali': '🇲🇱', 'malta': '🇲🇹', 'marshall islands': '🇲🇭', 'mauritania': '🇲🇷', 'mauritius': '🇲🇺',
    'mexico': '🇲🇽', 'micronesia': '🇫🇲', 'moldova': '🇲🇩', 'monaco': '🇲🇨', 'mongolia': '🇲🇳',
    'montenegro': '🇲🇪', 'morocco': '🇲🇦', 'mozambique': '🇲🇿', 'myanmar': '🇲🇲', 'burma': '🇲🇲',
    'namibia': '🇳🇦', 'nauru': '🇳🇷', 'nepal': '🇳🇵', 'netherlands': '🇳🇱', 'new zealand': '🇳🇿',
    'nicaragua': '🇳🇮', 'niger': '🇳🇪', 'nigeria': '🇳🇬', 'north korea': '🇰🇵', 'north macedonia': '🇲🇰',
    'macedonia': '🇲🇰', 'norway': '🇳🇴', 'oman': '🇴🇲', 'pakistan': '🇵🇰', 'palau': '🇵🇼',
    'palestine': '🇵🇸', 'panama': '🇵🇦', 'papua new guinea': '🇵🇬', 'paraguay': '🇵🇾', 'peru': '🇵🇪',
    'philippines': '🇵🇭', 'poland': '🇵🇱', 'portugal': '🇵🇹', 'puerto rico': '🇵🇷', 'qatar': '🇶🇦',
    'romania': '🇷🇴', 'russia': '🇷🇺', 'russian federation': '🇷🇺', 'rwanda': '🇷🇼', 'saint kitts and nevis': '🇰🇳',
    'saint lucia': '🇱🇨', 'saint vincent and the grenadines': '🇻🇨', 'samoa': '🇼🇸', 'san marino': '🇸🇲', 'sao tome and principe': '🇸🇹',
    'saudi arabia': '🇸🇦', 'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'senegal': '🇸🇳', 'serbia': '🇷🇸', 'seychelles': '🇸🇨',
    'sierra leone': '🇸🇱', 'singapore': '🇸🇬', 'slovakia': '🇸🇰', 'slovenia': '🇸🇮', 'solomon islands': '🇸🇧',
    'somalia': '🇸🇴', 'south africa': '🇿🇦', 'south korea': '🇰🇷', 'south sudan': '🇸🇸', 'spain': '🇪🇸',
    'sri lanka': '🇱🇰', 'sudan': '🇸🇩', 'suriname': '🇸🇷', 'sweden': '🇸🇪', 'switzerland': '🇨🇭',
    'syria': '🇸🇾', 'taiwan': '🇹🇼', 'tajikistan': '🇹🇯', 'tanzania': '🇹🇿', 'thailand': '🇹🇭',
    'timor-leste': '🇹🇱', 'togo': '🇹🇬', 'tonga': '🇹🇴', 'trinidad and tobago': '🇹🇹', 'tunisia': '🇹🇳',
    'turkey': '🇹🇷', 'türkiye': '🇹🇷', 'turkmenistan': '🇹🇲', 'tuvalu': '🇹🇻', 'uganda': '🇺🇬',
    'ukraine': '🇺🇦', 'united arab emirates': '🇦🇪', 'uae': '🇦🇪', 'united kingdom': '🇬🇧', 'uk': '🇬🇧',
    'great britain': '🇬🇧', 'britain': '🇬🇧', 'united states': '🇺🇸', 'usa': '🇺🇸', 'us': '🇺🇸',
    'uruguay': '🇺🇾', 'uzbekistan': '🇺🇿', 'vanuatu': '🇻🇺', 'vatican city': '🇻🇦', 'venezuela': '🇻🇪',
    'vietnam': '🇻🇳', 'viet nam': '🇻🇳', 'wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'yemen': '🇾🇪', 'zambia': '🇿🇲', 'zimbabwe': '🇿🇼'
};

  const DUPLICATES = new Set([
    'bosnia', 'czechia', 'macedonia', 'burma', 'macau', 'uk', 'usa', 'us', 'uae',
    'britain', 'great britain'
  ]);

  const COUNTRY_LIST = Object.keys(COUNTRY_FLAGS)
    .filter(name => !DUPLICATES.has(name))
    .sort((a, b) => a.localeCompare(b));

  const REGION_DATA = [
    { name: 'Africa', key: 'africa', flag: '🌍' },
    { name: 'Australasia', key: 'australasia', flag: '🌏' },
    { name: 'East Asia & Pacific', key: 'east asia & pacific', flag: '🌏' },
    { name: 'Europe', key: 'europe', flag: '🌍' },
    { name: 'North Africa', key: 'north africa', flag: '🌍' },
    { name: 'North America', key: 'north america', flag: '🌎' },
    { name: 'South America', key: 'south america', flag: '🌎' },
    { name: 'South Asia', key: 'south asia', flag: '🌏' },
    { name: 'Southeast Asia', key: 'southeast asia', flag: '🌏' },
    { name: 'West Asia', key: 'west asia', flag: '🌍' }
];

  const REGION_KEYS = new Set(REGION_DATA.map(r => r.key));
  const COUNTRY_KEYS = new Set(COUNTRY_LIST);

  function isRegionKey(key) {
    return typeof key === 'string' && REGION_KEYS.has(key.toLowerCase());
  }

  function isCountryKey(key) {
    return typeof key === 'string' && COUNTRY_KEYS.has(key.toLowerCase());
  }

  function titleCase(name) {
    if (!name) return '';
    return String(name)
      .split(' ')
      .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  const api = {
    COUNTRY_FLAGS,
    COUNTRY_LIST,
    COUNTRY_KEYS,
    REGION_DATA,
    REGION_KEYS,
    isRegionKey,
    isCountryKey,
    titleCase
  };

  global.XCD_GEO = api;
  if (typeof self !== 'undefined') self.XCD_GEO = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);

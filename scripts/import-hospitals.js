const { createClient } = require('@supabase/supabase-js');

const API_BASE = 'https://chtn.cmchistn.com/api/v1/hospital-specialties/';
const PAGE_SIZE = 100;
const MAX_PAGES = 300;
const REQUEST_DELAY_MS = 200;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildUrl = (page) => {
  const params = new URLSearchParams({
    district: '',
    district__icontains: '',
    hosp_id: '',
    hospital: '',
    id: '',
    ordering: '-id',
    page_size: String(PAGE_SIZE),
    page: String(page),
    speciality: '',
    speciality_code: '',
    tpa: '',
  });
  return `${API_BASE}?${params.toString()}`;
};

const normalizeText = (value) => {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const mapHospital = (item) => {
  const externalId = normalizeText(item?.id ?? item?.hosp_id);
  if (!externalId) {
    return null;
  }

  const name = normalizeText(item?.hospital ?? item?.name);
  if (!name) {
    return null;
  }

  return {
    external_id: externalId,
    name,
    address: normalizeText(item?.address ?? item?.hospital_address ?? item?.location),
    phone: normalizeText(item?.phone ?? item?.contact ?? item?.mobile),
    district: normalizeText(item?.district ?? item?.district_name),
    speciality: normalizeText(item?.speciality ?? item?.specialty ?? item?.speciality_name),
    speciality_code: normalizeText(item?.speciality_code ?? item?.specialty_code),
  };
};

const fetchPage = async (page) => {
  const response = await fetch(buildUrl(page));
  if (!response.ok) {
    throw new Error(`Failed to fetch page ${page}: ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  throw new Error(`Unexpected API response for page ${page}`);
};

const upsertBatch = async (rows) => {
  const { error } = await supabase
    .from('hospitals')
    .upsert(rows, { onConflict: 'external_id' });

  if (error) {
    throw error;
  }
};

const dedupeByExternalId = (rows) => {
  const seen = new Map();
  for (const row of rows) {
    if (!row || !row.external_id) {
      continue;
    }
    if (!seen.has(row.external_id)) {
      seen.set(row.external_id, row);
    }
  }
  return Array.from(seen.values());
};

const run = async () => {
  let page = 1;
  let totalImported = 0;

  while (page <= MAX_PAGES) {
    const items = await fetchPage(page);
    if (!items.length) {
      break;
    }

    const rows = dedupeByExternalId(
      items
        .map(mapHospital)
        .filter(Boolean)
    );

    if (rows.length > 0) {
      await upsertBatch(rows);
      totalImported += rows.length;
    }

    console.log(`Page ${page}: fetched ${items.length}, upserted ${rows.length}`);

    page += 1;
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`Done. Total upserted rows: ${totalImported}`);
};

run().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});

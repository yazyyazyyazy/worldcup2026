// Fetches FIFA World Cup results from football-data.org (free tier) and writes
// results.json mapped to the bracket's match slots. Runs on Node 20+ (global fetch).
// Needs env var FD_TOKEN = your free football-data.org API token.
import { writeFileSync } from 'fs';

// ---- bracket structure (must mirror the site) ----
const FIX = {
  m1:['GER','PAR'], m2:['FRA','SWE'], m3:['RSA','CAN'], m4:['NED','MAR'],
  m5:['POR','CRO'], m6:['ESP','AUT'], m7:['USA','BIH'], m8:['BEL','SEN'],
  m9:['BRA','JPN'], m10:['CIV','NOR'], m11:['MEX','ECU'], m12:['ENG','COD'],
  m13:['ARG','CPV'], m14:['AUS','EGY'], m15:['SUI','ALG'], m16:['COL','GHA']
};
const TREE = {
  l1:['m1','m2'], l2:['m3','m4'], l3:['m5','m6'], l4:['m7','m8'],
  r1:['m9','m10'], r2:['m11','m12'], r3:['m13','m14'], r4:['m15','m16'],
  lq1:['l1','l2'], lq2:['l3','l4'], rq1:['r1','r2'], rq2:['r3','r4'],
  lsf:['lq1','lq2'], rsf:['rq1','rq2'], fin:['lsf','rsf']
};

// football-data sometimes uses different 3-letter codes than ours — normalise here.
// If a finished game doesn't show up on the site, add the mismatching code below.
const ALIAS = {
  DZA:'ALG',  // Algeria
  IVO:'CIV', CIV:'CIV',
  CGO:'COD', DRC:'COD',
  CPV:'CPV',
  RSA:'RSA', SAF:'RSA',
  SUI:'SUI', SWZ:'SUI'
};
const norm = (t) => (t ? (ALIAS[t] || t) : t);
const pairKey = (x, y) => [x, y].sort().join('|');

async function main() {
  const TOKEN = process.env.FD_TOKEN;
  if (!TOKEN) { console.error('Missing FD_TOKEN env var'); process.exit(1); }

  const resp = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': TOKEN }
  });
  if (!resp.ok) { console.error('API error', resp.status, await resp.text()); process.exit(1); }
  const data = await resp.json();

  const finished = (data.matches || [])
    .filter(m => m.status === 'FINISHED' || m.status === 'AWARDED')
    .map(m => {
      const h = norm(m.homeTeam && m.homeTeam.tla);
      const a = norm(m.awayTeam && m.awayTeam.tla);
      let w = null;
      const winner = m.score && m.score.winner;
      if (winner === 'HOME_TEAM') w = h;
      else if (winner === 'AWAY_TEAM') w = a;
      return { h, a, w };
    })
    .filter(x => x.h && x.a && x.w);

  const winByPair = {};
  finished.forEach(f => { winByPair[pairKey(f.h, f.a)] = f.w; });

  const results = {};
  // Round of 32 — match by the two teams in each fixture
  for (const mid in FIX) {
    const [x, y] = FIX[mid];
    const w = winByPair[pairKey(x, y)];
    if (w) results[mid] = w;
  }
  // Later rounds — resolve once both feeder matches are decided
  let changed = true;
  while (changed) {
    changed = false;
    for (const mid in TREE) {
      if (results[mid]) continue;
      const [ca, cb] = TREE[mid];
      if (results[ca] && results[cb]) {
        const w = winByPair[pairKey(results[ca], results[cb])];
        if (w) { results[mid] = w; changed = true; }
      }
    }
  }

  const out = {
    updated: new Date().toUTCString(),
    results
  };
  writeFileSync('results.json', JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote results.json with', Object.keys(results).length, 'decided matches.');
}

main().catch(e => { console.error(e); process.exit(1); });

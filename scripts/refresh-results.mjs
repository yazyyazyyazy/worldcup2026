// Fetches FIFA World Cup results from football-data.org (free tier) and writes
// results.json mapped to the bracket's match slots. Node 20+ (global fetch).
// Needs env var FD_TOKEN = your free football-data.org API token.
//
// Handles penalty shootouts, matches teams by full name (more robust than 3-letter
// codes), and is "sticky": anything already decided in results.json is kept, so a
// manual fix or a tricky result never gets wiped by a later run.
import { readFileSync, writeFileSync, existsSync } from 'fs';

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

// Match teams by full name first (most reliable), then fall back to 3-letter code.
const NAME2CODE = {
  'germany':'GER','paraguay':'PAR','france':'FRA','sweden':'SWE','south africa':'RSA',
  'canada':'CAN','netherlands':'NED','morocco':'MAR','portugal':'POR','croatia':'CRO',
  'spain':'ESP','austria':'AUT','usa':'USA','united states':'USA','united states of america':'USA',
  'bosnia and herzegovina':'BIH','bosnia & herzegovina':'BIH','belgium':'BEL','senegal':'SEN',
  'brazil':'BRA','japan':'JPN',"côte d'ivoire":'CIV','cote d\'ivoire':'CIV','ivory coast':'CIV',
  'norway':'NOR','mexico':'MEX','ecuador':'ECU','england':'ENG','congo dr':'COD','dr congo':'COD',
  'democratic republic of the congo':'COD','argentina':'ARG','cape verde':'CPV','cabo verde':'CPV',
  'australia':'AUS','egypt':'EGY','switzerland':'SUI','algeria':'ALG','colombia':'COL','ghana':'GHA'
};
const TLA_ALIAS = { DZA:'ALG', RSA:'RSA', CIV:'CIV', COD:'COD' };

function codeOf(team){
  if(!team) return null;
  const byName = NAME2CODE[(team.name||'').toLowerCase().trim()];
  if(byName) return byName;
  const t = team.tla;
  return t ? (TLA_ALIAS[t]||t) : null;
}
// Decide a winner, including penalty shootouts.
function decide(m){
  const s = m.score || {};
  if(s.winner === 'HOME_TEAM') return 'H';
  if(s.winner === 'AWAY_TEAM') return 'A';
  const p = s.penalties || {};
  if(typeof p.home === 'number' && typeof p.away === 'number' && p.home !== p.away)
    return p.home > p.away ? 'H' : 'A';
  return null; // genuinely undecided (e.g. draw with no shootout data yet)
}
const pairKey = (x,y) => [x,y].sort().join('|');

async function main(){
  const TOKEN = process.env.FD_TOKEN;
  if(!TOKEN){ console.error('Missing FD_TOKEN env var'); process.exit(1); }

  // sticky: start from whatever's already decided
  let results = {};
  if(existsSync('results.json')){
    try { results = (JSON.parse(readFileSync('results.json','utf8')).results) || {}; } catch(e){}
  }

  const resp = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': TOKEN }
  });
  if(!resp.ok){ console.error('API error', resp.status, await resp.text()); process.exit(1); }
  const data = await resp.json();

  const winByPair = {};
  let count = 0;
  for(const m of (data.matches || [])){
    if(!(m.status === 'FINISHED' || m.status === 'AWARDED')) continue;
    const h = codeOf(m.homeTeam), a = codeOf(m.awayTeam);
    const d = decide(m);
    const w = d === 'H' ? h : d === 'A' ? a : null;
    console.log(`finished: ${(m.homeTeam&&m.homeTeam.name)||'?'} (${h}) vs ${(m.awayTeam&&m.awayTeam.name)||'?'} (${a}) -> ${w||'UNDECIDED'}`);
    count++;
    if(h && a && w) winByPair[pairKey(h,a)] = w;
  }
  console.log(`${count} finished matches in feed`);

  // Round of 32 — feed decides each fixture
  for(const mid in FIX){ const [x,y] = FIX[mid]; const w = winByPair[pairKey(x,y)]; if(w) results[mid] = w; }
  // Later rounds — resolve once both feeders are decided
  let changed = true;
  while(changed){
    changed = false;
    for(const mid in TREE){
      if(results[mid]) continue;
      const [ca, cb] = TREE[mid];
      if(results[ca] && results[cb]){
        const w = winByPair[pairKey(results[ca], results[cb])];
        if(w){ results[mid] = w; changed = true; }
      }
    }
  }

  writeFileSync('results.json', JSON.stringify({ updated: new Date().toUTCString(), results }, null, 2) + '\n');
  console.log('Wrote results.json with', Object.keys(results).length, 'decided matches.');
}
main().catch(e => { console.error(e); process.exit(1); });

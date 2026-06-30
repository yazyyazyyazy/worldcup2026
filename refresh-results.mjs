// Fetches FIFA World Cup KNOCKOUT results from ESPN's free public API and writes
// results.json mapped to the bracket. Node 20+ (global fetch). NO API key needed.
//
// Why ESPN: each team carries an `advance` flag marking who progresses — including
// penalty-shootout winners — so shootouts resolve automatically (football-data
// reported them as plain draws). Still "sticky": anything already in results.json
// is kept, so a manual fix is never wiped.

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

// Resolve ESPN teams to our codes — by full name first, then abbreviation.
const NAME2CODE = {
  'germany':'GER','paraguay':'PAR','france':'FRA','sweden':'SWE','south africa':'RSA',
  'canada':'CAN','netherlands':'NED','morocco':'MAR','portugal':'POR','croatia':'CRO',
  'spain':'ESP','austria':'AUT','united states':'USA','usa':'USA',
  'bosnia-herzegovina':'BIH','bosnia and herzegovina':'BIH','bosnia & herzegovina':'BIH',
  'belgium':'BEL','senegal':'SEN','brazil':'BRA','japan':'JPN',
  'ivory coast':'CIV',"cote d'ivoire":'CIV',
  'norway':'NOR','mexico':'MEX','ecuador':'ECU','england':'ENG',
  'dr congo':'COD','congo dr':'COD','democratic republic of the congo':'COD',
  'argentina':'ARG','cape verde':'CPV','cabo verde':'CPV','australia':'AUS','egypt':'EGY',
  'switzerland':'SUI','algeria':'ALG','colombia':'COL','ghana':'GHA'
};
const ABBR_ALIAS = { DZA:'ALG', CGO:'COD' };

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=300&dates=20260626-20260720';
const pairKey = (x,y) => [x,y].sort().join('|');

function codeOf(team){
  if(!team) return null;
  const byName = NAME2CODE[(team.displayName||team.name||'').toLowerCase().trim()];
  if(byName) return byName;
  const ab = (team.abbreviation||'').toUpperCase();
  return ABBR_ALIAS[ab] || ab || null;
}

async function main(){
  // sticky: keep whatever's already decided
  let results = {};
  if(existsSync('results.json')){
    try { results = (JSON.parse(readFileSync('results.json','utf8')).results) || {}; } catch(e){}
  }

  const resp = await fetch(ESPN_URL, { headers: { 'accept':'application/json' } });
  if(!resp.ok){ console.error('ESPN error', resp.status, await resp.text()); process.exit(1); }
  const data = await resp.json();

  const winByPair = {};
  let fin = 0;
  for(const ev of (data.events || [])){
    const slug = (ev.season && ev.season.slug) || '';
    if(slug === 'group-stage') continue;                    // knockouts only
    const comp = (ev.competitions && ev.competitions[0]) || {};
    if(/group/i.test(comp.altGameNote || '')) continue;     // belt and suspenders
    const st = (comp.status && comp.status.type) || {};
    if(!(st.completed === true || st.state === 'post')) continue;
    const cs = comp.competitors || [];
    if(cs.length < 2) continue;
    // who advances? shootout winners carry `advance:true` even after a level score
    const adv = cs.find(c => c.advance === true) || cs.find(c => c.winner === true);
    if(!adv) continue;                                       // not yet resolved
    const h = codeOf(cs[0].team), a = codeOf(cs[1].team), w = codeOf(adv.team);
    if(!h || !a || !w) continue;
    winByPair[pairKey(h,a)] = w;
    const pens = (comp.details || []).some(d => d.shootout === true);
    console.log(`KO ${slug||'knockout'}: ${cs[0].team.abbreviation} v ${cs[1].team.abbreviation} -> ${adv.team.abbreviation}${pens?' (pens)':''}`);
    fin++;
  }
  console.log(`${fin} finished knockout matches in feed`);

  // Round of 32 — feed decides each fixture
  for(const mid in FIX){ const [x,y] = FIX[mid]; const w = winByPair[pairKey(x,y)]; if(w) results[mid] = w; }
  // Later rounds — resolve once both feeders are known
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

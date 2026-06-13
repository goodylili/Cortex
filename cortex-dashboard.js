/* ============================================================
   DATA: two namespaces, fully stateful
============================================================ */
const STATE = {
 ns: 'odds-watch',
 memFilter: 'all',
 memView: 'list',
 namespaces: {

 /* ---------------- odds-watch ---------------- */
 'odds-watch': {
  agents:[
   {name:'bet9ja-watcher',key:'0x3b1d…90af',sessions:2},
   {name:'sportybet-watcher',key:'0x88c2…17be',sessions:2},
   {name:'stake-watcher',key:'0xd40a…5c33',sessions:1},
   {name:'dream-worker',key:'0x7f2a…c41e',sessions:0,dream:true},
  ],
  mems:[
   {id:'mem_38',text:'stake cashout settled fast again, 84s on EPL',agent:'stake-watcher',via:'analyze',when:'6h ago',dup:true},
   {id:'mem_31',text:'SportyBet slow to update odds on EPL match',agent:'bet9ja-watcher',via:'remember',when:'14h ago',dup:true},
   {id:'mem_32',text:'noticed sportybet lag on Arsenal v Spurs goal markets',agent:'sportybet-watcher',via:'analyze',when:'9h ago',dup:true},
   {id:'mem_33',text:'SportyBet odds stale vs Stake after goal event',agent:'stake-watcher',via:'remember',when:'6h ago',dup:true},
   {id:'mem_34',text:'sportybet EPL odds behind again',agent:'sportybet-watcher',via:'remember',when:'3h ago',dup:true},
   {id:'mem_35',text:'EPL: sportybet slower than stake on in-play',agent:'bet9ja-watcher',via:'remember',when:'22h ago',dup:true},
   {id:'mem_29',text:'Bet9ja offers a corners handicap market on La Liga fixtures',agent:'bet9ja-watcher',via:'remember',when:'3d ago'},
   {id:'mem_27',text:'Stake settles cashouts within 90s on EPL markets',agent:'stake-watcher',via:'analyze',when:'2d ago',dup:true},
   {id:'mem_25',text:'Kalshi binary markets quote both sides past 02:00 WAT',agent:'sportybet-watcher',via:'analyze',when:'4d ago'},
   {id:'mem_22',text:'Polymarket resolution sources differ from Kalshi on the same event class. Map both before quoting a TROJAN HORSE slip.',agent:'stake-watcher',via:'analyze',when:'5d ago',verified:true},
   {id:'mem_19',text:'Bet9ja in-play API rate limits at 30 req/min per IP. Rotate through the proxy mesh.',agent:'bet9ja-watcher',via:'remember',when:'6d ago',verified:true},
   {id:'mem_14',text:'Normalize decimal odds before computing full-cover combinatorics. Fractional inputs from Bet9ja break the slip builder.',agent:'sportybet-watcher',via:'analyze',when:'1w ago',verified:true},
  ],
  versions:[
   {hash:'b3f9a1',msg:'remembered a manual correction to the lag pattern',agentName:'goodylili',when:'4m ago',plus:1,minus:0,head:true,source:'mcp'},
   {hash:'9c41de',msg:'persisted a run outcome from the agent',agentName:'risk-agent',when:'2h ago',plus:1,minus:0,source:'langchain'},
   {hash:'a91f3c',msg:'sportybet-watcher wrote 2 entries via remember()',agentName:'sportybet-watcher',when:'19m ago',plus:2,minus:0},
   {hash:'7c20e8',msg:'stake-watcher wrote 1 entry via analyze()',agentName:'stake-watcher',when:'6h ago',plus:1,minus:0},
   {hash:'7e22aa',msg:'synced CLAUDE.md edits back to memory',agentName:'claude-code',when:'8h ago',plus:1,minus:0,source:'claude-code'},
   {hash:'f04b11',msg:'Dream drm_0141 applied: 3 consolidations, 1 verification',agentName:'dream-worker',when:'1d ago',plus:1,minus:3,dreamed:true},
   {hash:'3d98a0',msg:'bet9ja-watcher wrote 3 entries via remember()',agentName:'bet9ja-watcher',when:'1d ago',plus:3,minus:0},
   {hash:'b7715f',msg:'sportybet-watcher wrote 2 entries via analyze()',agentName:'sportybet-watcher',when:'2d ago',plus:2,minus:0},
   {hash:'c61e02',msg:'stake-watcher wrote 1 entry via analyze()',agentName:'stake-watcher',when:'4d ago',plus:1,minus:0},
   {hash:'000000',msg:'Namespace created: odds-watch',agentName:'owner',when:'1w ago',plus:0,minus:0,genesis:true},
  ],
  transcripts:[
   {id:'ses_a93f',agent:'stake-watcher',entries:212,blob:'xWblb…a93f',when:'6m'},
   {id:'ses_90d2',agent:'sportybet-watcher',entries:178,blob:'xWblb…90d2',when:'3h'},
   {id:'ses_81c0',agent:'sportybet-watcher',entries:240,blob:'xWblb…81c0',when:'9h'},
   {id:'ses_77b1',agent:'bet9ja-watcher',entries:195,blob:'xWblb…77b1',when:'14h'},
   {id:'ses_64aa',agent:'bet9ja-watcher',entries:203,blob:'xWblb…64aa',when:'22h'},
  ],
  lines:{
   'ses_a93f':[
    {ts:'09:02:11',role:'system',cls:'r-sys',body:'stake-watcher booted. namespace=odds-watch delegate=0xd40a…5c33'},
    {ts:'09:02:14',role:'tool',cls:'r-tool',body:'poll_odds(stake, EPL) → 38 markets, 12 in-play'},
    {ts:'09:06:40',role:'tool',cls:'r-tool',body:'goal_event: ARS 1-0 TOT at 09:06:38Z. stake repriced in 2.1s'},
    {ts:'09:07:19',role:'agent',cls:'r-agent',body:'cross-check sportybet for the same market',hl:1},
    {ts:'09:07:21',role:'tool',cls:'r-tool',body:'poll_odds(sportybet, ARSvTOT) → odds unchanged since 09:05:58Z',hl:1},
    {ts:'09:07:22',role:'agent',cls:'r-agent',body:'sportybet still quoting pre-goal price 41s after the goal. stale window.',hl:1},
    {ts:'09:07:23',role:'memory',cls:'r-mem',body:'remember("SportyBet odds stale vs Stake after goal event")',hl:1},
    {ts:'09:14:02',role:'tool',cls:'r-tool',body:'cashout_check(stake, slip#2231) → settled in 84s'},
    {ts:'09:14:03',role:'memory',cls:'r-mem',body:'analyze("stake cashout settled fast again, 84s on EPL")'},
    {ts:'09:31:57',role:'system',cls:'r-sys',body:'cortex.capture → sealed → walrus blob xWblb…a93f'},
   ],
   'ses_77b1':[
    {ts:'19:11:03',role:'system',cls:'r-sys',body:'bet9ja-watcher booted. namespace=odds-watch delegate=0x3b1d…90af'},
    {ts:'19:13:40',role:'tool',cls:'r-tool',body:'fetch_market(bet9ja, corners_handicap, RMAvBAR) → 404',hl:1},
    {ts:'19:18:42',role:'tool',cls:'r-tool',body:'fetch_market(bet9ja, corners_handicap, RMAvBAR) → 404',hl:1},
    {ts:'19:23:44',role:'tool',cls:'r-tool',body:'fetch_market(bet9ja, corners_handicap, RMAvBAR) → 404',hl:1},
    {ts:'19:23:45',role:'agent',cls:'r-agent',body:'corners handicap gone for 3 consecutive polls. likely delisted.',hl:1},
    {ts:'19:41:30',role:'memory',cls:'r-mem',body:'remember("SportyBet slow to update odds on EPL match")'},
    {ts:'20:02:09',role:'system',cls:'r-sys',body:'cortex.capture → sealed → walrus blob xWblb…77b1'},
   ],
   'ses_81c0':[
    {ts:'00:40:21',role:'system',cls:'r-sys',body:'sportybet-watcher booted. namespace=odds-watch delegate=0x88c2…17be'},
    {ts:'00:55:02',role:'tool',cls:'r-tool',body:'goal_event: ARS 2-0 TOT. sportybet repriced at +38s',hl:1},
    {ts:'00:55:04',role:'memory',cls:'r-mem',body:'analyze("noticed sportybet lag on Arsenal v Spurs goal markets")',hl:1},
    {ts:'01:58:44',role:'tool',cls:'r-tool',body:'poll_odds(kalshi) → binary markets two-sided at 02:01 WAT'},
    {ts:'02:14:09',role:'system',cls:'r-sys',body:'cortex.capture → sealed → walrus blob xWblb…81c0'},
   ],
   'ses_90d2':[
    {ts:'06:20:00',role:'system',cls:'r-sys',body:'sportybet-watcher booted. namespace=odds-watch delegate=0x88c2…17be'},
    {ts:'06:44:13',role:'tool',cls:'r-tool',body:'goal_event: MCI 1-0 LIV. sportybet repriced at +42s',hl:1},
    {ts:'06:44:14',role:'memory',cls:'r-mem',body:'remember("sportybet EPL odds behind again")',hl:1},
    {ts:'07:30:18',role:'system',cls:'r-sys',body:'cortex.capture → sealed → walrus blob xWblb…90d2'},
   ],
   'ses_64aa':[
    {ts:'11:05:31',role:'system',cls:'r-sys',body:'bet9ja-watcher booted. namespace=odds-watch delegate=0x3b1d…90af'},
    {ts:'11:36:50',role:'tool',cls:'r-tool',body:'goal_event: CHE 1-1 MUN. stake repriced 1.8s, sportybet +39s',hl:1},
    {ts:'11:36:52',role:'memory',cls:'r-mem',body:'remember("EPL: sportybet slower than stake on in-play")',hl:1},
    {ts:'12:10:44',role:'system',cls:'r-sys',body:'cortex.capture → sealed → walrus blob xWblb…64aa'},
   ],
   'ses_b110':[
    {ts:'10:01:00',role:'system',cls:'r-sys',body:'stake-watcher booted. namespace=odds-watch delegate=0xd40a…5c33'},
    {ts:'10:18:22',role:'tool',cls:'r-tool',body:'cashout_check(stake, slip#2287) → settled in 78s',hl:1},
    {ts:'10:42:05',role:'tool',cls:'r-tool',body:'rate_probe(bet9ja) → throttled at 30 req/min, matches mem_19',hl:1},
    {ts:'11:03:40',role:'system',cls:'r-sys',body:'cortex.capture → sealed → walrus blob xWblb…b110'},
   ],
  },
  dreams:[
   {id:'drm_0142',status:'pending',when:'2m ago',window:'last 24h',model:'claude-sonnet-4-6',promptV:'v3',
    summary:'4 operations over 5 transcripts',breakdown:'1 consolidate · 1 pattern · 1 prune · 1 verify',
    diffBlob:'Qm9dDiff…0142',inputs:['ses_77b1','ses_81c0','ses_a93f','ses_90d2','ses_64aa'],incidents:14,
    ops:[
     {type:'consolidate',title:'Merge 5 duplicate lag observations into one',conf:.94,
      lines:[
       ['del','SportyBet slow to update odds on EPL match (bet9ja-watcher, ses_77b1)'],
       ['del','noticed sportybet lag on Arsenal v Spurs goal markets (sportybet-watcher, ses_81c0)'],
       ['del','SportyBet odds stale vs Stake after goal event (stake-watcher, ses_a93f)'],
       ['del','sportybet EPL odds behind again (sportybet-watcher, ses_90d2)'],
       ['del','EPL: sportybet slower than stake on in-play (bet9ja-watcher, ses_64aa)'],
       ['add','SportyBet in-play odds on EPL markets consistently lag Stake. Confirmed across 3 agents and 5 sessions.'],
      ],evidence:['ses_77b1','ses_81c0','ses_a93f','ses_90d2','ses_64aa']},
     {type:'pattern',title:'Cross-agent pattern no single agent observed',conf:.89,
      lines:[
       ['add','SportyBet odds lag Stake by ~40s on goal events. Observed in 14 incidents across 3 agents. Arbitrage window opens in the first 40s after a goal: read Stake, act on SportyBet.'],
       ['ctx','derived from timestamp deltas across sessions; no individual transcript states this'],
      ],evidence:['ses_a93f','ses_81c0','ses_64aa'],extra:'+ 14 cited incidents'},
     {type:'prune',title:'Tombstone a stale memory',conf:.97,
      lines:[
       ['del','Bet9ja offers a corners handicap market on La Liga fixtures'],
       ['ctx','contradicted: ses_77b1 shows the market returned 404 in 3 consecutive polls on Jun 11. tombstoned as superseded, not deleted.'],
      ],evidence:['ses_77b1']},
     {type:'verify',title:'Stamp 2 memories as confirmed against fresh evidence',conf:.92,
      lines:[
       ['ctx','Stake settles cashouts within 90s on EPL markets → verified at 2026-06-12T09:14Z'],
       ['ctx','Kalshi binary markets quote both sides past 02:00 WAT → verified at 2026-06-12T09:14Z'],
      ],evidence:['ses_a93f','ses_90d2']},
    ],
    effects:{
     add:[
      {id:'mem_36',text:'SportyBet in-play odds on EPL markets consistently lag Stake. Confirmed across 3 agents and 5 sessions.',agent:'dream-worker',via:'consolidate',when:'just now',dream:true},
      {id:'mem_37',text:'SportyBet odds lag Stake by ~40s on goal events. Observed in 14 incidents across 3 agents. Arbitrage window opens in the first 40s after a goal: read Stake, act on SportyBet.',agent:'dream-worker',via:'pattern',when:'just now',dream:true},
     ],
     tombstone:[
      {id:'mem_31',note:'superseded by mem_36 (drm_0142)'},{id:'mem_32',note:'superseded by mem_36 (drm_0142)'},
      {id:'mem_33',note:'superseded by mem_36 (drm_0142)'},{id:'mem_34',note:'superseded by mem_36 (drm_0142)'},
      {id:'mem_35',note:'superseded by mem_36 (drm_0142)'},
      {id:'mem_29',note:'tombstoned by drm_0142: market 404 in ses_77b1'},
     ],
     verify:['mem_27','mem_25'],
     version:{hash:'e2c4d7',msg:'Dream drm_0142 applied: 1 consolidation, 1 pattern, 1 prune, 2 verifications',plus:2,minus:6},
    }},
   {id:'drm_0141',status:'applied',when:'1d ago',window:'last 48h',model:'claude-sonnet-4-6',promptV:'v3',
    summary:'4 operations over 7 transcripts',breakdown:'3 consolidate · 1 verify',
    diffBlob:'Qm4cDiff…0141',inputs:['ses_64aa','ses_77b1'],incidents:6,appliedVersion:'f04b11',
    ops:[
     {type:'consolidate',title:'Merge 3 duplicate rate-limit observations',conf:.95,
      lines:[
       ['del','bet9ja throttling me again (bet9ja-watcher)'],
       ['del','bet9ja api 429 after burst (bet9ja-watcher)'],
       ['del','rate limited polling bet9ja in-play (sportybet-watcher)'],
       ['add','Bet9ja in-play API rate limits at 30 req/min per IP. Rotate through the proxy mesh.'],
      ],evidence:['ses_64aa']},
     {type:'consolidate',title:'Merge 2 odds-format notes',conf:.91,
      lines:[
       ['del','bet9ja sends fractional odds on some markets'],
       ['del','slip builder crashed on fractional input'],
       ['add','Normalize decimal odds before computing full-cover combinatorics. Fractional inputs from Bet9ja break the slip builder.'],
      ],evidence:['ses_77b1']},
     {type:'consolidate',title:'Merge 2 resolution-source notes',conf:.88,
      lines:[
       ['del','polymarket resolved differently than kalshi on same event'],
       ['del','check resolution source before cross-platform slips'],
       ['add','Polymarket resolution sources differ from Kalshi on the same event class. Map both before quoting a TROJAN HORSE slip.'],
      ],evidence:['ses_64aa']},
     {type:'verify',title:'Stamp 1 memory as confirmed',conf:.9,
      lines:[['ctx','Bet9ja in-play API rate limits at 30 req/min per IP → verified at 2026-06-11T08:02Z']],evidence:['ses_77b1']},
    ]},
   {id:'drm_0140',status:'empty',when:'3d ago',window:'last 24h',model:'claude-sonnet-4-6',promptV:'v2',
    summary:'No operations proposed',breakdown:'window contained 1 transcript, below evidence threshold',
    diffBlob:null,inputs:['ses_64aa'],incidents:0,ops:[]},
  ],
  activity:[
   {actor:'dream',label:'dream',main:'Dream job drm_0142 awaiting review',sub:'4 operations · 5 input transcripts',blob:'Qm9dDiff…0142',kind:'diff artifact',when:'2m ago'},
   {actor:'agent',label:'stake',main:'Transcript captured and sealed',sub:'session ses_a93f · 212 entries',blob:'xWblb…a93f',kind:'transcript blob',when:'6m ago'},
   {actor:'agent',label:'sportybet',main:'remember() wrote 2 entries',sub:'odds lag observation, EPL markets',blob:'0x55e1…f201',kind:'sui txn',when:'19m ago'},
   {actor:'dream',label:'dream',main:'Dream job drm_0141 applied',sub:'3 consolidations · 1 verification',blob:'Qm4cDiff…0141',kind:'diff artifact',when:'1d ago'},
  ],
  blobMB:7.4, nextSes:'ses_b110', dreamSeq:143,
 },

 /* ---------------- slip-builder ---------------- */
 'slip-builder': {
  agents:[
   {name:'slip-composer',key:'0x11ab…44ce',sessions:2},
   {name:'risk-guardian',key:'0x9c03…d2f7',sessions:1},
   {name:'dream-worker',key:'0x7f2a…c41e',sessions:0,dream:true},
  ],
  mems:[
   {id:'mem_09',text:'Full-cover 3-way slips above 6 legs exceed Bet9ja max combination count. Cap legs at 6.',agent:'risk-guardian',via:'analyze',when:'1d ago',verified:true},
   {id:'mem_08',text:'Dead Reckoning II stake split assumes independent legs. Same-match legs are correlated, flag them.',agent:'risk-guardian',via:'analyze',when:'2d ago',verified:true},
   {id:'mem_07',text:'kalshi fees eat thin ROI slips under 2.1% edge',agent:'slip-composer',via:'remember',when:'2d ago',dup:true},
   {id:'mem_06',text:'fees on kalshi kill sub-2% edges',agent:'slip-composer',via:'remember',when:'3d ago',dup:true},
   {id:'mem_04',text:'TROJAN HORSE slips need both binary sides quoted within 90s of each other or the cover breaks.',agent:'slip-composer',via:'analyze',when:'4d ago'},
  ],
  versions:[
   {hash:'d77a02',msg:'risk-guardian wrote 1 entry via analyze()',agentName:'risk-guardian',when:'1d ago',plus:1,minus:0,head:true},
   {hash:'9b3c61',msg:'Dream drm_0098 applied: 2 consolidations',agentName:'dream-worker',when:'2d ago',plus:1,minus:2,dreamed:true},
   {hash:'41e0fa',msg:'slip-composer wrote 3 entries via remember()',agentName:'slip-composer',when:'3d ago',plus:3,minus:0},
   {hash:'000000',msg:'Namespace created: slip-builder',agentName:'owner',when:'5d ago',plus:0,minus:0,genesis:true},
  ],
  transcripts:[
   {id:'ses_c201',agent:'slip-composer',entries:96,blob:'xWblb…c201',when:'1d'},
   {id:'ses_c114',agent:'risk-guardian',entries:140,blob:'xWblb…c114',when:'2d'},
  ],
  lines:{
   'ses_c201':[
    {ts:'14:02:10',role:'system',cls:'r-sys',body:'slip-composer booted. namespace=slip-builder delegate=0x11ab…44ce'},
    {ts:'14:20:33',role:'tool',cls:'r-tool',body:'build_slip(full_cover_3way, 7 legs) → rejected: exceeds bet9ja combo cap',hl:1},
    {ts:'14:20:35',role:'memory',cls:'r-mem',body:'analyze("cap full-cover 3-way at 6 legs on bet9ja")',hl:1},
    {ts:'15:01:00',role:'system',cls:'r-sys',body:'cortex.capture → sealed → walrus blob xWblb…c201'},
   ],
   'ses_c114':[
    {ts:'10:11:02',role:'system',cls:'r-sys',body:'risk-guardian booted. namespace=slip-builder delegate=0x9c03…d2f7'},
    {ts:'10:30:15',role:'tool',cls:'r-tool',body:'simulate(dead_reckoning_2, correlated legs) → variance 3.1x model',hl:1},
    {ts:'10:30:18',role:'memory',cls:'r-mem',body:'analyze("DRII assumes independence, flag same-match legs")',hl:1},
    {ts:'11:12:40',role:'system',cls:'r-sys',body:'cortex.capture → sealed → walrus blob xWblb…c114'},
   ],
  },
  dreams:[
   {id:'drm_0098',status:'applied',when:'2d ago',window:'last 72h',model:'claude-sonnet-4-6',promptV:'v3',
    summary:'2 operations over 3 transcripts',breakdown:'2 consolidate',
    diffBlob:'Qm2aDiff…0098',inputs:['ses_c114'],incidents:3,appliedVersion:'9b3c61',
    ops:[
     {type:'consolidate',title:'Merge correlated-legs notes',conf:.9,
      lines:[
       ['del','same match legs move together'],
       ['del','correlation broke the stake split model'],
       ['add','Dead Reckoning II stake split assumes independent legs. Same-match legs are correlated, flag them.'],
      ],evidence:['ses_c114']},
     {type:'consolidate',title:'Merge combo-cap notes',conf:.93,
      lines:[
       ['del','bet9ja rejected the 7 leg cover'],
       ['del','combo count limit somewhere around 6 legs'],
       ['add','Full-cover 3-way slips above 6 legs exceed Bet9ja max combination count. Cap legs at 6.'],
      ],evidence:['ses_c114']},
    ]},
  ],
  activity:[
   {actor:'agent',label:'risk',main:'analyze() wrote 1 entry',sub:'Dead Reckoning II correlation note',blob:'0x71aa…03bd',kind:'sui txn',when:'1d ago'},
   {actor:'dream',label:'dream',main:'Dream job drm_0098 applied',sub:'2 consolidations',blob:'Qm2aDiff…0098',kind:'diff artifact',when:'2d ago'},
  ],
  blobMB:2.1, nextSes:'ses_c305', dreamSeq:99,
 },
}};

function ns(){return STATE.namespaces[STATE.ns]}
function findDream(id){return ns().dreams.find(d=>d.id===id)}
function esc(s){return s.replace(/'/g,"\\'")}

/* ============================================================
   NAMESPACE SWITCHER
============================================================ */
function toggleNsMenu(e){
  e.stopPropagation();
  const m=document.getElementById('ns-menu');
  m.innerHTML=Object.keys(STATE.namespaces).map(k=>{
    const d=STATE.namespaces[k];
    return `<button class="${k===STATE.ns?'cur':''}" onclick="switchNs('${k}')">${k===STATE.ns?'●':'○'} ${k}<span class="nsm-sub">${d.mems.length} mem</span></button>`;
  }).join('');
  m.classList.toggle('show');
}
document.addEventListener('click',()=>document.getElementById('ns-menu').classList.remove('show'));
function switchNs(k){
  STATE.ns=k; STATE.memFilter='all'; STATE.memView='list';
  PS.touched=false; PS.selTouched=false; PS.sel=new Set(); PS.format='system';
  MM.sel=null;
  document.getElementById('ns-current').textContent=k;
  document.getElementById('mem-search').value='';
  renderAll();
  if(location.hash.startsWith('#/dream/')) location.hash='#/dreams';
  toast('Switched to namespace '+k);
}

/* ============================================================
   RENDER: OVERVIEW
============================================================ */
function liveMems(){return ns().mems.filter(m=>!m.stale)}
function renderOverview(){
  const d=ns();
  const live=liveMems(), tomb=d.mems.filter(m=>m.stale);
  const ver=d.mems.filter(m=>m.verified&&!m.stale).length;
  document.getElementById('ov-crumb').textContent=STATE.ns;
  const diffCount=d.dreams.filter(x=>x.diffBlob).length;
  const dev=isDev();
  const ovStats=document.getElementById('ov-stats');
  ovStats.className='grid '+(dev?'g4':'g3');
  ovStats.innerHTML=`
   <div class="card stat"><div class="k">Memories</div><div class="v">${live.length}</div><div class="d">${tomb.length} tombstoned · ${ver} verified</div></div>
   <div class="card stat"><div class="k">Transcripts</div><div class="v">${d.transcripts.length}</div><div class="d">last capture ${d.transcripts[0].when} ago</div></div>
   <div class="card stat"><div class="k">Memory versions</div><div class="v">${d.versions.length}</div><div class="d">head ${d.versions[0].hash}</div></div>
   ${dev?`<div class="card stat"><div class="k">Walrus blobs</div><div class="v">${d.mems.length+d.transcripts.length+diffCount}</div><div class="d">${d.blobMB} <span style="color:var(--faint)">MB on testnet</span></div></div>`:''}`;
  const dup=live.filter(m=>m.dup).length, pat=live.filter(m=>m.via==='pattern').length;
  const pct=n=>live.length?Math.round(n/live.length*100):0;
  const dupP=pct(dup),verP=pct(ver),patP=pct(pat),staleP=d.mems.length?Math.round(tomb.length/d.mems.length*100):0;
  const note=dupP>25?'duplicate rate is high. a dream pass is recommended.':'namespace is clean. next dream runs on schedule.';
  document.getElementById('ov-health').innerHTML=`
   <div class="bar-row"><span class="lbl">verified</span><div class="bar"><div class="fill" style="width:${verP}%;background:var(--blue)"></div></div><span class="num">${verP}%</span></div>
   <div class="bar-row"><span class="lbl">duplicates</span><div class="bar"><div class="fill" style="width:${dupP}%;background:var(--amber)"></div></div><span class="num">${dupP}%</span></div>
   <div class="bar-row"><span class="lbl">tombstoned</span><div class="bar"><div class="fill" style="width:${staleP}%;background:var(--red)"></div></div><span class="num">${staleP}%</span></div>
   <div class="bar-row"><span class="lbl">cross-agent</span><div class="bar"><div class="fill" style="width:${patP}%;background:var(--purple)"></div></div><span class="num">${patP}%</span></div>
   <div class="xs faint" style="margin-top:10px;font-family:var(--mono)">${note}</div>`;
  document.getElementById('ov-agents').innerHTML=`
   <div class="stat"><div class="k">Agents on this namespace</div></div>
   <div style="display:flex;flex-direction:column;gap:9px;margin-top:12px">
   ${d.agents.map(a=>`<div style="display:flex;align-items:center;gap:9px"><span class="tag ${a.dream?'dream':'agent'}">${a.name}</span><span class="mono xs faint">${a.key}</span><span class="mono xs faint" style="margin-left:auto">${a.dream?'read + write':a.sessions+' sessions'}</span></div>`).join('')}
   </div>`;
  const aCols=dev?'110px 1fr 150px 110px':'110px 1fr 110px';
  document.getElementById('ov-activity').innerHTML=`
   <div class="tr th" style="grid-template-columns:${aCols}"><span>actor</span><span>event</span>${dev?'<span>artifact</span>':''}<span>when</span></div>
   ${d.activity.map(a=>`<div class="tr" style="grid-template-columns:${aCols}">
     <span class="tag ${a.actor}">${a.label}</span>
     <div><div class="cell-main">${a.main}</div><div class="cell-sub">${a.sub}</div></div>
     ${dev?`<span class="blob" onclick="openBlob('${a.blob}','${a.kind}')">${a.blob}</span>`:''}
     <span class="mono xs faint">${a.when}</span></div>`).join('')}`;
  const pending=d.dreams.filter(x=>x.status==='pending').length;
  const pill=document.getElementById('pendingPill');
  pill.style.display=pending?'':'none';
  pill.textContent=pending+' pending';
}

/* ============================================================
   RENDER: MEMORIES
============================================================ */
function setMemFilter(f){STATE.memFilter=f;renderMemories()}
function setMemView(v){
  STATE.memView=v;
  document.getElementById('mem-list-view').style.display=v==='list'?'':'none';
  document.getElementById('mem-map-view').style.display=v==='map'?'':'none';
  document.querySelectorAll('#mem-views button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  if(v==='map') renderMindmap();
}
function renderMemViews(){
  const d=ns();
  const live=d.mems.filter(m=>!m.stale).length;
  const clusters=mmClusters().length;
  document.getElementById('mem-views').innerHTML=`
    <button data-v="list" onclick="setMemView('list')"><svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>List<span class="cbadge">${live}</span></button>
    <button data-v="map" onclick="setMemView('map')"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="6" r="1.8"/><circle cx="19" cy="6" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/><path d="M10.4 10.6L6.4 7.2M13.6 10.7l3.8-3.4M10.5 13.6L7 17M13.7 13.5l3.2 3.1"/></svg>Map<span class="cbadge">${clusters}</span></button>`;
}
function renderMemFilters(){
  const d=ns();
  const counts={
    all:d.mems.length,
    live:d.mems.filter(m=>!m.stale).length,
    verified:d.mems.filter(m=>m.verified&&!m.stale).length,
    tomb:d.mems.filter(m=>m.stale).length,
    dream:d.mems.filter(m=>m.dream).length,
  };
  const labels={all:'all',live:'live',verified:'verified',tomb:'tombstoned',dream:'dreamed'};
  document.getElementById('mem-filters').innerHTML=['all','live','verified','tomb','dream'].map(f=>
    `<button class="${STATE.memFilter===f?'on':''}" onclick="setMemFilter('${f}')">${labels[f]}<span class="cbadge">${counts[f]}</span></button>`).join('');
}
function renderMemories(){
  const d=ns(); const q=(document.getElementById('mem-search').value||'').toLowerCase();
  document.getElementById('mem-crumb').textContent=STATE.ns+' / memories';
  renderMemViews(); renderMemFilters(); renderMemPresets();
  setMemView(STATE.memView||'list');
  let list=[...d.mems];
  if(STATE.memFilter==='live') list=list.filter(m=>!m.stale);
  if(STATE.memFilter==='verified') list=list.filter(m=>m.verified&&!m.stale);
  if(STATE.memFilter==='tomb') list=list.filter(m=>m.stale);
  if(STATE.memFilter==='dream') list=list.filter(m=>m.dream);
  if(q) list=list.filter(m=>(m.text+m.agent+m.id).toLowerCase().includes(q));
  const el=document.getElementById('memlist');
  if(!list.length){el.innerHTML='<div class="empty">No memories match this filter.<div class="mono">try clearing the search or switching to all</div></div>';return}
  el.innerHTML=list.map(m=>`
    <div class="mem ${m.stale?'is-stale':''}">
      <div class="mtop">
        <span class="mono xs faint">${m.id}</span>
        ${m.dream?'<span class="tag '+(m.via==='pattern'?'pattern':'consolidate')+'">'+m.via+'</span>':''}
        ${m.verified&&!m.stale?'<span class="tag verify">verified</span>':''}
        ${m.stale?'<span class="tag stale">tombstoned</span>':''}
        ${!m.dream&&!m.stale&&m.dup?'<span class="tag pending">likely duplicate</span>':''}
      </div>
      <div class="mtext">${m.text}</div>
      <div class="mmeta">
        <span class="tag ${m.dream?'dream':'agent'}">${m.agent}</span>
        <span class="sep">·</span><span>${m.via==='consolidate'||m.via==='pattern'?'dream op':m.via+'()'}</span>
        <span class="sep">·</span><span>${m.when}</span>
        ${m.tomb?'<span class="sep">·</span><span style="color:var(--amber)">'+m.tomb+'</span>':''}
      </div>
    </div>`).join('');
}

/* ============================================================
   RENDER: TIMELINE
============================================================ */
function tlPlatform(v){return v.source||'app'}
function setTlSource(s){STATE.tlSource=s;renderTimeline()}
function renderTimeline(){
  const d=ns();
  document.getElementById('tl-crumb').textContent=STATE.ns+' / timeline';
  const order=['app','mcp','langchain','llamaindex','vercel','claude-code','cursor'];
  const sources=[...new Set(d.versions.map(tlPlatform))].sort((a,b)=>((order.indexOf(a)+1)||99)-((order.indexOf(b)+1)||99));
  const sel=STATE.tlSource||'all';
  document.getElementById('tl-sources').innerHTML=['all',...sources].map(s=>{
    const count=s==='all'?d.versions.length:d.versions.filter(v=>tlPlatform(v)===s).length;
    return '<button class="'+(sel===s?'on':'')+'" onclick="setTlSource(\''+s+'\')">'+s+'<span class="cbadge">'+count+'</span></button>';
  }).join('');
  const list=sel==='all'?d.versions:d.versions.filter(v=>tlPlatform(v)===sel);
  document.getElementById('vchain').innerHTML=list.map(v=>{
    const src=tlPlatform(v);
    const ext=src!=='app';
    // writes that don't come from the app are shown as  [source]: description
    const msg=ext?'<span style="font-family:var(--mono);color:var(--teal)">['+src+']:</span> '+v.msg:v.msg;
    const plain=ext?'['+src+']: '+v.msg:v.msg;
    return `
    <div class="vnode ${v.dreamed?'dreamed':''} ${v.head?'head':''}">
      <div class="vcard" onclick="openVersion('${v.hash}','${v.agentName}','${v.when}','${esc(plain)}')">
        <div class="vtop">
          <span class="vtag">${v.hash}</span>
          ${v.head?'<span class="tag applied">head</span>':''}
          ${ext?'<span class="tag dream">'+src+'</span>':''}
          ${v.dreamed?'<span class="tag dream">dream</span>':''}
          ${v.genesis?'<span class="tag agent">genesis</span>':''}
          <div class="vstats">${v.plus?'<span class="plus">+'+v.plus+'</span>':''}${v.minus?'<span class="minus">−'+v.minus+'</span>':''}</div>
        </div>
        <div class="vmsg">${msg}</div>
        <div class="vmeta"><span>by ${v.agentName}</span><span>${v.when}</span><span>sui 0x${v.hash}…${v.hash.slice(0,2)}f</span></div>
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   RENDER: DREAMS LIST + DETAIL
============================================================ */
function statusTag(s){
  return {pending:'<span class="tag pending">awaiting review</span>',applied:'<span class="tag applied">applied</span>',
   running:'<span class="tag running"><span class="spinner"></span> running</span>',empty:'<span class="tag empty-t">empty</span>',
   rejected:'<span class="tag rejected">rejected</span>'}[s];
}
function renderDreams(){
  const d=ns();
  document.getElementById('dr-crumb').textContent=STATE.ns+' / dreams';
  const dev=isDev();
  const cols=dev?'100px 1fr 170px 130px 100px':'100px 1fr 130px 100px';
  document.getElementById('dreamtbl').innerHTML=`
   <div class="tr th" style="grid-template-columns:${cols}"><span>job</span><span>summary</span>${dev?'<span>diff artifact</span>':''}<span>status</span><span>when</span></div>
   ${d.dreams.map(j=>`
    <div class="tr click" style="grid-template-columns:${cols}" onclick="location.hash='#/dream/${j.id}'">
      <span class="mono sm">${j.id}</span>
      <div><div class="cell-main">${j.summary}</div><div class="cell-sub">${j.breakdown}</div></div>
      ${dev?(j.diffBlob?`<span class="blob" onclick="event.stopPropagation();openBlob('${j.diffBlob}','diff artifact')">${j.diffBlob}</span>`:'<span class="mono xs faint">no diff emitted</span>'):''}
      <span>${statusTag(j.status)}</span><span class="mono xs faint">${j.when}</span>
    </div>`).join('')}`;
}
function renderDreamDetail(id){
  const j=findDream(id); const root=document.getElementById('dd-root'); const dev=isDev();
  if(!j){root.innerHTML='<div class="empty">Dream not found in this namespace.<div class="mono"><a href="#/dreams" style="color:var(--teal)">back to dreams</a></div></div>';return}
  let actions='';
  if(j.status==='pending') actions=`<button class="btn danger" onclick="rejectDream('${j.id}')">Reject</button><button class="btn primary" onclick="applyDream('${j.id}')">Approve and apply</button>`;
  else if(j.status==='applied') actions=`<a class="btn" href="#/memories">View memory state</a>${j.appliedVersion?`<a class="btn teal" href="#/timeline">View version ${j.appliedVersion}</a>`:''}`;
  else if(j.status==='rejected') actions=`<a class="btn" href="#/dreams">Back to dreams</a>`;
  const opsHtml=j.status==='running'
    ? `<div class="vlog" id="dream-progress"></div>`
    : j.ops.length
    ? `<div class="section-h">${j.status==='applied'?'applied diff':'proposed diff'}</div>`+j.ops.map(op=>`
      <div class="op ${op.type}"><div class="op-rail"><div class="op-bar"></div><div class="op-body">
        <div class="op-head"><span class="tag ${op.type}">${op.type}</span><span class="op-title">${op.title}</span><span class="op-confidence">confidence ${op.conf.toFixed(2)}</span></div>
        ${op.lines.map(l=>`<div class="diffline ${l[0]}">${l[1]}</div>`).join('')}
        <div class="op-evidence"><span class="lbl">evidence</span>
          ${op.evidence.map(s=>`<span class="blob" onclick="openEvidence('${s}','${j.id}')">${s}</span>`).join('')}
          ${op.extra?`<span class="mono xs faint">${op.extra}</span>`:''}
        </div>
      </div></div></div>`).join('')
    : `<div class="empty">This dream emitted no operations.<div class="mono">${j.breakdown}</div></div>`;
  root.innerHTML=`
   <div class="head">
    <div>
      <div class="crumb"><a href="#/dreams">dreams</a> / ${j.id}</div>
      <div class="h1">${j.id} ${statusTag(j.status)}</div>
      <div class="sub">Window: ${j.window} · ${j.inputs.length} input transcript${j.inputs.length===1?'':'s'} · model ${j.model} · prompt ${j.promptV}</div>
    </div>
    <div class="head-actions">${actions}</div>
   </div>
   <div class="grid ${dev?'g3':'g2'}" style="margin-bottom:24px">
    <div class="card stat"><div class="k">Operations</div><div class="v">${j.ops.length}</div><div class="d">${j.breakdown}</div></div>
    <div class="card stat"><div class="k">Evidence</div><div class="v">${j.inputs.length} <span class="unit">${dev?'blobs':'sources'}</span></div><div class="d">${j.incidents} incidents cited</div></div>
    ${dev?`<div class="card stat"><div class="k">Diff artifact</div><div class="v" style="font-size:14px;padding-top:6px">${j.diffBlob?`<span class="blob" onclick="openBlob('${j.diffBlob}','diff artifact')">${j.diffBlob}</span>`:'<span class="mono xs faint">none</span>'}</div><div class="d">${j.diffBlob?'committed before apply':'below evidence threshold'}</div></div>`:''}
   </div>
   ${opsHtml}`;
}

/* ============================================================
   DREAM ACTIONS
============================================================ */
function applyDream(id){
  const d=ns(); const j=findDream(id);
  if(!j||j.status!=='pending') return;
  const fx=j.effects||{};
  (fx.tombstone||[]).forEach(t=>{const m=d.mems.find(x=>x.id===t.id); if(m){m.stale=true;m.tomb=t.note;m.dup=false}});
  (fx.verify||[]).forEach(vid=>{const m=d.mems.find(x=>x.id===vid); if(m){m.verified=true;m.dup=false}});
  (fx.add||[]).forEach(nm=>d.mems.unshift(nm));
  if(fx.version){
    d.versions[0].head=false;
    d.versions.unshift({...fx.version,agentName:'dream-worker',when:'just now',dreamed:true,head:true});
    j.appliedVersion=fx.version.hash;
  }
  j.status='applied';
  d.activity.unshift({actor:'dream',label:'dream',main:'Dream job '+id+' applied',sub:j.breakdown,blob:j.diffBlob,kind:'diff artifact',when:'just now'});
  renderAll(); renderDreamDetail(id);
  toast('Diff committed to Walrus, then applied through MemWal. New head: '+(fx.version?fx.version.hash:'unchanged'));
}
function rejectDream(id){
  const j=findDream(id); if(!j||j.status!=='pending') return;
  j.status='rejected';
  ns().activity.unshift({actor:'dream',label:'dream',main:'Dream job '+id+' rejected',sub:'diff artifact retained on Walrus as a record',blob:j.diffBlob,kind:'diff artifact',when:'just now'});
  renderAll(); renderDreamDetail(id);
  toast('Dream rejected. The diff stays on Walrus as a record. Memory unchanged.');
}

function newDream(){
  const d=ns();
  if(d.dreams.some(x=>x.status==='running')){toast('A dream is already running in this namespace.');return}
  const id='drm_0'+(d.dreamSeq++);
  const isOdds=STATE.ns==='odds-watch';
  const job={id,status:'running',when:'just now',window:'last 24h',model:'claude-sonnet-4-6',promptV:'v3',
   summary:'Running over recent transcripts…',breakdown:'scanning window',diffBlob:null,
   inputs:isOdds?['ses_b110','ses_a93f','ses_90d2']:['ses_c201','ses_c114'],incidents:0,ops:[]};
  d.dreams.unshift(job);
  renderDreams();
  location.hash='#/dream/'+id;
  setTimeout(()=>simulateDream(job,isOdds),50);
}
function simulateDream(job,isOdds){
  const log=document.getElementById('dream-progress'); if(!log) return;
  log.innerHTML='<div class="ln" style="opacity:1"><span class="st info">$</span><span class="body faint">cortex dream --namespace '+STATE.ns+' --window 24h</span></div>';
  const steps=isOdds?[
   ['run','resolving window: '+job.inputs.length+' transcripts found, 1 new since last dream'],
   ['ok','fetched '+job.inputs.join(', ')+' from walrus'],
   ['run','seal decrypt with delegate 0x7f2a…c41e…'],
   ['ok','decrypted. 426 entries in scope'],
   ['run','recalling current memory state via memwal…'],
   ['ok','memory state loaded at head'],
   ['run','consolidation pass (claude-sonnet-4-6, prompt v3)…'],
   ['ok','found 2 near-duplicate cashout notes (mem_27, mem_38)'],
   ['ok','found fresh evidence confirming mem_19 (rate limit probe in ses_b110)'],
   ['run','committing diff artifact to walrus before anything mutates…'],
   ['ok','diff committed: <span class="hl">Qm7eDiff…'+job.id.slice(-4)+'</span>'],
   ['ok','<span class="hl">dream complete.</span> 2 operations await your review.'],
  ]:[
   ['run','resolving window: '+job.inputs.length+' transcripts found'],
   ['ok','fetched '+job.inputs.join(', ')+' from walrus'],
   ['run','seal decrypt with delegate 0x7f2a…c41e…'],
   ['ok','decrypted. 236 entries in scope'],
   ['run','consolidation pass (claude-sonnet-4-6, prompt v3)…'],
   ['ok','found 2 duplicate kalshi fee notes (mem_06, mem_07)'],
   ['run','committing diff artifact to walrus before anything mutates…'],
   ['ok','diff committed: <span class="hl">Qm7eDiff…'+job.id.slice(-4)+'</span>'],
   ['ok','<span class="hl">dream complete.</span> 1 operation awaits your review.'],
  ];
  let i=0;
  const iv=setInterval(()=>{
    const cur=document.getElementById('dream-progress');
    if(!cur){clearInterval(iv);finishDream(job,isOdds);return}
    if(i>=steps.length){clearInterval(iv);setTimeout(()=>finishDream(job,isOdds),350);return}
    const [st,body]=steps[i++];
    const icon=st==='ok'?'<span class="st ok">✓</span>':'<span class="st run">●</span>';
    cur.insertAdjacentHTML('beforeend',`<div class="ln">${icon}<span class="body">${body}</span></div>`);
  },340);
}
function finishDream(job,isOdds){
  job.status='pending';
  job.diffBlob='Qm7eDiff…'+job.id.slice(-4);
  if(isOdds){
   job.summary='2 operations over '+job.inputs.length+' transcripts';
   job.breakdown='1 consolidate · 1 verify';
   job.incidents=4;
   job.ops=[
    {type:'consolidate',title:'Merge 2 cashout-speed notes',conf:.92,
     lines:[
      ['del','Stake settles cashouts within 90s on EPL markets'],
      ['del','stake cashout settled fast again, 84s on EPL'],
      ['add','Stake cashouts settle in under 90s on EPL markets. Repeatedly confirmed (84s, 78s in latest sessions).'],
     ],evidence:['ses_a93f','ses_b110']},
    {type:'verify',title:'Confirm rate-limit memory against fresh probe',conf:.95,
     lines:[['ctx','Bet9ja in-play API rate limits at 30 req/min per IP → re-verified at 2026-06-12T10:42Z (ses_b110)']],
     evidence:['ses_b110']},
   ];
   job.effects={
    add:[{id:'mem_39',text:'Stake cashouts settle in under 90s on EPL markets. Repeatedly confirmed (84s, 78s in latest sessions).',agent:'dream-worker',via:'consolidate',when:'just now',dream:true}],
    tombstone:[{id:'mem_27',note:'superseded by mem_39 ('+job.id+')'},{id:'mem_38',note:'superseded by mem_39 ('+job.id+')'}],
    verify:['mem_19'],
    version:{hash:'b3f9a1',msg:'Dream '+job.id+' applied: 1 consolidation, 1 verification',plus:1,minus:2},
   };
   const d=STATE.namespaces['odds-watch'];
   if(!d.transcripts.some(t=>t.id==='ses_b110'))
    d.transcripts.unshift({id:'ses_b110',agent:'stake-watcher',entries:118,blob:'xWblb…b110',when:'1h'});
  } else {
   job.summary='1 operation over '+job.inputs.length+' transcripts';
   job.breakdown='1 consolidate';
   job.incidents=2;
   job.ops=[
    {type:'consolidate',title:'Merge 2 Kalshi fee notes',conf:.9,
     lines:[
      ['del','kalshi fees eat thin ROI slips under 2.1% edge'],
      ['del','fees on kalshi kill sub-2% edges'],
      ['add','Kalshi fees erase edges under roughly 2%. Floor slip ROI at 2.1% before quoting.'],
     ],evidence:['ses_c201','ses_c114']},
   ];
   job.effects={
    add:[{id:'mem_10',text:'Kalshi fees erase edges under roughly 2%. Floor slip ROI at 2.1% before quoting.',agent:'dream-worker',via:'consolidate',when:'just now',dream:true}],
    tombstone:[{id:'mem_06',note:'superseded by mem_10 ('+job.id+')'},{id:'mem_07',note:'superseded by mem_10 ('+job.id+')'}],
    verify:[],
    version:{hash:'c8d017',msg:'Dream '+job.id+' applied: 1 consolidation',plus:1,minus:2},
   };
  }
  ns().activity.unshift({actor:'dream',label:'dream',main:'Dream job '+job.id+' awaiting review',sub:job.breakdown,blob:job.diffBlob,kind:'diff artifact',when:'just now'});
  renderAll();
  if(location.hash==='#/dream/'+job.id) renderDreamDetail(job.id);
  toast('Dream '+job.id+' finished. Diff is on Walrus and awaiting your review.');
}

/* ============================================================
   RENDER: TRANSCRIPTS
============================================================ */
function renderTranscripts(){
  const d=ns();
  document.getElementById('tr-crumb').textContent=STATE.ns+' / transcripts';
  const dev=isDev();
  const cols=dev?'120px 1fr 130px 150px 90px':'120px 1fr 130px 90px';
  document.getElementById('trtbl').innerHTML=`
   <div class="tr th" style="grid-template-columns:${cols}"><span>session</span><span>agent</span><span>entries</span>${dev?'<span>walrus blob</span>':''}<span>when</span></div>
   ${d.transcripts.map(t=>`
    <div class="tr click" style="grid-template-columns:${cols}" onclick="openEvidence('${t.id}')">
      <span class="mono sm">${t.id}</span><div><span class="tag agent">${t.agent}</span></div>
      <span class="mono xs dim">${t.entries} · sealed</span>
      ${dev?`<span class="blob" onclick="event.stopPropagation();openBlob('${t.blob}','transcript blob')">${t.blob}</span>`:''}
      <span class="mono xs faint">${t.when}</span>
    </div>`).join('')}`;
}

/* ============================================================
   VERIFY
============================================================ */
let verifying=false;
function renderVerify(){
  document.getElementById('vf-crumb').textContent=STATE.ns+' / verify';
  document.getElementById('vlog').innerHTML='<div class="ln" style="opacity:1"><span class="st info">$</span><span class="body faint">cortex verify --namespace '+STATE.ns+' --bypass-relayer</span></div>';
  ['vf-walrus','vf-hash','vf-sui'].forEach(i=>document.getElementById(i).textContent=', ');
}
function runVerify(){
  if(verifying) return; verifying=true;
  const d=ns();
  const btn=document.getElementById('verifyBtn'); btn.disabled=true; btn.textContent='Verifying…';
  const log=document.getElementById('vlog');
  log.innerHTML='<div class="ln" style="opacity:1"><span class="st info">$</span><span class="body faint">cortex verify --namespace '+STATE.ns+' --bypass-relayer</span></div>';
  const memBlobs=d.mems.length, ts=d.transcripts.length, diffs=d.dreams.filter(x=>x.diffBlob).length;
  const total=memBlobs;
  const dreamWrites=d.mems.filter(m=>m.dream).length;
  const steps=[
   ['run','resolving namespace manifest from sui (gRPC, no relayer)…'],
   ['ok',`manifest found. ${memBlobs} memory blobs, ${ts} transcript blobs, ${diffs} diff artifact${diffs===1?'':'s'}`],
   ['run','fetching blobs from public aggregator aggregator.walrus-testnet…'],
   ...d.transcripts.slice(0,5).map(t=>['ok',`${t.blob}  fetched  hash <span class="hl">match</span>`]),
   ['ok',`memory blobs ${total}/${total} fetched, all hashes <span class="hl">match</span>`],
   ['run','checking seal decryption policy against delegate 0x7f2a…c41e…'],
   ['ok','seal policy passed. decryption rights confirmed on chain'],
   ['run','walking attribution: signed delegate txns per memory write…'],
   ['ok',`${total}/${total} writes attributed. ${dreamWrites} by dream-worker, ${total-dreamWrites} by agents`],
   ['ok','<span class="hl">verification complete.</span> this namespace survives without the relayer.'],
  ];
  let i=0;
  const iv=setInterval(()=>{
    if(i>=steps.length){clearInterval(iv);verifying=false;btn.disabled=false;btn.textContent='Run verification';
      document.getElementById('vf-walrus').textContent=total+'/'+total;
      document.getElementById('vf-hash').textContent=total+'/'+total;
      document.getElementById('vf-sui').textContent=total+'/'+total;return}
    const [st,body]=steps[i++];
    const icon=st==='ok'?'<span class="st ok">✓</span>':'<span class="st run">●</span>';
    log.insertAdjacentHTML('beforeend',`<div class="ln">${icon}<span class="body">${body}</span></div>`);
    log.parentElement.scrollTop=log.parentElement.scrollHeight;
  },240);
}

/* ============================================================
   SETTINGS: keys
============================================================ */
const KEYS=[
 {name:'bet9ja-watcher',key:'0x3b1d…90af',scope:'read + write',ns:'odds-watch',created:'Jun 5',status:'active'},
 {name:'sportybet-watcher',key:'0x88c2…17be',scope:'read + write',ns:'odds-watch',created:'Jun 5',status:'active'},
 {name:'stake-watcher',key:'0xd40a…5c33',scope:'read + write',ns:'odds-watch',created:'Jun 6',status:'active'},
 {name:'slip-composer',key:'0x11ab…44ce',scope:'read + write',ns:'slip-builder',created:'Jun 7',status:'active'},
 {name:'risk-guardian',key:'0x9c03…d2f7',scope:'read + write',ns:'slip-builder',created:'Jun 7',status:'active'},
 {name:'dream-worker',key:'0x7f2a…c41e',scope:'read + write',ns:'all namespaces',created:'Jun 5',status:'active',dream:true},
 {name:'inspector-readonly',key:'0xe5b8…1f09',scope:'read only',ns:'all namespaces',created:'Jun 8',status:'active'},
 {name:'old-prototype-key',key:'0x02cd…77a4',scope:'read + write',ns:'odds-watch',created:'Jun 1',status:'revoked'},
];
function renderKeys(){
  document.getElementById('keytbl').innerHTML=`
   <div class="tr th" style="grid-template-columns:1fr 140px 120px 140px 90px 90px"><span>delegate</span><span>key</span><span>scope</span><span>namespace</span><span>since</span><span></span></div>
   ${KEYS.map((k,i)=>`
    <div class="tr" style="grid-template-columns:1fr 140px 120px 140px 90px 90px">
      <div><span class="tag ${k.status==='revoked'?'revoked':k.dream?'dream':'agent'}">${k.name}</span></div>
      <span class="mono xs ${k.status==='revoked'?'faint':'dim'}">${k.key}</span>
      <span class="mono xs ${k.scope==='read only'?'faint':'dim'}">${k.scope}</span>
      <span class="mono xs faint">${k.ns}</span>
      <span class="mono xs faint">${k.created}</span>
      ${k.status==='revoked'
        ?'<span class="mono xs faint">revoked</span>'
        :`<button class="fbtn" onclick="revokeKey(${i})">revoke</button>`}
    </div>`).join('')}`;
}
function revokeKey(i){
  const k=KEYS[i];
  if(k.dream){toast('Revoking the dream-worker would stop consolidation. Rotate it instead from a new key.');return}
  k.status='revoked';
  renderKeys();
  toast('Seal policy updated on chain. '+k.name+' can no longer decrypt this account.');
}
function newKey(){
  const hex=()=>Math.floor(Math.random()*65536).toString(16).padStart(4,'0');
  const key='0x'+hex()+'…'+hex();
  KEYS.unshift({name:'delegate-'+hex(),key,scope:'read + write',ns:STATE.ns,created:'Jun 12',status:'active'});
  renderKeys();
  toast('Delegate key created and added to the Seal permission group: '+key);
}

/* ============================================================
   DRAWER
============================================================ */
function openDrawer(title,sub,html){
  document.getElementById('dw-title').textContent=title;
  document.getElementById('dw-sub').textContent=sub;
  document.getElementById('dw-body').innerHTML=html;
  document.getElementById('drawer').classList.add('show');
  document.getElementById('scrim').classList.add('show');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('scrim').classList.remove('show');
}
function openBlob(id,kind){
  openDrawer(kind,'content-addressed artifact on walrus testnet',`
    <div class="kv">
      <span class="k">blob id</span><span class="v">${id}</span>
      <span class="k">kind</span><span class="v">${kind}</span>
      <span class="k">encryption</span><span class="v">seal · policy 0x9a31…04dd</span>
      <span class="k">size</span><span class="v">${kind.includes('diff')?'18.2 KB':kind.includes('txn')?'n/a (sui txn)':'612 KB'}</span>
      <span class="k">stored</span><span class="v">epoch 412 · auto-extended</span>
      <span class="k">sui object</span><span class="v">0x${id.slice(-4)}d…77e1</span>
      <span class="k">aggregator</span><span class="v">aggregator.walrus-testnet/v1/${id}</span>
    </div>
    <div class="section-h" style="margin-top:6px">independence check</div>
    <p class="sm dim" style="line-height:1.7">This artifact is fetchable from any public Walrus aggregator without Cortex or the MemWal relayer. The blob ID is the hash of its content: if anyone can fetch it, anyone can verify it.</p>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn teal" onclick="toast('Fetched from public aggregator. Hash match.')">Fetch from aggregator</button>
      <button class="btn" onclick="toast('Sui object opened in explorer (prototype).')">Open on Sui</button>
    </div>`);
}
function openVersion(hash,agent,when,msg){
  openDrawer('Version '+hash,'memory state at this point',`
    <div class="kv">
      <span class="k">state hash</span><span class="v">${hash}</span>
      <span class="k">message</span><span class="v" style="font-family:var(--sans)">${msg}</span>
      <span class="k">written by</span><span class="v">${agent}</span>
      <span class="k">when</span><span class="v">${when}</span>
      <span class="k chainy">sui txn</span><span class="v chainy">0x${hash}f7…2200</span>
      <span class="k chainy">precondition</span><span class="v chainy">parent hash checked before write (optimistic concurrency)</span>
    </div>
    <div class="section-h" style="margin-top:6px">restore this version</div>
    <p class="sm dim" style="line-height:1.7">Any version can be reconstructed and replayed to reproduce the exact memory state agents saw at ${when}.</p>
    <div style="margin-top:16px"><button class="btn" onclick="toast('Version ${hash} reconstructed in read-only mode.')">Reconstruct read-only</button></div>
    <div class="chainy"><div class="section-h">on-chain</div>
      <p class="sm dim" style="line-height:1.7">This state is reconstructable from Walrus blobs alone, no relayer, no Cortex. The chain up to ${hash} is the source of truth.</p></div>`);
}
function openEvidence(ses,dreamId){
  const lines=ns().lines[ses]||[];
  const cite=dreamId?'highlighted lines are cited by dream '+dreamId:'highlighted lines were cited as evidence';
  openDrawer('Transcript '+ses,'sealed evidence blob · '+cite,`
    <div class="term">
      <div class="term-head"><span style="color:var(--teal)">●</span> ${ses} · decrypted via seal with delegate 0x7f2a…c41e</div>
      <div class="term-body">${lines.length?lines.map(l=>`
        <div class="tl ${l.hl?'hl':''}"><span class="ts">${l.ts}</span><span class="role ${l.cls}">${l.role}</span><span class="body">${l.body}</span></div>`).join(''):'<div class="tl"><span class="body" style="color:var(--faint)">transcript content not cached locally. fetch it from the aggregator.</span></div>'}
      </div>
    </div>
    <p class="xs faint" style="margin-top:12px;font-family:var(--mono)">highlighted entries are the exact lines the dream cited as evidence. nothing in a diff exists without a line like these behind it.</p>`);
}

/* ============================================================
   HELPERS: escape / copy / download
============================================================ */
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function copyText(txt,msg){
  const done=()=>toast(msg||'Copied to clipboard');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,()=>fallbackCopy(txt,done));}
  else fallbackCopy(txt,done);
}
function fallbackCopy(txt,done){
  const ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}
  document.body.removeChild(ta);done();
}
function dlText(name,txt){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));
  a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}

/* ============================================================
   COLLABORATION
============================================================ */
const COLLAB={
 'odds-watch':{
  stats:[
   {k:'Cross-agent recalls',v:'47',d:'last 7 days · memories read by a non-author'},
   {k:'Duplicate writes',v:'−79%',d:'5.2/day → 1.1/day since dreams enabled'},
   {k:'Recall hit rate',v:'81%',d:'was 38% before consolidation'},
   {k:'Probes avoided',v:'31',d:'rate-limit hits skipped via mem_19 recalls'},
  ],
  matrix:{
   agents:['bet9ja-watcher','sportybet-watcher','stake-watcher'],
   rows:[[null,6,9],[4,null,7],[12,5,null]],
  },
  events:[
   {reader:'stake-watcher',mem:'mem_19',author:'bet9ja-watcher',what:'Recalled the 30 req/min rate limit before probing Bet9ja',win:'avoided a 429 burst · 0 throttled requests this session',when:'1h ago'},
   {reader:'sportybet-watcher',mem:'mem_14',author:'sportybet-watcher',what:'Recalled odds-normalization rule before handing legs to slip-builder',win:'fractional inputs converted, no downstream crash',when:'5h ago'},
   {reader:'bet9ja-watcher',mem:'mem_22',author:'stake-watcher',what:'Recalled the Polymarket vs Kalshi resolution-source mismatch',win:'mapped both sources before quoting a TROJAN HORSE slip',when:'9h ago'},
   {reader:'stake-watcher',mem:'mem_25',author:'sportybet-watcher',what:'Recalled that Kalshi quotes both sides past 02:00 WAT',win:'kept overnight coverage live instead of pausing',when:'14h ago'},
  ],
  dynamicEvent:{needs:'mem_37',ev:{reader:'sportybet-watcher',mem:'mem_37',author:'dream-worker',what:'Recalled the ~40s goal-event lag pattern from dream drm_0142',win:'read Stake, acted on SportyBet inside the arbitrage window',when:'just now'}},
  before:[['duplicate writes/day',5.2,6,'var(--amber)'],['recall hit rate',38,100,'var(--red)'],['stale memories acted on',4,6,'var(--red)']],
  after:[['duplicate writes/day',1.1,6,'var(--green)'],['recall hit rate',81,100,'var(--teal)'],['stale memories acted on',0,6,'var(--green)']],
 },
 'slip-builder':{
  stats:[
   {k:'Cross-agent recalls',v:'18',d:'last 7 days · memories read by a non-author'},
   {k:'Duplicate writes',v:'−64%',d:'2.8/day → 1.0/day since dreams enabled'},
   {k:'Recall hit rate',v:'74%',d:'was 41% before consolidation'},
   {k:'Bad slips blocked',v:'9',d:'risk rules recalled before quoting'},
  ],
  matrix:{
   agents:['slip-composer','risk-guardian'],
   rows:[[null,11],[7,null]],
  },
  events:[
   {reader:'slip-composer',mem:'mem_09',author:'risk-guardian',what:'Recalled the 6-leg cap before building a full-cover 3-way',win:'slip restructured to 6 legs, accepted first try',when:'8h ago'},
   {reader:'slip-composer',mem:'mem_08',author:'risk-guardian',what:'Recalled the correlated-legs warning on a same-match combo',win:'flagged legs, stake split recomputed at true variance',when:'1d ago'},
   {reader:'risk-guardian',mem:'mem_04',author:'slip-composer',what:'Recalled the 90s two-sided quote window for TROJAN HORSE covers',win:'rejected a slip where the cover would have broken',when:'1d ago'},
  ],
  dynamicEvent:{needs:'mem_10',ev:{reader:'slip-composer',mem:'mem_10',author:'dream-worker',what:'Recalled the consolidated Kalshi fee floor from the latest dream',win:'sub-2.1% ROI slip rejected before quoting',when:'just now'}},
  before:[['duplicate writes/day',2.8,4,'var(--amber)'],['recall hit rate',41,100,'var(--red)'],['rejected slips/week',7,8,'var(--red)']],
  after:[['duplicate writes/day',1.0,4,'var(--green)'],['recall hit rate',74,100,'var(--teal)'],['rejected slips/week',2,8,'var(--green)']],
 },
};
function collabSVG(){
  const d=ns(); const ags=d.agents.filter(a=>!a.dream);
  const W=640,H=300,cx=W/2;
  const n=ags.length, gap=W/(n+1);
  let nodes='',arrows='';
  ags.forEach((a,i)=>{
    const x=gap*(i+1);
    nodes+=`<g><rect x="${x-72}" y="22" width="144" height="36" rx="7" fill="var(--surface2)" stroke="var(--border2)"/><text x="${x}" y="44" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--text)">${a.name}</text></g>`;
    arrows+=`<path d="M ${x-14} 58 C ${x-14} 100, ${cx-40} 120, ${cx-40} 142" stroke="var(--teal)" stroke-width="1.3" fill="none" marker-end="url(#arr)"/>`;
    arrows+=`<path d="M ${cx+40} 142 C ${cx+40} 120, ${x+14} 100, ${x+14} 58" stroke="var(--faint)" stroke-width="1.2" stroke-dasharray="4 3" fill="none" marker-end="url(#arrg)"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
   <defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="var(--teal)"/></marker>
    <marker id="arrg" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="var(--faint)"/></marker>
   </defs>
   ${nodes}
   <rect x="${cx-130}" y="142" width="260" height="44" rx="8" fill="var(--teal-dim)" stroke="rgba(183,118,241,.4)"/>
   <text x="${cx}" y="161" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--teal)">shared memory plane</text>
   <text x="${cx}" y="176" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--muted)">${STATE.ns} · memwal → walrus</text>
   ${arrows}
   <rect x="${cx-66}" y="232" width="132" height="34" rx="7" fill="var(--surface2)" stroke="var(--border2)"/>
   <text x="${cx}" y="253" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="var(--purple)">dream-worker</text>
   <path d="M ${cx-20} 232 L ${cx-20} 186" stroke="var(--purple)" stroke-width="1.2" fill="none" marker-end="url(#arr)"/>
   <path d="M ${cx+20} 186 L ${cx+20} 232" stroke="var(--purple)" stroke-width="1.2" stroke-dasharray="4 3" fill="none"/>
   <text x="${cx-78}" y="214" text-anchor="end" font-family="var(--mono)" font-size="9" fill="var(--faint)">consolidate · prune · verify</text>
   <text x="40" y="100" font-family="var(--mono)" font-size="9" fill="var(--teal)">remember() / analyze()</text>
   <text x="${W-40}" y="100" text-anchor="end" font-family="var(--mono)" font-size="9" fill="var(--faint)">recall()</text>
  </svg>`;
}
function renderCollab(){
  const c=COLLAB[STATE.ns]; const d=ns();
  document.getElementById('cl-crumb').textContent=STATE.ns+' / collaboration';
  document.getElementById('cl-stats').innerHTML=c.stats.map(s=>`<div class="card stat"><div class="k">${s.k}</div><div class="v">${s.v}</div><div class="d">${s.d}</div></div>`).join('');
  document.getElementById('cl-flow').innerHTML=collabSVG();
  const ags=c.matrix.agents, max=Math.max(...c.matrix.rows.flat().filter(x=>x!==null));
  let mx=`<div class="mx-grid" style="grid-template-columns:170px repeat(${ags.length},1fr)">`;
  mx+=`<div class="mx-cell mx-head" style="justify-content:flex-start">reads ↓ · wrote →</div>`+ags.map(a=>`<div class="mx-cell mx-head">${a.split('-')[0]}</div>`).join('');
  c.matrix.rows.forEach((row,r)=>{
    mx+=`<div class="mx-cell mx-rowhead">${ags[r]}</div>`;
    row.forEach(v=>{
      if(v===null) mx+=`<div class="mx-cell mx-self">, </div>`;
      else{const op=.08+(v/max)*.5; mx+=`<div class="mx-cell mx-val" style="background:rgba(183,118,241,${op.toFixed(2)})">${v}</div>`;}
    });
  });
  mx+='</div>';
  document.getElementById('cl-matrix').innerHTML=mx;
  let evs=[...c.events];
  if(c.dynamicEvent&&d.mems.some(m=>m.id===c.dynamicEvent.needs&&!m.stale)) evs.unshift(c.dynamicEvent.ev);
  document.getElementById('cl-events').innerHTML=`
   <div class="tr th" style="grid-template-columns:150px 1fr 90px"><span>reader</span><span>what happened</span><span>when</span></div>
   ${evs.map(e=>`<div class="tr" style="grid-template-columns:150px 1fr 90px">
     <span class="tag agent">${e.reader}</span>
     <div><div class="cell-main">${e.what}</div><div class="cell-sub">recall(<span style="color:var(--teal)">${e.mem}</span>) written by ${e.author} · ${e.win}</div></div>
     <span class="mono xs faint">${e.when}</span></div>`).join('')}`;
  const bars=(rows)=>rows.map(([lbl,val,max2,col])=>`<div class="bar-row"><span class="lbl">${lbl}</span><div class="bar"><div class="fill" style="width:${Math.round(val/max2*100)}%;background:${col}"></div></div><span class="num">${val}</span></div>`).join('');
  document.getElementById('cl-impact').innerHTML=`
   <div class="card"><div class="stat"><div class="k">Before dreams</div></div><div style="margin-top:12px">${bars(c.before)}</div><div class="xs faint" style="margin-top:10px;font-family:var(--mono)">agents repeated each other's mistakes</div></div>
   <div class="card"><div class="stat"><div class="k">After dreams</div></div><div style="margin-top:12px">${bars(c.after)}</div><div class="xs faint" style="margin-top:10px;font-family:var(--mono)">one agent learns, every agent knows</div></div>`;
}

/* ============================================================
   PROMPT STUDIO
============================================================ */
const PS={format:'system',model:'Claude Opus 4.8',role:'',tone:'neutral',output:'markdown',temp:0.3,maxTokens:2048,constraints:'',examples:[],sel:new Set(),selTouched:false,touched:false,panelOpen:false};
const PSFMT=[
 {id:'system',name:'System prompt',sub:'markdown',file:'system-prompt.md'},
 {id:'json',name:'API request',sub:'messages json',file:'request.json'},
 {id:'xml',name:'Claude XML',sub:'tagged context',file:'prompt.xml'},
 {id:'langchain',name:'LangChain',sub:'python',file:'prompt.py'},
 {id:'claudemd',name:'CLAUDE.md',sub:'project memory',file:'CLAUDE.md'},
 {id:'checklist',name:'Guardrails',sub:'pre-flight checks',file:'guardrails.md'},
];
function psDefaultGoal(){
  return STATE.ns==='odds-watch'
   ?'Watch in-play EPL odds across books and surface arbitrage windows'
   :'Compose betting slips and reject any slip that violates a known risk rule';
}
function psMemPool(){return liveMems()}
function psDefaultSel(){
  PS.sel=new Set(psMemPool().filter(m=>m.verified||m.dream).map(m=>m.id));
  if(!PS.sel.size) PS.sel=new Set(psMemPool().slice(0,4).map(m=>m.id));
}
function selMems(){return psMemPool().filter(m=>PS.sel.has(m.id))}
function provenance(m){return m.id+(m.verified?' verified':'')+(m.dream?' dream':'')+' · '+m.agent}
function escAttr(s){return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function psSet(k,v){ PS[k]=v; if(k==='goal')PS.touched=true; if(k==='temp'){const t=document.getElementById('ps-tempval'); if(t)t.textContent=(+v).toFixed(1);} psUpdateKnobs(); updatePrompt(); }
function psTogglePanel(e){ if(e)e.stopPropagation(); PS.panelOpen=!PS.panelOpen; const p=document.getElementById('ps-panel'); if(p)p.hidden=!PS.panelOpen; }
document.addEventListener('click',(e)=>{ const p=document.getElementById('ps-panel'); if(p&&!p.hidden&&!p.contains(e.target)){ PS.panelOpen=false; p.hidden=true; } });
function psMenu(id,e){ e.stopPropagation(); const m=document.getElementById(id); const open=m.classList.contains('show'); document.querySelectorAll('.kb-menu.show').forEach(x=>x.classList.remove('show')); if(!open)m.classList.add('show'); }
function psToggleFmtMenu(e){ psMenu('ps-fmtmenu',e); }
function psToggleModelMenu(e){ psMenu('ps-modelmenu',e); }
document.addEventListener('click',()=>document.querySelectorAll('.kb-menu.show').forEach(m=>m.classList.remove('show')));
function psRenderFmtMenu(){ const m=document.getElementById('ps-fmtmenu'); if(m)m.innerHTML=PSFMT.map(f=>'<button onclick="setFmt(\''+f.id+'\')">'+f.name+'<span class="mp">'+f.sub+'</span></button>').join(''); }
function psRenderModelMenu(){ const m=document.getElementById('ps-modelmenu'); if(m)m.innerHTML=KB_MODELS.map(x=>'<button onclick="psSetModel(\''+x.name+'\')">'+x.name+'<span class="mp">'+x.prov+'</span></button>').join(''); }
function setFmt(id){ PS.format=id; const f=PSFMT.find(x=>x.id===id)||PSFMT[0]; const n=document.getElementById('ps-fmtname'); if(n)n.textContent=f.name; const mm=document.getElementById('ps-fmtmenu'); if(mm)mm.classList.remove('show'); updatePrompt(); }
function psSetModel(name){ PS.model=name; const n=document.getElementById('ps-modelname'); if(n)n.textContent=name; const mm=document.getElementById('ps-modelmenu'); if(mm)mm.classList.remove('show'); updatePrompt(); }
function psSelect(mode){ PS.selTouched=true; const pool=psMemPool(); if(mode==='none')PS.sel=new Set(); else if(mode==='all')PS.sel=new Set(pool.map(m=>m.id)); else PS.sel=new Set(pool.filter(m=>m.verified||m.dream).map(m=>m.id)); psRenderMems(); psUpdateKnobs(); updatePrompt(); }
function toggleMem(id){ PS.selTouched=true; PS.sel.has(id)?PS.sel.delete(id):PS.sel.add(id); psRenderMems(); psUpdateKnobs(); updatePrompt(); }
function psAddExample(){ PS.examples.push({input:'',output:''}); psRenderExamples(); psUpdateKnobs(); updatePrompt(); }
function psRemoveExample(i){ PS.examples.splice(i,1); psRenderExamples(); psUpdateKnobs(); updatePrompt(); }
function psExampleSet(i,f,v){ if(PS.examples[i]){PS.examples[i][f]=v; updatePrompt();} }
function psRenderExamples(){ const el=document.getElementById('ps-examples'); if(!el)return; el.innerHTML=PS.examples.length?PS.examples.map((ex,i)=>'<div class="ps-ex"><div class="ps-ex-h">Example '+(i+1)+'<button class="ps-mini danger" onclick="psRemoveExample('+i+')">remove</button></div><input class="ps-in" placeholder="input" value="'+escAttr(ex.input)+'" oninput="psExampleSet('+i+',\'input\',this.value)"><textarea class="ps-in ps-ta" rows="2" placeholder="ideal output" oninput="psExampleSet('+i+',\'output\',this.value)">'+escHtml(ex.output)+'</textarea></div>').join(''):'<div class="mono xs faint" style="padding:2px 0">No examples, add one to steer the model with few-shot.</div>'; }
function psRenderMems(){ if(!PS.sel.size&&!PS.selTouched)psDefaultSel(); const rank=m=>m.dream?0:m.verified?1:m.dup?3:2; const pool=[...psMemPool()].sort((a,b)=>rank(a)-rank(b)); const el=document.getElementById('ps-mems'); if(!el)return; el.innerHTML=pool.map(m=>'<div class="mc-row '+(PS.sel.has(m.id)?'sel':'')+'" onclick="toggleMem(\''+m.id+'\')"><span class="mc-box">'+(PS.sel.has(m.id)?'✓':'')+'</span><div><div class="mc-text">'+escHtml(m.text)+'</div><div class="mc-meta"><span>'+m.id+'</span><span>'+m.agent+'</span>'+(m.verified?'<span style="color:var(--blue)">verified</span>':'')+(m.dream?'<span style="color:var(--teal)">dream</span>':'')+(m.dup?'<span style="color:var(--amber)">likely dup</span>':'')+'</div></div></div>').join(''); const c=document.getElementById('ps-selcount'); if(c)c.textContent='· '+PS.sel.size+' selected'; }
function psUpdateKnobs(){ let n=0; if(PS.role.trim())n++; if(PS.tone!=='neutral')n++; if(PS.output!=='markdown')n++; if(PS.constraints.trim())n++; if(PS.examples.some(e=>e.input.trim()||e.output.trim()))n++; if(PS.sel.size)n++; if(+PS.temp!==0.3)n++; if(+PS.maxTokens!==2048)n++; const b=document.getElementById('ps-knobs'); if(b)b.textContent=n; }
function toneLine(t){ return {neutral:'',precise:'Be precise and technical; prefer exact figures over hedging.',friendly:'Keep the tone approachable and encouraging.',terse:'Be terse, no preamble, no filler.',formal:'Maintain a formal, professional register.'}[t]||''; }
function outLine(o){ return {markdown:'Respond in clean Markdown.',json:'Respond with valid JSON only, no prose outside the JSON.',bullets:'Respond as a concise bulleted list.',prose:'Respond in plain prose paragraphs.',steps:'Respond as numbered, sequential steps.'}[o]||''; }
function psModelId(n){ return (n||'').toLowerCase().replace(/[^a-z0-9.]+/g,'-'); }
function psCfg(){
  const head=ns().versions[0].hash;
  const goalEl=document.getElementById('ps-goal');
  const goal=((goalEl&&goalEl.value.trim())||psDefaultGoal());
  return {ns:STATE.ns,head,goal,role:PS.role.trim(),tone:PS.tone,output:PS.output,temp:+PS.temp,maxTokens:+PS.maxTokens,model:PS.model,
    constraints:PS.constraints.split('\n').map(s=>s.trim()).filter(Boolean),
    examples:PS.examples.filter(e=>e.input.trim()||e.output.trim()),
    mems:selMems()};
}

function genSystem(c){
  let s='# Agent system prompt, '+c.ns+'\n';
  s+='<!-- cortex prompt studio · '+c.model+' · temp '+c.temp.toFixed(1)+' · max_tokens '+c.maxTokens+' · pinned to '+c.head+' -->\n\n';
  if(c.role) s+='## Role\nYou are '+c.role+'.\n\n';
  s+='## Mission\n'+c.goal+'\n\n';
  const style=[toneLine(c.tone),outLine(c.output)].filter(Boolean);
  if(style.length) s+='## Style\n'+style.map(x=>'- '+x).join('\n')+'\n\n';
  if(c.constraints.length) s+='## Constraints\n'+c.constraints.map(x=>'- '+x).join('\n')+'\n\n';
  if(c.mems.length){
    s+='## Established knowledge (from verified namespace memory)\n';
    s+='Treat each item as ground truth unless live evidence contradicts it. Cite the memory id when you rely on one.\n\n';
    s+=c.mems.map(m=>'- ['+m.id+'] '+m.text+'  <!-- '+provenance(m)+' -->').join('\n')+'\n\n';
  }
  if(c.examples.length){
    s+='## Examples\n'+c.examples.map((e,i)=>'### Example '+(i+1)+'\n**Input:** '+e.input+'\n**Output:** '+e.output).join('\n\n')+'\n\n';
  }
  s+='## Memory discipline\n- Before acting, recall() relevant memories from `'+c.ns+'`.\n- Write durable findings back with remember().\n- If reality contradicts a memory above, record the contradiction so the next dream can tombstone it.\n';
  return s;
}
function genJSON(c){
  const sys=[];
  const lead=(c.role?'You are '+c.role+'. ':'')+'Mission: '+c.goal;
  const style=[toneLine(c.tone),outLine(c.output)].filter(Boolean).join(' ');
  sys.push({type:'text',text:style?lead+'\n'+style:lead});
  if(c.constraints.length) sys.push({type:'text',text:'Constraints:\n- '+c.constraints.join('\n- ')});
  if(c.mems.length) sys.push({type:'text',text:'Established memory (version '+c.head+'), cite ids when used:\n'+c.mems.map(m=>'['+m.id+'] '+m.text).join('\n')});
  const messages=[];
  c.examples.forEach(e=>{ messages.push({role:'user',content:e.input}); messages.push({role:'assistant',content:e.output}); });
  messages.push({role:'user',content:'Begin. recall() before acting, remember() durable findings.'});
  return JSON.stringify({model:psModelId(c.model),max_tokens:c.maxTokens,temperature:c.temp,system:sys,messages,metadata:{cortex_namespace:c.ns,memory_version:c.head,memory_ids:c.mems.map(m=>m.id)}},null,2);
}
function genXML(c){
  let s='<prompt namespace="'+c.ns+'" memory_version="'+c.head+'" model="'+psModelId(c.model)+'" temperature="'+c.temp.toFixed(1)+'">\n';
  if(c.role) s+='  <role>'+c.role+'</role>\n';
  s+='  <mission>\n    '+c.goal+'\n  </mission>\n';
  const style=[toneLine(c.tone),outLine(c.output)].filter(Boolean);
  if(style.length) s+='  <style>\n'+style.map(x=>'    <guideline>'+x+'</guideline>').join('\n')+'\n  </style>\n';
  if(c.constraints.length) s+='  <constraints>\n'+c.constraints.map(x=>'    <constraint>'+x+'</constraint>').join('\n')+'\n  </constraints>\n';
  if(c.mems.length) s+='  <memories source="cortex" verified_first="true">\n'+c.mems.map(m=>'    <memory id="'+m.id+'" agent="'+m.agent+'"'+(m.verified?' verified="true"':'')+(m.dream?' origin="dream"':'')+'>'+m.text+'</memory>').join('\n')+'\n  </memories>\n';
  if(c.examples.length) s+='  <examples>\n'+c.examples.map(e=>'    <example>\n      <input>'+e.input+'</input>\n      <output>'+e.output+'</output>\n    </example>').join('\n')+'\n  </examples>\n';
  s+='  <rules>\n    <rule>Cite memory ids when a decision relies on one.</rule>\n    <rule>recall() from '+c.ns+' before acting; remember() durable findings.</rule>\n  </rules>\n</prompt>';
  return s;
}
function genLC(c){
  const sysLines=[];
  if(c.role) sysLines.push('You are '+c.role+'.');
  sysLines.push('Mission: '+c.goal);
  [toneLine(c.tone),outLine(c.output)].filter(Boolean).forEach(x=>sysLines.push(x));
  if(c.constraints.length) sysLines.push('Constraints: '+c.constraints.join('; '));
  let s='from langchain_core.prompts import ChatPromptTemplate\n';
  s+='from cortex_memory import CortexMemory\n\n';
  s+='memory = CortexMemory(namespace="'+c.ns+'", version="'+c.head+'")  # pinned snapshot\n\n';
  s+='MEMORIES = [\n'+c.mems.map(m=>'    ("'+m.id+'", "'+m.text.replace(/"/g,'\\"')+'"),').join('\n')+'\n]\n\n';
  s+='SYSTEM = (\n    "'+sysLines.join(' ').replace(/"/g,'\\"')+'\\n"\n    "Established memory (cite ids):\\n" +\n    "\\n".join(f"[{mid}] {text}" for mid, text in MEMORIES)\n)\n\n';
  s+='messages = [("system", SYSTEM)]\n';
  c.examples.forEach(e=>{ s+='messages += [("human", "'+e.input.replace(/"/g,'\\"')+'"), ("ai", "'+e.output.replace(/"/g,'\\"')+'")]\n'; });
  s+='messages += [("placeholder", "{messages}")]\n\n';
  s+='prompt = ChatPromptTemplate.from_messages(messages)\n';
  s+='chain = prompt | llm.bind(model="'+psModelId(c.model)+'", temperature='+c.temp.toFixed(1)+', max_tokens='+c.maxTokens+')\n';
  return s;
}
function genMD(c){
  let s='# CLAUDE.md, '+c.ns+'\n\n';
  s+='> Synced from Cortex at memory version `'+c.head+'` ('+c.model+'). Do not edit by hand; run `cortex sync claude-md`.\n\n';
  if(c.role) s+='## Role\nYou are '+c.role+'.\n\n';
  s+='## What this agent does\n'+c.goal+'\n\n';
  const style=[toneLine(c.tone),outLine(c.output)].filter(Boolean);
  if(style.length) s+='## Style\n'+style.map(x=>'- '+x).join('\n')+'\n\n';
  if(c.constraints.length) s+='## Constraints\n'+c.constraints.map(x=>'- '+x).join('\n')+'\n\n';
  if(c.mems.length) s+='## Things we know (verified namespace memory)\n'+c.mems.map(m=>'- '+m.text+' `'+m.id+'`').join('\n')+'\n\n';
  s+='## Working rules\n- These facts came from real sessions; trust them over assumptions.\n- New durable findings go back through `remember()`, not into this file.\n- If one of these is wrong now, say so explicitly so the next dream can prune it.\n';
  return s;
}
function genChecklist(c){
  let s='# Pre-flight guardrails, '+c.ns+' (memory '+c.head+')\n\n';
  if(c.role) s+='Role: '+c.role+'\n';
  s+='Goal: '+c.goal+'\n\nBefore every action, confirm:\n\n';
  c.constraints.forEach(x=>{ s+='- [ ] '+x+'\n'; });
  c.mems.forEach(m=>{ s+='- [ ] Does this respect: "'+m.text+'"? ('+m.id+')\n'; });
  s+='- [ ] Have I recall()ed '+c.ns+' for anything newer than this snapshot?\n';
  s+='- [ ] If I learned something durable, did I remember() it?\n';
  return s;
}
function buildPrompt(){
  const c=psCfg();
  const g={system:genSystem,json:genJSON,xml:genXML,langchain:genLC,claudemd:genMD,checklist:genChecklist}[PS.format]||genSystem;
  return g(c);
}
function updatePrompt(){
  const out=buildPrompt();
  const o=document.getElementById('ps-out'); if(o)o.textContent=out;
  const t=document.getElementById('ps-tokens'); if(t)t.textContent='~'+Math.round(out.length/4)+' tok · '+ns().versions[0].hash;
}
function renderStudio(){
  const cr=document.getElementById('ps-crumb'); if(!cr) return;
  cr.textContent=STATE.ns+' / prompt studio';
  psRenderFmtMenu(); psRenderModelMenu();
  const fn=document.getElementById('ps-fmtname'); if(fn)fn.textContent=(PSFMT.find(f=>f.id===PS.format)||PSFMT[0]).name;
  const mn=document.getElementById('ps-modelname'); if(mn)mn.textContent=PS.model;
  const setv=(id,v)=>{const el=document.getElementById(id); if(el&&document.activeElement!==el)el.value=v;};
  setv('ps-role',PS.role); setv('ps-tone',PS.tone); setv('ps-output',PS.output); setv('ps-maxtok',String(PS.maxTokens)); setv('ps-constraints',PS.constraints);
  const tr=document.getElementById('ps-temp'); if(tr&&document.activeElement!==tr)tr.value=PS.temp;
  const tv=document.getElementById('ps-tempval'); if(tv)tv.textContent=(+PS.temp).toFixed(1);
  const goalEl=document.getElementById('ps-goal');
  if(goalEl&&!PS.touched&&document.activeElement!==goalEl){ goalEl.value=psDefaultGoal(); kbGrow(goalEl); }
  const p=document.getElementById('ps-panel'); if(p)p.hidden=!PS.panelOpen;
  psRenderExamples(); psRenderMems(); psUpdateKnobs(); updatePrompt();
}
function copyPrompt(){ copyText(buildPrompt(),'Prompt copied · '+PS.format+' · '+ns().versions[0].hash); }
function dlPrompt(){ const f=PSFMT.find(x=>x.id===PS.format)||PSFMT[0]; dlText(STATE.ns+'-'+f.file,buildPrompt()); toast('Downloaded '+STATE.ns+'-'+f.file); }

/* ============================================================
   INTEGRATIONS
============================================================ */
function genSkillMd(){
  const d=ns(); const head=d.versions[0].hash;
  const mems=liveMems().filter(m=>m.verified||m.dream);
  return '---\nname: '+STATE.ns+'-knowledge\ndescription: Verified operational knowledge from the '+STATE.ns+' namespace. Use when working on '+(STATE.ns==='odds-watch'?'odds monitoring, bookmaker APIs, or arbitrage windows':'slip construction, stake splitting, or bet risk rules')+'.\nsource: cortex · memory version '+head+'\n---\n\n# '+STATE.ns+' knowledge\n\n'
   +mems.map(m=>'- '+m.text+' `'+m.id+'`').join('\n')
   +'\n\nEvery line above is backed by a Walrus blob and a signed Sui write. Verify with `cortex verify --namespace '+STATE.ns+'`.';
}
function intData(){
  const head=ns().versions[0].hash;
  return {
  exports:[
   {id:'skills',logo:'sk',name:'skills.sh',kind:'skill export',desc:'Package verified memories as a SKILL.md any Claude agent can load. Republished automatically when a dream changes the namespace.',foot:'last publish · v'+head,
    sub:'publish verified memory as a portable skill',
    kv:[['target','skills.sh/'+'busta/'+STATE.ns+'-knowledge'],['trigger','on dream apply (head change)'],['contents','verified + dream memories only'],['pinned to','memory version '+head]],
    code:genSkillMd(),lang:'SKILL.md preview',action:'Publish to skills.sh',toastMsg:'Published '+STATE.ns+'-knowledge to skills.sh, pinned to '+head},
   {id:'claudemd',logo:'cc',name:'Claude Code',kind:'claude.md sync',desc:'Keep a CLAUDE.md block in your repo in sync with namespace memory. Your coding agent inherits what your runtime agents learned.',foot:'sync · cortex sync claude-md',
    sub:'project memory for coding agents',
    kv:[['command','cortex sync claude-md --namespace '+STATE.ns],['writes','./CLAUDE.md (managed block)'],['cadence','on head change or manual'],['pinned to','memory version '+head]],
    code:'<!-- cortex:begin '+STATE.ns+' '+head+' -->\n'+liveMems().filter(m=>m.verified).map(m=>'- '+m.text+' `'+m.id+'`').join('\n')+'\n<!-- cortex:end -->',
    lang:'managed block preview',action:'Copy sync command',copy:'cortex sync claude-md --namespace '+STATE.ns,toastMsg:'Sync command copied'},
   {id:'mcp',logo:'mc',name:'MCP server',kind:'model context protocol',desc:'Mount the namespace as an MCP server. Any MCP client gets recall, remember, dream and verify as native tools.',foot:'tools · recall remember dream verify',
    sub:'live memory tools over MCP',
    kv:[['transport','stdio or sse'],['tools','recall() remember() dream() verify()'],['auth','seal delegate key, read or read+write'],['namespace',STATE.ns]],
    code:'{\n  "mcpServers": {\n    "cortex": {\n      "command": "cortex",\n      "args": ["mcp", "--namespace", "'+STATE.ns+'"],\n      "env": { "CORTEX_DELEGATE": "0xe5b8…1f09" }\n    }\n  }\n}',
    lang:'mcp config',action:'Copy config',copy:true,toastMsg:'MCP config copied'},
  ],
  adapters:[
   {id:'langchain',logo:'lc',name:'LangChain',kind:'python adapter',desc:'CortexMemory drops into any chain. recall() on load, remember() on save, verified memories ranked first.',foot:'pip install cortex-memory',
    sub:'BaseMemory implementation',
    kv:[['class','CortexMemory'],['recall ranking','verified > dream > recent'],['writes','remember() via memwal relayer'],['namespace',STATE.ns]],
    code:'from cortex_memory import CortexMemory\n\nmemory = CortexMemory(\n    namespace="'+STATE.ns+'",\n    delegate_key=os.environ["CORTEX_DELEGATE"],\n    verified_first=True,\n)\n\nchain = prompt | llm\nresult = chain.invoke(\n    {"messages": msgs},\n    config={"configurable": {"memory": memory}},\n)',
    lang:'python',action:'Copy snippet',copy:true,toastMsg:'LangChain snippet copied'},
   {id:'llamaindex',logo:'li',name:'LlamaIndex',kind:'retriever',desc:'CortexRetriever serves memories as nodes with provenance metadata. Tombstoned entries never leak into retrieval.',foot:'pip install cortex-llamaindex',
    sub:'retriever with provenance metadata',
    kv:[['class','CortexRetriever'],['node metadata','memory id, agent, verified, version'],['filters','live only · tombstones excluded'],['namespace',STATE.ns]],
    code:'from cortex_llamaindex import CortexRetriever\n\nretriever = CortexRetriever(\n    namespace="'+STATE.ns+'",\n    top_k=6,\n    rank="verified_first",\n)\n\nquery_engine = RetrieverQueryEngine(retriever=retriever)',
    lang:'python',action:'Copy snippet',copy:true,toastMsg:'LlamaIndex snippet copied'},
   {id:'vercel',logo:'ai',name:'Vercel AI SDK',kind:'middleware',desc:'Middleware that injects recalled memories into the system prompt per request and writes durable findings back after the stream ends.',foot:'npm i @cortex/ai-sdk',
    sub:'languageModel middleware',
    kv:[['package','@cortex/ai-sdk'],['inject','system prompt, per request'],['write-back','after stream completion'],['namespace',STATE.ns]],
    code:'import { cortexMemory } from "@cortex/ai-sdk";\n\nconst model = wrapLanguageModel({\n  model: anthropic("claude-sonnet-4-6"),\n  middleware: cortexMemory({\n    namespace: "'+STATE.ns+'",\n    verifiedFirst: true,\n    writeBack: true,\n  }),\n});',
    lang:'typescript',action:'Copy snippet',copy:true,toastMsg:'AI SDK snippet copied'},
  ]};
}
function renderIntegrations(){
  document.getElementById('in-crumb').textContent=STATE.ns+' / integrations';
  const data=intData();
  const card=(x,group)=>`
   <div class="intcard" onclick="openIntegration('${group}','${x.id}')">
     <div class="int-top"><div class="int-logo">${x.logo}</div><div><div class="int-name">${x.name}</div><div class="int-kind">${x.kind}</div></div></div>
     <div class="int-desc">${x.desc}</div>
     <div class="int-foot">${x.foot}</div>
   </div>`;
  document.getElementById('int-export').innerHTML=data.exports.map(x=>card(x,'exports')).join('');
  document.getElementById('int-adapters').innerHTML=data.adapters.map(x=>card(x,'adapters')).join('');
}
let INT_CUR=null;
function openIntegration(group,id){
  const x=intData()[group].find(i=>i.id===id); if(!x) return;
  INT_CUR=x;
  openDrawer(x.name,x.sub,`
    <div class="kv">${x.kv.map(([k,v])=>'<span class="k">'+k+'</span><span class="v">'+escHtml(v)+'</span>').join('')}</div>
    <div class="section-h" style="margin-top:6px">${x.lang}</div>
    <pre class="codeout" style="max-height:340px">${escHtml(x.code)}</pre>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn primary" onclick="intAction()">${x.action}</button>
      <button class="btn" onclick="copyText(INT_CUR.code,'Copied')">Copy code</button>
    </div>`);
}
function intAction(){
  const x=INT_CUR; if(!x) return;
  if(x.copy) copyText(typeof x.copy==='string'?x.copy:x.code,x.toastMsg);
  else toast(x.toastMsg);
}

/* ============================================================
   MEMORY MAP
============================================================ */
const MM={sel:null};
const CLUSTERS={
 'odds-watch':[
  {id:'lag',name:'SportyBet lag pattern',color:'var(--purple)',
   sum:'Five agents kept rediscovering the same thing: SportyBet trails Stake on in-play EPL odds. This cluster is what dream drm_0142 consolidates, the duplicates collapse into one verified pattern memory with a quantified ~40s arbitrage window.',
   ids:['mem_31','mem_32','mem_33','mem_34','mem_35','mem_36','mem_37']},
  {id:'apis',name:'Bookmaker APIs & limits',color:'var(--teal)',
   sum:'Operational knowledge about the books themselves, rate limits, data formats, market coverage. These memories prevent throttling and parser crashes before they happen.',
   ids:['mem_19','mem_14','mem_29']},
  {id:'pred',name:'Prediction markets',color:'var(--blue)',
   sum:'Kalshi and Polymarket behave differently from the bookmakers: different quoting hours, different resolution sources. Knowing both is what makes cross-venue TROJAN HORSE slips safe to quote.',
   ids:['mem_22','mem_25']},
  {id:'settle',name:'Settlement speed',color:'var(--green)',
   sum:'How fast each venue actually pays out. Cashout latency bounds how quickly capital can be recycled into the next window, drm_0141 consolidates the repeated Stake observations.',
   ids:['mem_27','mem_38','mem_39']},
 ],
 'slip-builder':[
  {id:'risk',name:'Risk rules',color:'var(--red)',
   sum:'Hard constraints learned from rejected and broken slips: leg-count caps and correlation traps. risk-guardian wrote these, slip-composer recalls them before every build.',
   ids:['mem_09','mem_08']},
  {id:'fees',name:'Fees & ROI floors',color:'var(--amber)',
   sum:'Thin edges die to venue fees. Two near-duplicate observations about Kalshi fees live here until a dream consolidates them into a single 2.1% ROI floor rule.',
   ids:['mem_06','mem_07','mem_10']},
  {id:'cover',name:'Cover mechanics',color:'var(--teal)',
   sum:'Timing constraints that make covered strategies actually hold, both sides of a binary need to be quotable inside the same window or the cover breaks.',
   ids:['mem_04']},
 ],
};
const MM_RELATIONS={
 'odds-watch':[['mem_37','mem_19','acting inside the 40s window needs rate-limit headroom'],['mem_22','mem_25','same venues, same quoting quirks'],['mem_14','mem_29','market data feeds the slip builder']],
 'slip-builder':[['mem_04','mem_08','timing and correlation both break covers']],
};
function mmClusters(){
  const d=ns();
  return CLUSTERS[STATE.ns].map(c=>{
    const all=c.ids.map(id=>d.mems.find(m=>m.id===id)).filter(Boolean);
    return {...c,mems:all.filter(m=>!m.stale),tomb:all.filter(m=>m.stale)};
  }).filter(c=>c.mems.length);
}
function mmFind(id){return ns().mems.find(m=>m.id===id)}
function mmLeafColor(m){return m.dream?'var(--teal)':m.verified?'var(--blue)':m.dup?'var(--amber)':'var(--faint)'}
function mmTrunc(s,n){return s.length>n?s.slice(0,n-1).trimEnd()+'…':s}
function mindmapSVG(cs){
  const W=780,H=580,cx=W/2,cy=H/2,R1=150,R2=252;
  const pos={};
  const n=cs.length;
  let edges='',rel='',nodes='',leaves='';
  cs.forEach((c,i)=>{
    const a=-Math.PI/2+i*2*Math.PI/n;
    const x=cx+R1*Math.cos(a),y=cy+R1*Math.sin(a);
    const dim=MM.sel&&MM.sel!==c.id?'mm-dimmed':'';
    edges+=`<path class="${dim}" d="M ${cx} ${cy} Q ${(cx+x)/2} ${(cy+y)/2}, ${x} ${y}" stroke="${c.color}" stroke-width="1.6" fill="none" opacity=".55"/>`;
    const span=Math.min(2*Math.PI/n*.92,1.7), m=c.mems.length;
    c.mems.forEach((mem,j)=>{
      const la=a+(m===1?0:(j/(m-1)-.5)*span);
      const lx=cx+R2*Math.cos(la),ly=cy+R2*Math.sin(la);
      pos[mem.id]={x:lx,y:ly};
      const right=Math.cos(la)>=0;
      edges+=`<path class="${dim}" d="M ${x} ${y} Q ${(x+lx)/2} ${(y+ly)/2}, ${lx} ${ly}" stroke="${c.color}" stroke-width="1" fill="none" opacity=".35"/>`;
      leaves+=`<g class="mm-leaf ${dim}" onclick="mmOpenMem('${mem.id}')">
        <circle cx="${lx}" cy="${ly}" r="5" fill="${mmLeafColor(mem)}" stroke="var(--border2)" stroke-width="1"/>
        <text x="${lx+(right?10:-10)}" y="${ly-3}" text-anchor="${right?'start':'end'}" font-family="var(--mono)" font-size="9.5" fill="var(--teal)">${mem.id}</text>
        <text x="${lx+(right?10:-10)}" y="${ly+9}" text-anchor="${right?'start':'end'}" font-family="var(--mono)" font-size="9" fill="var(--muted)">${escHtml(mmTrunc(mem.text,30))}</text>
        <title>${escHtml(mem.text)}</title></g>`;
    });
    nodes+=`<g class="mm-node ${dim}" onclick="mmSelect('${c.id}')">
      <rect x="${x-78}" y="${y-19}" width="156" height="38" rx="8" fill="var(--surface2)" stroke="${c.color}" stroke-width="${MM.sel===c.id?'1.8':'1.2'}"/>
      <text x="${x}" y="${y-2}" text-anchor="middle" font-family="var(--mono)" font-size="10.5" fill="var(--text)">${c.name}</text>
      <text x="${x}" y="${y+12}" text-anchor="middle" font-family="var(--mono)" font-size="8.5" fill="${c.color}">${c.mems.length} live${c.tomb.length?' · '+c.tomb.length+' tombstoned':''}</text></g>`;
  });
  (MM_RELATIONS[STATE.ns]||[]).forEach(([a,b,why])=>{
    const pa=pos[a],pb=pos[b]; if(!pa||!pb) return;
    rel+=`<path d="M ${pa.x} ${pa.y} Q ${cx} ${cy}, ${pb.x} ${pb.y}" stroke="var(--purple)" stroke-width="1" stroke-dasharray="4 4" fill="none" opacity="${MM.sel?'.18':'.5'}"><title>${escHtml(why)}</title></path>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
   ${edges}${rel}
   <circle cx="${cx}" cy="${cy}" r="40" fill="var(--teal-dim)" stroke="rgba(183,118,241,.5)" stroke-width="1.4"/>
   <text x="${cx}" y="${cy-2}" text-anchor="middle" font-family="var(--mono)" font-size="10.5" fill="var(--teal)">${STATE.ns}</text>
   <text x="${cx}" y="${cy+12}" text-anchor="middle" font-family="var(--mono)" font-size="8.5" fill="var(--muted)">${ns().versions[0].hash}</text>
   ${nodes}${leaves}
  </svg>`;
}
function renderMindmap(){
  const cs=mmClusters();
  if(MM.sel&&!cs.some(c=>c.id===MM.sel)) MM.sel=null;
  const live=liveMems(), clustered=new Set(cs.flatMap(c=>c.mems.map(m=>m.id)));
  const biggest=[...cs].sort((a,b)=>b.mems.length-a.mems.length)[0];
  document.getElementById('mm-stats').innerHTML=[
    {k:'Clusters',v:cs.length,d:'named by dream-worker from embedding groups'},
    {k:'Clustered memories',v:clustered.size+'/'+live.length,d:'live memories with at least one strong neighbor'},
    {k:'Densest cluster',v:biggest.mems.length,d:biggest.name.toLowerCase()},
    {k:'Cross-cluster links',v:(MM_RELATIONS[STATE.ns]||[]).length,d:'relations spanning cluster boundaries'},
  ].map(s=>`<div class="card stat"><div class="k">${s.k}</div><div class="v">${s.v}</div><div class="d">${s.d}</div></div>`).join('');
  document.getElementById('mm-map').innerHTML=mindmapSVG(cs);
  const det=document.getElementById('mm-detail');
  if(!MM.sel){det.innerHTML='<div class="empty" style="margin-top:14px">Select a cluster to inspect it.<div class="mono">or click any memory node to open it</div></div>';return}
  const c=cs.find(x=>x.id===MM.sel);
  det.innerHTML=`<div class="mm-detail">
    <div class="mm-dhead"><span class="mm-dot" style="background:${c.color}"></span><span class="mm-dname">${c.name}</span>
      <span class="mono xs faint">${c.mems.length} live${c.tomb.length?' · '+c.tomb.length+' tombstoned':''}</span></div>
    <div class="mm-dsum">${c.sum}</div>
    <div class="mm-mems">${c.mems.map(m=>`
      <div class="mm-mrow" onclick="mmOpenMem('${m.id}')">
        <span class="mm-mid">${m.id}</span>
        <div><div class="mm-mtext">${m.text}</div>
        <div class="mm-mtags"><span class="tag ${m.dream?'dream':'agent'}">${m.agent}</span>
          ${m.verified&&!m.stale?'<span class="tag verify">verified</span>':''}
          ${m.dream?'<span class="tag '+(m.via==='pattern'?'pattern':'consolidate')+'">'+m.via+'</span>':''}
          ${!m.dream&&m.dup?'<span class="tag pending">likely duplicate</span>':''}</div></div>
      </div>`).join('')}
    ${c.tomb.map(m=>`<div class="mm-mrow" style="opacity:.45" onclick="mmOpenMem('${m.id}')">
        <span class="mm-mid">${m.id}</span>
        <div><div class="mm-mtext" style="text-decoration:line-through">${m.text}</div>
        <div class="mm-mtags"><span class="tag stale">tombstoned</span>${m.tomb?'<span class="mono xs faint">'+m.tomb+'</span>':''}</div></div>
      </div>`).join('')}</div>
    <div class="mm-actions">
      <button class="btn primary" onclick="mmToStudio('${c.id}')">Build a prompt from this cluster</button>
      <button class="btn" onclick="MM.sel=null;renderMindmap()">Clear selection</button>
    </div>
  </div>`;
}
function mmSelect(id){MM.sel=MM.sel===id?null:id;renderMindmap()}
function mmOpenMem(id){
  const m=mmFind(id); if(!m) return;
  const c=mmClusters().find(x=>x.mems.some(y=>y.id===id)||x.tomb.some(y=>y.id===id));
  const rels=(MM_RELATIONS[STATE.ns]||[]).filter(r=>r[0]===id||r[1]===id);
  openDrawer(m.id,m.stale?'tombstoned memory':'live memory · '+(c?c.name.toLowerCase():'unclustered'),`
    <div class="kv">
      <span class="k">text</span><span class="v">${escHtml(m.text)}</span>
      <span class="k">agent</span><span class="v">${m.agent}</span>
      <span class="k">written via</span><span class="v">${m.via==='consolidate'||m.via==='pattern'?'dream op · '+m.via:m.via+'()'}</span>
      <span class="k">when</span><span class="v">${m.when}</span>
      <span class="k">cluster</span><span class="v">${c?c.name:', '}</span>
      <span class="k">status</span><span class="v">${m.stale?'tombstoned'+(m.tomb?' · '+m.tomb:''):m.verified?'live · verified':m.dream?'live · dream output':m.dup?'live · likely duplicate':'live'}</span>
    </div>
    ${rels.length?'<div class="section-h" style="margin-top:6px">related across clusters</div>'+rels.map(r=>{
      const other=r[0]===id?r[1]:r[0]; const om=mmFind(other);
      return '<div class="mm-mrow" onclick="mmOpenMem(\''+other+'\')"><span class="mm-mid">'+other+'</span><div><div class="mm-mtext">'+(om?escHtml(om.text):'')+'</div><div class="mm-mtags"><span class="mono xs faint">'+escHtml(r[2])+'</span></div></div></div>';
    }).join(''):''}
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn" onclick="closeDrawer();setMemView('list')">Open list view</button>
    </div>`);
}
function mmToStudio(cid){
  const c=mmClusters().find(x=>x.id===cid); if(!c) return;
  PS.sel=new Set(c.mems.map(m=>m.id)); PS.selTouched=true;
  location.hash='#/prompt-studio';
  renderStudio();
  toast('Prompt Studio loaded with '+c.mems.length+' memories from '+c.name.toLowerCase());
}

/* ============================================================
   TOAST + ROUTER
============================================================ */
let toastT;
function toast(msg){
  const t=document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),3800);
}

const routes={'overview':'p-overview','memories':'p-memories','timeline':'p-timeline','collaboration':'p-collab','dreams':'p-dreams','transcripts':'p-transcripts','knowledge':'p-knowledge','prompt-studio':'p-studio','integrations':'p-integrations','verify':'p-verify','settings':'p-settings'};
function route(){
  let h=location.hash.replace('#/','')||'overview';
  let pageId,navKey;
  if(h.startsWith('dream/')){pageId='p-dream-detail';navKey='dreams';renderDreamDetail(h.slice(6));}
  else if(h==='mindmap'){pageId='p-memories';navKey='memories';STATE.memView='map';}
  else{pageId=routes[h]||'p-overview';navKey=routes[h]?h:'overview';}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('show'));
  document.getElementById(pageId).classList.add('show');
  document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===navKey));
  if(pageId==='p-memories') setMemView(STATE.memView||'list');
  document.querySelector('.main').scrollTop=0;
  document.querySelector('.side').classList.remove('open');
  closeDrawer();
}
window.addEventListener('hashchange',route);

function renderAll(){
  renderOverview();renderMemories();renderMindmap();renderTimeline();renderCollab();renderDreams();renderTranscripts();renderStudio();renderIntegrations();renderVerify();renderKeys();renderKB();
}

/* ============================================================
   THEME (light / dark / system), ChatGPT-grade contrast
============================================================ */
const _root=document.documentElement,_mq=matchMedia('(prefers-color-scheme: dark)');
let _theme='system';
function _effTheme(){return _theme==='system'?(_mq.matches?'dark':'light'):_theme}
function applyTheme(){
  const t=_effTheme();_root.setAttribute('data-theme',t);
  const ic=document.getElementById('themeIcon');
  if(ic) ic.innerHTML=t==='dark'
    ?'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></g>'
    :'<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>';
}
function toggleTheme(){_theme=_effTheme()==='dark'?'light':'dark';try{localStorage.setItem('cortex-theme',_theme)}catch(e){}applyTheme();}
_mq.addEventListener('change',()=>{if(_theme==='system')applyTheme()});
try{const tp=localStorage.getItem('cortex-theme');if(tp)_theme=tp;}catch(e){}
/* developer mode, Sui/Walrus details are opt-in; memory-first by default */
function isDev(){ return document.body.classList.contains('dev'); }
function toggleDev(){ const on=!document.body.classList.contains('dev'); document.body.classList.toggle('dev',on); try{localStorage.setItem('cortex-dev',on?'1':'')}catch(e){} renderAll(); if(location.hash.startsWith('#/dream/')) renderDreamDetail(location.hash.slice(7)); toast(on?'Developer mode on, on-chain (Sui & Walrus) details shown':'Developer mode off, memory-first view'); }
try{ if(localStorage.getItem('cortex-dev')) document.body.classList.add('dev'); }catch(e){}

/* ============================================================
   KNOWLEDGE BASE, upload → build memory → ask (Perplexity-style)
============================================================ */
const KB={files:[],seq:0,model:'claude-sonnet-4-6',built:0,answer:null};
function fmtSize(b){return b<1024?b+' B':b<1048576?Math.round(b/1024)+' KB':(b/1048576).toFixed(1)+' MB'}
function kbGrow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,200)+'px'}
function kbPick(){document.getElementById('kb-file').click()}
function kbChosen(list){
  [...list].forEach(f=>KB.files.push({id:++KB.seq,name:f.name,size:f.size||0,status:'indexing',chunks:0}));
  document.getElementById('kb-file').value='';
  renderKB();
  KB.files.filter(x=>x.status==='indexing').forEach(x=>setTimeout(()=>{x.status='indexed';x.chunks=Math.max(2,Math.round((x.size||4000)/1800));renderKB();},650+Math.random()*1000));
}
function kbRemove(id){KB.files=KB.files.filter(f=>f.id!==id);renderKB();}
function kbBuild(){
  const idx=KB.files.filter(f=>f.status==='indexed');
  if(!idx.length){toast('Upload and index at least one source first.');return}
  KB.built=idx.reduce((n,f)=>n+Math.max(1,Math.round(f.chunks/3)),0);
  renderKB();
  toast('Built '+KB.built+' memories from '+idx.length+' source'+(idx.length>1?'s':'')+' · queued for the next dream.');
}
function kbAsk(){
  const q=document.getElementById('kb-q').value.trim();
  const idx=KB.files.filter(f=>f.status==='indexed');
  if(!q){toast('Type a question first.');return}
  if(!idx.length){toast('Upload a source before asking.');return}
  KB.answer={q,cites:idx.slice(0,3),model:KB.model,sources:idx.length};
  const ta=document.getElementById('kb-q'); ta.value=''; kbGrow(ta);
  renderKB();
}
function kbSetModel(m){KB.model=m;document.getElementById('kb-modelname').textContent=m;document.getElementById('kb-modelmenu').classList.remove('show');}
function kbToggleModelMenu(e){e.stopPropagation();document.getElementById('kb-modelmenu').classList.toggle('show');}
document.addEventListener('click',()=>{const m=document.getElementById('kb-modelmenu');if(m)m.classList.remove('show');});
function renderKB(){
  const sc=document.getElementById('kb-srccount'); if(!sc) return;
  const idx=KB.files.filter(f=>f.status==='indexed').length;
  sc.textContent=KB.files.length;
  document.getElementById('kb-crumb').textContent=STATE.ns+' / knowledge base';
  const files=document.getElementById('kb-files');
  if(!KB.files.length){
    files.innerHTML='<button class="kb-dropzone" id="kb-drop" onclick="kbPick()">Drop files here, or <span style="color:var(--text);font-weight:500">browse</span><div class="mono xs faint" style="margin-top:6px">PDF · Markdown · TXT · DOCX, indexed into this namespace</div></button>';
  } else {
    files.innerHTML='<div class="kb-dropzone slim" id="kb-drop" onclick="kbPick()">+ Add more files</div>'+KB.files.map(f=>
      '<div class="kb-file"><span class="kb-fi"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>'
      +'<div class="kb-fmeta"><div class="kb-fname">'+escHtml(f.name)+'</div><div class="kb-fsub">'+fmtSize(f.size)+(f.status==='indexed'?' · '+f.chunks+' chunks':'')+'</div></div>'
      +'<span class="kb-status '+f.status+'">'+(f.status==='indexed'?'indexed':'indexing…')+'</span>'
      +'<button class="kb-x" aria-label="Remove" onclick="kbRemove('+f.id+')">×</button></div>').join('');
  }
  const dz=document.getElementById('kb-drop');
  if(dz){
    dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over')});
    dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
    dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');kbChosen(e.dataTransfer.files)});
  }
  document.getElementById('kb-built').textContent=KB.built?(KB.built+' memories built'):(idx?idx+' source'+(idx>1?'s':'')+' indexed · ready to build':'');
  const ans=document.getElementById('kb-answer');
  if(!KB.answer){ans.innerHTML='';}
  else{
    const a=KB.answer;
    ans.innerHTML='<div class="kb-ans"><div class="kb-ans-q">'+escHtml(a.q)+'</div>'
      +'<div class="kb-ans-body">Drawing on '+a.sources+' indexed source'+(a.sources>1?'s':'')+', here is what your knowledge base says. The supporting passages were retrieved from the documents cited below'+a.cites.map((c,i)=>' <sup class="kb-sup">'+(i+1)+'</sup>').join('')+'. In production this is generated by <b>'+a.model+'</b> over the retrieved chunks, with every claim grounded in a source.</div>'
      +'<div class="kb-cites">'+a.cites.map((c,i)=>'<span class="kb-cite"><span class="kb-cnum">'+(i+1)+'</span>'+escHtml(c.name)+'</span>').join('')+'</div></div>';
  }
}
/* ===== knowledge base: chat layout, drop-on-surface, multi-provider models ===== */
const KB_MARK_PATHS='<path d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z"/><path d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z" transform="rotate(45 60 60)"/><path d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z" transform="rotate(90 60 60)"/><path d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z" transform="rotate(135 60 60)"/><path d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z" transform="rotate(180 60 60)"/><path d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z" transform="rotate(225 60 60)"/><path d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z" transform="rotate(270 60 60)"/><path d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z" transform="rotate(315 60 60)"/>';
const KB_MODELS=[
 {name:'Claude Opus 4.8',prov:'Anthropic'},
 {name:'GPT-5.5',prov:'OpenAI'},
 {name:'Gemini 3.1 Pro',prov:'Google'},
 {name:'Grok 4',prov:'xAI'},
 {name:'Llama 4 Maverick',prov:'Meta'},
];
KB.msgs=[]; KB.model='Claude Opus 4.8';
function kbKey(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();kbAsk();} }
function kbScrollEnd(){ const s=document.getElementById('kb-scroll'); if(s) s.scrollTop=s.scrollHeight; }
function kbRenderModels(){
  const m=document.getElementById('kb-modelmenu'); if(!m) return;
  m.innerHTML=KB_MODELS.map(x=>'<button onclick="kbSetModel(\''+x.name+'\')">'+x.name+'<span class="mp">'+x.prov+'</span></button>').join('');
}
function kbSetModel(name){ KB.model=name; document.getElementById('kb-modelname').textContent=name; document.getElementById('kb-modelmenu').classList.remove('show'); }
function kbChosen(list){
  [...list].forEach(f=>KB.files.push({id:++KB.seq,name:f.name,size:f.size||0,status:'indexing',chunks:0}));
  const fi=document.getElementById('kb-file'); if(fi) fi.value='';
  renderKB();
  KB.files.filter(x=>x.status==='indexing').forEach(x=>setTimeout(()=>{x.status='indexed';x.chunks=Math.max(2,Math.round((x.size||4000)/1800));renderKB();},650+Math.random()*1000));
}
function kbRemove(id){ KB.files=KB.files.filter(f=>f.id!==id); renderKB(); }
function kbBuild(){
  const idx=KB.files.filter(f=>f.status==='indexed');
  if(!idx.length){toast('Add at least one source first.');return}
  KB.built=idx.reduce((n,f)=>n+Math.max(1,Math.round(f.chunks/3)),0);
  toast('Built '+KB.built+' memories from '+idx.length+' source'+(idx.length>1?'s':'')+' · queued for the next dream.');
}
function kbAsk(){
  const ta=document.getElementById('kb-q'); const q=ta.value.trim();
  if(!q){toast('Type a question first.');return}
  const idx=KB.files.filter(f=>f.status==='indexed');
  const msg={q,cites:idx.slice(0,3),model:KB.model,sources:idx.length,text:''};
  KB.msgs.push(msg); ta.value=''; kbGrow(ta); renderKB();
  const full=idx.length
    ? 'Drawing on '+idx.length+' indexed source'+(idx.length>1?'s':'')+', here is what your knowledge base says. The supporting passages were retrieved from the cited documents below. In production this answer is generated by '+KB.model+' over the retrieved chunks, with every claim grounded in a source.'
    : 'You have not added any sources yet, so there is nothing to ground this in. Drop a document onto the box below and I will index it into this namespace first.';
  kbStream(msg, full);
}
function kbStream(msg, full){
  const words=full.split(' '); let i=0;
  const body=document.querySelector('.kb-msg:last-child .kb-a-text');
  const tick=setInterval(()=>{
    if(i>=words.length){clearInterval(tick); msg.text=full; renderKB(); return;}
    msg.text=(msg.text?msg.text+' ':'')+words[i++];
    if(body){ body.textContent=msg.text; kbScrollEnd(); }
  },42);
}
function renderKB(){
  const sc=document.getElementById('kb-srccount'); if(!sc) return;
  const idx=KB.files.filter(f=>f.status==='indexed').length;
  sc.textContent=KB.files.length;
  const cr=document.getElementById('kb-crumb'); if(cr) cr.textContent=STATE.ns+' / knowledge base';
  kbRenderModels();
  const att=document.getElementById('kb-attached');
  if(att) att.innerHTML=KB.files.map(f=>
    '<span class="kb-att"><span class="ai"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span><span class="an">'+escHtml(f.name)+'</span><span class="as '+f.status+'">'+(f.status==='indexed'?f.chunks+' ch':'…')+'</span><button class="ax" aria-label="Remove" onclick="kbRemove('+f.id+')">×</button></span>').join('');
  const scr=document.getElementById('kb-scroll'); if(!scr) return;
  if(!KB.msgs.length){
    scr.innerHTML='<div class="kb-empty"><svg class="em-mark" viewBox="0 0 120 120" fill="currentColor"><circle cx="60" cy="60" r="9"/>'+KB_MARK_PATHS+'</svg><div class="em-t">Ask anything about your sources</div><div class="em-s">Drop files onto the box below to index them into '+STATE.ns+'.</div></div>';
  } else {
    scr.innerHTML=KB.msgs.map(m=>
      '<div class="kb-msg"><div class="kb-q-bubble">'+escHtml(m.q)+'</div>'
      +'<div class="kb-a-bubble"><div class="kb-a-model"><span class="kb-a-dot"></span>'+escHtml(m.model)+(m.sources?' · '+m.sources+' source'+(m.sources>1?'s':''):'')+'</div>'
      +'<div class="kb-a-text">'+escHtml(m.text)+'</div>'
      +(m.sources&&m.text?'<div class="kb-cites">'+m.cites.map((c,i)=>'<span class="kb-cite"><span class="kb-cnum">'+(i+1)+'</span>'+escHtml(c.name)+'</span>').join('')+'</div>':'')
      +'</div></div>').join('');
    kbScrollEnd();
  }
}
(function kbInitDrop(){
  const c=document.getElementById('kb-composer'); if(!c) return;
  c.addEventListener('dragover',e=>{e.preventDefault();c.classList.add('over')});
  c.addEventListener('dragleave',e=>{ if(e.target===c) c.classList.remove('over')});
  c.addEventListener('drop',e=>{e.preventDefault();c.classList.remove('over'); if(e.dataTransfer&&e.dataTransfer.files.length) kbChosen(e.dataTransfer.files)});
})();
/* ===== memory page: saved view presets ===== */
let MEM_PRESETS=[];
function loadMemPresets(){
  try{const s=localStorage.getItem('cortex-mem-presets'); if(s){MEM_PRESETS=JSON.parse(s);return}}catch(e){}
  MEM_PRESETS=[
    {name:'Verified',view:'list',filter:'verified',q:''},
    {name:'Dreamed',view:'list',filter:'dream',q:''},
    {name:'Tombstoned',view:'list',filter:'tomb',q:''},
    {name:'Cluster map',view:'map',filter:'all',q:''},
  ];
}
function saveMemPresets(){try{localStorage.setItem('cortex-mem-presets',JSON.stringify(MEM_PRESETS))}catch(e){}}
function memQ(){const s=document.getElementById('mem-search');return s?s.value:''}
function memPresetActive(p){return p.view===(STATE.memView||'list')&&p.filter===STATE.memFilter&&(p.q||'')===memQ()}
function renderMemPresets(){
  const el=document.getElementById('mem-presets'); if(!el) return;
  el.innerHTML=MEM_PRESETS.length?MEM_PRESETS.map((p,i)=>
    '<span class="mpreset '+(memPresetActive(p)?'on':'')+'"><button class="pn" onclick="applyMemPreset('+i+')">'+escHtml(p.name)+'</button><button class="px" aria-label="Delete preset" onclick="delMemPreset(event,'+i+')">×</button></span>').join('')
    :'<span class="mono xs faint">no presets yet</span>';
}
function applyMemPreset(i){
  const p=MEM_PRESETS[i]; if(!p) return;
  STATE.memFilter=p.filter; STATE.memView=p.view;
  const s=document.getElementById('mem-search'); if(s) s.value=p.q||'';
  renderMemories();
  toast('Applied preset · '+p.name);
}
function delMemPreset(e,i){
  e.stopPropagation();
  const p=MEM_PRESETS[i]; MEM_PRESETS.splice(i,1); saveMemPresets(); renderMemPresets();
  toast('Removed preset · '+(p?p.name:''));
}
function memSavePreset(){
  const name=(prompt('Name this view preset:','My filter')||'').trim(); if(!name) return;
  MEM_PRESETS.push({name,view:STATE.memView||'list',filter:STATE.memFilter,q:memQ()});
  saveMemPresets(); renderMemPresets();
  toast('Saved preset · '+name);
}
loadMemPresets();
applyTheme();renderAll();route();

  // --- PWA bootstrap ---------------------------------------------------
  // Register the service worker so the app works offline and can be installed.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('[PWA] Service worker registration failed:', err);
      });
    });
  }

  // Keep the screen awake while the app is in view — so the phone doesn't
  // sleep between holes. Silently does nothing on browsers that don't
  // support it (notably iOS Safari <16.4). Re-requests on tab focus.
  (() => {
    if (!('wakeLock' in navigator)) return;
    let lock = null;
    const request = async () => {
      try { lock = await navigator.wakeLock.request('screen'); }
      catch (e) { /* denied or unavailable — fine */ }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') request();
    });
    request();
  })();

(() => {

  const $ = id => document.getElementById(id);
  let activeMode = 'en';

  // ── HCP ──
  function parseHcp(val){
    // "5" or "5.0" → 5.0 (normal golfer)
    // "+5" or "+5.0" → -5.0 (plus golfer, internally negative)
    if(typeof val!=='string') val=String(val||'');
    val=val.trim();
    if(!val) return 0;
    if(val.startsWith('+')){const n=parseFloat(val.slice(1));return isNaN(n)?0:-n;}
    const n=parseFloat(val);return isNaN(n)?0:n;
  }
  function playHcp(hcp,slope,cr,par){return Math.round(hcp*(slope/113)+(cr-par))||0;}
  function extraStrokes(ph,si){
    if(ph===0) return 0;
    if(ph>0){let s=0;if(si<=ph)s++;if(si<=ph-18)s++;return s;}
    // Negative playing hcp: minusslag on easiest holes first (SI 18, 17, ...)
    const absPh=Math.abs(ph);
    let s=0;if(si>=19-absPh)s--;if(si>=37-absPh)s--;return s;
  }
  function b2sf(brutto,par,ex){return Math.max(0,2-(brutto-par-ex));}
  function netto(brutto,par,ex){return brutto-par-ex;}

  // ── COURSE DROPDOWNS ──
  function buildCourseDd(selId){
    const s=$(selId);s.innerHTML='<option value="">Ingen bana</option>';
    COURSES.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;s.appendChild(o);});
  }
  // Populates each player's individual tee dropdown for the given mode based on the
  // currently-selected course. Preserves the previous selection if the new course
  // still has a tee with that name; otherwise clears it.
  function buildPlayerTeeDds(mode){
    const courseId=$(`${mode}-courseSelect`).value;
    const c=courseId?COURSES.find(x=>x.id===courseId)||null:null;
    const ids=mode==='en'?['en-teeA','en-teeB','en-teeC']:['tb-tee1','tb-tee2','tb-tee3','tb-tee4'];
    ids.forEach(id=>{
      const sel=$(id);if(!sel)return;
      const cur=sel.value;
      sel.innerHTML='<option value="">\u2013</option>';
      if(c){
        c.tees.forEach(t=>{
          const o=document.createElement('option');
          o.value=t.name;
          o.textContent=t.name+' ('+t.slope+')';
          sel.appendChild(o);
        });
      }
      if([...sel.options].some(o=>o.value===cur))sel.value=cur;
      else sel.value='';
    });
  }
  function getCourse(csel){const id=$(csel).value;return id?COURSES.find(c=>c.id===id)||null:null;}

  function updateCourseBar(csel){
    const c=getCourse(csel);
    if(c){$('courseBarName').textContent=c.name.toUpperCase();$('courseBarPar').textContent='Par '+c.par;$('courseBar').classList.add('visible');}
    else $('courseBar').classList.remove('visible');
  }
  function updateParBadge(badgeId,csel,hole){
    const c=getCourse(csel);
    if(c&&hole>=1&&hole<=c.holes.length){const hd=c.holes[hole-1];$(badgeId).textContent='PAR '+hd.par+' \u00b7 SI '+hd.si;$(badgeId).classList.add('visible');}
    else $(badgeId).classList.remove('visible');
  }

  // ── MODE SWITCHER ──
  $('modeBtn').addEventListener('click',()=>{
    activeMode=activeMode==='en'?'tb':'en';
    $('viewEN').classList.toggle('active',activeMode==='en');
    $('viewTB').classList.toggle('active',activeMode==='tb');
    $('appTitle').innerHTML=activeMode==='en'?'EVIL <em>NINE</em>':'B\u00c4STBOLL <em>TALIBAN</em>';
    $('modeBtnLabel').textContent=activeMode==='en'?'Taliban':'Evil Nine';
    $('openPayments').classList.toggle('hidden',activeMode==='tb');
    $('tb-openPayments').classList.toggle('hidden',activeMode==='en');
    $('en-settings').classList.toggle('active',activeMode==='en');
    $('tb-settings').classList.toggle('active',activeMode==='tb');
    $('settingsModeLabel').textContent=activeMode==='en'?'EVIL NINE':'B\u00c4STBOLL TALIBAN';
    if(activeMode==='en')updateCourseBar('en-courseSelect');
    else updateCourseBar('tb-courseSelect');
    localStorage.setItem('golfActiveMode',activeMode);
  });

  // ════════════════════════════════
  // EVIL NINE
  // ════════════════════════════════
  const EN_KEY='evilNine_v6_state';
  const enS={scores:[0,0,0],history:[],usedDouble:[false,false,false],krStart:10,krNow:10,maxHoles:18,hole:1};
  let enUndo=[];

  buildCourseDd('en-courseSelect');
  $('en-courseSelect').addEventListener('change',()=>{buildPlayerTeeDds('en');if($('en-courseSelect').value)$('en-inputMode').value='brutto';});

  function enNames(){return [0,1,2].map(i=>($(['en-nameA','en-nameB','en-nameC'][i]).value||'').trim()||'Spelare '+(i+1));}
  function enCA(){return !!enCourse();}
  function enCourse(){return getCourse('en-courseSelect');}
  // Per-player tee lookup. Returns null if no course or this player has no tee selected.
  function enTeeFor(i){const c=enCourse();if(!c)return null;const name=$(['en-teeA','en-teeB','en-teeC'][i]).value;return name?c.tees.find(t=>t.name===name)||null:null;}
  function enHcps(){const c=enCourse();if(!c)return[0,0,0];return[0,1,2].map(i=>{const t=enTeeFor(i);if(!t)return 0;const el=$(['en-hcpA','en-hcpB','en-hcpC'][i]);return playHcp(parseHcp(el.value),t.slope,t.cr,c.par);});}

  function enStrokeBadges(){
    const bs=[$('en-strokeBadgeA'),$('en-strokeBadgeB'),$('en-strokeBadgeC')];
    if(!enCA()){bs.forEach(b=>b.textContent='');return;}
    const c=enCourse(),h=Number($('en-holeNo').value)||enS.hole;
    if(!c||h<1||h>c.holes.length){bs.forEach(b=>b.textContent='');return;}
    const hd=c.holes[h-1],ph=enHcps();
    ph.forEach((p,i)=>{const ex=extraStrokes(p,hd.si);if(ex>0)bs[i].textContent='\u25cf'.repeat(ex);else if(ex<0)bs[i].textContent='\u2212'.repeat(Math.abs(ex));else bs[i].textContent='';});
  }

  function enUpdateDblDd(){
    const names=enNames(),h=Number($('en-holeNo').value)||enS.hole;
    $('en-doubleWho').innerHTML='<option value="">Ingen</option>';
    const hints=[];
    if(h>=12){
      const m=Math.min(...enS.scores),elig=enS.scores.map((v,i)=>v===m&&!enS.usedDouble[i]?i:-1).filter(i=>i!==-1);
      if(elig.length){elig.forEach(i=>{const o=document.createElement('option');o.value=i;o.textContent=names[i];$('en-doubleWho').appendChild(o);});hints.push('H\u00c5L '+h+': '+elig.map(i=>names[i]).join(' & ')+' kan pressa.');}
      else hints.push('H\u00c5L '+h+': Press redan anv\u00e4nd.');
    }
    if(enCA()){const c=enCourse(),hd=c.holes[h-1];if(hd){const ph=enHcps(),ex=ph.map(p=>extraStrokes(p,hd.si));hints.push('Extra slag \u2192 '+ex.map((e,i)=>names[i].split(' ')[0]+': '+(e>0?'+'+e:'0')).join(' \u00b7 '));}}
    $('en-hint').textContent=hints.join('  |  ');
  }

  function enCalcPts(raw,holeNum){
    const mode=$('en-inputMode').value,thr=Math.max(1,Number($('en-evilThreshold').value)||2);
    let vals=raw.slice(),sf=null;
    if(mode==='brutto'&&enCA()){const c=enCourse(),hd=c.holes[holeNum-1],ph=enHcps();sf=raw.map((b,i)=>b2sf(b,hd.par,extraStrokes(ph[i],hd.si)));vals=sf;}
    const low=(mode==='strokes'||(mode==='brutto'&&!enCA()));
    const sorted=vals.map((v,i)=>({v,i})).sort((a,b)=>low?a.v-b.v:b.v-a.v);
    const[best,mid,last]=sorted,diff=low?(mid.v-best.v):(best.v-mid.v);
    let pts,note;
    if(diff>=thr){pts=[0,0,0];pts[best.i]=9;note='Evil Nine (\u2265'+thr+')';}
    else if(best.v===mid.v&&mid.v===last.v){pts=[0,0,0];note='Alla lika (0\u20130\u20130)';}
    else if(best.v===mid.v){pts=[0,0,0];pts[best.i]=3;pts[mid.i]=3;note='Tv\u00e5 delar 1:a (3\u20133\u20130)';}
    else if(mid.v===last.v){pts=[0,0,0];pts[best.i]=3;note='Ensam vinnare (3\u20130\u20130)';}
    else{pts=[0,0,0];pts[best.i]=4;pts[mid.i]=2;note='1\u20132\u20133 (4\u20132\u20130)';}
    return{pts,note,sf};
  }

  function enTransfers(){
    const p=enS.scores,kr=enS.krNow,mode=$('en-payMode').value,names=enNames(),res=[];
    const leader=s=>{let mx=s[0],idx=0;for(let i=1;i<3;i++)if(s[i]>mx){mx=s[i];idx=i;}return idx;};
    if(mode==='leader-diff'){const l=leader(p);for(let i=0;i<3;i++){if(i===l)continue;const a=(p[l]-p[i])*kr;if(a>0)res.push({from:names[i],to:names[l],amt:a});}}
    else if(mode==='pairwise'){for(const[i,j]of[[0,1],[0,2],[1,2]]){if(p[i]===p[j])continue;const hi=p[i]>p[j]?i:j,lo=hi===i?j:i;const a=(p[hi]-p[lo])*kr;if(a>0)res.push({from:names[lo],to:names[hi],amt:a});}}
    return res;
  }

  function enUI(){
    const names=enNames();
    [$('en-scoreTitleA'),$('en-scoreTitleB'),$('en-scoreTitleC')].forEach((el,i)=>el.textContent=names[i].toUpperCase());
    [$('en-labelNameA'),$('en-labelNameB'),$('en-labelNameC')].forEach((el,i)=>el.textContent=names[i].toUpperCase());
    [$('en-labelInputA'),$('en-labelInputB'),$('en-labelInputC')].forEach((el,i)=>el.textContent=names[i].toUpperCase().slice(0,8));
    $('en-scoreA').textContent=enS.scores[0];$('en-scoreB').textContent=enS.scores[1];$('en-scoreC').textContent=enS.scores[2];
    $('en-krNow').textContent=enS.krNow+' KR';
    $('en-doublesUsed').textContent=names.map((n,i)=>n+':'+(enS.usedDouble[i]?'\u2713':'\u2013')).join(' ');
    $('en-undoBtn').disabled=enS.history.length===0;
    $('en-holeNo').value=enS.hole;
    enUpdateDblDd();enStrokeBadges();
    $('en-historyCount').textContent=enS.history.length+' H\u00c5L';
    $('en-roundCompleteBar').classList.toggle('visible',enS.history.length>=(Number($('en-maxHoles').value)||18));
    if(activeMode==='en')updateCourseBar('en-courseSelect');
    updateParBadge('en-holeParBadge','en-courseSelect',Number($('en-holeNo').value)||enS.hole);
    $('openPayments').classList.toggle('has-payments',enTransfers().length>0);
    enSave();
  }

  function enAddRow(e,prepend=false){
    const tr=document.createElement('tr');
    const slag=e.sf?e.sf.join(' / ')+'<br><span style="font-size:10px;color:var(--chalk-dim)">brutto: '+e.values.join(' / ')+'</span>':e.values.join(' / ');
    tr.innerHTML='<td>'+e.hole+'</td><td>'+slag+'</td><td>'+e.holePts.join(' / ')+'</td><td class="note-cell">'+e.note+'</td><td style="text-align:right">'+e.after.join(' / ')+'</td>';
    if(prepend&&$('en-historyBody').firstChild)$('en-historyBody').insertBefore(tr,$('en-historyBody').firstChild);
    else $('en-historyBody').appendChild(tr);
  }
  function enRerender(){$('en-historyBody').innerHTML='';for(let i=enS.history.length-1;i>=0;i--)enAddRow(enS.history[i]);}

  function enUiState(){return{inputMode:$('en-inputMode').value,evilThreshold:$('en-evilThreshold').value,maxHoles:$('en-maxHoles').value,startHole:$('en-startHole').value,krPerPoint:$('en-krPerPoint').value,payMode:$('en-payMode').value,names:[$('en-nameA').value,$('en-nameB').value,$('en-nameC').value],hcps:[$('en-hcpA').value,$('en-hcpB').value,$('en-hcpC').value],courseId:$('en-courseSelect').value,tees:['en-teeA','en-teeB','en-teeC'].map(id=>$(id).value)};}
  function enApplyUi(ui){
    if(!ui)return;
    if(ui.inputMode)$('en-inputMode').value=ui.inputMode;if(ui.evilThreshold!=null)$('en-evilThreshold').value=ui.evilThreshold;
    if(ui.maxHoles)$('en-maxHoles').value=ui.maxHoles;if(ui.startHole)$('en-startHole').value=ui.startHole;
    if(ui.krPerPoint!=null)$('en-krPerPoint').value=ui.krPerPoint;if(ui.payMode)$('en-payMode').value=ui.payMode;
    const nm=ui.names||['','',''];$('en-nameA').value=nm[0]||'';$('en-nameB').value=nm[1]||'';$('en-nameC').value=nm[2]||'';
    const hcps=ui.hcps||['','',''];$('en-hcpA').value=hcps[0]||'';$('en-hcpB').value=hcps[1]||'';$('en-hcpC').value=hcps[2]||'';
    if(ui.courseId){$('en-courseSelect').value=ui.courseId;buildPlayerTeeDds('en');}
    // Apply per-player tees, with migration from old single `tee` field
    let tees=ui.tees;
    if(!tees&&ui.tee)tees=[ui.tee,ui.tee,ui.tee];
    if(tees){['en-teeA','en-teeB','en-teeC'].forEach((id,i)=>{if(tees[i]&&$(id))$(id).value=tees[i];});}
    syncHcpPlusButtons();
  }
  function enSave(){localStorage.setItem(EN_KEY,JSON.stringify({state:enS,ui:enUiState()}));}
  function enLoad(){
    const raw=localStorage.getItem(EN_KEY);if(!raw)return false;
    try{const p=JSON.parse(raw);if(!p||!p.state)return false;Object.assign(enS,p.state);enApplyUi(p.ui||{});enRerender();return true;}catch(e){return false;}
  }
  function enSnap(){return JSON.parse(JSON.stringify({state:enS,ui:{...enUiState(),holeNo:$('en-holeNo').value}}));}
  function enRestore(snap){
    Object.assign(enS,snap.state);enApplyUi(snap.ui||{});if(snap.ui&&snap.ui.holeNo)$('en-holeNo').value=snap.ui.holeNo;enRerender();enUI();
  }
  function enReset(){
    enUndo=[];enS.scores=[0,0,0];enS.history=[];enS.usedDouble=[false,false,false];
    enS.krStart=Number($('en-krPerPoint').value)||10;enS.krNow=enS.krStart;
    enS.maxHoles=Number($('en-maxHoles').value)||18;enS.hole=Number($('en-startHole').value)||1;
    enRerender();enSaveClose();
  }
  function enAddHole(){
    const hole=Number($('en-holeNo').value),max=Number($('en-maxHoles').value)||18;
    enS.maxHoles=max;
    if(!Number.isFinite(hole)||hole<1||hole>18){alert('Ogiltigt h\u00e5l.');return;}
    const raw=[Number($('en-valA').value),Number($('en-valB').value),Number($('en-valC').value)];
    if(raw.some(v=>!Number.isFinite(v))){alert('Fyll i resultat f\u00f6r alla tre spelare.');return;}
    if($('en-inputMode').value==='brutto'){const c=enCourse(),par=c?c.holes[hole-1].par:4;const sus=raw.filter(v=>v<1||v>par+8);if(sus.length&&!confirm('N\u00e5got slag verkar ovanligt ('+sus.join(', ')+').\nSt\u00e4mmer det?'))return;}
    enUndo.push(enSnap());enS.hole=hole;
    const dv=$('en-doubleWho').value===''?null:Number($('en-doubleWho').value);
    let dNote='';
    if(dv!=null&&hole>=12&&enS.scores[dv]===Math.min(...enS.scores)&&!enS.usedDouble[dv]){enS.scores=enS.scores.map(s=>Math.floor(s/2));enS.krNow*=2;enS.usedDouble[dv]=true;dNote='Press: kr/p nu '+enS.krNow+'.';}
    const{pts,note,sf}=enCalcPts(raw,hole);
    enS.scores=enS.scores.map((s,i)=>s+pts[i]);
    const m=Math.min(...enS.scores);enS.scores=enS.scores.map(s=>s-m);
    const entry={hole,values:raw,holePts:pts,sf:sf||null,note:[dNote,note,m>0?'Nedr\u00e4kning: -'+m:'Nedr\u00e4kning: 0'].filter(Boolean).join(' \u2022 '),after:[...enS.scores]};
    enS.history.push(entry);enAddRow(entry,true);
    enS.hole=Math.min(hole+1,18);
    $('en-valA').value='';$('en-valB').value='';$('en-valC').value='';$('en-valA').focus();
    enUI();if(enS.history.length>=max)setTimeout(()=>openSummary('en'),400);
  }

  let enSettSnap=null;
  function enOpenSet(){enSettSnap=enSnap();}
  function enDiscardSet(){if(enSettSnap)enRestore(enSettSnap);enSettSnap=null;}
  function enSaveClose(){enSettSnap=null;$('modalOverlay').classList.remove('open');const ns=Number($('en-krPerPoint').value)||10;if(enS.krNow===enS.krStart)enS.krNow=ns;enS.krStart=ns;enUI();}

  $('openPayments').addEventListener('click',()=>{renderPay();$('payModalOverlay').classList.add('open');});
  $('closePayments').addEventListener('click',()=>$('payModalOverlay').classList.remove('open'));
  $('payModalOverlay').addEventListener('click',e=>{if(e.target===$('payModalOverlay'))$('payModalOverlay').classList.remove('open');});
  function renderPay(){
    $('payKrBadge').textContent=enS.krNow+' KR / PO\u00c4NG';
    const tr=enTransfers();$('openPayments').classList.toggle('has-payments',tr.length>0);
    if(!tr.length){$('payLines').innerHTML='<div class="pay-empty">Ingen betalning \u2014 alla \u00e4r lika.</div>';return;}
    $('payLines').innerHTML=tr.map(t=>'<div class="pay-line"><div><div class="pay-line-names">'+t.from+'</div><div class="pay-line-arrow">\u25bc BETALAR TILL</div><div class="pay-line-names">'+t.to+'</div></div><div class="pay-line-amount">'+t.amt+' KR</div></div>').join('');
  }

  $('en-addHoleBtn').addEventListener('click',enAddHole);
  $('en-undoBtn').addEventListener('click',()=>{const s=enUndo.pop();if(s)enRestore(s);});
  $('en-resetBtn').addEventListener('click',()=>{$('en-resetConfirmBar').classList.add('visible');$('en-resetConfirmBar').scrollIntoView({behavior:'smooth',block:'nearest'});});
  $('en-resetYes').addEventListener('click',()=>{$('en-resetConfirmBar').classList.remove('visible');enReset();});
  $('en-resetNo').addEventListener('click',()=>$('en-resetConfirmBar').classList.remove('visible'));
  $('en-resetBtn2').addEventListener('click',()=>$('en-resetConfirm').style.display='block');
  $('en-resetConfirmNo').addEventListener('click',()=>$('en-resetConfirm').style.display='none');
  $('en-resetConfirmYes').addEventListener('click',()=>{localStorage.removeItem(EN_KEY);$('en-resetConfirm').style.display='none';enReset();});
  $('en-saveSettings').addEventListener('click',enSaveClose);
  $('en-holeNo').addEventListener('input',()=>{enUpdateDblDd();enStrokeBadges();updateParBadge('en-holeParBadge','en-courseSelect',Number($('en-holeNo').value));});
  $('en-historyToggle').addEventListener('click',()=>$('en-historySection').classList.toggle('open'));
  $('en-showSummaryBtn').addEventListener('click',()=>openSummary('en'));

  // ════════════════════════════════
  // TALIBAN
  // ════════════════════════════════
  const TB_KEY='talibanJihad_v2_state';
  const tbS={history:[],hole:1};
  let tbUndo=[];

  buildCourseDd('tb-courseSelect');
  $('tb-courseSelect').addEventListener('change',()=>buildPlayerTeeDds('tb'));

  function tbName(i){return($(['tb-name1','tb-name2','tb-name3','tb-name4'][i]).value||'').trim()||'Spelare '+(i+1);}
  function tbTeams(){return[[parseInt($('tb-pair1a').value),parseInt($('tb-pair1b').value)],[parseInt($('tb-pair2a').value),parseInt($('tb-pair2b').value)]];}
  function tbTname(t){return tbTeams()[t].map(i=>tbName(i).split(' ')[0]).join(' & ');}
  function tbCA(){return !!tbCourse();}
  function tbCourse(){return getCourse('tb-courseSelect');}
  function tbTeeFor(i){const c=tbCourse();if(!c)return null;const name=$(['tb-tee1','tb-tee2','tb-tee3','tb-tee4'][i]).value;return name?c.tees.find(t=>t.name===name)||null:null;}
  function tbHcps(){const c=tbCourse();if(!c)return[0,0,0,0];return[0,1,2,3].map(i=>{const t=tbTeeFor(i);if(!t)return 0;return playHcp(parseHcp($('tb-hcp'+(i+1)).value),t.slope,t.cr,c.par);});}

  // Previous values snapshot — used by tbPairChanged to perform swap-on-change
  // so that picking a player who's already in another slot swaps them rather
  // than creating a duplicate.
  let _tbPairPrev = null;

  function tbBuildPairing(){
    const ids=['tb-pair1a','tb-pair1b','tb-pair2a','tb-pair2b'];
    if(ids.some(id=>!$(id))) return;

    // Read current values as indices 0..3, or -1 if missing/invalid
    const vals = ids.map(id=>{
      const n=parseInt($(id).value,10);
      return (Number.isFinite(n)&&n>=0&&n<=3)?n:-1;
    });

    // Resolve duplicates + missing: first occurrence of each value keeps it;
    // any slot that's -1 or a repeat gets assigned the next unused index.
    const seen=new Set(), needsFix=[];
    for(let i=0;i<4;i++){
      if(vals[i]===-1||seen.has(vals[i])) needsFix.push(i);
      else seen.add(vals[i]);
    }
    const unused=[0,1,2,3].filter(v=>!seen.has(v));
    needsFix.forEach((i,idx)=>{ vals[i]=unused[idx]; });

    // Rebuild each dropdown with ALL 4 players as options. Duplicate prevention
    // happens on change via tbPairChanged (swap-on-collision), not by hiding options,
    // which would leave the user unable to re-pair when every slot is already filled.
    ids.forEach((sid,si)=>{
      const sel=$(sid);
      sel.innerHTML='';
      [0,1,2,3].forEach(i=>{
        const o=document.createElement('option');
        o.value=i;o.textContent=tbName(i);
        sel.appendChild(o);
      });
      sel.value=String(vals[si]);
    });

    _tbPairPrev=vals.slice();
  }

  // When a pairing dropdown changes: if the new value is already held by another
  // slot, swap — give that other slot the value this slot used to have. Keeps
  // all four slots holding distinct players at all times.
  function tbPairChanged(changedId){
    const ids=['tb-pair1a','tb-pair1b','tb-pair2a','tb-pair2b'];
    const ci=ids.indexOf(changedId);
    if(ci<0||!_tbPairPrev){ tbBuildPairing(); tbUI(); return; }
    const newVal=parseInt($(changedId).value,10);
    const prevVal=_tbPairPrev[ci];
    if(newVal===prevVal){ tbUI(); return; }
    // Find the other slot holding newVal and give it this slot's previous value
    for(let i=0;i<4;i++){
      if(i!==ci&&_tbPairPrev[i]===newVal){
        $(ids[i]).value=String(prevVal);
        break;
      }
    }
    _tbPairPrev=ids.map(id=>parseInt($(id).value,10));
    tbUI();
  }
  [1,2,3,4].forEach(n=>{ const el=$('tb-name'+n); if(el) el.addEventListener('input',tbBuildPairing); });
  ['tb-pair1a','tb-pair1b','tb-pair2a','tb-pair2b'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('change',()=>tbPairChanged(id)); });

  function tbColors(){
    const teams=tbTeams();
    [1,2,3,4].forEach(n=>{$('tb-col'+n).classList.remove('team1','team2');$('tb-badge'+n).textContent='';$('tb-badge'+n).className='team-badge';});
    teams[0].forEach(i=>{$('tb-col'+(i+1)).classList.add('team1');$('tb-badge'+(i+1)).textContent='LAG 1';$('tb-badge'+(i+1)).className='team-badge t1';});
    teams[1].forEach(i=>{$('tb-col'+(i+1)).classList.add('team2');$('tb-badge'+(i+1)).textContent='LAG 2';$('tb-badge'+(i+1)).className='team-badge t2';});
  }

  function tbCalcScore(){
    const ut={w1:0,w2:0,d:0,played:0},inp={w1:0,w2:0,d:0,played:0};
    tbS.history.forEach(e=>{const p=e.hole<=9?ut:inp;p.played++;if(e.winner===0)p.w1++;else if(e.winner===1)p.w2++;else p.d++;});
    return{ut,in:inp,tot:{w1:ut.w1+inp.w1,w2:ut.w2+inp.w2,d:ut.d+inp.d,played:ut.played+inp.played}};
  }

  // Walks a section's holes in play order; once lead > remaining, freezes the
  // display at "X & Y" so later play within that section doesn't change it.
  // If no closeout happened, falls back to dormy/all-square/X UP based on current tally.
  function tbSectionResult(holes,totalHoles,t1Name,t2Name){
    let w1=0,w2=0,d=0,frozen=null;
    for(const e of holes){
      if(e.winner===0)w1++;else if(e.winner===1)w2++;else d++;
      if(!frozen){
        const played=w1+w2+d,lead=Math.abs(w1-w2),remaining=totalHoles-played;
        if(lead>remaining&&lead>0){
          const leader=w1>w2?t1Name:t2Name;
          frozen={txt:lead+' & '+remaining,cls:'lead',sub:leader};
        }
      }
    }
    if(frozen)return frozen;
    const played=w1+w2+d;
    if(!played)return{txt:'\u2013',cls:'',sub:''};
    const lead=Math.abs(w1-w2),remaining=totalHoles-played;
    const leader=w1>w2?t1Name:w2>w1?t2Name:null;
    if(!leader)return{txt:'ALL SQUARE',cls:'',sub:''};
    if(remaining===0)return{txt:lead+' UP',cls:'lead',sub:leader};
    if(lead===remaining)return{txt:'DORMY',cls:'lead',sub:leader};
    return{txt:lead+' UP',cls:'lead',sub:leader};
  }

  function tbCalcHole(bruttos,holeNum){
    let nettos;
    if(tbCA()){const c=tbCourse(),hd=c.holes[holeNum-1],ph=tbHcps();nettos=bruttos.map((b,i)=>netto(b,hd.par,extraStrokes(ph[i],hd.si)));}
    else nettos=bruttos.slice();
    const teams=tbTeams(),tn=teams.map(t=>t.map(i=>nettos[i]));
    const best=tn.map(ns=>Math.min(...ns)),worst=tn.map(ns=>Math.max(...ns));
    let winner,note;
    if(best[0]<best[1]){winner=0;note='B\u00e4stboll: '+best[0]+' mot '+best[1];}
    else if(best[1]<best[0]){winner=1;note='B\u00e4stboll: '+best[1]+' mot '+best[0];}
    else{
      note='Lika b\u00e4stboll ('+best[0]+') \u2192 Taliban: '+worst[0]+' mot '+worst[1];
      if(worst[0]<worst[1])winner=0;else if(worst[1]<worst[0])winner=1;else{winner=2;note='Lika b\u00e4stboll och s\u00e4mstboll \u2192 Delat h\u00e5l';}
    }
    return{nettos,best,worst,winner,note};
  }

  function tbUI(){
    const t1=tbTname(0),t2=tbTname(1);
    $('tb-team1Name').textContent=t1;$('tb-team2Name').textContent=t2;
    const teams=tbTeams(),ph=tbHcps();
    $('tb-team1Players').innerHTML=teams[0].map(i=>tbName(i)+(tbCA()?' (spel-hcp: '+ph[i]+')':'')).join('<br>');
    $('tb-team2Players').innerHTML=teams[1].map(i=>tbName(i)+(tbCA()?' (spel-hcp: '+ph[i]+')':'')).join('<br>');
    [1,2,3,4].forEach(n=>$('tb-labelP'+n).textContent=tbName(n-1).toUpperCase().slice(0,8));
    tbColors();
    const sc=tbCalcScore();
    const ul=tbSectionResult(tbS.history.filter(e=>e.hole<=9),9,t1,t2);
    const il=tbSectionResult(tbS.history.filter(e=>e.hole>=10),9,t1,t2);
    const tl=tbSectionResult(tbS.history,18,t1,t2);
    $('tb-scoreUt').innerHTML=ul.txt;$('tb-scoreUt').className='score-val'+(ul.cls?' '+ul.cls:'');
    $('tb-scoreIn').innerHTML=il.txt;$('tb-scoreIn').className='score-val'+(il.cls?' '+il.cls:'');
    $('tb-scoreTot').innerHTML=tl.txt;$('tb-scoreTot').className='score-val'+(tl.cls?' '+tl.cls:'');
    $('tb-resultUt').textContent=ul.sub?ul.sub:'';
    $('tb-resultIn').textContent=il.sub?il.sub:'';
    $('tb-resultTot').textContent=tl.sub?tl.sub:'';
    $('tb-holeNo').value=tbS.hole;
    $('tb-undoBtn').disabled=tbS.history.length===0;
    $('tb-historyCount').textContent=tbS.history.length+' H\u00c5L';
    $('tb-roundCompleteBar').classList.toggle('visible',tbS.history.length>=(Number($('tb-maxHoles').value)||18));
    if(activeMode==='tb')updateCourseBar('tb-courseSelect');
    updateParBadge('tb-holeParBadge','tb-courseSelect',Number($('tb-holeNo').value)||tbS.hole);
    if(tbCA()){const h=Number($('tb-holeNo').value)||tbS.hole,c=tbCourse(),hd=c.holes[h-1];if(hd){const ex=ph.map(p=>extraStrokes(p,hd.si));$('tb-hint').textContent='Extra slag \u2192 '+[0,1,2,3].map(i=>tbName(i).split(' ')[0]+': '+(ex[i]>0?'+'+ex[i]:'0')).join(' \u00b7 ');}else $('tb-hint').textContent='';}else $('tb-hint').textContent='';
    tbSave();
  }

  function tbAddRow(e,prepend=false){
    const tr=document.createElement('tr'),teams=tbTeams();
    const t1s=teams[0].map(i=>e.nettos[i]).join('/'),t2s=teams[1].map(i=>e.nettos[i]).join('/');
    const wc=e.winner===0?'win':e.winner===1?'loss':'draw';
    const wt=e.winner===0?tbTname(0)+' vinner':e.winner===1?tbTname(1)+' vinner':'Delat';
    tr.innerHTML='<td>'+e.hole+'</td><td>'+t1s+' <span style="font-size:10px;color:var(--chalk-dim)">('+e.best[0]+')</span></td><td>'+t2s+' <span style="font-size:10px;color:var(--chalk-dim)">('+e.best[1]+')</span></td><td class="'+wc+'">'+wt+'</td><td class="note-cell">'+e.note+'</td>';
    if(prepend&&$('tb-historyBody').firstChild)$('tb-historyBody').insertBefore(tr,$('tb-historyBody').firstChild);
    else $('tb-historyBody').appendChild(tr);
  }
  function tbRerender(){$('tb-historyBody').innerHTML='';for(let i=tbS.history.length-1;i>=0;i--)tbAddRow(tbS.history[i]);}

  function tbUiState(){return{names:[1,2,3,4].map(n=>$('tb-name'+n).value),hcps:[1,2,3,4].map(n=>$('tb-hcp'+n).value),pair1a:$('tb-pair1a').value,pair1b:$('tb-pair1b').value,pair2a:$('tb-pair2a').value,pair2b:$('tb-pair2b').value,courseId:$('tb-courseSelect').value,tees:['tb-tee1','tb-tee2','tb-tee3','tb-tee4'].map(id=>$(id).value),maxHoles:$('tb-maxHoles').value,startHole:$('tb-startHole').value,stakeUt:$('tb-stakeUt').value,stakeIn:$('tb-stakeIn').value,stakeTot:$('tb-stakeTot').value};}
  function tbApplyUi(ui){
    if(!ui)return;
    const nm=ui.names||['','','',''];[1,2,3,4].forEach((n,i)=>$('tb-name'+n).value=nm[i]||'');
    const hcps=ui.hcps||['','','',''];[1,2,3,4].forEach((n,i)=>$('tb-hcp'+n).value=hcps[i]||'');
    tbBuildPairing();
    if(ui.pair1a!=null)$('tb-pair1a').value=ui.pair1a;if(ui.pair1b!=null)$('tb-pair1b').value=ui.pair1b;
    if(ui.pair2a!=null)$('tb-pair2a').value=ui.pair2a;if(ui.pair2b!=null)$('tb-pair2b').value=ui.pair2b;
    // Re-run so _tbPairPrev snapshot matches the just-restored values
    tbBuildPairing();
    if(ui.courseId){$('tb-courseSelect').value=ui.courseId;buildPlayerTeeDds('tb');}
    let tbTees=ui.tees;
    if(!tbTees&&ui.tee)tbTees=[ui.tee,ui.tee,ui.tee,ui.tee];
    if(tbTees){['tb-tee1','tb-tee2','tb-tee3','tb-tee4'].forEach((id,i)=>{if(tbTees[i]&&$(id))$(id).value=tbTees[i];});}
    if(ui.maxHoles)$('tb-maxHoles').value=ui.maxHoles;if(ui.startHole)$('tb-startHole').value=ui.startHole;
    if(ui.stakeUt!=null)$('tb-stakeUt').value=ui.stakeUt;
    if(ui.stakeIn!=null)$('tb-stakeIn').value=ui.stakeIn;
    if(ui.stakeTot!=null)$('tb-stakeTot').value=ui.stakeTot;
    syncHcpPlusButtons();
  }

  function tbCalcPayments(){
    const t1=tbTname(0),t2=tbTname(1),teams=tbTeams();
    const stakes={ut:Number($('tb-stakeUt').value)||0,in:Number($('tb-stakeIn').value)||0,tot:Number($('tb-stakeTot').value)||0};
    const utRes=tbSectionResult(tbS.history.filter(e=>e.hole<=9),9,t1,t2);
    const inRes=tbSectionResult(tbS.history.filter(e=>e.hole>=10),9,t1,t2);
    const totRes=tbSectionResult(tbS.history,18,t1,t2);
    const payments=[];
    function addSection(res,stake,part){
      if(stake<=0||!res.sub)return;
      const winTeam=res.sub===t1?0:1;
      const loseTeam=1-winTeam;
      const winners=teams[winTeam];
      const perLine=stake/winners.length;
      teams[loseTeam].forEach(L=>winners.forEach(W=>payments.push({from:tbName(L),to:tbName(W),amt:perLine,part})));
    }
    addSection(utRes,stakes.ut,'UT');
    addSection(inRes,stakes.in,'IN');
    addSection(totRes,stakes.tot,'TOTALT');
    return payments;
  }

  function tbRenderPay(){
    const payments=tbCalcPayments();
    $('tb-openPayments').classList.toggle('has-payments',payments.length>0);
    const overlay=$('payModalOverlay');
    const badge=$('payKrBadge');
    const lines=$('payLines');
    badge.textContent='UT '+($('tb-stakeUt').value||0)+' kr \u00b7 IN '+($('tb-stakeIn').value||0)+' kr \u00b7 TOTALT '+($('tb-stakeTot').value||0)+' kr';
    if(!payments.length){lines.innerHTML='<div class="pay-empty">Ingen betalning \u2014 j\u00e4mnt!</div>';return;}
    // Group by person paying
    const grouped={};
    payments.forEach(p=>{
      const key=p.from+'->'+p.to;
      if(!grouped[key])grouped[key]={from:p.from,to:p.to,amt:0,parts:[]};
      grouped[key].amt+=p.amt;grouped[key].parts.push(p.part);
    });
    lines.innerHTML=Object.values(grouped).map(p=>'<div class="pay-line"><div><div class="pay-line-names">'+p.from+'</div><div class="pay-line-arrow">\u25bc BETALAR TILL</div><div class="pay-line-names">'+p.to+'</div><div style="font-family:\'Courier Prime\',monospace;font-size:10px;color:var(--chalk-dim);margin-top:4px">'+p.parts.join(' + ')+'</div></div><div class="pay-line-amount">'+p.amt+' KR</div></div>').join('');
    overlay.classList.add('open');
  }
  function tbSave(){localStorage.setItem(TB_KEY,JSON.stringify({state:tbS,ui:tbUiState()}));}
  function tbLoad(){const raw=localStorage.getItem(TB_KEY);if(!raw)return false;try{const p=JSON.parse(raw);if(!p||!p.state)return false;Object.assign(tbS,p.state);tbApplyUi(p.ui||{});tbRerender();return true;}catch(e){return false;}}
  function tbSnap(){return JSON.parse(JSON.stringify({state:tbS,ui:{...tbUiState(),holeNo:$('tb-holeNo').value}}));}
  function tbRestore(snap){Object.assign(tbS,snap.state);tbApplyUi(snap.ui||{});if(snap.ui&&snap.ui.holeNo)$('tb-holeNo').value=snap.ui.holeNo;tbRerender();tbUI();}
  function tbReset(){tbUndo=[];tbS.history=[];tbS.hole=Number($('tb-startHole').value)||1;tbRerender();tbSaveClose();}

  function tbAddHole(){
    const hole=Number($('tb-holeNo').value),max=Number($('tb-maxHoles').value)||18;
    if(!Number.isFinite(hole)||hole<1||hole>18){alert('Ogiltigt h\u00e5l.');return;}
    const bruttos=[1,2,3,4].map(n=>Number($('tb-val'+n).value));
    if(bruttos.some(v=>!Number.isFinite(v))){alert('Fyll i slag f\u00f6r alla fyra spelare.');return;}
    const existingIdx=tbS.history.findIndex(e=>e.hole===hole);
    if(existingIdx!==-1&&!confirm('H\u00e5l '+hole+' \u00e4r redan registrerat. Vill du ers\u00e4tta det?'))return;
    tbUndo.push(tbSnap());
    const{nettos,best,worst,winner,note}=tbCalcHole(bruttos,hole);
    const entry={hole,bruttos,nettos,best,worst,winner,note};
    if(existingIdx!==-1){
      tbS.history[existingIdx]=entry;
      tbRerender();
    } else {
      tbS.history.push(entry);
      tbAddRow(entry,true);
      tbS.hole=Math.min(hole+1,18);
    }
    [1,2,3,4].forEach(n=>$('tb-val'+n).value='');$('tb-val1').focus();
    tbUI();if(tbS.history.length>=max)setTimeout(()=>openSummary('tb'),400);
  }

  let tbSettSnap=null;
  function tbOpenSet(){tbSettSnap=tbSnap();}
  function tbDiscardSet(){if(tbSettSnap)tbRestore(tbSettSnap);tbSettSnap=null;}
  function tbSaveClose(){tbSettSnap=null;$('modalOverlay').classList.remove('open');tbS.hole=Number($('tb-startHole').value)||1;tbUI();}

  $('tb-addHoleBtn').addEventListener('click',tbAddHole);
  $('tb-undoBtn').addEventListener('click',()=>{const s=tbUndo.pop();if(s)tbRestore(s);});
  $('tb-resetBtn').addEventListener('click',()=>{$('tb-resetConfirmBar').classList.add('visible');$('tb-resetConfirmBar').scrollIntoView({behavior:'smooth',block:'nearest'});});
  $('tb-resetYes').addEventListener('click',()=>{$('tb-resetConfirmBar').classList.remove('visible');tbReset();});
  $('tb-resetNo').addEventListener('click',()=>$('tb-resetConfirmBar').classList.remove('visible'));
  $('tb-resetBtn2').addEventListener('click',()=>$('tb-resetConfirm').style.display='block');
  $('tb-resetConfirmNo').addEventListener('click',()=>$('tb-resetConfirm').style.display='none');
  $('tb-resetConfirmYes').addEventListener('click',()=>{localStorage.removeItem(TB_KEY);$('tb-resetConfirm').style.display='none';tbReset();});
  $('tb-saveSettings').addEventListener('click',tbSaveClose);
  $('tb-openPayments').addEventListener('click',()=>tbRenderPay());
  $('tb-holeNo').addEventListener('input',()=>{
    const h=Number($('tb-holeNo').value);
    const existing=Number.isFinite(h)?tbS.history.find(e=>e.hole===h):null;
    if(existing){[1,2,3,4].forEach((n,i)=>$('tb-val'+n).value=existing.bruttos[i]);}
    else {[1,2,3,4].forEach(n=>$('tb-val'+n).value='');}
    tbUI();
  });
  $('tb-historyToggle').addEventListener('click',()=>$('tb-historySection').classList.toggle('open'));
  $('tb-showSummaryBtn').addEventListener('click',()=>openSummary('tb'));

  // ════════════════════════════════
  // SHARED SETTINGS MODAL
  // ════════════════════════════════
  $('openSettings').addEventListener('click',()=>{if(activeMode==='en')enOpenSet();else tbOpenSet();$('modalOverlay').classList.add('open');});
  $('closeSettings').addEventListener('click',()=>{if(activeMode==='en')enDiscardSet();else tbDiscardSet();$('modalOverlay').classList.remove('open');if(activeMode==='en')enUI();else tbUI();});
  $('modalOverlay').addEventListener('click',e=>{if(e.target===$('modalOverlay')){if(activeMode==='en')enDiscardSet();else tbDiscardSet();$('modalOverlay').classList.remove('open');if(activeMode==='en')enUI();else tbUI();}});
  $('courseBarInner').addEventListener('click',()=>{if(activeMode==='en')enOpenSet();else tbOpenSet();$('modalOverlay').classList.add('open');});

  // ════════════════════════════════
  // SUMMARY MODAL
  // ════════════════════════════════
  function openSummary(mode){renderSummary(mode);$('summaryOverlay').classList.add('open');}
  $('closeSummary').addEventListener('click',()=>$('summaryOverlay').classList.remove('open'));
  $('summaryOverlay').addEventListener('click',e=>{if(e.target===$('summaryOverlay'))$('summaryOverlay').classList.remove('open');});

  function renderSummary(mode){
    if(mode==='en'){
      $('summaryTitle').textContent='EVIL NINE \u2014 RUNDAN KLAR';
      const names=enNames(),p=enS.scores;
      const sorted=[0,1,2].map(i=>({i,name:names[i],score:p[i]})).sort((a,b)=>b.score-a.score);
      const ranks=['\ud83e\udd47 1:A','\ud83e\udd48 2:A','\ud83e\udd49 3:E'];
      let html='<div class="summary-podium">'+sorted.map((pl,r)=>'<div class="podium-col'+(r===0?' first':'')+'"><div class="podium-rank">'+ranks[r]+'</div><div class="podium-name">'+pl.name+'</div><div class="podium-score">'+pl.score+'</div></div>').join('')+'</div>';
      html+='<div class="summary-section-label">BETALNING</div>';
      const tr=enTransfers();
      if(!tr.length)html+='<div class="summary-no-pay">Ingen betalning \u2014 alla \u00e4r lika.</div>';
      else html+='<div class="summary-pay-lines">'+tr.map(t=>'<div class="summary-pay-line"><span class="summary-pay-from-to">'+t.from+' \u2192 '+t.to+'</span><span class="summary-pay-amt">'+t.amt+' KR</span></div>').join('')+'</div>';
      html+='<div class="summary-actions"><button class="summary-btn" id="sumExport">EXPORTERA</button><button class="summary-btn primary" id="sumClose">ST\u00c4NG</button></div>';
      $('summaryBody').innerHTML=html;
      $('sumExport').addEventListener('click',()=>{
        const date=new Date().toLocaleDateString('sv-SE'),c=enCourse();
        let txt='EVIL NINE \u2014 '+date+'\n';if(c)txt+=c.name+'\n';
        txt+='\nST\u00c4LLNING\n';sorted.forEach((pl,i)=>txt+=(i+1)+'. '+pl.name+': '+pl.score+' po\u00e4ng\n');
        txt+='\nBETALNING ('+enS.krNow+' kr/po\u00e4ng)\n';
        const tr2=enTransfers();if(!tr2.length)txt+='Ingen betalning.\n';else tr2.forEach(t=>txt+=t.from+' betalar '+t.to+': '+t.amt+' kr\n');
        navigator.clipboard.writeText(txt).then(()=>{const b=$('sumExport');if(!b)return;const o=b.textContent;b.textContent='KOPIERAT!';setTimeout(()=>{if($('sumExport'))$('sumExport').textContent=o;},2000);}).catch(()=>alert(txt));
      });
      $('sumClose').addEventListener('click',()=>$('summaryOverlay').classList.remove('open'));
    } else {
      $('summaryTitle').textContent='TALIBAN \u2014 RUNDAN KLAR';
      const sc=tbCalcScore(),t1=tbTname(0),t2=tbTname(1);
      const utRes=tbSectionResult(tbS.history.filter(e=>e.hole<=9),9,t1,t2);
      const inRes=tbSectionResult(tbS.history.filter(e=>e.hole>=10),9,t1,t2);
      const totRes=tbSectionResult(tbS.history,18,t1,t2);
      const sec=(label,res)=>'<div class="summary-section"><div class="summary-section-title">'+label+'</div><div class="summary-result-row" style="justify-content:center"><span class="summary-result-val'+(res.cls?' '+res.cls:'')+'" style="font-size:36px">'+res.txt+'</span></div>'+(res.sub?'<div style="text-align:center;font-family:\'Courier Prime\',monospace;font-size:12px;color:var(--lime-dim);margin-top:6px">'+res.sub+'</div>':'<div style="text-align:center;font-family:\'Courier Prime\',monospace;font-size:12px;color:var(--chalk-dim);margin-top:6px">J\u00e4mnt!</div>')+'</div>';
      const winner=totRes.sub||null;
      let html=sec('UT (H\u00c5L 1\u20139)',utRes)+sec('IN (H\u00c5L 10\u201318)',inRes)+sec('TOTALT',totRes);
      html+=winner?'<div class="summary-winner-banner"><div class="summary-winner-text">\ud83c\udfc6 '+winner+'</div><div class="summary-winner-sub">Vinner matchen</div></div>':'<div class="summary-winner-banner"><div class="summary-winner-text">J\u00c4MT!</div><div class="summary-winner-sub">Matchen slutade delat</div></div>';
      html+='<div class="summary-actions"><button class="summary-btn" id="sumExport">EXPORTERA</button><button class="summary-btn primary" id="sumClose">ST\u00c4NG</button></div>';
      $('summaryBody').innerHTML=html;
      $('sumExport').addEventListener('click',()=>{
        const date=new Date().toLocaleDateString('sv-SE'),c=tbCourse();
        let txt='B\u00c4STBOLL TALIBAN \u2014 '+date+'\n';if(c)txt+=c.name+'\n';
        txt+='\n'+t1+' mot '+t2+'\n\nUT: '+utRes.txt+(utRes.sub?' ('+utRes.sub+')':'')+'\nIN: '+inRes.txt+(inRes.sub?' ('+inRes.sub+')':'')+'\nTOTALT: '+totRes.txt+(totRes.sub?' ('+totRes.sub+')':'');
        txt+=winner?'\n\nVinnare: '+winner:'\n\nResultat: J\u00e4mnt';
        navigator.clipboard.writeText(txt).then(()=>{const b=$('sumExport');if(!b)return;const o=b.textContent;b.textContent='KOPIERAT!';setTimeout(()=>{if($('sumExport'))$('sumExport').textContent=o;},2000);}).catch(()=>alert(txt));
      });
      $('sumClose').addEventListener('click',()=>$('summaryOverlay').classList.remove('open'));
    }
  }

  // ════════════════════════════════
  // HCP PLUS-TOGGLE
  // ════════════════════════════════
  // Each HCP input has a "+" button beside it. Tapping the button toggles a leading
  // "+" prefix on the input's value. parseHcp already understands "+5.4" as -5.4 (plus golfer).
  function hcpTogglePlus(targetId){
    const inp=$(targetId);if(!inp)return;
    const cur=inp.value.trim();
    inp.value=cur.startsWith('+')?cur.slice(1):'+'+cur;
    syncHcpPlusButtons();
  }
  function syncHcpPlusButtons(){
    document.querySelectorAll('.hcp-plus-btn').forEach(btn=>{
      const inp=$(btn.dataset.target);
      if(inp)btn.classList.toggle('active',inp.value.trim().startsWith('+'));
    });
  }

  // ════════════════════════════════
  // INIT
  // ════════════════════════════════
  setTimeout(()=>tbBuildPairing(), 0);
  // Wire up plus-toggle buttons (and sync state when user types directly)
  document.querySelectorAll('.hcp-plus-btn').forEach(btn=>{
    btn.addEventListener('click',()=>hcpTogglePlus(btn.dataset.target));
  });
  document.querySelectorAll('input[id^="en-hcp"],input[id^="tb-hcp"]').forEach(inp=>{
    inp.addEventListener('input',syncHcpPlusButtons);
  });
  const savedMode=localStorage.getItem('golfActiveMode');
  if(savedMode==='tb'){
    activeMode='tb';
    $('viewEN').classList.remove('active');$('viewTB').classList.add('active');
    $('appTitle').innerHTML='B\u00c4STBOLL <em>TALIBAN</em>';$('modeBtnLabel').textContent='Evil Nine';
    $('openPayments').classList.add('hidden');
    $('tb-openPayments').classList.remove('hidden');
    $('en-settings').classList.remove('active');$('tb-settings').classList.add('active');
    $('settingsModeLabel').textContent='B\u00c4STBOLL TALIBAN';
  }
  const enLoaded=enLoad();
  if(!enLoaded){enS.krStart=Number($('en-krPerPoint').value)||10;enS.krNow=enS.krStart;enS.hole=1;}
  const tbLoaded=tbLoad();
  if(!tbLoaded)tbS.hole=1;
  enUI();tbUI();
  if(activeMode==='en')updateCourseBar('en-courseSelect');
  else updateCourseBar('tb-courseSelect');
})();

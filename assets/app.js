'use strict';
// QuizPulse single-device mode. No Scratch VM, cloud variables, or external services.
const CATEGORIES=['歴史','地理','科学・自然','数学・IT','言語・文学','芸術・音楽','アニメ・ゲーム・映画','スポーツ','生活・雑学／実用'];
const COLORS=['#ff667b','#4d9bff','#42deb7','#ffc15d'];
const DISPLAY_CAT=['歴史','地理','科学・自然','数学・IT','言語・文学','芸術・音楽','アニメ・ゲーム・映画','スポーツ','生活・雑学／実用'];
const $=id=>document.getElementById(id);
const allCats=new Set(CATEGORIES.map((_,i)=>i));
const config={count:4,difficulty:'B',rounds:20,categories:allCats,sound:true,onlyReadable:true};
const game={phase:'idle',pool:[],round:0,score:[0,0,0,0],misses:new Set(),q:null,revealStart:0,revealElapsed:0,shown:-1,buzzes:[],buzzStart:0,owner:null,answerStart:0,lockedAfterFull:0,wasVisibleAt:0,lastFrame:0,readings:[],typed:'',answerLimit:10000,confirmStart:0,confirmLimit:3000};
let toastHandle=null,audio=null,frameId=null;
function setText(id,text){const e=$(id);if(e&&e.textContent!==String(text))e.textContent=String(text)}
function setMirrorText(id,text){setText(id,text);setText(id+'Top',text)}
function showMirrors(id,visible){show(id,visible);show(id+'Top',visible)}
function progressMirrors(width){$('progressBar').style.width=width;$('progressBarTop').style.width=width}
function show(id,visible){$(id).classList.toggle('hidden',!visible)}
function toast(msg){setText('toast',msg);show('toast',true);clearTimeout(toastHandle);toastHandle=setTimeout(()=>show('toast',false),2400)}
function sfx(type){if(!config.sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const x=audio.createOscillator(),v=audio.createGain(),n=audio.currentTime;x.type=type==='bad'?'sawtooth':'sine';x.frequency.setValueAtTime(type==='buzz'?620:type==='good'?740:type==='bad'?180:480,n);if(type==='good')x.frequency.exponentialRampToValueAtTime(1100,n+.13);v.gain.setValueAtTime(.07,n);v.gain.exponentialRampToValueAtTime(.001,n+.17);x.connect(v).connect(audio.destination);x.start(n);x.stop(n+.18)}catch{}}
function setupUI(){
 document.querySelectorAll('[data-count]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.count)===config.count);b.onclick=()=>{config.count=Number(b.dataset.count);setupUI()}});
 document.querySelectorAll('[data-difficulty]').forEach(b=>{b.classList.toggle('active',b.dataset.difficulty===config.difficulty);b.onclick=()=>{config.difficulty=b.dataset.difficulty;setupUI()}});
 document.querySelectorAll('[data-rounds]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.rounds)===config.rounds);b.onclick=()=>{config.rounds=Number(b.dataset.rounds);setupUI()}});
 $('onlyReadable').checked=config.onlyReadable;
 const genres=$('genreChoices');genres.replaceChildren();CATEGORIES.forEach((c,i)=>{const l=document.createElement('label'),inp=document.createElement('input');inp.type='checkbox';inp.checked=config.categories.has(i);inp.onchange=()=>{inp.checked?config.categories.add(i):config.categories.delete(i);setText('genreCount',`${config.categories.size}/9`);$('startBtn').disabled=!config.categories.size};const span=document.createElement('span');span.textContent=c;l.append(inp,span);genres.append(l)});
 setText('genreCount',`${config.categories.size}/9`);$('startBtn').disabled=!config.categories.size;
}
$('allGenres').onclick=()=>{config.categories=new Set(CATEGORIES.map((_,i)=>i));setupUI()};
$('noGenres').onclick=()=>{config.categories=new Set();setupUI()};
$('onlyReadable').onchange=e=>{config.onlyReadable=e.target.checked};
$('soundBtn').onclick=()=>{config.sound=!config.sound;setText('soundBtn',config.sound?'♪':'♩')};
$('fullBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('この端末では全画面にできません')}};
function renderPlayers(){const top=$('playersTop'),bottom=$('players');top.replaceChildren();bottom.replaceChildren();const topCount=config.count>=3?2:1;top.classList.toggle('single',topCount===1);bottom.classList.toggle('single',config.count-topCount===1);for(let p=0;p<config.count;p++){
 const b=document.createElement('button');b.type='button';b.className='buzz';b.style.setProperty('--player-color',COLORS[p]);b.dataset.player=p;
 b.innerHTML=`<span class="player-head"><span class="player-dot"></span> PLAYER ${p+1}</span><span class="player-main">0<small>pt</small></span><span class="player-foot">押して早押し · ${p+1}キー</span><span class="confirm-overlay" aria-hidden="true"><span class="confirm-caption">PLAYER ${p+1} · 解答権</span><strong class="confirm-cta">回答開始</strong><span class="confirm-timer">3.0秒</span></span>`;
 b.addEventListener('pointerdown',e=>{e.preventDefault();game.phase==='confirming'?confirmAnswer(p):buzz(p,e.timeStamp)});(p<topCount?top:bottom).appendChild(b)
 }}
function renderScores(){document.querySelectorAll('.buzz').forEach(b=>{
 const p=Number(b.dataset.player),awaiting=game.phase==='confirming'&&game.owner===p;
 b.querySelector('.player-main').innerHTML=`${game.score[p]}<small>pt</small>`;
 b.classList.toggle('lockout',game.misses.has(p));
 b.classList.toggle('winner',game.owner===p&&game.phase==='answering');
 b.classList.toggle('await-start',awaiting);
 b.disabled=!awaiting&&(!(game.phase==='reading'||game.phase==='pending')||game.misses.has(p));
 b.setAttribute('aria-label',awaiting?`PLAYER ${p+1} 回答開始、残り3秒`: `PLAYER ${p+1} 早押し`);
 b.querySelector('.player-foot').textContent=game.misses.has(p)?'この問題は回答済み':awaiting?'もう一度押して回答開始':game.phase==='confirming'?'回答開始を待機中':game.phase==='reading'||game.phase==='pending'?'タップして早押し · '+(p+1)+'キー':'次の問題で押せます';
})}

async function loadBank(d){const ids=[1,2,3];const packs=await Promise.all(ids.map(async n=>{const url=`./data/${d}${n}.json`;const res=await fetch(url,{cache:'force-cache'});if(!res.ok)throw Error(`データ取得失敗: ${url}`);const x=await res.json();if(!Array.isArray(x)||x.length!==1000)throw Error(`不正な問題データ: ${url}`);return x}));return packs.flat().map(e=>({id:d+String(e[0]).padStart(4,'0'),cat:e[1],question:e[2],answer:e[3],explain:e[4],alt:e[5]}))}
// A question without an established phonetic reading must not silently guess kanji.
function normalizeReading(text){
 if(typeof text!=='string')return null;
 const clean=text.normalize('NFKC').trim().replace(/[\s・･／/＝=]/g,'');
 if(!/^[\u3041-\u3096\u30a1-\u30f6ー]+$/.test(clean))return null;
 return Array.from(clean).map(ch=>ch>='ァ'&&ch<='ヶ'?String.fromCharCode(ch.charCodeAt(0)-96):ch).join('');
}
function acceptedReadings(q){
 return [...new Set([q.answer,...(Array.isArray(q.alt)?q.alt:[])].map(normalizeReading).filter(Boolean))];
}
const HIRAGANA_POOL=Array.from('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉゃゅょっゔー');
function showChoiceMode(enabled,owner){
 const onTop=owner!==null&&owner<(config.count>=3?2:1);
 for(const side of ['Top','']){
  const active=owner!==null&&(side==='Top'?onTop:!onTop);
  show('choiceEntry'+side,enabled&&active);
  show('manualActions'+side,!enabled&&active);
 }
}

function renderChoices(){
 const side=game.owner<(config.count>=3?2:1)?'Top':'';
 const target=$('choiceButtons'+side);
 setText('typedAnswer'+side,game.typed||'1文字ずつ選択');
 const nexts=[...new Set(game.readings.filter(r=>r.startsWith(game.typed)&&r.length>game.typed.length).map(r=>Array.from(r)[Array.from(game.typed).length]))];
 if(!nexts.length){judge(false);return}
 if(nexts.length>4){showChoiceMode(false,game.owner);return}
 const choices=shuffle([...nexts,...shuffle(HIRAGANA_POOL.filter(ch=>!nexts.includes(ch))).slice(0,4-nexts.length)]);
 target.replaceChildren();
 for(const ch of choices){
  const button=document.createElement('button');
  button.type='button';button.textContent=ch;button.setAttribute('aria-label',ch);
  button.addEventListener('click',()=>selectChar(ch));
  target.append(button);
 }
}
function selectChar(ch){
 if(game.phase!=='answering'||!game.readings.length)return;
 const next=game.typed+ch;
 if(!game.readings.some(r=>r.startsWith(next))){judge(false);return}
 game.typed=next;sfx('tap');
 if(game.readings.includes(next)){judge(true);return}
 renderChoices();
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const n=Math.floor(Math.random()*(i+1));[a[i],a[n]]=[a[n],a[i]]}return a}
$('startBtn').onclick=async()=>{if(!config.categories.size){toast('ジャンルを一つ以上選択してください');return}const btn=$('startBtn');btn.disabled=true;btn.textContent='問題を読み込み中…';try{
 let bank=await loadBank(config.difficulty);bank=bank.filter(q=>config.categories.has(q.cat));if(config.onlyReadable)bank=bank.filter(q=>acceptedReadings(q).length>0);if(bank.length<config.rounds){throw Error('選択した問題が不足しています')}
 game.pool=shuffle(bank).slice(0,config.rounds);game.round=0;game.score=[0,0,0,0];game.phase='ready';savePrefs();renderPlayers();show('setupOverlay',false);nextRound()
 }catch(err){toast(err.message||'データ読み込みに失敗しました');setText('loadNotice',String(err.message||err))}finally{btn.disabled=false;btn.innerHTML='ゲーム開始 <span>→</span>'}};
function savePrefs(){try{localStorage.setItem('sideworks:quizpulse:settings',JSON.stringify({count:config.count,difficulty:config.difficulty,rounds:config.rounds,categories:[...config.categories],sound:config.sound,onlyReadable:config.onlyReadable}))}catch{}}
function restorePrefs(){try{const x=JSON.parse(localStorage.getItem('sideworks:quizpulse:settings'));if(!x)return;if([2,3,4].includes(x.count))config.count=x.count;if('ABC'.includes(x.difficulty))config.difficulty=x.difficulty;if([10,20,30].includes(x.rounds))config.rounds=x.rounds;if(Array.isArray(x.categories)&&x.categories.every(n=>Number.isInteger(n)&&n>=0&&n<9))config.categories=new Set(x.categories);config.sound=x.sound!==false;config.onlyReadable=x.onlyReadable!==false}catch{}}
function nextRound(){showChoiceMode(false,null);showMirrors('judgeInline',false);showMirrors('answerPanel',false);show('nextBtn',false);show('showAnswerBtn',true);game.misses.clear();game.owner=null;game.confirmStart=0;game.buzzes=[];game.readings=[];game.typed='';
 if(game.round>=game.pool.length){finishGame();return}
 game.q=game.pool[game.round++];game.phase='reading';game.revealElapsed=0;game.shown=-1;game.revealStart=performance.now();game.lockedAfterFull=0;
 setMirrorText('questionText','');setMirrorText('roundLabel',`ROUND ${String(game.round).padStart(2,'0')} / ${String(game.pool.length).padStart(2,'0')}`);setMirrorText('difficultyLabel',`${config.difficulty} · ${DISPLAY_CAT[game.q.cat]}`);setMirrorText('stateLabel','読み上げ中 · ボタンを押して回答');setMirrorText('clockLabel','00.0');progressMirrors('0%');renderScores()}
function elapsedReading(t){return game.revealElapsed+Math.max(0,t-game.revealStart)}
function timeStamp(t){const now=performance.now();return Number.isFinite(t)&&t>=0&&Math.abs(t-now)<8000?t:now}
function buzz(player,eventStamp){if((game.phase!=='reading'&&game.phase!=='pending')||game.misses.has(player))return;const t=timeStamp(eventStamp);if(game.phase==='reading'){game.revealElapsed=elapsedReading(t);game.phase='pending';game.buzzStart=performance.now();game.buzzes=[];setMirrorText('stateLabel','早押し判定中…')}
 if(!game.buzzes.some(x=>x.player===player))game.buzzes.push({player,t});sfx('buzz')}
function resolveBuzz(){
 const b=game.buzzes.sort((a,b)=>a.t-b.t);game.buzzes=[];
 if(!b.length){game.phase='reading';game.revealStart=performance.now();return}
 if(b.length>=2&&b[1].t-b[0].t<=6){
  game.phase='reading';game.revealStart=performance.now();setMirrorText('stateLabel','同時押し・押し直してください');toast('6ms以内の同時押し：もう一度押してください');return;
 }
 game.owner=b[0].player;game.phase='confirming';game.confirmStart=performance.now();
 show('showAnswerBtn',false);
 setMirrorText('stateLabel',`PLAYER ${game.owner+1} が獲得 · ボタンをもう一度押して回答開始`);
 renderScores();
}
function expireConfirmation(){
 if(game.phase!=='confirming'||game.owner===null)return;
 const p=game.owner;
 game.misses.add(p);game.owner=null;
 if(game.misses.size===config.count){revealAnswer('全員の解答権が終了');return}
 game.phase='reading';game.revealStart=performance.now();
 show('showAnswerBtn',true);
 setMirrorText('stateLabel',`PLAYER ${p+1} 開始期限切れ · 他の人が早押しできます`);
 renderScores();
}
function confirmAnswer(player){
 if(game.phase!=='confirming'||game.owner!==player)return;
 if(performance.now()-game.confirmStart>=game.confirmLimit){expireConfirmation();return}
 game.phase='answering';game.answerStart=performance.now();
 game.readings=acceptedReadings(game.q);game.typed='';
 game.answerLimit=game.readings.length?Math.min(30000,12000+Math.max(...game.readings.map(x=>x.length))*650):10000;
 showMirrors('judgeInline',true);showChoiceMode(game.readings.length>0,game.owner);
 setMirrorText('judgeTitle',`PLAYER ${game.owner+1} が解答中`);
 setMirrorText('answerClock',`${(game.answerLimit/1000).toFixed(1)}`);
 setMirrorText('stateLabel',`PLAYER ${game.owner+1} 解答中`);
 if(game.readings.length)renderChoices();
 sfx('tap');renderScores();
}

function judge(correct){if(game.phase!=='answering'||game.owner===null)return;const p=game.owner;showChoiceMode(false,null);showMirrors('judgeInline',false);if(correct){game.score[p]+=10;sfx('good');revealAnswer(`PLAYER ${p+1} 正解！ +10 pt`)}else{game.score[p]-=5;game.misses.add(p);sfx('bad');game.owner=null;if(game.misses.size===config.count){revealAnswer('全員不正解');return}game.phase='reading';game.revealStart=performance.now();show('showAnswerBtn',true);setMirrorText('stateLabel',`PLAYER ${p+1} 不正解 −5 · 続行`);renderScores()}}
document.querySelectorAll('[data-judge]').forEach(b=>b.addEventListener('click',()=>judge(b.dataset.judge==='correct')));
function revealAnswer(label){game.phase='reveal';showChoiceMode(false,null);showMirrors('judgeInline',false);setMirrorText('questionText',game.q.question);setMirrorText('stateLabel',label||'正解発表');setMirrorText('answerText',game.q.answer);setMirrorText('explainText',game.q.explain||'');showMirrors('answerPanel',true);show('showAnswerBtn',false);show('nextBtn',true);progressMirrors('100%');setMirrorText('clockLabel','—');renderScores()}
$('showAnswerBtn').onclick=()=>{if(game.phase==='reading'||game.phase==='pending')revealAnswer('正解発表')};$('nextBtn').onclick=()=>nextRound();
function finishGame(){game.phase='results';showMirrors('judgeInline',false);const sorted=[...Array(config.count).keys()].sort((a,b)=>game.score[b]-game.score[a]);$('results').replaceChildren();for(let i=0;i<sorted.length;i++){const p=sorted[i],line=document.createElement('div');line.className='result-row';line.style.borderColor=COLORS[p];const left=document.createElement('span');left.textContent=`${i+1}位 · PLAYER ${p+1}`;const right=document.createElement('b');right.textContent=`${game.score[p]} pt`;line.append(left,right);$('results').append(line)}setText('resultTitle',`優勝 PLAYER ${sorted[0]+1}`);show('resultOverlay',true);setMirrorText('stateLabel','ゲーム終了');sfx('good')}
function exitGame(){showMirrors('judgeInline',false);show('resultOverlay',false);show('setupOverlay',true);game.phase='idle';game.owner=null;setupUI();renderScores()}
$('settingsBtn').onclick=()=>{if(game.phase!=='idle'&&game.phase!=='results'&&game.round>0&&!confirm('対戦を終了して設定に戻りますか？'))return;exitGame()};$('againBtn').onclick=exitGame;
function runFrame(now){if(now-game.lastFrame>=40){game.lastFrame=now;if(game.phase==='pending'&&now-game.buzzStart>=65)resolveBuzz();if(game.phase==='confirming'){const remaining=game.confirmLimit-(now-game.confirmStart);if(remaining<=0)expireConfirmation();else{const timer=document.querySelector('.buzz.await-start .confirm-timer');if(timer)timer.textContent=(remaining/1000).toFixed(1)+'秒'}}if(game.phase==='reading'){
 const t=elapsedReading(now),wanted=Math.min(game.q.question.length,Math.floor(t/93));if(wanted!==game.shown){game.shown=wanted;setMirrorText('questionText',game.q.question.slice(0,wanted))}
 progressMirrors(`${Math.floor(100*wanted/Math.max(1,game.q.question.length))}%`);
 if(wanted>=game.q.question.length){if(!game.lockedAfterFull)game.lockedAfterFull=now;if(now-game.lockedAfterFull>=10000)revealAnswer('時間切れ · 正解発表')}
 else game.lockedAfterFull=0;setMirrorText('clockLabel',`${(t/1000).toFixed(1)}s`)
 }else if(game.phase==='answering'){
 const left=Math.max(0,game.answerLimit-(now-game.answerStart));setMirrorText('answerClock',(left/1000).toFixed(1));if(!left)judge(false)
 }}frameId=requestAnimationFrame(runFrame)}
window.addEventListener('keydown',e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;const p=Number(e.key)-1;if(p>=0&&p<config.count){if(game.phase==='reading'||game.phase==='pending'){e.preventDefault();buzz(p,e.timeStamp)}else if(game.phase==='confirming'&&game.owner===p){e.preventDefault();confirmAnswer(p)}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(game.phase==='reading')game.revealElapsed=elapsedReading(performance.now());game.wasVisibleAt=performance.now()}else if(game.wasVisibleAt){const pause=performance.now()-game.wasVisibleAt;if(game.phase==='reading')game.revealStart=performance.now();if(game.phase==='answering')game.answerStart+=pause;if(game.phase==='confirming')game.confirmStart+=pause;if(game.phase==='pending')game.buzzStart+=pause;game.wasVisibleAt=0}});
restorePrefs();setupUI();renderPlayers();renderScores();frameId=requestAnimationFrame(runFrame);
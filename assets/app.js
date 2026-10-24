'use strict';
// QuizPulse single-device mode. No Scratch VM, cloud variables, or external services.
const CATEGORIES=['歴史','地理','科学・自然','数学・IT','言語・文学','芸術・音楽','アニメ・ゲーム・映画','スポーツ','生活・雑学／実用'];
const COLORS=['#ff667b','#4d9bff','#42deb7','#ffc15d'];
const DISPLAY_CAT=['歴史','地理','科学・自然','数学・IT','言語・文学','芸術・音楽','アニメ・ゲーム・映画','スポーツ','生活・雑学／実用'];
const QUESTION_INTRO_MS=1100; // Show 問題 before the first character.
const LETTER_LIMIT_MS=5000; // Each correctly entered character refreshes this deadline.
const NEXT_BUZZ_MS=3000; // 3 seconds after full reading or an incorrect answer.
const ANSWER_REVEAL_MS=3000; // Automatically advance three seconds after answer reveal.
const CHAR_REVEAL_MS=93;
const $=id=>document.getElementById(id);
const allCats=new Set(CATEGORIES.map((_,i)=>i));
const config={count:4,difficulty:'B',rounds:20,categories:allCats,sound:true};
const game={phase:'idle',pool:[],round:0,score:[0,0,0,0],misses:new Set(),q:null,revealStart:0,revealElapsed:0,shown:-1,buzzes:[],buzzStart:0,owner:null,answerStart:0,lockedAfterFull:0,wasVisibleAt:0,lastFrame:0,readings:[],typed:'',prefixes:[''],answerLimit:10000,introStart:0,rebuzzDeadline:0,revealAt:0};
let toastHandle=null,audio=null,frameId=null;
function setText(id,text){const e=$(id);if(e&&e.textContent!==String(text))e.textContent=String(text)}
function setMirrorText(id,text){setText(id,text);setText(id+'Top',text)}
function showMirrors(id,visible){show(id,visible);show(id+'Top',visible)}
function showQuestionCue(on){
 for(const suffix of ['', 'Top']){
  const element=$('questionText'+suffix);
  element.classList.toggle('question-cue',on);
  element.parentElement.classList.toggle('question-cue-frame',on);
 }
}
function progressMirrors(width){$('progressBar').style.width=width;$('progressBarTop').style.width=width}
function show(id,visible){$(id).classList.toggle('hidden',!visible)}
function toast(msg){setText('toast',msg);show('toast',true);clearTimeout(toastHandle);toastHandle=setTimeout(()=>show('toast',false),2400)}
function sfx(type){if(!config.sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const x=audio.createOscillator(),v=audio.createGain(),n=audio.currentTime;x.type=type==='bad'?'sawtooth':'sine';x.frequency.setValueAtTime(type==='buzz'?620:type==='good'?740:type==='bad'?180:480,n);if(type==='good')x.frequency.exponentialRampToValueAtTime(1100,n+.13);v.gain.setValueAtTime(.07,n);v.gain.exponentialRampToValueAtTime(.001,n+.17);x.connect(v).connect(audio.destination);x.start(n);x.stop(n+.18)}catch{}}
function setupUI(){
 document.querySelectorAll('[data-count]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.count)===config.count);b.onclick=()=>{config.count=Number(b.dataset.count);setupUI()}});
 document.querySelectorAll('[data-difficulty]').forEach(b=>{b.classList.toggle('active',b.dataset.difficulty===config.difficulty);b.onclick=()=>{config.difficulty=b.dataset.difficulty;setupUI()}});
 document.querySelectorAll('[data-rounds]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.rounds)===config.rounds);b.onclick=()=>{config.rounds=Number(b.dataset.rounds);setupUI()}});
 const genres=$('genreChoices');genres.replaceChildren();CATEGORIES.forEach((c,i)=>{const l=document.createElement('label'),inp=document.createElement('input');inp.type='checkbox';inp.checked=config.categories.has(i);inp.onchange=()=>{inp.checked?config.categories.add(i):config.categories.delete(i);setText('genreCount',`${config.categories.size}/9`);$('startBtn').disabled=!config.categories.size};const span=document.createElement('span');span.textContent=c;l.append(inp,span);genres.append(l)});
 setText('genreCount',`${config.categories.size}/9`);$('startBtn').disabled=!config.categories.size;
}
$('allGenres').onclick=()=>{config.categories=new Set(CATEGORIES.map((_,i)=>i));setupUI()};
$('noGenres').onclick=()=>{config.categories=new Set();setupUI()};
$('soundBtn').onclick=()=>{config.sound=!config.sound;setText('soundBtn',config.sound?'♪':'♩')};
$('fullBtn').onclick=async()=>{
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else {await document.documentElement.requestFullscreen();requestPortraitOnTouch()}
 }catch{toast('この端末では全画面にできません')}
};
function renderPlayers(){const top=$('playersTop'),bottom=$('players');top.replaceChildren();bottom.replaceChildren();const topCount=config.count>=3?2:1;top.classList.toggle('single',topCount===1);bottom.classList.toggle('single',config.count-topCount===1);for(let p=0;p<config.count;p++){
 const b=document.createElement('button');b.type='button';b.className='buzz';b.style.setProperty('--player-color',COLORS[p]);b.dataset.player=p;
 b.innerHTML=`<span class="player-head"><span class="player-dot"></span> PLAYER ${p+1}</span><span class="player-main">0<small>pt</small></span><span class="player-foot">押して早押し · ${p+1}キー</span>`;
 b.addEventListener('pointerdown',e=>{e.preventDefault();buzz(p,e.timeStamp)});(p<topCount?top:bottom).appendChild(b)
 }}
function renderScores(){document.querySelectorAll('.buzz').forEach(b=>{
 const p=Number(b.dataset.player);
 b.querySelector('.player-main').innerHTML=`${game.score[p]}<small>pt</small>`;
 b.classList.toggle('lockout',game.misses.has(p));
 b.classList.toggle('winner',game.owner===p&&game.phase==='answering');
 b.disabled=!(game.phase==='reading'||game.phase==='pending')||game.misses.has(p);
 b.setAttribute('aria-label',`PLAYER ${p+1} 早押し`);
 b.querySelector('.player-foot').textContent=game.misses.has(p)?'この問題は回答済み':
  (game.phase==='reading'||game.phase==='pending')?'タップして早押し · '+(p+1)+'キー':'次の問題で押せます';
})}

async function loadBank(d){
 const ids=[1,2,3];
 const packs=await Promise.all(ids.map(async n=>{
  const [questionsResponse,answersResponse]=await Promise.all([
   fetch(`./data/${d}${n}.json`,{cache:'force-cache'}),
   fetch(`./data/answers_${d}${n}.json`,{cache:'force-cache'})
  ]);
  if(!questionsResponse.ok||!answersResponse.ok)throw Error(`問題または解答の読み込み失敗: ${d}${n}`);
  const [questions,answers]=await Promise.all([questionsResponse.json(),answersResponse.json()]);
  if(!Array.isArray(questions)||questions.length!==1000||!Array.isArray(answers)||answers.length!==1000)throw Error(`問題・解答データ数が不正: ${d}${n}`);
  const offset=(n-1)*1000;
  return questions.map((e,i)=>{
   const numericId=offset+i+1,registered=answers[i];
   if(e[0]!==numericId||!Array.isArray(registered)||registered[0]!==numericId||!Array.isArray(registered[1])||!registered[1].length)throw Error(`問題と入力用読みが不一致: ${d}${numericId}`);
   const readings=[...new Set(registered[1].map(x=>String(x).normalize('NFKC').trim()))];
   if(readings.some(x=>!x||/[一-龥々]/u.test(x)))throw Error(`解答文字列に未変換の漢字: ${d}${numericId}`);
   return {id:d+String(numericId).padStart(4,'0'),cat:e[1],question:e[2],answer:e[3],explain:e[4],alt:e[5],readings};
  });
 }));
 return packs.flat();
}
function acceptedReadings(q){return q?.readings||[]}
const HIRAGANA_POOL=Array.from('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉゃゅょっゔー');
const DIGITS=Array.from('0123456789'), LATIN=Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), GREEK=Array.from('αβγδεζηθικλμνξοπρστυφχψωπ');
const MATH_SYMBOLS=Array.from('+-×÷=√π∞%°℃−―/():.、。・');
// Similar-looking full-size / small kana must never appear together in one 4-choice set.
// Multiple registered spellings may still be valid: merge their underlying matching paths.
const KANA_CONFUSABLE=Object.freeze({'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','ゃ':'や','ゅ':'ゆ','ょ':'よ','っ':'つ','ゎ':'わ'});
function choiceFamily(ch){return KANA_CONFUSABLE[ch]||ch}
function nextValidLetters(){
 const valid=new Set();
 for(const prefix of game.prefixes){
  const index=Array.from(prefix).length;
  for(const reading of game.readings){
   if(reading.startsWith(prefix)){
    const following=Array.from(reading)[index];
    if(following!==undefined)valid.add(following);
   }
  }
 }
 return [...valid];
}
function distractorPool(ch){
 if(DIGITS.includes(ch))return DIGITS;
 if(LATIN.includes(ch))return LATIN;
 if(GREEK.includes(ch))return GREEK;
 if(MATH_SYMBOLS.includes(ch))return MATH_SYMBOLS;
 return HIRAGANA_POOL;
}
function fourOptions(nexts){
 // One visible option per look-alike family, including accepted alternative spellings.
 const canonical=new Map();
 for(const letter of nexts){
  const family=choiceFamily(letter);
  if(!canonical.has(family)||letter===family)canonical.set(family,letter);
 }
 const options=[...canonical.values()];
 if(options.length>4)throw Error('分岐文字が4択を超えています');
 const pools=shuffle(options.map(distractorPool)),fallback=HIRAGANA_POOL;
 function appendFrom(pool){
  const candidates=shuffle(pool.filter(c=>!options.some(x=>choiceFamily(x)===choiceFamily(c))));
  if(candidates.length)options.push(candidates[0]);
 }
 for(const pool of pools)if(options.length<4)appendFrom(pool);
 while(options.length<4){
  const before=options.length;
  appendFrom(fallback);
  if(options.length===before)throw Error('4択の生成に失敗しました');
 }
 return shuffle(options);
}
function sideOfPlayer(player){
 const topCount=config.count>=3?2:1;
 const onTop=player<topCount;
 const sideCount=onTop?topCount:config.count-topCount;
 const localIndex=onTop?player:player-topCount;
 return {suffix:onTop?'Top':'',placement:sideCount===1?'center':localIndex===0?'left':'right'};
}
function showChoiceMode(enabled,owner){
 const activeSide=owner===null?null:sideOfPlayer(owner);
 for(const side of ['Top','']){
  const panel=$('judgeInline'+side);
  panel.classList.remove('answer-position-left','answer-position-right','answer-position-center');
  const active=enabled&&activeSide?.suffix===side;
  if(active)panel.classList.add('answer-position-'+activeSide.placement);
  show('choiceEntry'+side,active);
  show('manualActions'+side,false);
 }
}

function renderChoices(){
 const side=sideOfPlayer(game.owner).suffix;
 const target=$('choiceButtons'+side);
 setText('typedAnswer'+side,game.typed||'1文字ずつ選択');
 const nexts=nextValidLetters();
 if(!nexts.length){judge(false);return}
 const choices=fourOptions(nexts);
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
 if(performance.now()-game.answerStart>=game.answerLimit){judge(false);return}
 const nextPrefixes=new Set();
 const desired=choiceFamily(ch);
 for(const prefix of game.prefixes){
  const index=Array.from(prefix).length;
  for(const reading of game.readings){
   if(!reading.startsWith(prefix))continue;
   const nextLetter=Array.from(reading)[index];
   if(nextLetter!==undefined&&choiceFamily(nextLetter)===desired)nextPrefixes.add(prefix+nextLetter);
  }
 }
 if(!nextPrefixes.size){judge(false);return}
 game.prefixes=[...nextPrefixes];
 game.typed+=ch;sfx('tap');
 if(game.prefixes.some(prefix=>game.readings.includes(prefix))){judge(true);return}
 game.answerStart=performance.now();
 setMirrorText('answerClock',(game.answerLimit/1000).toFixed(1));
 renderChoices();
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const n=Math.floor(Math.random()*(i+1));[a[i],a[n]]=[a[n],a[i]]}return a}
$('startBtn').onclick=async()=>{requestPortraitOnTouch();if(!config.categories.size){toast('ジャンルを一つ以上選択してください');return}const btn=$('startBtn');btn.disabled=true;btn.textContent='問題を読み込み中…';try{
 let bank=await loadBank(config.difficulty);bank=bank.filter(q=>config.categories.has(q.cat));if(bank.some(q=>!acceptedReadings(q).length))throw Error('入力用読みのない問題が検出されました');if(bank.length<config.rounds){throw Error('選択した問題が不足しています')}
 game.pool=shuffle(bank).slice(0,config.rounds);game.round=0;game.score=[0,0,0,0];game.phase='ready';savePrefs();renderPlayers();show('setupOverlay',false);nextRound()
 }catch(err){toast(err.message||'データ読み込みに失敗しました');setText('loadNotice',String(err.message||err))}finally{btn.disabled=false;btn.innerHTML='ゲーム開始 <span>→</span>'}};
function savePrefs(){try{localStorage.setItem('sideworks:quizpulse:settings',JSON.stringify({count:config.count,difficulty:config.difficulty,rounds:config.rounds,categories:[...config.categories],sound:config.sound,answerMode:'four-choice-all'}))}catch{}}
function restorePrefs(){try{const x=JSON.parse(localStorage.getItem('sideworks:quizpulse:settings'));if(!x)return;if([2,3,4].includes(x.count))config.count=x.count;if('ABC'.includes(x.difficulty))config.difficulty=x.difficulty;if([10,20,30].includes(x.rounds))config.rounds=x.rounds;if(Array.isArray(x.categories)&&x.categories.every(n=>Number.isInteger(n)&&n>=0&&n<9))config.categories=new Set(x.categories);config.sound=x.sound!==false;/* All 9000 questions use registered four-choice inputs. */}catch{}}
function nextRound(){showChoiceMode(false,null);showMirrors('judgeInline',false);showMirrors('answerPanel',false);show('nextBtn',false);show('showAnswerBtn',false);game.misses.clear();game.owner=null;game.buzzes=[];game.readings=[];game.typed='';game.prefixes=[''];game.rebuzzDeadline=0;game.revealAt=0;
 if(game.round>=game.pool.length){finishGame();return}
 game.q=game.pool[game.round++];game.phase='intro';game.introStart=performance.now();game.revealElapsed=0;game.shown=-1;game.revealStart=0;game.lockedAfterFull=0;
 setMirrorText('questionText','問題');showQuestionCue(true);setMirrorText('roundLabel',`ROUND ${String(game.round).padStart(2,'0')} / ${String(game.pool.length).padStart(2,'0')}`);setMirrorText('difficultyLabel',`${config.difficulty} · ${DISPLAY_CAT[game.q.cat]}`);setMirrorText('stateLabel','まもなく出題');setMirrorText('clockLabel','—');progressMirrors('0%');renderScores()}
function elapsedReading(t){return game.revealElapsed+Math.max(0,t-game.revealStart)}
function timeStamp(t){const now=performance.now();return Number.isFinite(t)&&t>=0&&Math.abs(t-now)<8000?t:now}
function buzzDeadline(){
 if(game.rebuzzDeadline)return game.rebuzzDeadline;
 // Measure the 3 seconds from the actual time the last character is due to appear,
 // rather than from the next potentially delayed animation frame.
 return game.revealStart+Math.max(0,game.q.question.length*CHAR_REVEAL_MS-game.revealElapsed)+NEXT_BUZZ_MS;
}
function closeBuzzWindow(){
 if(game.phase!=='reading')return;
 revealAnswer(game.rebuzzDeadline?'誤答後3秒・受付終了':'問読み終了後3秒・受付終了');
}
function buzz(player,eventStamp){
 if((game.phase!=='reading'&&game.phase!=='pending')||game.misses.has(player))return;
 const t=timeStamp(eventStamp);
 if(t>=buzzDeadline()){
  if(game.phase==='reading')closeBuzzWindow();
  return;
 }
 if(game.phase==='reading'){
  game.revealElapsed=elapsedReading(t);
  game.phase='pending';game.buzzStart=performance.now();game.buzzes=[];
  setMirrorText('stateLabel','早押し判定中…');
 }
 if(!game.buzzes.some(x=>x.player===player))game.buzzes.push({player,t});
 sfx('buzz');
}
function resolveBuzz(){
 const b=game.buzzes.sort((a,b)=>a.t-b.t);game.buzzes=[];
 if(!b.length){game.phase='reading';game.revealStart=performance.now();return}
 if(b.length>=2&&b[1].t-b[0].t<=6){
  game.phase='reading';game.revealStart=performance.now();
  setMirrorText('stateLabel','同時押し・押し直してください');
  toast('6ms以内の同時押し：もう一度押してください');return;
 }
 beginAnswer(b[0].player);
}
function beginAnswer(player){
 game.owner=player;
 game.phase='answering';
 game.answerStart=performance.now();
 game.readings=acceptedReadings(game.q);game.typed='';game.prefixes=[''];
 game.answerLimit=LETTER_LIMIT_MS;
 show('showAnswerBtn',false);
 // The other pair keeps the paused question visible; input exists only by the winner.
 const winningSide=sideOfPlayer(player).suffix;
 show('judgeInline',winningSide==='');
 show('judgeInlineTop',winningSide==='Top');
 showChoiceMode(true,player);
 setMirrorText('judgeTitle',`PLAYER ${player+1} が解答中`);
 setMirrorText('answerClock',(LETTER_LIMIT_MS/1000).toFixed(1));
 setMirrorText('stateLabel',`PLAYER ${player+1} 解答中`);
 renderChoices();
 renderScores();
}

function judge(correct){if(game.phase!=='answering'||game.owner===null)return;const p=game.owner;showChoiceMode(false,null);showMirrors('judgeInline',false);if(correct){game.score[p]+=10;sfx('good');revealAnswer(`PLAYER ${p+1} 正解！ +10 pt`)}else{game.score[p]-=5;game.misses.add(p);sfx('bad');game.owner=null;if(game.misses.size===config.count){revealAnswer('全員不正解');return}game.phase='reading';
 const now=performance.now();game.revealStart=now;game.rebuzzDeadline=now+NEXT_BUZZ_MS;
 show('showAnswerBtn',true);
 setMirrorText('stateLabel',`PLAYER ${p+1} 不正解 −5 · 残り3秒で早押し`);
 setMirrorText('clockLabel','3.0s');renderScores()}}
document.querySelectorAll('[data-judge]').forEach(b=>b.addEventListener('click',()=>judge(b.dataset.judge==='correct')));
function revealAnswer(label){
 if(game.phase==='reveal'||game.phase==='results'||game.phase==='idle')return;
 game.phase='reveal';
 game.revealAt=performance.now();
 showChoiceMode(false,null);showMirrors('judgeInline',false);
 setMirrorText('questionText',game.q.question);
 setMirrorText('stateLabel',label||'正解発表');
 setMirrorText('answerText',game.q.answer);
 setMirrorText('explainText',game.q.explain||'');
 showMirrors('answerPanel',true);
 show('showAnswerBtn',false);
 show('nextBtn',true);
 setText('nextBtn','次へ 3.0秒');
 progressMirrors('100%');
 setMirrorText('clockLabel','3.0s');
 renderScores();
}
$('showAnswerBtn').onclick=()=>{if(game.phase==='reading'||game.phase==='pending')revealAnswer('正解発表')};$('nextBtn').onclick=()=>nextRound();
function finishGame(){game.phase='results';showMirrors('judgeInline',false);const sorted=[...Array(config.count).keys()].sort((a,b)=>game.score[b]-game.score[a]);$('results').replaceChildren();for(let i=0;i<sorted.length;i++){const p=sorted[i],line=document.createElement('div');line.className='result-row';line.style.borderColor=COLORS[p];const left=document.createElement('span');left.textContent=`${i+1}位 · PLAYER ${p+1}`;const right=document.createElement('b');right.textContent=`${game.score[p]} pt`;line.append(left,right);$('results').append(line)}setText('resultTitle',`優勝 PLAYER ${sorted[0]+1}`);show('resultOverlay',true);setMirrorText('stateLabel','ゲーム終了');sfx('good')}
function exitGame(){game.revealAt=0;showMirrors('judgeInline',false);show('resultOverlay',false);show('setupOverlay',true);game.phase='idle';game.owner=null;setupUI();renderScores()}
$('settingsBtn').onclick=()=>{if(game.phase!=='idle'&&game.phase!=='results'&&game.round>0&&!confirm('対戦を終了して設定に戻りますか？'))return;exitGame()};$('againBtn').onclick=exitGame;
function runFrame(now){if(now-game.lastFrame>=40){game.lastFrame=now;
 if(game.phase==='intro'&&now-game.introStart>=QUESTION_INTRO_MS){
  game.phase='reading';game.revealStart=now;game.revealElapsed=0;game.shown=-1;
  showQuestionCue(false);setMirrorText('questionText','');
  setMirrorText('stateLabel','読み上げ中 · ボタンを押して回答');setMirrorText('clockLabel','00.0');
  show('showAnswerBtn',true);renderScores();
 }
 if(game.phase==='reveal'){
  const left=Math.max(0,ANSWER_REVEAL_MS-(now-game.revealAt));
  if(left<=0)nextRound();
  else {
   const remaining=(left/1000).toFixed(1);
   setText('nextBtn',`次へ ${remaining}秒`);
   setMirrorText('clockLabel',`${remaining}s`);
  }
 }
 if(game.phase==='pending'&&now-game.buzzStart>=65)resolveBuzz();
 if(game.phase==='reading'){
  const deadline=buzzDeadline();
  if(now>=deadline){closeBuzzWindow()}
  else{
   const t=elapsedReading(now);
   const wanted=Math.min(game.q.question.length,Math.floor(t/CHAR_REVEAL_MS));
   if(wanted!==game.shown){game.shown=wanted;setMirrorText('questionText',game.q.question.slice(0,wanted))}
   progressMirrors(`${Math.floor(100*wanted/Math.max(1,game.q.question.length))}%`);
   const full=wanted>=game.q.question.length;
   if(game.rebuzzDeadline||full){
    const remain=Math.max(0,deadline-now);
    setMirrorText('clockLabel',`${(remain/1000).toFixed(1)}s`);
    setMirrorText('stateLabel',game.rebuzzDeadline?'誤答後・早押し受付':'問読み終了・早押し受付');
   }else setMirrorText('clockLabel',`${(t/1000).toFixed(1)}s`);
  }
 }else if(game.phase==='answering'){
 const left=Math.max(0,game.answerLimit-(now-game.answerStart));setMirrorText('answerClock',(left/1000).toFixed(1));if(!left)judge(false)
 }}frameId=requestAnimationFrame(runFrame)}
window.addEventListener('keydown',e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;const p=Number(e.key)-1;if(p>=0&&p<config.count){if(game.phase==='reading'||game.phase==='pending'){e.preventDefault();buzz(p,e.timeStamp)}}});
// Deliberately do not freeze answer / buzzer deadlines when backgrounded: searching
// in another app must never extend the 3s window or 5s per-character limit.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)game.lastFrame=0});
restorePrefs();setupUI();renderPlayers();renderScores();frameId=requestAnimationFrame(runFrame);


/* PWA portrait preference: browser platforms may reject orientation.lock().
 * The manifest handles install-time orientation; a lock is only best effort. */
async function preferPortrait(){
 if(typeof screen==='undefined'||typeof screen.orientation?.lock!=='function')return false;
 try{await screen.orientation.lock('portrait');return true}
 catch{return false}
}
function requestPortraitOnTouch(){
 if(navigator.maxTouchPoints>0)void preferPortrait();
}

// PWA lifecycle, explicit installation and full 9,000-question offline readiness.
// The worker is scoped to this repository so that it cannot touch other sites.
(()=>{
 const installButton=$('installAppBtn');
 const cacheButton=$('cacheOfflineBtn');
 const statusLabel=$('pwaStatus');
 let installEvent=null;
 let registration=null;
 const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
 const appleMobile=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 function updateInstallButton(){
  const eligible=!standalone()&&(Boolean(installEvent)||appleMobile());
  show('installAppBtn',eligible);
  if(eligible)installButton.textContent=appleMobile()&&!installEvent?'ホーム画面に追加':'アプリをインストール';
 }
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installEvent=event;
  updateInstallButton();
 });
 window.addEventListener('appinstalled',()=>{requestPortraitOnTouch();
  installEvent=null;
  updateInstallButton();
  statusLabel.textContent='インストール済み · オフラインデータを準備しています';
 });
 installButton.addEventListener('click',async()=>{
  if(installEvent){
   const event=installEvent;
   installEvent=null;
   updateInstallButton();
   try{await event.prompt();await event.userChoice}catch(err){console.warn('PWA installation cancelled or unavailable',err)}
   return;
  }
  if(appleMobile()){
   window.alert('Safariでこのページを開き、共有ボタンから「ホーム画面に追加」を選択してください。');
  }
 });
 cacheButton.addEventListener('click',()=>{
  const worker=registration?.active||navigator.serviceWorker?.controller;
  if(!worker){statusLabel.textContent='オフライン準備がまだ完了していません';return}
  cacheButton.disabled=true;
  statusLabel.textContent='9,000問を保存中…';
  worker.postMessage({type:'QUIZPULSE_CACHE_ALL'});
 });
 if(!('serviceWorker' in navigator)){
  statusLabel.textContent='このブラウザではオフライン保存に対応していません';
  updateInstallButton();
  return;
 }
 navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type!=='QUIZPULSE_OFFLINE_STATUS')return;
  const {ready,cached,total}=event.data;
  statusLabel.textContent=ready?'オフラインでも9,000問プレイできます':`オフライン保存: ${cached}/${total} ファイル`;
  show('cacheOfflineBtn',!ready);
  cacheButton.disabled=false;
 });
 function requestStatus(){
  const worker=registration?.active||navigator.serviceWorker.controller;
  worker?.postMessage({type:'QUIZPULSE_CHECK_OFFLINE'});
 }
 navigator.serviceWorker.addEventListener('controllerchange',requestStatus);
 statusLabel.textContent='オフラインデータを準備しています…';
 navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(async reg=>{
  registration=reg;
  await navigator.serviceWorker.ready;
  requestStatus();
 }).catch(err=>{
  console.warn('QuizPulse PWA registration failed',err);
  statusLabel.textContent='アプリのオフライン機能は利用できません';
 });
 updateInstallButton();
 if(standalone())requestPortraitOnTouch();
 document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement)requestPortraitOnTouch();
 });
})();

'use strict';
// Deterministic VM tests of real QuizPulse game logic (no browser dependency).
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
let now=1000;
const elements=new Map();
function node(id=''){
 const classes=new Set();
 const el={id,textContent:'',innerHTML:'',disabled:false,dataset:{},children:[],handlers:{},
  style:{width:'',setProperty(){}},
  classList:{add(...names){names.forEach(x=>classes.add(x))},
   remove(...names){names.forEach(x=>classes.delete(x))},
   toggle(x,on){if(on===undefined)on=!classes.has(x);on?classes.add(x):classes.delete(x);return on},
   contains(x){return classes.has(x)}},
  replaceChildren(...items){this.children=items},
  append(...items){this.children.push(...items)},
  appendChild(item){this.children.push(item)},
  addEventListener(type,fn){this.handlers[type]=fn},
  querySelector(){return node()},
  setAttribute(){}
 };
 el.parentElement=el;
 return el;
}
const document={
 hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,node(id));return elements.get(id)},
 createElement(){return node()},querySelectorAll(){return []},addEventListener(){},
 documentElement:{requestFullscreen(){}}
};
const sandbox={console,document,
 window:{addEventListener(){},matchMedia(){return {matches:false}}},
 navigator:{userAgent:'test',platform:'Linux',maxTouchPoints:0},
 performance:{now(){return now}},
 localStorage:{getItem(){return null},setItem(){}},
 requestAnimationFrame(){return 1},setTimeout(){return 1},clearTimeout(){},confirm(){return true}
};
vm.createContext(sandbox);
new vm.Script(source,{filename:'app.js'}).runInContext(sandbox);
function run(code){return vm.runInContext(code,sandbox)}
function setNow(t){now=t}
run('config.sound=false');
run("game.q={question:'abcdef',answer:'答',explain:'説明'};game.score=[0,0,0,0];game.misses.clear();game.rebuzzDeadline=0");
run("game.phase='reading';game.revealStart=1000;game.revealElapsed=0;game.shown=-1;game.owner=null");
assert.equal(run('buzzDeadline()'),4558,'6 * 93ms reading + 3000ms buzzer window');
setNow(4557);
run('buzz(0,4557)');
assert.equal(run('game.phase'),'pending','buzz before deadline accepted');
assert.equal(run('game.buzzes[0].player'),0);
run("game.phase='reading';game.revealStart=1000;game.revealElapsed=0;game.buzzes=[];game.owner=null");
setNow(4558);
run('buzz(0,4558)');
assert.equal(run('game.phase'),'reveal','buzz at deadline rejected');

run("game.phase='answering';game.owner=0;game.misses.clear();game.score=[0,0,0,0];game.revealElapsed=300");
setNow(7000);
run('judge(false)');
assert.equal(run('game.phase'),'reading','wrong answer allows other players');
assert.equal(run('buzzDeadline()'),10000,'wrong answer starts a fresh 3s window');
assert.equal(run('game.score[0]'),-5);
setNow(9999);
run('buzz(1,9999)');
assert.equal(run('game.phase'),'pending','remaining player can press before retry deadline');
run("game.phase='reading';game.buzzes=[];game.owner=null");
setNow(10000);
run('buzz(1,10000)');
assert.equal(run('game.phase'),'reveal','wrong-answer buzzer ends at 3 seconds');

const pairs=[['い','ぃ'],['あ','ぁ'],['う','ぅ'],['や','ゃ'],['つ','っ'],['ゆ','ゅ'],['よ','ょ']];
for(const pair of pairs){
 const normal=pair[0],small=pair[1];
 for(let i=0;i<10;i++){
  const choices=Array.from(run("fourOptions(['"+normal+"','"+small+"'])"));
  const normalized=choices.map(x=>x===small?normal:x);
  assert.equal(choices.length,4);
  assert.equal(new Set(normalized).size,4,'confusable pair '+normal+'/'+small);
  assert.ok(choices.includes(normal),'canonical choice '+normal);
 }
}
run("game.phase='answering';game.owner=0;game.misses.clear();game.readings=['いぃ','ぃい'];game.prefixes=[''];game.typed='';game.answerLimit=5000;game.score=[0,0,0,0]");
setNow(11000);
run('game.answerStart=performance.now();renderChoices()');
let chars=elements.get('choiceButtonsTop').children.map(x=>x.textContent);
assert.equal(chars.length,4);
assert.equal(new Set(chars.map(x=>x==='ぃ'?'い':x)).size,4,'first 4 choices contain no paired glyphs');
run("selectChar('い')");
assert.equal(run('game.phase'),'answering');
assert.equal(run('game.prefixes.length'),2,'both aliases remain valid');
chars=elements.get('choiceButtonsTop').children.map(x=>x.textContent);
assert.equal(new Set(chars.map(x=>x==='ぃ'?'い':x)).size,4,'second character does not show pair');
setNow(11010);
run("selectChar('い')");
assert.equal(run('game.phase'),'reveal','confusable branches remain answerable');
assert.equal(run('game.score[0]'),10);

run("game.phase='answering';game.owner=0;game.misses.clear();game.rebuzzDeadline=0;game.readings=['いぃ'];game.prefixes=[''];game.typed='';game.answerLimit=5000;game.score=[0,0,0,0]");
setNow(15000);
run('game.answerStart=performance.now()');
setNow(20000);
run("selectChar('い')");
assert.equal(run('game.score[0]'),-5,'late tap is not accepted');
assert.equal(run('game.rebuzzDeadline'),23000,'per-letter timeout starts new 3s retry');
assert.ok(!source.includes('confirmAnswer('),'removed answer-start confirmation must remain removed');
assert.ok(source.includes('QUESTION_INTRO_MS=1100'),'question cue preserved');
assert.ok(source.includes('answers_'+String.fromCharCode(36)+'{d}'+String.fromCharCode(36)+'{n}.json'),'all 9000 question reading bundles preserved');
console.log('QuizPulse timing and unambiguous choices: PASS');

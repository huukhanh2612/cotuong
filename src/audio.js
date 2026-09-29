// Âm thanh game: nhạc nền tự sinh bằng WebAudio (không cần file mp3) + hiệu ứng âm thanh.
// - 3 bản nhạc: Sơn Thủy (đàn tranh), Thiền Trà (sáo trúc), Kỳ Đài (chiến trận). Chế độ "Tự động":
//   ở sảnh dùng Sơn Thủy, khi đang đấu cờ dùng Kỳ Đài.
// - Cài đặt lưu trong localStorage. Trình duyệt chỉ cho phát tiếng sau lần chạm/bấm đầu tiên nên nhạc sẽ bắt đầu ngay lúc đó.
import {useSyncExternalStore} from 'react';

const KEY='cotuong.audio.v1';
const DEFAULTS={musicOn:true,track:'auto',musicVol:0.5,sfxOn:true,sfxVol:0.7};
export const TRACK_LIST=[['auto','Tự động','Sảnh: Sơn Thủy • Trong trận: Kỳ Đài'],['sanh','Sơn Thủy','Đàn tranh nhẹ nhàng'],['thien','Thiền Trà','Sáo trúc, chuông gió, rất thư thái'],['tran','Kỳ Đài','Trống trận, nhịp dồn dập']];

const load=()=>{try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(e){return {...DEFAULTS};}};
let S=load();
const listeners=new Set();
const emit=()=>{S={...S};listeners.forEach(f=>f());};
export const getAudio=()=>S;
export const useAudio=()=>useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb);},getAudio,getAudio);
export function setAudio(patch){
  S={...S,...patch};
  try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}
  applyVolumes();refresh();listeners.forEach(f=>f());
}

// ---------- Khởi tạo AudioContext ----------
let ctx=null,master=null,musicBus=null,sfxBus=null,noiseBuf=null;
let scene='menu',cur=null;

function impulse(c,secs=2.6,decay=2.4){
  const n=Math.floor(c.sampleRate*secs),b=c.createBuffer(2,n,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay);}
  return b;
}
function ensure(){
  if(ctx)return ctx;
  const A=window.AudioContext||window.webkitAudioContext;
  if(!A)return null;
  ctx=new A();
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;
  master=ctx.createGain();master.gain.value=0.9;master.connect(comp);comp.connect(ctx.destination);
  musicBus=ctx.createGain();sfxBus=ctx.createGain();
  const dry=ctx.createGain();dry.gain.value=0.8;musicBus.connect(dry);dry.connect(master);
  const verb=ctx.createConvolver();verb.buffer=impulse(ctx);const wet=ctx.createGain();wet.gain.value=0.38;
  musicBus.connect(verb);verb.connect(wet);wet.connect(master);
  sfxBus.connect(master);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const nd=noiseBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  applyVolumes();
  return ctx;
}
function applyVolumes(){
  if(!ctx)return;
  musicBus.gain.setTargetAtTime(S.musicVol*0.9,ctx.currentTime,0.05);
  sfxBus.gain.setTargetAtTime(S.sfxOn?S.sfxVol:0,ctx.currentTime,0.05);
}

// ---------- Nhạc cụ ----------
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const D4=293.66;
const semi=(base,s)=>base*Math.pow(2,s/12);
const PM=[0,2,4,7,9];      // ngũ cung trưởng (Cung, Thương, Giác, Chủy, Vũ)
const Pm=[0,3,5,7,10];     // ngũ cung thứ, u tối hơn, hợp nhạc trận
const deg=(scale,base,d)=>semi(base,scale[((d%5)+5)%5]+12*Math.floor(d/5));

function env(g,t,attack,peak,hold,release){
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(peak,t+attack);
  g.gain.setValueAtTime(peak,t+attack+hold);
  g.gain.exponentialRampToValueAtTime(0.0001,t+attack+hold+release);
}
function pluck(out,t,f,vel=1){ // đàn tranh: tiếng gảy tắt nhanh
  const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),mix=ctx.createGain(),lp=ctx.createBiquadFilter();
  o.type='triangle';o.frequency.setValueAtTime(f*1.012,t);o.frequency.exponentialRampToValueAtTime(f,t+0.05);
  o2.type='sine';o2.frequency.value=f*2.005;mix.gain.value=0.22;
  lp.type='lowpass';lp.frequency.value=3400;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.26*vel,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+1.5);
  o.connect(g);o2.connect(mix);mix.connect(g);g.connect(lp);lp.connect(out);
  o.start(t);o2.start(t);o.stop(t+1.6);o2.stop(t+1.6);
}
function flute(out,t,f,dur,vel=1){ // sáo trúc: vào nhẹ, rung nhẹ
  const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),m2=ctx.createGain();
  const lfo=ctx.createOscillator(),lg=ctx.createGain();
  o.type='sine';o.frequency.value=f;o2.type='sine';o2.frequency.value=f*2;m2.gain.value=0.12;
  lfo.frequency.value=5.2;lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*0.006,t+Math.min(0.5,dur*0.5));
  lfo.connect(lg);lg.connect(o.frequency);
  env(g,t,0.2,0.16*vel,Math.max(0.05,dur-0.6),0.45);
  o.connect(g);o2.connect(m2);m2.connect(g);g.connect(out);
  const end=t+dur+0.8;o.start(t);o2.start(t);lfo.start(t);o.stop(end);o2.stop(end);lfo.stop(end);
  // hơi thở
  const n=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),ng=ctx.createGain();
  n.buffer=noiseBuf;n.loop=true;bp.type='bandpass';bp.frequency.value=f*2;bp.Q.value=2;
  env(ng,t,0.15,0.012*vel,Math.max(0.05,dur-0.5),0.4);
  n.connect(bp);bp.connect(ng);ng.connect(out);n.start(t);n.stop(end);
}
function pad(out,t,f,dur){ // nền kéo dài
  const g=ctx.createGain(),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=650;
  for(const d of[-6,6]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=d;o.connect(lp);o.start(t);o.stop(t+dur+2);}
  env(g,t,Math.min(1.6,dur*0.4),0.045,Math.max(0.1,dur-2.2),1.8);
  lp.connect(g);g.connect(out);
}
function bell(out,t,f,vel=1){ // chuông gió
  for(const [m,a] of[[1,1],[2.76,0.35],[5.4,0.15]]){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f*m;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.11*a*vel,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+3.2/m**0.4);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+3.4);
  }
}
function drum(out,t,vel=1){ // trống trận
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(42,t+0.28);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.7*vel,t+0.006);g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
  o.connect(g);g.connect(out);o.start(t);o.stop(t+0.65);
  const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),ng=ctx.createGain();
  n.buffer=noiseBuf;f.type='lowpass';f.frequency.value=500;
  ng.gain.setValueAtTime(0.25*vel,t);ng.gain.exponentialRampToValueAtTime(0.0001,t+0.09);
  n.connect(f);f.connect(ng);ng.connect(out);n.start(t);n.stop(t+0.1);
}
function wood(out,t,vel=1){ // mõ gỗ
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='triangle';o.frequency.setValueAtTime(950,t);o.frequency.exponentialRampToValueAtTime(620,t+0.05);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.16*vel,t+0.003);g.gain.exponentialRampToValueAtTime(0.0001,t+0.09);
  o.connect(g);g.connect(out);o.start(t);o.stop(t+0.1);
}

// ---------- Ba bản nhạc ----------
// Mỗi bản: bpm, gain, make() -> {bar(out,t,n,barDur)} ; một "bar" = 4 phách.
const TRACKS={
  sanh:{bpm:84,gain:1,make(){
    const r=rng(7);let d=5;const roots=[0,2,1,3];
    return {bar(out,t,n,bd){
      const e=bd/8,root=roots[n%4];
      pluck(out,t,deg(PM,D4/2,root),0.9);pluck(out,t+e*4,deg(PM,D4/2,root+3),0.55);
      if(n%4===0){pad(out,t,D4/2,bd*4);pad(out,t,D4*0.75,bd*4);}
      const run=n%4===3;
      for(let s=0;s<8;s++){
        if(run&&s>=5)break;
        if(s===0||r()<0.72){
          const st=[-2,-1,-1,0,1,1,2][Math.floor(r()*7)];
          d+=st;if(d>10)d-=2;if(d<2)d+=2;
          pluck(out,t+s*e,deg(PM,D4,d),0.45+0.4*r());
        }
      }
      if(run){for(let i=0;i<6;i++)pluck(out,t+e*5+i*e/2,deg(PM,D4,d+i),0.35+i*0.06);d+=5;if(d>10)d=4;}
    }};
  }},
  thien:{bpm:54,gain:1,make(){
    const r=rng(21);let d=5;
    return {bar(out,t,n,bd){
      const b=bd/4;
      d+=[-2,-1,0,1,2][Math.floor(r()*5)];if(d>8)d=6;if(d<3)d=4;
      flute(out,t+0.1,deg(PM,D4,d),bd*0.85,0.85);
      if(n%2===0){pad(out,t,D4/2,bd*2);pad(out,t,D4*0.75,bd*2);}
      if(r()<0.55)bell(out,t+b*2,deg(PM,D4*2,Math.floor(r()*5)),0.8);
      if(r()<0.35)pluck(out,t+b,deg(PM,D4,d-5),0.5);
    }};
  }},
  tran:{bpm:100,gain:0.85,make(){
    const r=rng(99);
    const motifs=[[0,null,2,null,0,null,3,2],[0,2,null,3,4,null,3,2],[0,null,0,2,null,3,null,2]];
    return {bar(out,t,n,bd){
      const b=bd/4,e=bd/8;
      drum(out,t,1);drum(out,t+b*2,0.75);if(n%2===1)drum(out,t+b*3.5,0.35);
      wood(out,t+b,0.6);wood(out,t+b*3,0.6);
      if(n%2===0){pad(out,t,D4/4,bd*2);pad(out,t,D4*0.375,bd*2);}
      const m=motifs[Math.floor(r()*motifs.length)],run=n%4===3;
      m.forEach((x,s)=>{if(x==null)return;if(run&&s>=5)return;pluck(out,t+s*e,deg(Pm,D4/2,x),0.5+0.3*r());});
      if(run){for(let i=0;i<6;i++)pluck(out,t+e*5+i*e/2,deg(Pm,D4/2,i),0.4+i*0.07);}
      if(n%8===6){flute(out,t,deg(Pm,D4,4),b*2,0.9);flute(out,t+b*2,deg(Pm,D4,3),b*2,0.9);}
    }};
  }}
};

function startTrack(name){
  const def=TRACKS[name];if(!def||!ctx)return;
  const out=ctx.createGain();out.gain.setValueAtTime(0.0001,ctx.currentTime);
  out.gain.linearRampToValueAtTime(def.gain,ctx.currentTime+1.4);out.connect(musicBus);
  const inst=def.make(),bd=240/def.bpm;let next=ctx.currentTime+0.2,n=0;
  const tick=()=>{try{while(next<ctx.currentTime+1.6){inst.bar(out,next,n++,bd);next+=bd;}}catch(e){}};
  tick();cur={name,out,iv:setInterval(tick,250)};
}
function stopTrack(){
  if(!cur||!ctx)return;
  const c=cur;cur=null;clearInterval(c.iv);
  c.out.gain.cancelScheduledValues(ctx.currentTime);c.out.gain.setTargetAtTime(0,ctx.currentTime,0.25);
  setTimeout(()=>{try{c.out.disconnect();}catch(e){}},1600);
}
function wanted(){return S.track==='auto'?(scene==='game'?'tran':'sanh'):S.track;}
function refresh(){
  if(!ctx||ctx.state!=='running'||document.hidden){return;}
  if(!S.musicOn){stopTrack();return;}
  const w=wanted();
  if(cur&&cur.name===w)return;
  stopTrack();startTrack(w);
}
export function setScene(s){scene=s;refresh();}

// ---------- Mở khóa âm thanh sau cử chỉ đầu tiên của người dùng ----------
function unlock(){
  const c=ensure();if(!c)return;
  const go=()=>{refresh();if(ctx.state==='running')off();};
  if(c.state!=='running'){c.resume().then(go).catch(()=>{});}else go();
}
const evs=['pointerdown','touchend','keydown','click'];
const off=()=>evs.forEach(e=>window.removeEventListener(e,unlock,true));
if(typeof window!=='undefined'){
  evs.forEach(e=>window.addEventListener(e,unlock,true));
  document.addEventListener('visibilitychange',()=>{
    if(!ctx)return;
    if(document.hidden){stopTrack();ctx.suspend().catch(()=>{});}
    else ctx.resume().then(refresh).catch(()=>{});
  });
}

// ---------- Hiệu ứng âm thanh ----------
function tone(type,f0,f1,dur,vol,delay=0){
  const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dur*0.7);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+dur+0.02);
}
function click(vol,delay=0){
  const t=ctx.currentTime+delay,n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  n.buffer=noiseBuf;f.type='bandpass';f.frequency.value=1800;f.Q.value=0.9;
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.03);
  n.connect(f);f.connect(g);g.connect(sfxBus);n.start(t);n.stop(t+0.04);
}
const ok=()=>S.sfxOn&&ensure()&&ctx.state==='running';
const arp=(freqs,gap,fn)=>freqs.forEach((f,i)=>fn(f,i*gap));
export const sfx={
  move(){if(!ok())return;tone('triangle',190,70,0.13,0.45);click(0.25);},
  capture(){if(!ok())return;tone('triangle',150,55,0.18,0.6);click(0.4);tone('triangle',230,90,0.12,0.4,0.07);click(0.3,0.07);},
  select(){if(!ok())return;tone('sine',1250,1250,0.05,0.12);},
  check(){if(!ok())return;tone('sine',740,740,0.35,0.22);tone('sine',988,988,0.5,0.2,0.13);tone('triangle',1480,1480,0.3,0.06,0.13);},
  click(){if(!ok())return;tone('sine',900,700,0.04,0.07);},
  win(){if(!ok())return;arp([587.33,739.99,880,1174.66],0.14,(f,d)=>{tone('triangle',f,f,0.9,0.22,d);tone('sine',f*2.01,f*2.01,0.6,0.05,d);});tone('sine',293.66,293.66,1.6,0.16,0.5);},
  lose(){if(!ok())return;arp([440,349.23,293.66],0.22,(f,d)=>tone('triangle',f,f*0.99,1.1,0.2,d));tone('sine',146.83,146.83,1.8,0.16,0.4);},
  draw(){if(!ok())return;tone('sine',523.25,523.25,1.1,0.16);tone('sine',659.25,659.25,1.1,0.14,0.18);}
};

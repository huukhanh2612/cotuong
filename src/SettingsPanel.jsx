import React from 'react';
import {X,Smartphone,Tablet,Monitor,MonitorSmartphone,Music,Volume2,VolumeX,Check} from 'lucide-react';
import {DEVICES,SCALES,deviceName} from './prefs.js';
import {useAudio,setAudio,TRACK_LIST,sfx} from './audio.js';

const ICON={auto:<MonitorSmartphone/>,phone:<Smartphone/>,tablet:<Tablet/>,desktop:<Monitor/>};

function DeviceGrid({value,onPick,suggested}){
  return <div className="devgrid">{DEVICES.map(([id,name,desc])=>
    <button key={id} className={'devcard '+(value===id?'on':'')} onClick={()=>onPick(id)}>
      <span className="devicon">{ICON[id]}</span><b>{name}</b>
      <small>{id==='auto'?`Đang nhận: ${deviceName(suggested)}`:desc}</small>
      {value===id&&<Check className="devcheck" size={16}/>}
    </button>)}</div>;
}

// Hộp chọn thiết bị hiện ở lần đầu vào trang
export function DevicePicker({ui}){
  const {prefs,set,suggested}=ui;
  if(prefs.picked)return null;
  return <div className="modalback"><div className="modalcard">
    <span className="eyebrow">CHÀO MỪNG KỲ THỦ</span>
    <h2 className="modaltitle">Bạn đang chơi bằng thiết bị nào?</h2>
    <p className="muted">Chọn để giao diện vừa với thiết bị của bạn. Có thể đổi lại bất cứ lúc nào ở biểu tượng bánh răng trên thanh trên cùng.</p>
    <p className="muted">Gợi ý cho bạn: <b>{deviceName(suggested)}</b></p>
    <DeviceGrid value={null} suggested={suggested} onPick={id=>set({device:id,picked:true})}/>
    <button className="primary wide" onClick={()=>set({device:'auto',picked:true})}>Dùng chế độ tự động</button>
  </div></div>;
}

const Seg=({value,options,onPick})=><div className="seg">{options.map(([id,label])=><button key={id} className={value===id?'on':''} onClick={()=>onPick(id)}>{label}</button>)}</div>;

export default function SettingsPanel({ui,onClose}){
  const {prefs,set,suggested}=ui;
  const a=useAudio();
  return <div className="modalback" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modalcard">
    <div className="modalhead"><h2 className="modaltitle">Cài đặt</h2><button className="iconbtn" onClick={onClose} aria-label="Đóng"><X/></button></div>

    <h3 className="setgroup">Giao diện thiết bị</h3>
    <DeviceGrid value={prefs.device} suggested={suggested} onPick={id=>set({device:id,picked:true})}/>
    <label className="lbl">Cỡ chữ và nút</label>
    <Seg value={prefs.scale} options={SCALES} onPick={v=>set({scale:v})}/>
    <label className="check setcheck"><input type="checkbox" checked={prefs.calm} onChange={e=>set({calm:e.target.checked})}/> Giảm hiệu ứng chuyển động (tiết kiệm pin)</label>

    <h3 className="setgroup"><Music size={16}/> Nhạc nền</h3>
    <div className="setrow"><span>Bật nhạc nền</span>
      <button className={'switch '+(a.musicOn?'on':'')} role="switch" aria-checked={a.musicOn} onClick={()=>setAudio({musicOn:!a.musicOn})}><i/></button></div>
    <label className="lbl">Bản nhạc</label>
    <div className="tracklist">{TRACK_LIST.map(([id,name,desc])=>
      <button key={id} className={'trackrow '+(a.track===id?'on':'')} onClick={()=>setAudio({track:id,musicOn:true})}>
        <b>{name}</b><small>{desc}</small>{a.track===id&&<Check size={16}/>}</button>)}</div>
    <label className="lbl">Âm lượng nhạc: {Math.round(a.musicVol*100)}%</label>
    <input className="slider" type="range" min="0" max="1" step="0.05" value={a.musicVol} onChange={e=>setAudio({musicVol:Number(e.target.value)})}/>

    <h3 className="setgroup">{a.sfxOn?<Volume2 size={16}/>:<VolumeX size={16}/>} Hiệu ứng âm thanh</h3>
    <div className="setrow"><span>Tiếng gõ quân, chiếu tướng, thắng thua</span>
      <button className={'switch '+(a.sfxOn?'on':'')} role="switch" aria-checked={a.sfxOn} onClick={()=>setAudio({sfxOn:!a.sfxOn})}><i/></button></div>
    <label className="lbl">Âm lượng hiệu ứng: {Math.round(a.sfxVol*100)}%</label>
    <input className="slider" type="range" min="0" max="1" step="0.05" value={a.sfxVol} onChange={e=>setAudio({sfxVol:Number(e.target.value)})} onPointerUp={()=>sfx.capture()}/>

    <button className="primary wide" onClick={onClose}>Xong</button>
  </div></div>;
}

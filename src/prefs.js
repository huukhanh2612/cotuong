// Tùy chỉnh giao diện theo thiết bị. Lưu trong localStorage, áp dụng bằng thuộc tính data-* trên <html> (xem style.css).
import {useCallback,useEffect,useState} from 'react';

const KEY='cotuong.ui.v1';
const DEFAULTS={device:'auto',scale:'m',calm:false,picked:false};
export const DEVICES=[['auto','Tự động','Tự nhận theo màn hình'],['phone','Điện thoại','Bàn cờ full màn hình, nút to, thanh điều hướng dưới'],['tablet','Máy tính bảng','Bố cục vừa, nút cỡ trung'],['desktop','Máy tính','Bố cục rộng đầy đủ']];
export const SCALES=[['s','Nhỏ'],['m','Vừa'],['l','Lớn']];
export const deviceName=d=>(DEVICES.find(x=>x[0]===d)||[])[1]||d;

const load=()=>{try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(e){return {...DEFAULTS};}};

// Nhận dạng thiết bị theo bề rộng màn hình và kiểu con trỏ (cảm ứng hay chuột)
export function detectDevice(){
  const w=window.innerWidth,coarse=!!(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches);
  if(w<700)return 'phone';
  if(w<900||(w<1100&&coarse))return 'tablet';
  return 'desktop';
}

export function useUiPrefs(){
  const [prefs,setPrefs]=useState(load),[auto,setAuto]=useState(()=>detectDevice());
  useEffect(()=>{
    const f=()=>setAuto(detectDevice());
    window.addEventListener('resize',f);window.addEventListener('orientationchange',f);
    return()=>{window.removeEventListener('resize',f);window.removeEventListener('orientationchange',f);};
  },[]);
  const device=prefs.device==='auto'?auto:prefs.device;
  useEffect(()=>{
    const h=document.documentElement;
    h.dataset.device=device;h.dataset.scale=prefs.scale;h.dataset.calm=prefs.calm?'on':'off';
  },[device,prefs.scale,prefs.calm]);
  const set=useCallback(patch=>setPrefs(p=>{
    const n={...p,...patch};
    try{localStorage.setItem(KEY,JSON.stringify(n));}catch(e){}
    return n;
  }),[]);
  return {prefs,set,device,suggested:auto};
}

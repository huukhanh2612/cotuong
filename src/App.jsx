import React,{useCallback,useEffect,useMemo,useState} from 'react';
import GameView from './GameView.jsx';
import Lobby from './Lobby.jsx';
import OnlineGame from './OnlineGame.jsx';
import History from './History.jsx';
import Shop from './Shop.jsx';
import Wallet from './Wallet.jsx';
import TopUp from './TopUp.jsx';
import TamLobby from './TamLobby.jsx';
import TamGame from './TamGame.jsx';
import Admin from './Admin.jsx';
import Leaderboard from './Leaderboard.jsx';
import Friends from './Friends.jsx';
import Rooms from './Rooms.jsx';
import {copyText,showCode} from './social.js';
import SettingsPanel,{DevicePicker} from './SettingsPanel.jsx';
import {useUiPrefs} from './prefs.js';
import {useAudio,setAudio,setScene,sfx} from './audio.js';
import {CatalogCtx,Avatar,PlayerName} from './ui.jsx';
import {sb,hasSupabase} from './supabase.js';
import {khiInfo,fmt,tierOf,BASE,roomRules} from './khi.js';
import {Swords,Wind,BookOpen,UserRound,Volume2,VolumeX,LogOut,Trophy,ChevronRight,Sparkles,History as HistoryIcon,Store,Package,Wallet as WalletIcon,Coins,ShieldCheck,Crown,Settings as Cog,Home as HomeIcon,Users,DoorOpen,Bell,Copy,Check} from 'lucide-react';

const viErr=m=>/Invalid login/i.test(m)?'Sai email hoặc mật khẩu.':/already registered/i.test(m)?'Email này đã được đăng ký.':/Password should/i.test(m)?'Mật khẩu cần tối thiểu 6 ký tự.':/rate limit/i.test(m)?'Thao tác quá nhanh, hãy thử lại sau ít phút.':/Email not confirmed/i.test(m)?'Email chưa được xác nhận. Hãy kiểm tra hộp thư.':m;

function App(){
  const [page,setPage]=useState('login'),[session,setSession]=useState(null),[guest,setGuest]=useState(false),[profile,setProfile]=useState(null),[ready,setReady]=useState(!hasSupabase);
  const [mode,setMode]=useState('human'),[lobbyMode,setLobbyMode]=useState('casual'),[matchId,setMatchId]=useState(null),[tamId,setTamId]=useState(null);
  const [authTab,setAuthTab]=useState('in'),[username,setUsername]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authErr,setAuthErr]=useState(''),[authBusy,setAuthBusy]=useState(false);
  const ui=useUiPrefs(),aud=useAudio(),[showSettings,setShowSettings]=useState(false);
  const [social,setSocial]=useState({req:0,inv:[]}),[roomPreset,setRoomPreset]=useState(null),[roomKey,setRoomKey]=useState(0),[idCopied,setIdCopied]=useState(false);

  const uid=session?.user?.id;
  const [catalog,setCatalog]=useState([]),[shopTab,setShopTab]=useState('shop');
  const loadCatalog=useCallback(async()=>{if(!hasSupabase)return;const {data}=await sb.from('shop_items').select('*');setCatalog(data||[]);},[]);
  const catalogValue=useMemo(()=>({all:catalog,byId:Object.fromEntries(catalog.map(i=>[i.id,i])),reload:loadCatalog}),[catalog,loadCatalog]);
  const name=profile?.username||(guest?'Khách':'');

  const loadProfile=useCallback(async()=>{
    if(!uid)return;
    const {data}=await sb.from('profiles').select('*').eq('id',uid).single();
    if(data)setProfile(data);
  },[uid]);

  // Phiên đăng nhập
  useEffect(()=>{
    if(!hasSupabase)return;
    sb.auth.getSession().then(({data})=>{setSession(data.session);setReady(true);});
    const {data:sub}=sb.auth.onAuthStateChange((_e,s)=>setSession(s));
    return()=>sub.subscription.unsubscribe();
  },[]);

  // Sau khi đăng nhập: tải hồ sơ, tự vào lại ván đang dở nếu có
  useEffect(()=>{
    if(!ready||!hasSupabase)return;
    if(!uid){setProfile(null);if(!guest)setPage('login');return;}
    (async()=>{
      await Promise.all([loadProfile(),loadCatalog()]);
      const {data}=await sb.from('matches').select('id').eq('status','playing').limit(1);
      const {data:tm}=await sb.from('tam_matches').select('id').eq('status','playing').limit(1);
      if(data&&data.length){setMatchId(data[0].id);setPage('match');}
      else if(tm&&tm.length){setTamId(tm[0].id);setPage('tam');}
      else setPage(p=>p==='login'?'home':p);
    })();
  },[ready,uid]);

  useEffect(()=>{if(uid&&(page==='home'||page==='profile'))loadProfile();},[page,uid,loadProfile]);

  // Hiện diện (chấm xanh cho bạn bè) + thông báo lời mời kết bạn / lời mời vào phòng, cập nhật mỗi 10 giây
  useEffect(()=>{
    if(!hasSupabase||!uid){setSocial({req:0,inv:[]});return;}
    let stop=false;
    const tick=async()=>{
      sb.rpc('touch_presence').then(()=>{});
      const [f,i]=await Promise.all([sb.from('friendships').select('requester,status').eq('status','pending'),sb.rpc('my_room_invites')]);
      if(stop)return;
      setSocial({req:(f.data||[]).filter(x=>x.requester!==uid).length,inv:i.data||[]});
    };
    tick();const t=setInterval(tick,10000);
    return()=>{stop=true;clearInterval(t);};
  },[uid]);

  // Nếu một phòng vừa bắt đầu ván (ví dụ bạn bè vào phòng của mình khi bạn đang ở trang khác) thì tự vào ván
  useEffect(()=>{
    if(!hasSupabase||!uid||['login','match','game','tam'].includes(page))return;
    let stop=false;
    const t=setInterval(async()=>{
      const {data}=await sb.from('matches').select('id').eq('status','playing').limit(1);
      if(!stop&&data&&data.length){setMatchId(data[0].id);setPage('match');return;}
      const {data:tm}=await sb.from('tam_matches').select('id').eq('status','playing').limit(1);
      if(!stop&&tm&&tm.length){setTamId(tm[0].id);setPage('tam');}
    },6000);
    return()=>{stop=true;clearInterval(t);};
  },[uid,page]);

  // Nhạc nền: sảnh dùng bản nhẹ, khi đang đấu cờ dùng bản trận (chi tiết trong audio.js)
  useEffect(()=>{setScene(page==='match'||page==='game'||page==='tam'?'game':'menu');},[page]);

  const submitAuth=async()=>{
    setAuthErr('');setAuthBusy(true);
    try{
      if(authTab==='in'){
        const {error}=await sb.auth.signInWithPassword({email,password});
        if(error)setAuthErr(viErr(error.message));
      }else{
        if(username.trim().length<2){setAuthErr('Tên kỳ thủ cần tối thiểu 2 ký tự.');return;}
        const {data,error}=await sb.auth.signUp({email,password,options:{data:{username:username.trim()}}});
        if(error)setAuthErr(viErr(error.message));
        else if(!data.session)setAuthErr('Đã đăng ký. Hãy kiểm tra email để xác nhận rồi đăng nhập.');
      }
    }finally{setAuthBusy(false);}
  };
  const logout=async()=>{if(hasSupabase&&session)await sb.auth.signOut();setGuest(false);setProfile(null);setPage('login');};
  const playOffline=m=>{setMode(m);setPage('game');};
  const openLobby=m=>{setLobbyMode(m);setPage('lobby');};
  const openShop=t=>{setShopTab(t);setPage('shop');};
  const openRooms=p=>{setRoomPreset(p||null);setRoomKey(k=>k+1);setPage('rooms');};
  const copyMyId=async()=>{if(profile?.player_code&&await copyText(profile.player_code)){setIdCopied(true);setTimeout(()=>setIdCopied(false),1600);}};
  const socialCount=social.req+social.inv.length;
  const online=!!uid&&!!profile;
  const k=khiInfo(profile?.khi??BASE);
  const games=profile?profile.wins+profile.losses+profile.draws:0;
  const rate=games?Math.round(profile.wins/games*100)+'%':'—';

  const showNav=ui.device==='phone'&&online&&!['login','match','game','tam'].includes(page);
  const NAV=[['home','Trang chủ',<HomeIcon/>,()=>setPage('home')],['lobby','Đấu',<Swords/>,()=>openLobby(lobbyMode)],['friends','Bạn bè',<Users/>,()=>setPage('friends')],['rank','Xếp hạng',<Crown/>,()=>setPage('rank')],['shop','Cửa hàng',<Store/>,()=>openShop('shop')],['profile','Tôi',<UserRound/>,()=>setPage('profile')]];

  return <CatalogCtx.Provider value={catalogValue}><div className={"app"+(showNav?" hasnav":"")} onClickCapture={e=>{if(e.target.closest&&e.target.closest("button,.mode,.tab"))sfx.click();}}><header><div className="brand"><span className="seal">棋</span><div><b>CỜ TƯỚNG</b><small>ĐẠO • KHÍ • TU LUYỆN</small></div></div><div className="headright"><div className="music-control"><button className={"iconbtn "+(aud.musicOn?"music-on":"")} onClick={()=>setAudio({musicOn:!aud.musicOn})} title="Bật/tắt nhạc nền" aria-label="Bật/tắt nhạc nền">{aud.musicOn?<Volume2/>:<VolumeX/>}</button>
      <button className="iconbtn" onClick={()=>setShowSettings(true)} title="Cài đặt giao diện và âm thanh" aria-label="Cài đặt"><Cog/></button></div>
    {online&&<button className="coinchip" onClick={()=>setPage('wallet')} title="Ví Thy Mây"><Coins size={15}/> {fmt(profile.coins??0)}</button>}
    {(online||guest)&&<button className="profile" onClick={()=>setPage('profile')}><Avatar p={profile||{username:name}} size={30}/><span><PlayerName p={profile} fallback={name}/></span><ChevronRight size={15}/></button>}</div></header>

  {online&&social.inv.length>0&&!['login','match','game','rooms'].includes(page)&&<div className="invitebanner"><Bell size={16}/><span><b>{social.inv[0].host_name}</b> mời bạn vào phòng đấu • {roomRules(social.inv[0].rated,social.inv[0].bet_khi,social.inv[0].bet_coins)}</span><button className="primary" onClick={()=>openRooms({code:social.inv[0].code})}>Xem</button></div>}

  {page==='login'?<main className="login"><div className="loginart"><div className="moon">☯</div><h1>Thiên hạ<br/><em>kỳ cuộc</em></h1><p>Mỗi nước cờ là một bước tu hành.</p></div>
    <section className="loginbox"><span className="eyebrow">CHÀO MỪNG KỲ THỦ</span>
    {hasSupabase?<>
      <div className="tabs"><button className={'tab '+(authTab==='in'?'on':'')} onClick={()=>{setAuthTab('in');setAuthErr('');}}>Đăng nhập</button><button className={'tab '+(authTab==='up'?'on':'')} onClick={()=>{setAuthTab('up');setAuthErr('');}}>Đăng ký</button></div>
      {authTab==='up'&&<><label>Tên kỳ thủ</label><input value={username} maxLength={24} onChange={e=>setUsername(e.target.value)} placeholder="Tên hiển thị trong trận"/></>}
      <label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ten@email.com"/>
      <label>Mật khẩu</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitAuth()} placeholder="Tối thiểu 6 ký tự"/>
      {authErr&&<p className="warn">{authErr}</p>}
      <button className="primary wide" disabled={authBusy||!email||!password} onClick={submitAuth}>{authTab==='in'?'Vào game':'Tạo tài khoản'} <ChevronRight size={17}/></button>
    </>:<><h2>Chưa cấu hình máy chủ</h2><p className="muted">Chưa có biến môi trường Supabase nên chưa chơi online được. Xem README để cấu hình <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code>.</p></>}
    <button className="secondary wide" style={{marginTop:12}} onClick={()=>{setGuest(true);setPage('home');}}>Chơi thử không cần tài khoản</button>
    <p className="hint">Khách chỉ chơi được luyện tập với máy và hai người cùng thiết bị.</p></section></main>

  :page==='home'?<main className="content"><section className="hero"><div><span className="eyebrow">HÀNH TRÌNH KỲ ĐẠO</span><h1>Chào mừng trở lại,<br/><em>{name}</em></h1><p>Rèn tâm, luyện trí, từng bước tiến vào cảnh giới cao hơn.</p><button className="primary" onClick={()=>online?openLobby('casual'):playOffline('bot')}>{online?'Ghép trận ngay':'Bắt đầu luyện tập'} <ChevronRight size={17}/></button></div><div className="hero-symbol">棋</div></section>
    <div className="stats five"><div><small>CẤP ĐỘ</small><b>{online?k.level:'—'}</b><span>{online?k.name:'Đăng nhập để tu luyện'}</span></div>
      <div><small>KHÍ</small><b>{online?fmt(profile.khi):'—'}</b><span>{online?(k.next?`Còn ${fmt(k.toNext)} để lên cấp`:'Đã đạt cảnh giới tối cao'):''}</span>{online&&<div className="bar"><i style={{width:k.pct+'%'}}/></div>}</div>
      <div><small>RANK</small><b>{online?profile.rating:'—'}</b><span>{online?tierOf(profile.rating):''}</span></div>
      <div><small>THY MÂY</small><b>{online?fmt(profile.coins??0):'—'}</b><span>{online?((profile.win_streak||0)>0?`🔥 Chuỗi thắng Rank: ${profile.win_streak}`:'Thắng Rank để kiếm thêm'):''}</span></div>
      <div><small>TỈ LỆ THẮNG</small><b>{rate}</b><span>{games?`${profile.wins}T • ${profile.losses}B • ${profile.draws}H`:'Chưa có trận đấu'}</span></div></div>
    <h2 className="sectiontitle">Đấu online</h2><div className="modes">
      {[['casual','Đấu thường','Ghép trận giao hữu',<Swords/>],['ranked','Đấu Rank','Tranh điểm Rank (Elo)',<Trophy/>],['khi','Luyện Khí','Cược Khí, thắng nhận Khí',<Wind/>]].map(([m,t,s,ic])=>
        online?<button key={m} onClick={()=>openLobby(m)} className="mode"><span className="modeicon">{ic}</span><b>{t}</b><small>{s}</small><ChevronRight/></button>
        :<div key={m} className="mode disabled"><span className="modeicon">{ic}</span><b>{t}</b><small>Cần đăng nhập</small></div>)}
      {online?<button onClick={()=>setPage('tamlobby')} className="mode"><span className="modeicon"><Users/></span><b>Tam đấu</b><small>3 người một bàn, cược Khí 500 - 1000 - 1500</small><ChevronRight/></button>
        :<div className="mode disabled"><span className="modeicon"><Users/></span><b>Tam đấu</b><small>Cần đăng nhập</small></div>}
      {online?<button onClick={()=>setPage('rank')} className="mode"><span className="modeicon"><Crown/></span><b>Bảng xếp hạng tuần</b><small>Xếp theo điểm Khí trong tuần</small><ChevronRight/></button>
        :<div className="mode disabled"><span className="modeicon"><Crown/></span><b>Bảng xếp hạng tuần</b><small>Cần đăng nhập</small></div>}
      {online?<button onClick={()=>setPage('history')} className="mode"><span className="modeicon"><HistoryIcon/></span><b>Lịch sử trận đấu</b><small>Xem lại các ván đã đấu</small><ChevronRight/></button>
        :<div className="mode disabled"><span className="modeicon"><HistoryIcon/></span><b>Lịch sử trận đấu</b><small>Cần đăng nhập</small></div>}</div>
    <h2 className="sectiontitle" style={{marginTop:28}}>Bạn bè • Phòng riêng</h2><div className="modes">
      {online?<>
        <button onClick={()=>setPage('friends')} className="mode"><span className="modeicon"><Users/></span><b>Bạn bè{social.req>0?` • ${social.req} lời mời`:''}</b><small>ID của bạn: {showCode(profile.player_code)}</small><ChevronRight/></button>
        <button onClick={()=>openRooms()} className="mode"><span className="modeicon"><DoorOpen/></span><b>Phòng riêng</b><small>Tính Rank (Elo), cược Khí và Thy Mây</small><ChevronRight/></button>
      </>:<div className="mode disabled"><span className="modeicon"><Users/></span><b>Bạn bè • Phòng riêng</b><small>Cần đăng nhập</small></div>}</div>
    <h2 className="sectiontitle" style={{marginTop:28}}>Cửa hàng • Ví</h2><div className="modes">
      {online?<>
        <button onClick={()=>openShop('shop')} className="mode"><span className="modeicon"><Store/></span><b>Cửa hàng</b><small>Thẻ, avatar, khung, sân đấu</small><ChevronRight/></button>
        <button onClick={()=>openShop('inv')} className="mode"><span className="modeicon"><Package/></span><b>Kho đồ</b><small>Dùng thẻ, trang bị vật phẩm</small><ChevronRight/></button>
        <button onClick={()=>setPage('wallet')} className="mode"><span className="modeicon"><WalletIcon/></span><b>Ví tài nguyên</b><small>Thy Mây, Khí, Rank, giao dịch</small><ChevronRight/></button>
        <button onClick={()=>setPage('topup')} className="mode"><span className="modeicon"><Coins/></span><b>Nạp Thy Mây</b><small>Chuyển khoản, admin duyệt</small><ChevronRight/></button>
        {profile.is_admin&&<button onClick={()=>setPage('admin')} className="mode"><span className="modeicon"><ShieldCheck/></span><b>Quản trị</b><small>Vật phẩm, người chơi, Rank, Khí</small><ChevronRight/></button>}
      </>:<div className="mode disabled"><span className="modeicon"><Store/></span><b>Cửa hàng</b><small>Cần đăng nhập</small></div>}</div>
    <h2 className="sectiontitle" style={{marginTop:28}}>Chơi offline</h2><div className="modes">
      <button onClick={()=>playOffline('bot')} className="mode"><span className="modeicon"><BookOpen/></span><b>Luyện tập</b><small>Đấu với máy ngoại tuyến</small><ChevronRight/></button>
      <button onClick={()=>playOffline('human')} className="mode"><span className="modeicon"><UserRound/></span><b>Hai người</b><small>Chơi trên cùng thiết bị</small><ChevronRight/></button></div></main>

  :page==='rank'?<Leaderboard onBack={()=>setPage('home')} onPlay={()=>openLobby('khi')}/>
  :page==='friends'?<Friends profile={profile} onBack={()=>setPage('home')} onInvite={f=>openRooms({invite:f.id,inviteName:f.username})} onJoinCode={c=>openRooms({code:c})}/>
  :page==='rooms'?<Rooms key={roomKey} profile={profile} preset={roomPreset} onBack={()=>setPage('home')} onMatch={id=>{setMatchId(id);setPage('match');}}/>
  :page==='lobby'?<Lobby profile={profile} initialMode={lobbyMode} onBack={()=>setPage('home')} onMatch={id=>{setMatchId(id);setPage('match');}}/>
  :page==='tamlobby'?<TamLobby profile={profile} onBack={()=>setPage('home')} onMatch={id=>{setTamId(id);setPage('tam');}}/>
  :page==='tam'?<TamGame key={tamId} matchId={tamId} userId={uid} onExit={()=>{loadProfile();setPage('home');}} onAgain={()=>{loadProfile();setPage('tamlobby');}}/>
  :page==='match'?<OnlineGame key={matchId} matchId={matchId} userId={uid} onExit={()=>setPage('home')} onHistory={()=>setPage('history')}/>
  :page==='history'?<History equipped={profile?.equipped} onBack={()=>setPage('home')}/>
  :page==='shop'?<Shop key={shopTab} profile={profile} refresh={loadProfile} initialTab={shopTab} onBack={()=>setPage('home')} goWallet={()=>setPage('wallet')}/>
  :page==='wallet'?<Wallet profile={profile} onBack={()=>setPage('home')} goShop={()=>openShop('shop')} goTopUp={()=>setPage('topup')}/>
  :page==='topup'?<TopUp profile={profile} refresh={loadProfile} onBack={()=>setPage('wallet')}/>
  :page==='admin'?<Admin profile={profile} onBack={()=>setPage('home')}/>
  :page==='game'?<GameView key={mode} mode={mode} equipped={profile?.equipped} onExit={()=>setPage('home')}/>
  :<main className="content"><button className="back" onClick={()=>setPage('home')}>← Trang chủ</button><section className="profilecard"><div style={{display:'flex',justifyContent:'center'}}><Avatar p={profile||{username:name}} size={66}/></div><h2><PlayerName p={profile} fallback={name}/></h2>
    {online?<><p className="muted">Cấp {k.level} • {k.name}</p><p className="muted">ID: <b>{showCode(profile.player_code)}</b> <button className="secondary idcopy" onClick={copyMyId}>{idCopied?<><Check size={13}/> Đã chép</>:<><Copy size={13}/> Chép</>}</button></p><p className="muted">Khí {fmt(profile.khi)} • Rank {profile.rating} ({tierOf(profile.rating)})</p><p className="muted">{profile.wins} thắng • {profile.losses} thua • {profile.draws} hòa</p><p className="muted">Thy Mây {fmt(profile.coins??0)} • Chuỗi thắng Rank {profile.win_streak||0}</p><div className="rowbtn" style={{margin:'10px 0'}}><button className="secondary" onClick={()=>openShop('inv')}>Kho đồ</button><button className="secondary" onClick={()=>openShop('shop')}>Cửa hàng</button><button className="secondary" onClick={()=>setPage('friends')}>Bạn bè</button></div></>:<p className="muted">Chế độ khách</p>}
    <button className="secondary" onClick={logout}><LogOut size={16}/> {online?'Đăng xuất':'Về màn đăng nhập'}</button></section></main>}
  <footer><span>© 2026 CỜ TƯỚNG • GIAI ĐOẠN 5 • BẠN BÈ, PHÒNG RIÊNG, CƯỢC</span><span><Sparkles size={13}/> Đạo nằm trong từng nước cờ</span></footer>
  {showNav&&<nav className="bottomnav" aria-label="Điều hướng">{NAV.map(([id,label,ic,go])=><button key={id} className={page===id||(id==='friends'&&page==='rooms')?'on':''} onClick={go}>{ic}<span>{label}</span>{id==='friends'&&socialCount>0&&<i className="navbadge">{socialCount}</i>}</button>)}</nav>}
  {showSettings&&<SettingsPanel ui={ui} onClose={()=>setShowSettings(false)}/>}
  <DevicePicker ui={ui}/></div></CatalogCtx.Provider>;
}
export default App;

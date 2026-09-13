const DEFAULT_OWNER_EMAIL='admin@centavo.com';
const CONFIG_KEY='centavo-config-v17', SCHEMA_VERSION=17;
let appConfig=loadConfig(), testing=false;

function loadConfig(){const def={ownerEmail:DEFAULT_OWNER_EMAIL,tagline:'tu dinero, sin vueltas',balanceValidation:true,theme:'midnight'};try{return{...def,...(JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}'))};}catch{return def;}}
function saveConfig(){localStorage.setItem(CONFIG_KEY,JSON.stringify(appConfig));}
const DATA_PREFIX='centavo-data-v17:', THEME_KEY='centavo-theme-v17';
const TYPE_LABELS={expense:'Gasto',income:'Ingreso',transfer:'Dinero dado'};
let currentUser=null,data=null,saveTimer=null,pendingConfirm=null,fixedBuffers={expense:[],income:[]};
let ui={tab:'inicio',dashMode:'current',dashFrom:'',dashTo:'',period:'current',month:'',from:'',to:'',search:'',type:'all',categoryId:null,
 editingId:null,editingCardId:null,editingLoanId:null,editingBankLoanId:null,convertFixedId:null,fixedKind:'expense',daysTarget:null,tempDays:[],fixedActionId:null,
 cardTxType:'consume',cardTxEditId:null,cardStmtId:null,loanStmtId:null,loanPayId:null,
 detailCategoryId:null,movementType:'expense',selectedCategory:null,selectedSub:null,loginMethod:'password',authMode:'login',onbStep:1,onbCats:null,onbCommit:[],creditTab:'bank',
 alcanciaTab:'personal', activePiggyId:null,piggyActionType:'in', activeSharedId:null, sharedActionType:'in', activeSanId:null};
function isPro(){return true;}
function isAdmin(){return !!currentUser&&currentUser.email.toLowerCase()===(appConfig.ownerEmail||'').toLowerCase();}
function mapUser(u){return{id:u.id,email:u.email,name:(u.user_metadata&&u.user_metadata.name)||''};}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function traducirError(m){m=(m||'').toLowerCase();if(m.includes('after')&&m.includes('seconds'))return '⏳ Espera unos segundos.';if(m.includes('already registered'))return 'Correo ya registrado.';if(m.includes('not confirmed'))return 'Confirma tu correo.';if(m.includes('invalid login'))return 'Correo o contraseña incorrectos.';if(m.includes('at least 6'))return 'Mínimo 6 caracteres.';if(m.includes('rate limit'))return 'Demasiados intentos.';return 'Error: '+m;}
function defaultCategories(){return[
 {id:'comida',name:'Comida',emoji:'🍽️',type:'expense',bg:'--orange-soft',color:'#f59e0b',subs:[{id:'super',name:'Supermercado'},{id:'rest',name:'Restaurante'},{id:'cafe',name:'Cafetería'}]},
 {id:'transporte',name:'Transporte',emoji:'🚗',type:'expense',bg:'--blue-soft',color:'#3b82f6',subs:[{id:'gas',name:'Gasolina'},{id:'pasaje',name:'Pasajes'},{id:'taxi',name:'Taxi'}]},
 {id:'casa',name:'Hogar',emoji:'🏠',type:'expense',bg:'--purple-soft',color:'#8b5cf6',subs:[{id:'renta',name:'Renta'},{id:'muebles',name:'Muebles'}]},
 {id:'servicios',name:'Servicios',emoji:'🧾',type:'expense',bg:'--cyan-soft',color:'#06b6d4',subs:[{id:'luz',name:'Luz'},{id:'agua',name:'Agua'},{id:'internet',name:'Internet'},{id:'tel',name:'Teléfono'}]},
 {id:'salud',name:'Salud',emoji:'💊',type:'expense',bg:'--pink-soft',color:'#ec4899',subs:[{id:'farmacia',name:'Farmacia'},{id:'consulta',name:'Consultas'}]},
 {id:'gastos-hijos',name:'Gastos hijos',emoji:'👶',type:'expense',bg:'--rose-soft',color:'#f472b6',subs:[]},
 {id:'educacion',name:'Educación',emoji:'📚',type:'expense',bg:'--indigo-soft',color:'#6366f1',subs:[]},
 {id:'ropa',name:'Ropa y calzado',emoji:'👕',type:'expense',bg:'--teal-soft',color:'#14b8a6',subs:[]},
 {id:'mascotas',name:'Mascotas',emoji:'🐶',type:'expense',bg:'--lime-soft',color:'#84cc16',subs:[]},
 {id:'ocio',name:'Ocio',emoji:'🎬',type:'expense',bg:'--amber-soft',color:'#f59e0b',subs:[{id:'cine',name:'Cine'},{id:'stream',name:'Streaming'}]},
 {id:'suscripciones',name:'Suscripciones',emoji:'🔁',type:'expense',bg:'--rose-soft',color:'#f43f5e',subs:[]},
 {id:'prestamos',name:'Préstamos',emoji:'🏦',type:'expense',bg:'--blue-soft',color:'#1d4ed8',subs:[]},
 {id:'belleza',name:'Belleza y cuidado',emoji:'💇',type:'expense',bg:'--pink-soft',color:'#ec4899',subs:[]},
 {id:'combustible',name:'Combustible',emoji:'⛽',type:'expense',bg:'--orange-soft',color:'#f59e0b',subs:[]},
 {id:'finanzas',name:'Finanzas',emoji:'🏛️',type:'expense',bg:'--blue-soft',color:'#1d4ed8',subs:[]},
 {id:'otros-gasto',name:'Otros',emoji:'📦',type:'expense',bg:'--pill',color:'#64748b',subs:[]},
 {id:'sueldo',name:'Sueldo',emoji:'💼',type:'income',bg:'--green-soft',color:'#10b981',subs:[]},
 {id:'freelance',name:'Trabajo extra',emoji:'🧑‍💻',type:'income',bg:'--teal-soft',color:'#14b8a6',subs:[]},
 {id:'venta',name:'Ventas',emoji:'🏷️',type:'income',bg:'--blue-soft',color:'#3b82f6',subs:[]},
 {id:'inversiones',name:'Inversiones',emoji:'📈',type:'income',bg:'--indigo-soft',color:'#6366f1',subs:[]},
 {id:'regalo',name:'Regalos',emoji:'🎁',type:'income',bg:'--pink-soft',color:'#ec4899',subs:[]},
 {id:'otros-ingreso',name:'Otros',emoji:'✨',type:'income',bg:'--purple-soft',color:'#8b5cf6',subs:[]}
];}
function defaultData(u){return{schema:SCHEMA_VERSION,userId:u.id,settings:{currency:'$',pinLock:false,notifications:false,pinHash:''},onboarding:{completed:false,mode:null},meta:{sample:false},categories:defaultCategories(),movements:[],fixeds:[],cards:[],loans:[],bankLoans:[],piggyBanks:[{id:uid(),name:'Mi alcancía',balance:0,goal:0,goalMonth:currentMonthKey(),transactions:[]}],sharedAccounts:[],sans:[]};}
function migrate(p){p.schema=p.schema||1;
 p.cards=(p.cards||[]).map(c=>{if(c.limit!==undefined){c.limitRD=c.limitRD||c.limit;c.usedRD=c.usedRD||c.used;delete c.limit;delete c.used;}return{currency:'RD$',limitRD:0,limitUS:0,usedRD:0,usedUS:0,cutDay:1,payLimitDate:'',lastCutDate:'',lastCutRD:0,lastCutUS:0,annualRate:0,finIntRD:0,finIntUS:0,lastInterestCycle:null,reminder:true,paidCycle:null,updatedAt:Date.now(),transactions:[],sample:false,...c};});
 p.cards.forEach(c=>{if(!Array.isArray(c.transactions))c.transactions=[];});
 p.loans=Array.isArray(p.loans)?p.loans:[];
 p.bankLoans=(p.bankLoans||[]).map(b=>({...b,installmentCapital:b.installmentCapital||0,installmentInterest:b.installmentInterest||0,maturityDate:b.maturityDate||'',paidInterest:b.paidInterest||0,payments:b.payments||[]}));
 if(!Array.isArray(p.fixeds)){p.fixeds=Array.isArray(p.payments)?p.payments:[];}
 let ex2=[];(p.fixeds||[]).forEach(x=>{const days=Array.isArray(x.days)&&x.days.length?x.days:[x.dueDay||1];days.forEach((d,i)=>ex2.push({...x,id:i===0?(x.id||uid()):uid(),days:[d]}));});p.fixeds=ex2;
 if(!Array.isArray(p.piggyBanks)||!p.piggyBanks.length)p.piggyBanks=[{id:uid(),name:'Mi alcancía',balance:0,goal:0,goalMonth:currentMonthKey(),transactions:[]}];
 p.piggyBanks=p.piggyBanks.map(pb=>({...pb,goalMonth:pb.goalMonth||currentMonthKey(),transactions:Array.isArray(pb.transactions)?pb.transactions:[]}));
 const have=new Set((p.categories||[]).map(c=>c.id));defaultCategories().forEach(c=>{if(!have.has(c.id))p.categories.push(c);});
 p.categories=p.categories.map(c=>({...c,subs:Array.isArray(c.subs)?c.subs:[]}));
 p.movements=(p.movements||[]).map(m=>({...m,subId:m.subId||null,merchant:m.merchant||''}));
 p.settings={currency:'$',pinLock:false,notifications:false,pinHash:'',...(p.settings||{})};
 if(!p.sharedAccounts) p.sharedAccounts = [];
 if(!p.sans) p.sans = [];
 p.schema=SCHEMA_VERSION;return p;}
function normalize(p,u){if((p.schema||1)<SCHEMA_VERSION)p=migrate(p);return{...defaultData(u),...p,settings:{...defaultData(u).settings,...(p.settings||{})}};}
function localLoad(u){try{const r=localStorage.getItem(DATA_PREFIX+u.id);if(!r)return defaultData(u);return normalize(JSON.parse(r),u);}catch{return defaultData(u);}}

function saveData(){if(testing||!currentUser||!data)return;localStorage.setItem(DATA_PREFIX+currentUser.id,JSON.stringify(data));if(typeof sb !== 'undefined' && sb){clearTimeout(saveTimer);saveTimer=setTimeout(syncUp,800);}}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
async function hashText(t){if(!t)return '';try{if(crypto?.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}}catch{}let h=5381;for(let i=0;i<t.length;i++)h=((h<<5)+h)+t.charCodeAt(i);return 'simple_'+Math.abs(h).toString(36);}
function isoDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function currentMonthKey(){return isoDate().slice(0,7);}
function previousMonthKey(){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function monthKey(d){return String(d||'').slice(0,7);}
function daysLeftInMonth(){const n=new Date();return new Date(n.getFullYear(),n.getMonth()+1,0).getDate()-n.getDate()+1;}
function fmt2(n){return Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function formatMoney(a){return `${(data?.settings?.currency||'$')}${fmt2(a)}`;}
function todayLabel(){return new Date().toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric'});}
function getCategory(id){return data.categories.find(c=>c.id===id)||{id:'x',name:'Sin categoría',emoji:'❓',type:'expense',bg:'--pill',color:'#64748b',subs:[]};}
function hexA(c){const h=c.color||'#888888';const r=parseInt(h.slice(1,3),16)||128,g=parseInt(h.slice(3,5),16)||128,b=parseInt(h.slice(5,7),16)||128;return `rgba(${r},${g},${b},.22)`;}
function calcSummary(l){return l.reduce((a,m)=>{const n=Number(m.amount||0);if(m.type==='income')a.income+=n;else if(m.type==='transfer')a.transfer+=n;else a.expense+=n;a.available=a.income-a.expense-a.transfer;return a;},{income:0,expense:0,transfer:0,available:0});}
function currentMonthMovements(){return data.movements.filter(m=>monthKey(m.date)===currentMonthKey());}
function previousMonthMovements(){return data.movements.filter(m=>monthKey(m.date)===previousMonthKey());}
function firstDayOfMonth(){const d=new Date();return isoDate(new Date(d.getFullYear(),d.getMonth(),1));}
function balanceBefore(ds){return data.movements.filter(m=>m.date<ds).reduce((a,m)=>a+(m.type==='income'?Number(m.amount||0):-Number(m.amount||0)),0);}
function availableNow(){return balanceBefore(firstDayOfMonth())+calcSummary(currentMonthMovements()).available;}
function validateExpense(a){if(!appConfig.balanceValidation)return{ok:true};const av=availableNow();if(Number(a)>av)return{ok:false,msg:`No puedes registrar ${formatMoney(a)}: tu disponible es ${formatMoney(av)}.`};return{ok:true};}
function getDashMovements(){if(ui.dashMode==='previous')return data.movements.filter(m=>monthKey(m.date)===previousMonthKey());if(ui.dashMode==='range')return data.movements.filter(m=>(!ui.dashFrom||m.date>=ui.dashFrom)&&(!ui.dashTo||m.date<=ui.dashTo));return currentMonthMovements();}
function getPeriodMovements(){if(ui.period==='current')return currentMonthMovements();if(ui.period==='previous')return data.movements.filter(m=>monthKey(m.date)===previousMonthKey());if(ui.period==='month')return data.movements.filter(m=>monthKey(m.date)===ui.month);if(ui.period==='range')return data.movements.filter(m=>(!ui.from||m.date>=ui.from)&&(!ui.to||m.date<=ui.to));return[...data.movements];}
function getFilteredMovements(){let l=getPeriodMovements();if(ui.type!=='all')l=l.filter(m=>m.type===ui.type);if(ui.categoryId)l=l.filter(m=>m.categoryId===ui.categoryId);if(ui.search){const q=ui.search.toLowerCase();l=l.filter(m=>(m.note||'').toLowerCase().includes(q)||(m.merchant||'').toLowerCase().includes(q)||getCategory(m.categoryId).name.toLowerCase().includes(q));}return l.sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0));}
function runningBalanceMap(){const all=[...data.movements].sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||0)-(b.createdAt||0));let bal=0;const map={};all.forEach(m=>{bal+=m.type==='income'?Number(m.amount||0):-Number(m.amount||0);map[m.id]=bal;});return map;}
function expenseByCategoryList(l){return l.filter(m=>m.type==='expense').reduce((a,m)=>{a[m.categoryId]=(a[m.categoryId]||0)+Number(m.amount||0);return a;},{});}
function combinedExpenseByCategory(month){const map=expenseByCategoryList(data.movements.filter(m=>monthKey(m.date)===month));data.fixeds.filter(p=>p.kind==='expense'&&p.active!==false).forEach(p=>{const occ=(p.days||[]).length||1;map[p.categoryId]=(map[p.categoryId]||0)+Number(p.amount||0)*occ;});return map;}
function homeCategoryMap(){ if(ui.dashMode==='current') return combinedExpenseByCategory(currentMonthKey()); return expenseByCategoryList(getDashMovements()); }
function hasSample(){return data.movements.some(m=>m.sample)||data.fixeds.some(p=>p.sample);}
function pushMovement(mov){const m={id:uid(),type:'expense',amount:0,categoryId:null,subId:null,merchant:'',note:'',date:isoDate(),sample:false,createdAt:Date.now(),...mov};data.movements.push(m);return m;}
function pushFixed(p){const x={id:uid(),name:'',amount:0,categoryId:'casa',days:[new Date().getDate()],active:true,reminder:true,status:'pendiente',kind:'expense',lastPaidMonth:null,sample:false,...p};data.fixeds.push(x);return x;}
function pushCard(c){const x={id:uid(),name:'',currency:'RD$',limitRD:0,limitUS:0,usedRD:0,usedUS:0,cutDay:1,payLimitDate:'',lastCutDate:'',lastCutRD:0,lastCutUS:0,annualRate:0,finIntRD:0,finIntUS:0,lastInterestCycle:null,reminder:true,paidCycle:null,updatedAt:Date.now(),transactions:[],sample:false,...c};data.cards.push(x);return x;}
function pushLoan(l){const x={id:uid(),person:'',dir:'owedToMe',amount:0,remaining:0,date:isoDate(),note:'',payments:[],...l};x.remaining=Number(x.amount);data.loans.push(x);return x;}
function pushBankLoan(l){const x={id:uid(),entity:'',kind:'personal',principal:0,balance:0,rate:0,installment:0,installmentCapital:0,installmentInterest:0,dueDay:1,maturityDate:'',status:'active',paidInterest:0,payments:[],...l};data.bankLoans.push(x);return x;}
function applyTheme(){const th=appConfig.theme||'midnight';document.body.classList.toggle('dark',th!=='light');['midnight','emerald','violet','amber','oled','light'].forEach(t=>document.body.classList.toggle('theme-'+t,th===t));const sel=document.getElementById('themeSelect');if(sel)sel.value=th;}
function setTheme(v){appConfig.theme=v;saveConfig();applyTheme();toast('Tema aplicado');}
function toggleTheme(){setTheme(appConfig.theme==='light'?'midnight':'light');}
function showScreen(n){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('screen-'+n).classList.add('active');}
function switchTab(t){ui.tab=t;document.querySelectorAll('.tab-view').forEach(s=>s.style.display='none');const el=document.getElementById('tab-'+t);if(el)el.style.display='block';document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));const sc=document.querySelector('#screen-app .scroll');if(sc)sc.scrollTop=0;if(t==='alcancia')renderAlcancia();if(t==='inicio')renderCompareChart();if(t==='creditos')renderCredits();if(t==='san')renderSan();}
function toast(m,dur){const el=document.getElementById('toast');el.textContent=m;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),dur||2600);}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function applyTagline(){document.querySelectorAll('.tagline').forEach(el=>el.textContent=appConfig.tagline);}
function setAuthMode(m){ui.authMode=m;document.getElementById('authTabLogin').classList.toggle('active',m==='login');document.getElementById('authTabRegister').classList.toggle('active',m==='register');document.getElementById('authLogin').classList.toggle('hidden',m!=='login');document.getElementById('authRegister').classList.toggle('hidden',m!=='register');document.getElementById('authForgot').classList.toggle('hidden',m!=='forgot');if(m!=='forgot'){document.getElementById('forgotStep1').classList.remove('hidden');document.getElementById('forgotStep2').classList.add('hidden');}}
function setLoginMethod(m){ui.loginMethod=m;document.getElementById('loginMethodPassword').classList.toggle('active',m==='password');document.getElementById('loginMethodPin').classList.toggle('active',m==='pin');document.getElementById('loginPasswordField').classList.toggle('hidden',m!=='password');document.getElementById('loginPinField').classList.toggle('hidden',m!=='pin');}
function showForgot(){setAuthMode('forgot');}
async function registerUser(){const name=document.getElementById('registerName').value.trim(),email=document.getElementById('registerEmail').value.trim().toLowerCase(),pw=document.getElementById('registerPassword').value,c=document.getElementById('registerConfirm').value;
 if(!name)return toast('Escribe tu nombre.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast('Correo inválido.');if(pw.length<6)return toast('Mínimo 6 caracteres.');if(pw!==c)return toast('No coinciden.');
 if(typeof sb !== 'undefined' && sb){const{data:res,error}=await sb.auth.signUp({email,password:pw,options:{data:{name}}});if(error)return toast(traducirError(error.message));if(!res.session)return toast('Cuenta creada. Confirma tu correo.');currentUser=mapUser(res.user);data=await cloudLoadOrCreate(currentUser);saveData();toast('Cuenta creada');enterApp();}
 else{const key='centavo-local-users-v17';const users=JSON.parse(localStorage.getItem(key)||'[]');if(users.some(u=>u.email===email))return toast('Correo ya existe.');const user={id:uid(),name,email,ph:await hashText(pw)};users.push(user);localStorage.setItem(key,JSON.stringify(users));localStorage.setItem('centavo-local-session-v17',user.id);currentUser=user;data=defaultData(user);saveData();toast('Cuenta creada');enterApp();}}
async function loginUser(){const email=document.getElementById('loginEmail').value.trim().toLowerCase();
 if(typeof sb !== 'undefined' && sb){if(ui.loginMethod==='pin')return toast('Usa contraseña la primera vez.');const pw=document.getElementById('loginPasswordInput').value;const{data:res,error}=await sb.auth.signInWithPassword({email,password:pw});if(error)return toast(traducirError(error.message));currentUser=mapUser(res.user);data=await cloudLoadOrCreate(currentUser);saveData();toast('Hola, '+(currentUser.name||'usuario'));enterApp();}
 else{const key='centavo-local-users-v17';const users=JSON.parse(localStorage.getItem(key)||'[]');const user=users.find(u=>u.email===email);if(!user)return toast('Cuenta no encontrada.');if((await hashText(document.getElementById('loginPasswordInput').value))!==user.ph)return toast('Contraseña incorrecta.');localStorage.setItem('centavo-local-session-v17',user.id);currentUser=user;data=localLoad(user);toast('Hola, '+(user.name||'usuario'));enterApp();}}
async function logout(){if(typeof sb !== 'undefined' && sb)await sb.auth.signOut();localStorage.removeItem('centavo-local-session-v17');currentUser=null;data=null;setAuthMode('login');showScreen('auth');}
async function requestResetCode(){const email=document.getElementById('forgotEmail').value.trim().toLowerCase();if(typeof sb !== 'undefined' && sb){const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin});if(error)return toast(traducirError(error.message));toast('Correo enviado.');}else{document.getElementById('resetDemoCode').textContent='Modo local: define nueva contraseña.';document.getElementById('forgotStep1').classList.add('hidden');document.getElementById('forgotStep2').classList.remove('hidden');}}
async function performReset(){const pw=document.getElementById('newPassword').value,c=document.getElementById('newPasswordConfirm').value;if(pw.length<6)return toast('Mínimo 6.');if(pw!==c)return toast('No coinciden.');if(typeof sb !== 'undefined' && sb){toast('Usa el enlace del correo.');return;}const key='centavo-local-users-v17';const users=JSON.parse(localStorage.getItem(key)||'[]');const user=users.find(u=>u.email===document.getElementById('forgotEmail').value.trim().toLowerCase());if(!user)return toast('Cuenta no encontrada.');user.ph=await hashText(pw);localStorage.setItem(key,JSON.stringify(users));toast('Actualizada');setAuthMode('login');}
function renderLock(){document.getElementById('lockUserName').textContent=currentUser.name||currentUser.email;document.getElementById('lockPinInput').value='';}
async function unlockPin(){if((await hashText(document.getElementById('lockPinInput').value))===(data.settings.pinHash||'')){toast('Desbloqueado');enterApp();}else toast('PIN incorrecto');}
async function lockUsePassword(){if(typeof sb !== 'undefined' && sb){await sb.auth.signOut();currentUser=null;data=null;setAuthMode('login');showScreen('auth');}else logout();}
function ensureOnbState(){if(!ui.onbCats)ui.onbCats=JSON.parse(JSON.stringify(defaultCategories().filter(c=>c.type==='expense')));if(!ui.onbCommit)ui.onbCommit=[];}
function renderOnboarding(){ensureOnbState();for(let i=1;i<=5;i++){document.getElementById('onbStep1').classList.toggle('hidden',ui.onbStep!==i);document.getElementById('dot'+i)?.classList.toggle('active',ui.onbStep===i);}document.getElementById('onbNext').classList.toggle('hidden',ui.onbStep===5);if(ui.onbStep===3)renderOnbCats();if(ui.onbStep===4)renderOnbCommit();}
function nextOnboarding(){if(ui.onbStep<5){ui.onbStep++;renderOnboarding();}}
function renderOnbCats(){document.getElementById('onbCatChips').innerHTML=ui.onbCats.map(c=>`<button type="button" class="chip-pick mini" onclick="removeOnbCat('${c.id}')">${c.emoji} ${c.name} ✕</button>`).join('');}
function addOnbCat(){const inp=document.getElementById('onbCatInput');const n=inp.value.trim();if(!n)return;if(ui.onbCats.some(c=>c.name.toLowerCase()===n.toLowerCase()))return toast('Ya existe.');ui.onbCats.push({id:'cat-'+uid(),name:n,emoji:'🏷️',type:'expense',bg:'--pill',color:'#64748b',subs:[]});inp.value='';renderOnbCats();}
function removeOnbCat(id){ui.onbCats=ui.onbCats.filter(c=>c.id!==id);renderOnbCats();}
function restoreOnbCats(){ui.onbCats=JSON.parse(JSON.stringify(defaultCategories().filter(c=>c.type==='expense')));renderOnbCats();}
function renderOnbCommit(){document.getElementById('onbCommitList').innerHTML=ui.onbCommit.map((k,i)=>`<div class="row" style="cursor:default;"><div class="row-left"><div style="min-width:0;"><div class="row-title">${k.name}</div><div class="row-sub">${k.kind==='income'?'Ingreso':'Gasto'} · día ${k.day} · ${k.amount}</div></div></div><button class="btn secondary mini" onclick="removeOnbCommit(${i})">✕</button></div>`).join('');}
function addOnbCommit(){const name=document.getElementById('commitName').value.trim(),kind=document.getElementById('commitKind').value,day=parseInt(document.getElementById('commitDay').value,10),amount=parseFloat(document.getElementById('commitAmount').value);if(!name||!(day>=1&&day<=31)||!(amount>0))return toast('Completa nombre, día y monto.');ui.onbCommit.push({name,kind,day,amount});document.getElementById('commitName').value='';document.getElementById('commitDay').value='';document.getElementById('commitAmount').value='';renderOnbCommit();}
function removeOnbCommit(i){ui.onbCommit.splice(i,1);renderOnbCommit();}
function guessCat(n){n=n.toLowerCase();if(/rent|casa|alqu/i.test(n))return 'casa';if(/luz|agua|internet|tel|serv|electric/i.test(n))return 'servicios';if(/comid|super|mercado/i.test(n))return 'comida';if(/sal[oó]n|belleza|pelu/i.test(n))return 'belleza';if(/gas|trans|uber|bus|combust/i.test(n))return 'combustible';if(/hijo/i.test(n))return 'gastos-hijos';if(/sueldo|salario|n[oó]mina/i.test(n))return 'sueldo';if(/pr[eé]stamo|financ|cred/i.test(n))return 'finanzas';if(/netflix|stream|ocio/i.test(n))return 'ocio';return 'otros-gasto';}
function chooseOnboarding(mode){ensureOnbState();const exp=ui.onbCats.length?ui.onbCats:defaultCategories().filter(c=>c.type==='expense');data.categories=[...JSON.parse(JSON.stringify(exp)),...defaultCategories().filter(c=>c.type==='income')];ui.onbCommit.forEach(k=>pushFixed({name:k.name,amount:Number(k.amount),categoryId:guessCat(k.name),days:[k.day],kind:k.kind||'expense'}));data.onboarding.completed=true;data.onboarding.mode=mode;if(mode==='examples'){addSampleData();data.meta.sample=true;}else data.meta.sample=false;saveData();showScreen('app');render();switchTab('inicio');notifyDueToday();}
function addSampleData(){const now=new Date();let t=Date.now();
 const d=day=>isoDate(new Date(now.getFullYear(),now.getMonth(),Math.min(day,now.getDate())));
 const fd=off=>{const x=new Date();x.setDate(x.getDate()+off);return x.getDate();};
 const lim=isoDate(new Date(now.getFullYear(),now.getMonth(),fd(4)));
 data.movements=[
  pushMovement({type:'income',amount:3200,categoryId:'sueldo',note:'Sueldo',date:d(1),sample:true,createdAt:t++}),
  pushMovement({type:'expense',amount:300,categoryId:'casa',subId:'renta',note:'Renta',date:d(2),sample:true,createdAt:t++}),
  pushMovement({type:'expense',amount:350,categoryId:'belleza',note:'Salón',date:d(5),sample:true,createdAt:t++}),
  pushMovement({type:'expense',amount:85.20,categoryId:'comida',subId:'super',merchant:'Walmart',note:'Supermercado',date:d(3),sample:true,createdAt:t++})
 ];
 data.fixeds=[
  pushFixed({name:'Peluquería',amount:600,categoryId:'belleza',days:[15,30],sample:true,kind:'expense'}),
  pushFixed({name:'Crediclic',amount:3000,categoryId:'finanzas',days:[30],sample:true,kind:'expense'}),
  pushFixed({name:'Gasolina',amount:4000,categoryId:'combustible',days:[15,30],sample:true,kind:'expense'}),
  pushFixed({name:'Comida',amount:3500,categoryId:'comida',days:[15,30],sample:true,kind:'expense'}),
  pushFixed({name:'Netflix',amount:1350,categoryId:'suscripciones',days:[15],sample:true,kind:'expense'}),
  pushFixed({name:'Sueldo 2da quincena',amount:34000,categoryId:'sueldo',days:[30],sample:true,kind:'income'})
 ];
 data.cards=[pushCard({name:'Visa principal',currency:'dual',limitRD:200000,limitUS:5000,usedRD:45000,usedUS:800,cutDay:fd(9),lastCutDate:d(9),lastCutRD:40000,lastCutUS:700,annualRate:45.9,payLimitDate:lim,sample:true})];
 data.loans=[pushLoan({person:'Ana',dir:'owedToMe',amount:200,date:d(2)}),pushLoan({person:'Luis',dir:'iOwe',amount:80,date:d(3)})];
 data.bankLoans=[pushBankLoan({entity:'BBVA',kind:'personal',principal:5000,balance:3800,rate:22.5,installment:250,installmentCapital:180,installmentInterest:70,dueDay:fd(10),maturityDate:isoDate(new Date(now.getFullYear()+1,now.getMonth(),1)),status:'active'})];
 if(data.piggyBanks.length>0){data.piggyBanks[0].balance=2500;data.piggyBanks[0].goal=1000;data.piggyBanks[0].transactions=[{id:uid(),date:d(2),type:'in',amount:1500,note:'Ahorro inicial'},{id:uid(),date:d(4),type:'in',amount:1000,note:'Ahorro extra'}];}}
function clearSample(){data.movements=data.movements.filter(m=>!m.sample);data.fixeds=data.fixeds.filter(p=>p.sample);data.cards=data.cards.filter(c=>!c.sample);data.loans=data.loans.filter(l=>!l.sample);data.bankLoans=data.bankLoans.filter(b=>!b.sample);data.meta.sample=false;saveData();render();toast('Datos de ejemplo borrados');}
async function init(){applyTheme();applyTagline();
 if(document.getElementById('setupSql') && typeof SETUP_SQL !== 'undefined') document.getElementById('setupSql').value = SETUP_SQL;
 document.getElementById('privacyNote').textContent=(typeof cloudEnabled !== 'undefined' && cloudEnabled)?'☁️ Se sincroniza entre dispositivos.':'🔒 Tus datos viven solo en este dispositivo.';
 if(typeof cloudEnabled !== 'undefined' && cloudEnabled){document.getElementById('loginMethodTabs').style.gridTemplateColumns='1fr';document.getElementById('loginMethodPin').classList.add('hidden');}
 setInterval(()=>{if(currentUser&&data)renderSummary();},60000);
 if(typeof sb !== 'undefined' && sb){const{data:{session}}=await sb.auth.getSession();
  sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'&&!currentUser){setAuthMode('login');showScreen('auth');}});
  if(session){currentUser=mapUser(session.user);try{data=await cloudLoadOrCreate(currentUser);}catch{data=localLoad(currentUser);}if(data.settings.pinLock&&data.settings.pinHash){renderLock();showScreen('lock');return;}enterApp();return;}
  showScreen('auth');return;}
 const sid=localStorage.getItem('centavo-local-session-v17');
 if(sid){const users=JSON.parse(localStorage.getItem('centavo-local-users-v17')||'[]');const u=users.find(x=>x.id===sid);if(u){currentUser=u;data=localLoad(u);if(data.settings.pinLock&&data.settings.pinHash){renderLock();showScreen('lock');return;}enterApp();return;}}
 showScreen('auth');}
function enterApp(){if(!data.onboarding.completed){ui.onbStep=1;renderOnboarding();showScreen('onboarding');return;}showScreen('app');render();switchTab('inicio');notifyDueToday();}
function toggleNotifications(){if(!data.settings.notifications&&('Notification' in window)){Notification.requestPermission().then(p=>{if(p!=='granted')return toast('Permiso denegado.');data.settings.notifications=true;saveData();renderMas();toast('Notificaciones activadas');});return;}data.settings.notifications=!data.settings.notifications;saveData();renderMas();}
function notifyDueToday(){try{if(!data.settings.notifications||!('Notification' in window)||Notification.permission!=='granted')return;getUpcomingUnified(0).forEach(p=>new Notification('Menudo',{body:`Hoy: ${p.name} (${formatMoney(p.amount)})`}));data.cards.forEach(c=>{if(cardCutInfo(c).du===0)new Notification('Menudo',{body:`${c.name}: corte hoy`});});}catch{}}
function render(){if(!currentUser||!data)return;applyCardFinancingInterest();renderSummary();renderBanner();renderAlerts();renderHomePayments();renderHomeCategories();renderInsights();renderCompareChart();renderCategoryFilter();renderMovements();renderBudgetModule();renderCredits();if(typeof renderMas === 'function') renderMas();renderAlcancia();renderSan();document.getElementById('amountSymbol').textContent=data.settings.currency;}
function renderSummary(){const s=calcSummary(getDashMovements());const carry=balanceBefore(firstDayOfMonth());const disp=(ui.dashMode==='current')?(carry+s.available):s.available;document.getElementById('availableValue').textContent=formatMoney(disp);document.getElementById('incomeValue').textContent='+'+formatMoney(s.income);document.getElementById('expenseValue').textContent='-'+formatMoney(s.expense);const ex=document.getElementById('heroExtra');let txt='';if(ui.dashMode==='current'){if(carry!==0)txt+=(carry>0?`Acumulado mes anterior: ${formatMoney(carry)}. `:`Déficit anterior: ${formatMoney(carry)}. `);if(s.available>0)txt+=`Hoy puedes gastar ${formatMoney((carry+s.available)/daysLeftInMonth())} diario.`;}if(s.transfer>0)txt+=(txt?' · ':'')+`Dinero dado: ${formatMoney(s.transfer)}`;ex.textContent=txt;ex.classList.toggle('hidden',!txt);}
function setDashPeriod(v){ui.dashMode=v;document.getElementById('dashRange').classList.toggle('hidden',v!=='range');renderSummary();renderHomeCategories();}
function setDashRange(){ui.dashFrom=document.getElementById('dashFrom').value;ui.dashTo=document.getElementById('dashTo').value;renderSummary();renderHomeCategories();}
function renderBanner(){document.getElementById('sampleBanner').classList.toggle('hidden',!hasSample());}
function cardCutInfo(c){const nd=getNextPaymentDate(c.cutDay||1);return{nd,du:daysUntil(nd)};}
function getCardReminders(){return data.cards.filter(c=>c.reminder!==false&&c.paidCycle!==currentMonthKey()&&(Number(c.usedRD||0)>0||Number(c.usedUS||0)>0)).map(c=>{const nd=getNextPaymentDate(c.cutDay||1);return{...c,nd,du:daysUntil(nd)};}).filter(c=>c.du<=3);}
function getNextPaymentDate(day){const t=new Date();t.setHours(0,0,0,0);let d=new Date(t.getFullYear(),t.getMonth(),Number(day||1));if(d<t)d=new Date(t.getFullYear(),t.getMonth()+1,Number(day||1));return d;}
function daysUntil(d){const t=new Date();t.setHours(0,0,0,0);return Math.round((d-t)/86400000);}
function nextDateForDays(days){const t=new Date();t.setHours(0,0,0,0);let best=null;(days||[]).forEach(dd=>{let dt=new Date(t.getFullYear(),t.getMonth(),dd);if(dt<t)dt=new Date(t.getFullYear(),t.getMonth()+1,dd);if(!best||dt<best)best=dt;});return best||getNextPaymentDate((days||[])[0]||1);}
function getUpcomingUnified(days=15){const t=new Date();t.setHours(0,0,0,0);const l=new Date(t);l.setDate(l.getDate()+days);return data.fixeds.filter(p=>p.active!==false&&p.status!=='pagado').map(p=>{const n=nextDateForDays(p.days);return{...p,kind:p.kind||'expense',nextDate:n,du:daysUntil(n)};}).filter(p=>p.nextDate>=t&&p.nextDate<=l).sort((a,b)=>a.nextDate-b.nextDate);}
function formatUpcomingLabel(p){const k=p.kind==='income'?'Ingreso':'Gasto';if(p.du===0)return k+' hoy';if(p.du===1)return k+' mañana';return `${k} en ${p.du} días`;}
function applyCardFinancingInterest(){const today=new Date();today.setHours(0,0,0,0);let applied=0;
 data.cards.forEach(c=>{if(!c.payLimitDate)return;const limit=new Date(c.payLimitDate+'T00:00:00');const cycle=monthKey(c.payLimitDate);
  if(today>=limit&&c.lastInterestCycle!==cycle){const mr=(Number(c.annualRate)||0)/100/12;const pRD=Number(c.lastCutRD||0),pUS=Number(c.lastCutUS||0);
   if(pRD>0||pUS>0){const iRD=pRD*mr,iUS=pUS*mr;c.usedRD=Number(c.usedRD||0)+iRD;c.usedUS=Number(c.usedUS||0)+iUS;c.finIntRD=Number(c.finIntRD||0)+iRD;c.finIntUS=Number(c.finIntUS||0)+iUS;c.lastInterestCycle=cycle;applied++;}}});
 if(applied>0){saveData();toast(`💳 Interés por financiamiento aplicado a ${applied} tarjeta(s).`);}}
function renderAlerts(){const area=document.getElementById('alertArea');const s=calcSummary(currentMonthMovements());const carry=balanceBefore(firstDayOfMonth());const avail=carry+s.available;const up=getUpcomingUnified(15);const upExp=up.filter(p=>p.kind==='expense').reduce((a,b)=>a+Number(b.amount||0),0);let html='';
 data.cards.forEach(c=>{const ci=cardCutInfo(c);const owed=cardOwedText(c);if(owed)html+=`<div class="banner"><span>💳 ${c.name}: debes ${owed} · corte ${ci.du===0?'hoy':`en ${ci.du} días`} · límite de pago ${c.payLimitDate?formatDateLabel(c.payLimitDate):'—'}.</span></div>`;});
 getUpcomingUnified(7).filter(p=>p.reminder!==false).slice(0,3).forEach(p=>{const btn=p.kind==='expense'?`<button onclick="openConvertFixed('${p.id}')">Registrar ahora</button>`:'';html+=`<div class="banner warning"><span>🔔 ${formatUpcomingLabel(p)}: ${p.name} (${formatMoney(p.amount)}).</span>${btn}</div>`;});
 getCardReminders().forEach(c=>{html+=`<div class="banner warning"><span>💳 ${c.name}: corte ${c.du===0?'hoy':`en ${c.du} días`}.</span></div>`;});
 if(!hasSample()&&data.movements.length===0)html+=`<div class="banner"><span>Registra tu primer ingreso para empezar.</span><button onclick="openMovementModal(null,'income')">Añadir</button></div>`;
 else if(avail<0)html+=`<div class="banner danger"><span>Tus salidas superaron tus ingresos este mes.</span></div>`;
 else if(upExp>avail&&avail>0)html+=`<div class="banner danger"><span>Próximos pagos (${formatMoney(upExp)}) superan tu disponible (${formatMoney(avail)}).</span></div>`;
 area.innerHTML=html;}
function cardOwedText(c){const parts=[];if(c.currency!=='US$'&&Number(c.usedRD||0)>0)parts.push('RD$'+fmt2(c.usedRD));if(c.currency!=='RD$'&&Number(c.usedUS||0)>0)parts.push('US$'+fmt2(c.usedUS));return parts.join(' + ');}
function renderHomePayments(){const up=getUpcomingUnified(15);const el=document.getElementById('homePaymentsList');if(!up.length){el.innerHTML='<div class="empty"><strong>Sin pendientes</strong>Registra fijos en "Presupuesto".</div>';return;}el.innerHTML=up.slice(0,5).map(p=>{const c=getCategory(p.categoryId);const inc=p.kind==='income';return `<div class="row" onclick="openConvertFixed('${p.id}')"><div class="row-left"><div class="row-icon" style="background:var(${c.bg});">${c.emoji}</div><div style="min-width:0;"><div class="row-title">${p.name}</div><div class="row-sub">${formatUpcomingLabel(p)}</div></div></div><div class="row-right"><div class="row-amount ${inc?'green':'red'}">${inc?'+':'-'} ${formatMoney(p.amount)}</div></div></div>`;}).join('');}
function renderHomeCategories(){const byCat=homeCategoryMap();const total=Object.values(byCat).reduce((a,b)=>a+b,0);document.getElementById('homeSpent').textContent=formatMoney(total);document.getElementById('homeSpentLabel').textContent=ui.dashMode==='current'?'Gastado este mes':ui.dashMode==='previous'?'Gastado el mes pasado':'Gastado en el rango';const el=document.getElementById('homeCategoryList');if(!total){el.innerHTML='<div class="empty"><strong>Sin gastos</strong></div>';return;}el.innerHTML=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([id,amt])=>{const c=getCategory(id);const pct=Math.min(100,Math.round(amt/total*100));return `<div class="row" onclick="openCategoryDetail('${id}')"><div class="row-left"><div class="row-icon" style="background:var(${c.bg});">${c.emoji}</div><div class="cat-value"><div class="row-title">${c.name}</div><div class="progress"><span style="width:${pct}%;background:${c.color};"></span></div></div></div><div class="row-right"><div class="row-amount">${formatMoney(amt)}</div></div></div>`;}).join('');}
function renderInsights(){const cur=currentMonthMovements();const prev=previousMonthMovements();const sC=calcSummary(cur),sP=calcSummary(prev);const byCat=expenseByCategoryList(cur);const ins=[];const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];if(top)ins.push(`Tu mayor gasto es ${getCategory(top[0]).name}: ${formatMoney(top[1])}`);if(sC.income>0){const r=Math.round(((balanceBefore(firstDayOfMonth())+sC.available)/sC.income)*100);ins.push(r>=0?`Conservas el ${r}% de lo que entra.`:'Gastas más de lo que entra.');}if(sP.expense)ins.push(`Mes pasado salió ${formatMoney(sP.expense+sP.transfer)}.`);if(!ins.length)ins.push('Registra movimientos.');document.getElementById('insightList').innerHTML=ins.map(t=>`<div class="row" style="cursor:default;"><div class="row-left"><div class="row-icon" style="background:var(--blue-soft);">💡</div><div style="min-width:0;"><div class="row-title" style="font-weight:600;white-space:normal;">${t}</div></div></div></div>`).join('');}
function renderCompareChart(){const cur=expenseByCategoryList(currentMonthMovements());const prev=expenseByCategoryList(previousMonthMovements());const allCats=[...new Set([...Object.keys(cur),...Object.keys(prev)])];const entries=allCats.map(id=>({id,name:getCategory(id).name,curr:Number(cur[id]||0),prev:Number(prev[id]||0)})).filter(e=>e.curr>0||e.prev>0).sort((a,b)=>(b.curr+b.prev)-(a.curr+a.prev));const maxVal=Math.max(1,...entries.flatMap(e=>[e.curr,e.prev]));const el=document.getElementById('compareChart');if(!entries.length){el.innerHTML='<div class="empty"><strong>Sin datos para comparar</strong></div>';return;}el.innerHTML=entries.slice(0,6).map(e=>{const pctPrev=(e.prev/maxVal*100).toFixed(1);const pctCurr=(e.curr/maxVal*100).toFixed(1);const diff=e.curr-e.prev;const diffClass=diff>0?'red':(diff<0?'green':'');const diffLabel=diff>0?`+${formatMoney(diff)}`:(diff<0?`−${formatMoney(Math.abs(diff))}`:'=');return `<div class="compare-row"><div class="compare-row-label"><span class="name">${e.name}</span><span class="amounts"><span class="${diffClass}">${diffLabel}</span></span></div><div class="compare-bars"><div class="compare-bar prev"><span style="width:${pctPrev}%"></span></div><div class="compare-bar curr"><span style="width:${pctCurr}%"></span></div></div></div>`;}).join('');}
function renderCategoryFilter(){document.getElementById('categoryFilter').innerHTML=`<option value="">Todas</option>`+data.categories.filter(c=>!c.archived).map(c=>`<option value="${c.id}" ${c.id===ui.categoryId?'selected':''}>${c.emoji} ${c.name}</option>`).join('');}
function renderBudgetModule(){
  const f=data.fixeds;
  const inc=f.filter(p=>p.kind==='income'&&p.active!==false);
  const exp=f.filter(p=>p.kind==='expense'&&p.active!==false);
  const incoming=inc.reduce((a,p)=>a+Number(p.amount||0)*(p.days.length||1),0);
  const outgoing=exp.reduce((a,p)=>a+Number(p.amount||0)*(p.days.length||1),0);
  
  const avail=incoming-outgoing;
  
  document.getElementById('budgetAvailable').textContent=formatMoney(avail);
  document.getElementById('budgetAvailable').className='value '+(avail>=0?'green':'red');
  document.getElementById('budgetIncoming').textContent='+'+formatMoney(incoming);
  document.getElementById('budgetIncoming').className='green';
  document.getElementById('budgetOutgoing').textContent='-'+formatMoney(outgoing);
  document.getElementById('budgetOutgoing').className='red';
  document.getElementById('fixedIncomeList').innerHTML=inc.length?inc.map(p=>fixedRow2(p,'income')).join(''):'<div class="empty"><strong>Sin ingresos fijos</strong></div>';
  document.getElementById('fixedExpenseList').innerHTML=exp.length?exp.map(p=>fixedRow2(p,'expense')).join(''):'<div class="empty"><strong>Sin gastos fijos</strong></div>';
  renderCatTotals();
}
function fixedRow2(p,kind){const c=getCategory(p.categoryId);const isInc=kind==='income';const amtCls=isInc?'green':'salmon';const sign=isInc?'+':'-';const days=(p.days||[]).join(', ');
 return `<div class="frow2"><div class="frow2-icon" style="background:${hexA(c)}">${c.emoji}</div><div class="frow2-mid"><div class="frow2-name">${esc(p.name)}</div><div class="frow2-sub">${esc(c.name)}</div></div><div class="frow2-right"><div class="frow2-amt ${amtCls}">${sign}${formatMoney(p.amount)}</div><div class="frow2-day">Día ${days}</div></div><button class="frow2-menu" onclick="openFixedAction('${p.id}')">⋮</button></div>`;}
function openFixedAction(id){ui.fixedActionId=id;const p=data.fixeds.find(x=>x.id===id);document.getElementById('fixedActionTitle').textContent=p?esc(p.name):'Acciones';openModal('fixedActionModal');}
function fixedActionEdit(){closeModal('fixedActionModal');openFixedModal();}
function fixedActionConvert(){const id=ui.fixedActionId;closeModal('fixedActionModal');openConvertFixed(id);}
function fixedActionDelete(){const id=ui.fixedActionId;if(!confirm('¿Eliminar este compromiso fijo?'))return;data.fixeds=data.fixeds.filter(p=>p.id!==id);saveData();render();closeModal('fixedActionModal');toast('Compromiso eliminado');}
function renderCatTotals(){const byCat=combinedExpenseByCategory(currentMonthKey());const entries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);const total=entries.reduce((a,e)=>a+e[1],0);const max=entries.length?entries[0][1]:1;
 document.getElementById('catTotalsList').innerHTML=entries.length?entries.map(([id,amt])=>{const c=getCategory(id);return `<div class="row"><div class="row-left"><div class="row-icon" style="background:var(${c.bg});">${c.emoji}</div><div style="min-width:0;"><div class="row-title">${c.name}</div></div></div><div class="row-right"><div class="row-amount">${formatMoney(amt)}</div><div class="row-balance">${total?Math.round(amt/total*100):0}%</div></div></div>`;}).join(''):'<div class="empty"><strong>Sin gastos este mes</strong></div>';
 document.getElementById('catChart').innerHTML=entries.length?entries.slice(0,8).map(([id,amt])=>{const c=getCategory(id);const w=(amt/max*100).toFixed(1);return `<div class="compare-row"><div class="compare-row-label"><span class="name">${c.emoji} ${c.name}</span><span class="amounts">${formatMoney(amt)}</span></div><div class="compare-bars"><div class="compare-bar curr"><span style="width:${w}%;background:${c.color}"></span></div></div></div>`;}).join(''):'<div class="empty"><strong>Sin datos</strong></div>';}
function openFixedModal(){fixedBuffers.expense=data.fixeds.filter(p=>p.kind==='expense').map(p=>({id:p.id,name:p.name,amount:p.amount,categoryId:p.categoryId,days:[...(p.days||[])]}));fixedBuffers.income=data.fixeds.filter(p=>p.kind==='income').map(p=>({id:p.id,name:p.name,amount:p.amount,categoryId:p.categoryId,days:[...(p.days||[])]}));if(!fixedBuffers.expense.length)fixedBuffers.expense.push({id:uid(),name:'',amount:'',categoryId:'',days:[]});if(!fixedBuffers.income.length)fixedBuffers.income.push({id:uid(),name:'',amount:'',categoryId:'',days:[]});document.getElementById('fixedActiveCheck').checked=true;document.getElementById('fixedReminderCheck').checked=true;setFixedKind('expense');openModal('fixedModal');}
function setFixedKind(k){ui.fixedKind=k;document.getElementById('fixedTypeIncome').classList.toggle('active',k==='income');document.getElementById('fixedTypeExpense').classList.toggle('active',k==='expense');document.getElementById('addRowLabel').textContent=k==='expense'?'gasto':'ingreso';document.getElementById('fixedModalTitle').textContent=k==='expense'?'Registro de gastos múltiples':'Registro de ingresos múltiples';renderFixedRows();}
function addFixedRow(){fixedBuffers[ui.fixedKind].push({id:uid(),name:'',amount:'',categoryId:'',days:[]});renderFixedRows();}
function updateFixedRow(i,field,val){fixedBuffers[ui.fixedKind][i][field]=val;}
function removeFixedRow(i){fixedBuffers[ui.fixedKind].splice(i,1);renderFixedRows();}
function renderFixedRows(){const rows=fixedBuffers[ui.fixedKind];const cats=data.categories.filter(c=>c.type===ui.fixedKind&&!c.archived);
 document.getElementById('fixedRows').innerHTML=rows.map((r,i)=>`<div class="fixed-row"><input value="${esc(r.name)}" placeholder="Nuevo ${ui.fixedKind==='expense'?'gasto':'ingreso'}..." oninput="updateFixedRow(${i},'name',this.value)"/><div class="fr-amt"><span>$</span><input value="${esc(r.amount)}" inputmode="decimal" placeholder="[Monto]" oninput="updateFixedRow(${i},'amount',this.value)"/></div><select onchange="updateFixedRow(${i},'categoryId',this.value)"><option value="">—</option>${cats.map(c=>`<option value="${c.id}" ${c.id===r.categoryId?'selected':''}>${c.emoji} ${c.name}</option>`).join('')}</select><button class="fr-day-btn" onclick="openDaysModal(${i})">${(r.days&&r.days.length)?r.days.join(', '):'Día'}</button><button class="fr-del" onclick="removeFixedRow(${i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button></div>`).join('');}
function openDaysModal(i){ui.daysTarget=i;ui.tempDays=[...(fixedBuffers[ui.fixedKind][i].days||[])];renderDaysGrid();openModal('daysModal');}
function renderDaysGrid(){const now=new Date();const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();let h='';for(let d=1;d<=last;d++){h+=`<button type="button" class="day-cell ${ui.tempDays.includes(d)?'sel':''}" onclick="toggleDay(${d})">${d}</button>`;}document.getElementById('daysGrid').innerHTML=h;}
function toggleDay(d){if(ui.tempDays.includes(d))ui.tempDays=ui.tempDays.filter(x=>x!==d);else ui.tempDays.push(d);renderDaysGrid();}
function confirmDays(){fixedBuffers[ui.fixedKind][ui.daysTarget].days=[...ui.tempDays].sort((a,b)=>a-b);renderFixedRows();closeModal('daysModal');}
function saveFixedBatch(){const active=document.getElementById('fixedActiveCheck').checked;const reminder=document.getElementById('fixedReminderCheck').checked;
 ['expense','income'].forEach(kind=>{const old=data.fixeds.filter(f=>f.kind===kind);const valid=fixedBuffers[kind].filter(r=>r.name&&r.name.trim()&&Number(r.amount)>0&&r.categoryId&&(r.days||[]).length).map(r=>{const prev=old.find(o=>o.id===r.id);return{id:r.id||uid(),name:r.name.trim(),amount:Number(r.amount),categoryId:r.categoryId,days:[...r.days].sort((a,b)=>a-b),active,reminder,kind,status:prev?prev.status:'pendiente',lastPaidMonth:prev?prev.lastPaidMonth:null,sample:false};});data.fixeds=data.fixeds.filter(f=>f.kind!==kind).concat(valid);});
 saveData();render();closeModal('fixedModal');toast('Presupuesto guardado');}
function openConvertFixed(id){const p=data.fixeds.find(x=>x.id===id);if(!p)return;ui.convertFixedId=id;document.getElementById('convertFixedName').value=p.name;document.getElementById('convertFixedAmount').value=`${p.kind==='income'?'+':'-'} ${formatMoney(p.amount)}`;document.getElementById('convertFixedDate').value=isoDate();document.getElementById('convertFixedMarkPaid').checked=true;document.getElementById('convertFixedHelp').textContent=`Se registrará una ocasión de "${p.name}" como ${p.kind==='income'?'ingreso':'gasto'} real.`;openModal('convertFixedModal');}
function confirmConvertFixed(){const p=data.fixeds.find(x=>x.id===ui.convertFixedId);if(!p)return;const date=document.getElementById('convertFixedDate').value||isoDate();const mark=document.getElementById('convertFixedMarkPaid').checked;pushMovement({type:p.kind==='income'?'income':'expense',amount:Number(p.amount),categoryId:p.categoryId,note:p.name,date,sample:false});if(mark){p.status='pagado';p.lastPaidMonth=currentMonthKey();}saveData();render();closeModal('convertFixedModal');toast('Registrado correctamente');}
function parseAmountRaw(s){s=String(s).trim().replace(/[RD\$US\s]/gi,'');if(!s)return null;
 const hasComma=s.includes(','),hasDot=s.includes('.');
 if(hasComma&&hasDot){ if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/,/g,''); }
 else if(hasComma){ const parts=s.split(','); if(parts.length===2&&parts[1].length<=2) s=s.replace(',','.'); else s=s.replace(/,/g,''); }
 else if(hasDot){ const parts=s.split('.'); if(parts.length>2) s=s.replace(/\./g,''); else if(parts[1].length===3) s=s.replace('.',''); }
 const n=parseFloat(s); return (isNaN(n)||n<=0)?null:n;}
function ocrLines(text){return String(text).split(/\n+/).map(l=>l.trim()).filter(Boolean);}
function ocrFind(text,keywords){const lines=ocrLines(text);
 for(const kw of keywords){ const re=new RegExp(kw,'i');
   for(const line of lines){ if(re.test(line)){ const nums=line.match(/\d[\d.,]*/g); if(nums&&nums.length){ const parsed=nums.map(parseAmountRaw).filter(n=>n!==null); if(parsed.length) return parsed[parsed.length-1]; } } } }
 return null;}
function allNums(text){return (String(text).match(/\d[\d.,]*/g)||[]).map(parseAmountRaw).filter(n=>n!==null).sort((a,b)=>b-a);}
async function runOCR(file){ if(typeof Tesseract==='undefined'){toast('OCR no disponible (sin conexión).');return '';} try{const{data:{text}}=await Tesseract.recognize(file,'spa');return text||'';}catch(e){toast('No se pudo leer la imagen.');return '';}}
async function ocrCard(ev){const input=ev.target;const file=input.files[0];input.value='';if(!file)return;
 toast('Procesando captura… puede tardar unos segundos',8000);
 const text=await runOCR(file);if(!text)return;
 const lim=ocrFind(text,['l[íi]mite de cr[ée]dito','l[íi]mite','l[íi]nea de cr[ée]dito','monto de cr[ée]dito']);
 const used=ocrFind(text,['saldo deudor','saldo actual','balance deudor','consumido','total debido']);
 const disp=ocrFind(text,['disponible']);
 let filled=0;
 if(lim){document.getElementById('cardLimitRD').value=lim;filled++;}
 if(used){document.getElementById('cardUsedRD').value=used;filled++;}
 else if(disp&&lim){document.getElementById('cardUsedRD').value=Math.max(0,lim-disp);filled++;}
 if(!filled){const nums=allNums(text);if(nums[0]){document.getElementById('cardLimitRD').value=nums[0];filled++;}if(nums[1]){document.getElementById('cardUsedRD').value=nums[1];filled++;}}
 toast(filled?`Captura leída: ${filled} campo(s) completados. Revísalos.`:'No encontré montos claros en la captura.');}
async function ocrLoan(ev){const input=ev.target;const file=input.files[0];input.value='';if(!file)return;
 toast('Procesando captura… puede tardar unos segundos',8000);
 const text=await runOCR(file);if(!text)return;
 const bal=ocrFind(text,['saldo (actual|deudor|pendiente)','balance','saldo']);
 const cuota=ocrFind(text,['cuota','mensualidad']);
 const cap=ocrFind(text,['capital']);
 const inte=ocrFind(text,['inter[ée]s']);
 let filled=0;
 if(bal){document.getElementById('blBalance').value=bal;filled++;}
 if(cuota){document.getElementById('blInstallment').value=cuota;filled++;}
 if(cap){document.getElementById('blInstCapital').value=cap;filled++;}
 if(inte){document.getElementById('blInstInterest').value=inte;filled++;}
 if(!filled){const nums=allNums(text);if(nums[0]){document.getElementById('blBalance').value=nums[0];filled++;}}
 toast(filled?`Captura leída: ${filled} campo(s) completados. Revísalos.`:'No encontré montos claros en la captura.');}
function applyCardTx(c,tx,dir){if(tx.type==='consume'){c.usedRD=Math.max(0,Number(c.usedRD||0)+Number(tx.rd||0)*dir);c.usedUS=Math.max(0,Number(c.usedUS||0)+Number(tx.us||0)*dir);}else{c.usedRD=Math.max(0,Number(c.usedRD||0)-Number(tx.rd||0)*dir);c.usedUS=Math.max(0,Number(c.usedUS||0)-Number(tx.us||0)*dir);}c.updatedAt=Date.now();}
function openCardTx(type,editId){const c=data.cards.find(x=>x.id===ui.editingCardId)||data.cards.find(x=>x.id===ui.cardStmtId);if(!c)return;ui.cardTxType=type;ui.cardTxEditId=editId||null;const tx=editId?(c.transactions.find(t=>t.id===editId)||null):null;document.getElementById('cardTxTitle').textContent=type==='consume'?'Registrar consumo':'Registrar pago';document.getElementById('cardTxRD').value=tx?tx.rd:'';document.getElementById('cardTxUS').value=tx?tx.us:'';document.getElementById('cardTxDate').value=tx?tx.date:isoDate();document.getElementById('cardTxNote').value=tx?(tx.note||''):'';openModal('cardTxModal');}
function confirmCardTx(){const c=data.cards.find(x=>x.id===ui.editingCardId)||data.cards.find(x=>x.id===ui.cardStmtId);if(!c)return;const rd=parseFloat(document.getElementById('cardTxRD').value)||0;const us=parseFloat(document.getElementById('cardTxUS').value)||0;if(rd<=0&&us<=0)return toast('Escribe al menos un monto.');const date=document.getElementById('cardTxDate').value||isoDate();const note=document.getElementById('cardTxNote').value.trim();
 if(ui.cardTxEditId){const old=c.transactions.find(t=>t.id===ui.cardTxEditId);if(old){applyCardTx(c,old,-1);Object.assign(old,{rd,us,date,note,type:ui.cardTxType});applyCardTx(c,old,1);}}
 else{const tx={id:uid(),type:ui.cardTxType,rd,us,date,note};c.transactions=c.transactions||[];c.transactions.push(tx);applyCardTx(c,tx,1);}
 saveData();render();renderCardStatement();closeModal('cardTxModal');toast('Registrado correctamente');}
function openCardStatement(id){ui.cardStmtId=id;renderCardStatement();openModal('cardStatementModal');}
function renderCardStatement(){const c=data.cards.find(x=>x.id===ui.cardStmtId);if(!c)return;const txs=[...(c.transactions||[])].sort((a,b)=>b.date.localeCompare(a.date));const totPay=txs.filter(t=>t.type==='pay').reduce((a,t)=>a+Number(t.rd||0)+Number(t.us||0),0);const totCon=txs.filter(t=>t.type==='consume').reduce((a,t)=>a+Number(t.rd||0)+Number(t.us||0),0);document.getElementById('cardStatementSummary').innerHTML=`${c.name} · Consumido: <strong class="red">${cardOwedText(c)}</strong> · Pagado: <strong class="green">${formatMoney(totPay)}</strong> · Consumos: <strong>${formatMoney(totCon)}</strong>`;document.getElementById('cardStatementList').innerHTML=txs.length?txs.map(t=>`<div class="row"><div class="row-left"><div class="row-icon" style="background:${t.type==='pay'?'var(--green-soft)':'var(--pink-soft)'};">${t.type==='pay'?'💳':'🛒'}</div><div style="min-width:0;"><div class="row-title">${t.note||(t.type==='pay'?'Pago':'Consumo')}</div><div class="row-sub">${formatDateLabel(t.date)}${(t.rd&&t.us)?` · RD$${fmt2(t.rd)} + US$${fmt2(t.us)}`:(t.rd?` · RD$${fmt2(t.rd)}`:` · US$${fmt2(t.us)}`)}</div></div></div><div class="row-right"><div class="row-amount ${t.type==='pay'?'green':'red'}">${t.type==='pay'?'-':'+'}${t.rd?fmt2(t.rd):''}${t.rd&&t.us?' + ':''}${t.us?fmt2(t.us):''}</div><div class="row-actions"><button class="btn secondary icon" onclick="openCardTx('${t.type}','${t.id}')">✎</button><button class="btn secondary icon" onclick="deleteCardTx('${t.id}')">🗑</button></div></div></div>`).join(''):'<div class="empty"><strong>Sin movimientos</strong>Usa "Consumido" o "Pagado".</div>';}
function deleteCardTx(id){const c=data.cards.find(x=>x.id===ui.cardStmtId);if(!c)return;const tx=c.transactions.find(t=>t.id===id);if(!tx)return;if(!confirm('¿Borrar este movimiento?'))return;applyCardTx(c,tx,-1);c.transactions=c.transactions.filter(t=>t.id!==id);saveData();render();renderCardStatement();toast('Movimiento borrado');}
function toggleCardCurrencyFields(){const v=document.getElementById('cardCurrency').value;document.getElementById('cardRDFields').classList.toggle('hidden',v==='US$');document.getElementById('cardUSFields').classList.toggle('hidden',v==='RD$');}
function openCardModal(id=null){ui.editingCardId=id;const c=id?data.cards.find(x=>x.id===id):null;document.getElementById('cardModalTitle').textContent=c?'Editar tarjeta':'Nueva tarjeta';document.getElementById('cardNameInput').value=c?c.name:'';document.getElementById('cardCurrency').value=c?c.currency:'RD$';document.getElementById('cardLimitRD').value=c?c.limitRD:'';document.getElementById('cardUsedRD').value=c?c.usedRD:'';document.getElementById('cardLastCutRD').value=c?c.lastCutRD:'';document.getElementById('cardLimitUS').value=c?c.limitUS:'';document.getElementById('cardUsedUS').value=c?c.usedUS:'';document.getElementById('cardLastCutUS').value=c?c.lastCutUS:'';document.getElementById('cardLastCutDate').value=c?c.lastCutDate:'';document.getElementById('cardPayLimit').value=c?c.payLimitDate:'';document.getElementById('cardRate').value=c?c.annualRate:'';document.getElementById('cardReminderCheck').checked=c?c.reminder!==false:true;document.getElementById('deleteCardBtn').classList.toggle('hidden',!c);let h='';for(let d=1;d<=31;d++)h+=`<option value="${d}">Día ${d}</option>`;document.getElementById('cardCutInput').innerHTML=h;if(c)document.getElementById('cardCutInput').value=c.cutDay;toggleCardCurrencyFields();openModal('cardModal');}
function saveCard(){const name=document.getElementById('cardNameInput').value.trim();if(!name)return toast('Nombre');const currency=document.getElementById('cardCurrency').value;
 const card={id:ui.editingCardId||uid(),name,currency,limitRD:currency==='US$'?0:Number(document.getElementById('cardLimitRD').value||0),usedRD:currency==='US$'?0:Number(document.getElementById('cardUsedRD').value||0),lastCutRD:currency==='US$'?0:Number(document.getElementById('cardLastCutRD').value||0),limitUS:currency==='RD$'?0:Number(document.getElementById('cardLimitUS').value||0),usedUS:currency==='RD$'?0:Number(document.getElementById('cardUsedUS').value||0),lastCutUS:currency==='RD$'?0:Number(document.getElementById('cardLastCutUS').value||0),cutDay:parseInt(document.getElementById('cardCutInput').value,10)||1,lastCutDate:document.getElementById('cardLastCutDate').value||'',payLimitDate:document.getElementById('cardPayLimit').value||'',annualRate:Number(document.getElementById('cardRate').value||0),finIntRD:0,finIntUS:0,lastInterestCycle:null,reminder:document.getElementById('cardReminderCheck').checked,paidCycle:null,updatedAt:Date.now(),transactions:[],sample:false};
 if(ui.editingCardId){const ex=data.cards.find(x=>x.id===ui.editingCardId);card.finIntRD=ex.finIntRD;card.finIntUS=ex.finIntUS;card.lastInterestCycle=ex.lastInterestCycle;card.paidCycle=ex.paidCycle;card.transactions=ex.transactions||[];const i=data.cards.findIndex(x=>x.id===ui.editingCardId);if(i>=0)data.cards[i]=card;}else data.cards.push(card);
 saveData();render();closeModal('cardModal');toast('Registrado correctamente');}
function deleteCard(){if(!ui.editingCardId||!confirm('¿Borrar?'))return;data.cards=data.cards.filter(c=>c.id!==ui.editingCardId);saveData();render();closeModal('cardModal');}
function openLoanPayModal(id){ui.loanPayId=id;document.getElementById('loanPayAmount').value='';openModal('loanPayModal');}
function confirmLoanPay(){const b=data.bankLoans.find(x=>x.id===ui.loanPayId);if(!b)return;const P=parseFloat(document.getElementById('loanPayAmount').value);if(!P||P<=0)return toast('Monto inválido');
 const inst=Number(b.installment)||0;const capConf=Number(b.installmentCapital)||0;const ratio=inst>0?(capConf/inst):0;const capital=P*ratio;const interest=P-capital;
 b.balance=Math.max(0,Number(b.balance)-capital);b.paidInterest=Number(b.paidInterest||0)+interest;
 b.payments=b.payments||[];b.payments.push({id:uid(),date:isoDate(),total:P,capital,interest});
 if(b.balance<=0)b.status='paid';
 saveData();render();closeModal('loanPayModal');toast('Registrado correctamente');}
function openLoanStatement(id){ui.loanStmtId=id;renderLoanStatement();openModal('loanStatementModal');}
function renderLoanStatement(){const b=data.bankLoans.find(x=>x.id===ui.loanStmtId);if(!b)return;const pays=[...(b.payments||[])].sort((a,b2)=>b2.date.localeCompare(a.date));const totCap=pays.reduce((a,p)=>a+Number(p.capital||0),0);const totInt=pays.reduce((a,p)=>a+Number(p.interest||0),0);document.getElementById('loanStatementSummary').innerHTML=`${b.entity} · Saldo actual: <strong class="red">${formatMoney(b.balance)}</strong> · Capital abonado: <strong>${formatMoney(totCap)}</strong> · Intereses: <strong>${formatMoney(totInt)}</strong>`;document.getElementById('loanStatementList').innerHTML=pays.length?pays.map(p=>`<div class="row"><div class="row-left"><div class="row-icon" style="background:var(--blue-soft);">🏦</div><div style="min-width:0;"><div class="row-title">Cuota pagada</div><div class="row-sub">${formatDateLabel(p.date)} · capital ${formatMoney(p.capital)} + interés ${formatMoney(p.interest)}</div></div></div><div class="row-right"><div class="row-amount">${formatMoney(p.total)}</div></div></div>`).join(''):'<div class="empty"><strong>Sin pagos registrados</strong></div>';}
function renderCredits(){
  renderCreditBank();
  renderCreditPersonal();
  renderCreditCards();
}
function renderCreditBank(){const list=data.bankLoans||[];document.getElementById('bankLoanTotal').textContent=formatMoney(list.filter(b=>b.status!=='paid').reduce((a,b)=>a+Number(b.balance||0),0));document.getElementById('bankLoanInterest').textContent=formatMoney(list.reduce((a,b)=>a+Number(b.paidInterest||0),0));const el=document.getElementById('bankLoansList');if(!list.length){el.innerHTML='<div class="empty"><strong>Sin préstamos bancarios</strong></div>';return;}el.innerHTML=list.map(b=>{const paid=b.status==='paid',over=b.status==='overdue';const cls=over?'overdue':(paid?'paid':'active');const st=over?'Vencido':(paid?'Pagado':'Activo');const pct=b.principal>0?Math.min(100,Math.round((1-Number(b.balance)/Number(b.principal))*100)):0;const du=daysUntil(getNextPaymentDate(b.dueDay));const rem=paid?'':(du===0?'<div class="fi-reminder today" style="margin-top:6px">Cuota hoy</div>':du<=7?`<div class="fi-reminder soon" style="margin-top:6px">En ${du} días</div>`:`<div class="fi-reminder" style="margin-top:6px">Día ${b.dueDay}</div>`);return `<div class="loan-card ${cls}"><div class="loan-head"><div><div class="loan-entity">${esc(b.entity)||'Sin nombre'}</div><div class="row-sub">${{personal:'Personal',auto:'Automotriz',mortgage:'Hipotecario',student:'Educativo',business:'Empresarial',other:'Otro'}[b.kind]||b.kind}</div></div><span class="loan-status ${cls}">${st}</span></div><div class="loan-body"><div class="loan-row"><span class="k">Saldo actual</span><span class="v red">${formatMoney(b.balance)}</span></div><div class="loan-row"><span class="k">Original</span><span class="v">${formatMoney(b.principal)}</span></div><div class="loan-row"><span class="k">Vencimiento</span><span class="v">${b.maturityDate?formatDateLabel(b.maturityDate):'—'}</span></div><div class="loan-row"><span class="k">Cuota (cap+int)</span><span class="v">${formatMoney(b.installment)} (${formatMoney(b.installmentCapital)}+${formatMoney(b.installmentInterest)})</span></div><div class="loan-row"><span class="k">Intereses pagados</span><span class="v">${formatMoney(b.paidInterest)}</span></div><div class="progress" style="margin-top:8px;"><span style="width:${pct}%;background:${paid?'var(--green)':over?'var(--red)':'var(--accent)'};"></span></div><div class="row-sub" style="margin-top:4px;">${pct}% amortizado</div>${rem}</div><div class="loan-actions">${!paid?`<button class="btn secondary mini" onclick="openLoanPayModal('${b.id}')">Pagar cuota</button>`:''}<button class="btn secondary mini" onclick="openLoanStatement('${b.id}')">Estado</button><button class="btn secondary mini" onclick="openBankLoanModal('${b.id}')">Editar</button></div></div>`;}).join('');}
function renderCreditPersonal(){const owed=data.loans.filter(l=>l.dir==='owedToMe').reduce((a,l)=>a+Number(l.remaining||0),0);const owe=data.loans.filter(l=>l.dir==='iOwe').reduce((a,l)=>a+Number(l.remaining||0),0);document.getElementById('loanOwedToMe').textContent=formatMoney(owed);document.getElementById('loanIOwe').textContent=formatMoney(owe);const el=document.getElementById('loansList');if(!data.loans.length){el.innerHTML='<div class="empty"><strong>Sin préstamos personales</strong></div>';return;}el.innerHTML=data.loans.map(l=>{const done=Number(l.remaining)<=0;return `<div class="row" onclick="openLoanModal('${l.id}')"><div class="row-left"><div class="row-icon" style="background:var(${l.dir==='owedToMe'?'--green-soft':'--pink-soft'});">🤝</div><div style="min-width:0;"><div class="row-title">${esc(l.person)}${done?' · saldado':''}</div><div class="row-sub">${l.dir==='owedToMe'?'Te debe':'Le debes'} · ${formatDateLabel(l.date)}</div></div></div><div class="row-right"><div class="row-amount ${l.dir==='owedToMe'?'green':'red'}">${formatMoney(l.remaining)}</div>${!done?`<div class="row-actions"><button class="btn secondary icon" onclick="event.stopPropagation();loanAbono('${l.id}')">💵</button></div>`:''}</div></div>`;}).join('');}
function renderCreditCards(){const el=document.getElementById('cardsList');if(!data.cards.length){el.innerHTML='<div class="empty"><strong>Sin tarjetas</strong></div>';return;}el.innerHTML=data.cards.map(c=>{const showRD=c.currency!=='US$',showUS=c.currency!=='RD$';const pctRD=c.limitRD>0?Math.min(100,Math.round(Number(c.usedRD||0)/Number(c.limitRD)*100)):0;const pctUS=c.limitUS>0?Math.min(100,Math.round(Number(c.usedUS||0)/Number(c.limitUS)*100)):0;const ci=cardCutInfo(c);const curChip=c.currency==='dual'?'RD$+US$':c.currency;return `<div class="card-tile"><div class="card-tile-head"><div><div class="card-tile-name">${esc(c.name)}<span class="cur-chip">${curChip}</span></div><div class="card-tile-sub">Corte día ${c.cutDay}</div></div><button class="btn secondary mini" onclick="openCardModal('${c.id}')">✎ Editar</button></div><div class="card-tile-info">${showRD?`<div class="card-info-cell"><div class="k">Consumido RD$</div><div class="v red">${fmt2(c.usedRD)}</div><div class="k" style="margin-top:4px">Límite</div><div class="v">${fmt2(c.limitRD)}</div></div>`:''}${showUS?`<div class="card-info-cell"><div class="k">Consumido US$</div><div class="v red">${fmt2(c.usedUS)}</div><div class="k" style="margin-top:4px">Límite</div><div class="v">${fmt2(c.limitUS)}</div></div>`:''}<div class="card-info-cell"><div class="k">Saldo pendiente último corte</div><div class="v">${showRD?fmt2(c.lastCutRD||0):''}${showRD&&showUS&&Number(c.lastCutRD)>0&&Number(c.lastCutUS)>0?' + ':''}${showUS?fmt2(c.lastCutUS||0):''}</div></div><div class="card-info-cell"><div class="k">Fecha límite de pago</div><div class="v ${c.payLimitDate&&new Date(c.payLimitDate)<new Date()?'red':''}">${c.payLimitDate?formatDateLabel(c.payLimitDate):'—'}</div></div></div>${showRD?`<div class="progress" style="margin-top:8px;"><span style="width:${pctRD}%;background:${pctRD>=90?'var(--red)':pctRD>=50?'#f59e0b':'var(--green)'};"></span></div>`:''}${showUS?`<div class="progress" style="margin-top:4px;"><span style="width:${pctUS}%;background:${pctUS>=90?'var(--red)':pctUS>=50?'#f59e0b':'var(--green)'};"></span></div>`:''}<div class="card-tile-actions"><button class="btn secondary" onclick="ui.editingCardId='${c.id}';openCardTx('consume')">Consumido</button><button class="btn primary" onclick="ui.editingCardId='${c.id}';openCardTx('pay')">Pagado</button><button class="btn secondary" onclick="openCardStatement('${c.id}')">Estado</button></div></div>`;}).join('');}
function openLoanModal(id=null){ui.editingLoanId=id;const l=id?data.loans.find(x=>x.id===id):null;document.getElementById('loanModalTitle').textContent=l?'Editar':'Préstamo personal';document.getElementById('loanPerson').value=l?l.person:'';document.getElementById('loanDir').value=l?l.dir:'owedToMe';document.getElementById('loanAmount').value=l?l.amount:'';document.getElementById('loanDate').value=l?l.date:isoDate();document.getElementById('loanNote').value=l?(l.note||''):'';document.getElementById('deleteLoanBtn').classList.toggle('hidden',!l);openModal('loanModal');}
function saveLoan(){const person=document.getElementById('loanPerson').value.trim(),dir=document.getElementById('loanDir').value,amount=parseFloat(document.getElementById('loanAmount').value),date=document.getElementById('loanDate').value||isoDate(),note=document.getElementById('loanNote').value.trim();if(!person)return toast('Nombre');if(!amount||amount<=0)return toast('Monto inválido');if(ui.editingLoanId){const l=data.loans.find(x=>x.id===ui.editingLoanId);if(l){l.person=person;l.dir=dir;l.amount=Number(amount);l.date=date;l.note=note;}}else pushLoan({person,dir,amount:Number(amount),date,note});saveData();render();closeModal('loanModal');toast('Registrado correctamente');}
function deleteLoan(){if(!ui.editingLoanId||!confirm('¿Borrar?'))return;data.loans=data.loans.filter(l=>l.id!==ui.editingLoanId);saveData();render();closeModal('loanModal');}
function loanAbono(id){const l=data.loans.find(x=>x.id===id);if(!l)return;const v=prompt(`Abono a ${l.person} (restante ${formatMoney(l.remaining)}):`,l.remaining);if(v===null)return;const n=parseFloat(v);if(isNaN(n)||n<=0)return toast('Inválido');l.payments.push({date:isoDate(),amount:n});l.remaining=Math.max(0,l.remaining-n);saveData();render();toast(Number(l.remaining)<=0?'Saldado':'Abono registrado');}
function openBankLoanModal(id=null){ui.editingBankLoanId=id;const b=id?data.bankLoans.find(x=>x.id===id):null;document.getElementById('bankLoanModalTitle').textContent=b?'Editar':'Préstamo bancario';document.getElementById('blEntity').value=b?b.entity:'';document.getElementById('blKind').value=b?b.kind:'personal';document.getElementById('blPrincipal').value=b?b.principal:'';document.getElementById('blBalance').value=b?b.balance:'';document.getElementById('blRate').value=b?b.rate:'';document.getElementById('blInstallment').value=b?b.installment:'';document.getElementById('blInstCapital').value=b?b.installmentCapital:'';document.getElementById('blInstInterest').value=b?b.installmentInterest:'';document.getElementById('blMaturity').value=b?b.maturityDate:'';document.getElementById('blStatus').value=b?b.status:'active';document.getElementById('blDeleteBtn').classList.toggle('hidden',!b);let h='';for(let d=1;d<=31;d++)h+=`<option value="${d}" ${b&&b.dueDay===d?'selected':''}>Día ${d}</option>`;document.getElementById('blDueDay').innerHTML=h;openModal('bankLoanModal');}
function saveBankLoan(){const entity=document.getElementById('blEntity').value.trim(),kind=document.getElementById('blKind').value,principal=parseFloat(document.getElementById('blPrincipal').value)||0,balance=parseFloat(document.getElementById('blBalance').value)||0,rate=parseFloat(document.getElementById('blRate').value)||0,installment=parseFloat(document.getElementById('blInstallment').value)||0,installmentCapital=parseFloat(document.getElementById('blInstCapital').value)||0,installmentInterest=parseFloat(document.getElementById('blInstInterest').value)||0,dueDay=parseInt(document.getElementById('blDueDay').value,10)||1,maturityDate=document.getElementById('blMaturity').value||'',status=document.getElementById('blStatus').value;if(!entity)return toast('Entidad');if(principal<=0)return toast('Monto inválido');const ex=ui.editingBankLoanId?data.bankLoans.find(b=>b.id===ui.editingBankLoanId):null;const bl={id:ui.editingBankLoanId||uid(),entity,kind,principal:Number(principal),balance:Number(balance),rate:Number(rate),installment:Number(installment),installmentCapital:Number(installmentCapital),installmentInterest:Number(installmentInterest),dueDay,maturityDate,status,paidInterest:ex?.paidInterest||0,payments:ex?.payments||[]};if(ui.editingBankLoanId){const i=data.bankLoans.findIndex(b=>b.id===ui.editingBankLoanId);if(i>=0)data.bankLoans[i]=bl;}else data.bankLoans.push(bl);saveData();render();closeModal('bankLoanModal');toast('Registrado correctamente');}
function deleteBankLoan(){if(!ui.editingBankLoanId||!confirm('¿Borrar?'))return;data.bankLoans=data.bankLoans.filter(b=>b.id!==ui.editingBankLoanId);saveData();render();closeModal('bankLoanModal');}
function setCreditTab(t){ui.creditTab=t;const tabs=['bank','personal','cards'];document.querySelectorAll('#creditTabs .auth-tab').forEach((b,i)=>b.classList.toggle('active',tabs[i]===t));document.getElementById('creditBank').classList.toggle('hidden',t!=='bank');document.getElementById('creditPersonal').classList.toggle('hidden',t!=='personal');document.getElementById('creditCards').classList.toggle('hidden',t!=='cards');renderCredits();}
function statementPeriodText(){if(ui.period==='current')return 'Este mes';if(ui.period==='previous')return 'Mes pasado';if(ui.period==='month')return 'Mes: '+ui.month;if(ui.period==='range')return `${ui.from||'…'} → ${ui.to||'…'}`;return 'Todo';}
function openStatement(){renderMovements();openModal('statementModal');}
function renderMovements(){
  const el=document.getElementById('movementList');
  const list=getFilteredMovements();
  const s=calcSummary(list);
  document.getElementById('stIn').textContent='+'+formatMoney(s.income);
  document.getElementById('stOut').textContent='-'+formatMoney(s.expense+s.transfer);
  let init=0;
  if(list.length){const minD=list.reduce((a,m)=>m.date<a?m.date:a,list[0].date);init=balanceBefore(minD);}
  document.getElementById('stInitial').textContent=formatMoney(init);
  document.getElementById('stFinal').textContent=formatMoney(init+s.available);
  if(!list.length){el.innerHTML='<div class="empty"><strong>Sin movimientos</strong>Regístralos desde Inicio.</div>';return;}
  const run=runningBalanceMap();
  const g={};
  list.forEach(m=>{(g[m.date]=g[m.date]||[]).push(m);});
  el.innerHTML=Object.keys(g).sort((a,b)=>b.localeCompare(a)).map(date=>`<div class="date-group">${formatDateLabel(date)}</div>`+g[date].map(m=>{
    const c=getCategory(m.categoryId);
    const sign=m.type==='income'?'+':m.type==='transfer'?'→':'-';
    const cls=m.type==='income'?'green':m.type==='transfer'?'transfer':'red';
    return `<div class="row"><div class="row-left"><div class="row-icon" style="background:var(${c.bg});">${c.emoji}</div><div style="min-width:0;"><div class="row-title">${esc(m.note)||c.name}</div><div class="row-sub">${[c.name,m.merchant].filter(Boolean).join(' · ')} · ${TYPE_LABELS[m.type]}</div></div></div><div class="row-right"><div class="row-amount ${cls}">${sign} ${formatMoney(m.amount)}</div><div class="row-balance">Saldo: ${formatMoney(run[m.id]??0)}</div><div class="row-actions"><button class="btn secondary icon" onclick="requestEditMovement('${m.id}')">✎</button><button class="btn secondary icon" onclick="deleteMovementDirect('${m.id}')">🗑</button></div></div></div>`;
  }).join('')).join('');
}
function requestEditMovement(id) { closeModal('statementModal'); openMovementModal(id); }
function deleteMovementDirect(id) {
  if(!confirm('¿Seguro que quieres borrar este movimiento de forma permanente?')) return;
  data.movements = data.movements.filter(m=>m.id!==id);
  saveData(); render();
  if(document.getElementById('statementModal').classList.contains('open')) renderMovements();
  toast('Movimiento eliminado exitosamente');
}
function formatDateLabel(d){const t=isoDate();const y=isoDate(new Date(Date.now()-86400000));if(d===t)return 'Hoy';if(d===y)return 'Ayer';return new Date(d+'T00:00:00').toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'});}
function setPeriod(v){ui.period=v;document.getElementById('monthInput').classList.toggle('hidden',v!=='month');document.getElementById('rangeInputs').classList.toggle('hidden',v!=='range');renderMovements();}
function setMonth(v){ui.month=v;renderMovements();}
function setRange(){ui.from=document.getElementById('fromInput').value;ui.to=document.getElementById('toInput').value;renderMovements();}
function setTypeFilter(v){ui.type=v;renderMovements();}
function setCategoryFilter(v){ui.categoryId=v||null;renderMovements();}
function setSearch(v){ui.search=v;renderMovements();}
function openMovementModal(id=null,type='expense'){ui.editingId=id;const m=id?data.movements.find(x=>x.id===id):null;ui.movementType=m?m.type:type;ui.selectedCategory=m?m.categoryId:(data.categories.find(c=>c.type===(ui.movementType==='income'?'income':'expense')&&!c.archived)?.id||null);ui.selectedSub=m?m.subId:null;document.getElementById('movementModalTitle').textContent=m?'Editar movimiento':'Nuevo movimiento';document.getElementById('amountInput').value=m?m.amount:'';document.getElementById('dateInput').value=m?m.date:isoDate();document.getElementById('noteInput').value=m?(m.note||''):'';document.getElementById('merchantInput').value=m?(m.merchant||''):'';document.getElementById('deleteMovementBtn').classList.toggle('hidden',!m);document.getElementById('merchantList').innerHTML=[...new Set(data.movements.map(x=>x.merchant).filter(Boolean))].map(x=>`<option value="${x}">`).join('');updateMovementTypeUI();renderCategoryChips();renderSubChips();openModal('movementModal');}
function openMovementModalForEdit(id){openMovementModal(id);}
function setMovementType(t){ui.movementType=t;ui.selectedCategory=data.categories.find(c=>c.type===(t==='income'?'income':'expense')&&!c.archived)?.id||null;ui.selectedSub=null;updateMovementTypeUI();renderCategoryChips();renderSubChips();}
function updateMovementTypeUI(){document.getElementById('btnExpense').classList.toggle('active',ui.movementType==='expense');document.getElementById('btnIncome').classList.toggle('active',ui.movementType==='income');document.getElementById('btnTransfer').classList.toggle('active',ui.movementType==='transfer');document.getElementById('saveMovementBtn').textContent=ui.editingId?'Guardar':'Guardar '+TYPE_LABELS[ui.movementType].toLowerCase();}
function renderCategoryChips(){const cats=data.categories.filter(c=>c.type===(ui.movementType==='income'?'income':'expense')&&!c.archived);if(!ui.selectedCategory||!cats.some(c=>c.id===ui.selectedCategory))ui.selectedCategory=cats[0]?.id||null;document.getElementById('categoryChips').innerHTML=cats.map(c=>`<button type="button" class="chip-pick ${ui.selectedCategory===c.id?'selected':''}" onclick="selectCategory('${c.id}')">${c.emoji} ${c.name}</button>`).join('');}
function selectCategory(id){ui.selectedCategory=id;ui.selectedSub=null;renderCategoryChips();renderSubChips();}
function renderSubChips(){const cat=getCategory(ui.selectedCategory);const subs=cat.subs||[];document.getElementById('subBox').classList.toggle('hidden',!subs.length||ui.movementType==='income');if(!subs.length)return;document.getElementById('subChips').innerHTML=`<button type="button" class="chip-pick mini ${!ui.selectedSub?'selected':''}" onclick="selectSub(null)">General</button>`+subs.map(s=>`<button type="button" class="chip-pick mini ${ui.selectedSub===s.id?'selected':''}" onclick="selectSub('${s.id}')">${s.name}</button>`).join('');}
function selectSub(id){ui.selectedSub=id;renderSubChips();}
function saveMovement(){const amount=parseFloat(document.getElementById('amountInput').value);if(!amount||amount<=0)return toast('Monto inválido');
 if(ui.movementType==='expense'){let av=availableNow();if(ui.editingId){const old=data.movements.find(m=>m.id===ui.editingId);if(old&&old.type==='expense')av+=Number(old.amount||0);}if(Number(amount)>av)return toast(`No puedes registrar ${formatMoney(amount)}: tu disponible es ${formatMoney(av)}.`);}
 const date=document.getElementById('dateInput').value||isoDate();const note=document.getElementById('noteInput').value.trim();const merchant=document.getElementById('merchantInput').value.trim();const categoryId=ui.selectedCategory||data.categories.find(c=>c.type===(ui.movementType==='income'?'income':'expense'))?.id;if(!categoryId)return toast('Categoría');const mov={id:ui.editingId||uid(),type:ui.movementType,amount:Number(amount),categoryId,subId:ui.movementType==='income'?null:ui.selectedSub,merchant:ui.movementType==='income'?'':merchant,date,note,sample:false,createdAt:Date.now()};if(ui.editingId){const i=data.movements.findIndex(m=>m.id===ui.editingId);if(i>=0)data.movements[i]={...data.movements[i],...mov};}else data.movements.push(mov);saveData();render();closeModal('movementModal');toast('Registrado correctamente');}
function deleteCurrentMovement(){if(!ui.editingId||!confirm('¿Borrar?'))return;data.movements=data.movements.filter(m=>m.id!==ui.editingId);saveData();render();closeModal('movementModal');toast('Movimiento borrado');}
function openCategoryDetail(id){ui.detailCategoryId=id;renderCategoryDetail();openModal('categoryModal');}
function renderCategoryDetail(){const c=getCategory(ui.detailCategoryId);document.getElementById('categoryModalTitle').textContent=`${c.emoji} ${c.name}`;const movs=data.movements.filter(m=>m.categoryId===c.id);const s=calcSummary(movs.filter(m=>monthKey(m.date)===currentMonthKey()));document.getElementById('categoryModalSummary').textContent=`Este mes: gastado ${formatMoney(s.expense)}`;const exp=movs.filter(m=>m.type==='expense');let bd='';(c.subs||[]).forEach(sub=>{const t=exp.filter(m=>m.subId===sub.id).reduce((a,m)=>a+Number(m.amount||0),0);if(t>0)bd+=`<div class="row" style="cursor:default;"><div class="row-left"><div class="row-title">${sub.name}</div></div><div class="row-right"><div class="row-amount">${formatMoney(t)}</div></div></div>`;});const merch={};exp.forEach(m=>{if(m.merchant)merch[m.merchant]=(merch[m.merchant]||0)+Number(m.amount||0);});Object.entries(merch).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,t])=>{bd+=`<div class="row" style="cursor:default;"><div class="row-left"><div class="row-sub" style="margin:0;">🏪 ${m}</div></div><div class="row-right"><div class="row-amount">${formatMoney(t)}</div></div></div>`;});document.getElementById('categoryBreakdown').innerHTML=bd||'<div class="empty">Sin detalle.</div>';const list=movs.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);document.getElementById('categoryMovementList').innerHTML=list.length?list.map(m=>`<div class="row" onclick="closeModal('categoryModal');requestEditMovement('${m.id}')"><div class="row-left"><div class="row-icon" style="background:var(${c.bg});">${c.emoji}</div><div style="min-width:0;"><div class="row-title">${m.merchant?m.merchant+' · ':''}${esc(m.note)||c.name}</div><div class="row-sub">${formatDateLabel(m.date)}</div></div></div><div class="row-right"><div class="row-amount ${m.type==='income'?'green':m.type==='transfer'?'transfer':'red'}">${m.type==='income'?'+':'−'} ${formatMoney(m.amount)}</div></div></div>`).join(''):'<div class="empty">Sin movimientos.</div>';}
function openCategoryManager(){renderCategoryManager();openModal('categoryManagerModal');}
function renderCategoryManager(){document.getElementById('categoryManagerList').innerHTML=data.categories.map(c=>`<div class="row"><div class="row-left"><div class="row-icon" style="background:var(${c.bg});">${c.emoji}</div><div style="min-width:0;"><div class="row-title">${c.name}${c.archived?' (archivada)':''}</div><div class="row-sub">${c.type==='income'?'Ingreso':'Gasto'}</div></div></div><div style="display:flex;gap:6px;"><button class="btn secondary mini" onclick="renameCategoryInline('${c.id}')">✎</button><button class="btn secondary mini" onclick="toggleArchive('${c.id}')">${c.archived?'♻':''}</button></div></div>`).join('');}
function renameCategoryInline(id){const c=data.categories.find(x=>x.id===id);if(!c)return;const v=prompt('Nuevo nombre:',c.name);if(!v)return;const n=v.trim();if(!n)return toast('Vacío');if(data.categories.find(x=>x.id!==id&&x.name.toLowerCase()===n.toLowerCase()))return toast('Ya existe');c.name=n;saveData();render();renderCategoryManager();toast('Renombrada');}
function toggleArchive(id){const c=data.categories.find(x=>x.id===id);if(!c)return;c.archived=!c.archived;saveData();render();renderCategoryManager();toast(c.archived?'Archivada':'Restaurada');}
function addCategoryFromManager(){const inp=document.getElementById('newCatName');const n=inp.value.trim();if(!n)return toast('Nombre');if(data.categories.find(c=>c.name.toLowerCase()===n.toLowerCase()))return toast('Ya existe');data.categories.push({id:'cat-'+uid(),name:n,emoji:'🏷️',type:'expense',bg:'--pill',color:'#64748b',subs:[]});inp.value='';saveData();render();renderCategoryManager();toast('Creada');}

/* ===== MODULO ALCANCÍA (Personal y Compartida) ===== */
function setAlcanciaTab(t){
  ui.alcanciaTab = t;
  document.getElementById('tabAlcPersonal').classList.toggle('active', t === 'personal');
  document.getElementById('tabAlcCompartida').classList.toggle('active', t === 'compartida');
  document.getElementById('alcanciaPersonal').classList.toggle('hidden', t !== 'personal');
  document.getElementById('alcanciaCompartida').classList.toggle('hidden', t !== 'compartida');
  renderAlcancia();
}

function renderAlcancia() {
  if (ui.alcanciaTab === 'personal') {
      renderPiggyBanks();
  } else {
      renderConjunta();
  }
}

function getActivePiggy(){
  if(!data.piggyBanks || !data.piggyBanks.length) return null;
  if(!ui.activePiggyId || !data.piggyBanks.find(p=>p.id===ui.activePiggyId)) ui.activePiggyId = data.piggyBanks[0].id;
  return data.piggyBanks.find(p=>p.id===ui.activePiggyId);
}
function renderPiggyBanks() {
  const p = getActivePiggy();
  document.getElementById('piggyTabs').innerHTML = (data.piggyBanks||[]).map(x=>`<button class="piggy-tab ${x.id===(p?p.id:'')?'active':''}" onclick="ui.activePiggyId='${x.id}';renderAlcancia()">${esc(x.name)}</button>`).join('') + `<button class="piggy-tab piggy-tab-add" onclick="openModal('newPiggyModal')">+ Nueva</button>`;
  
  if(!p) return;
  document.getElementById('piggyNameLabel').textContent = esc(p.name);
  document.getElementById('piggyBalance').textContent = formatMoney(p.balance);
  document.getElementById('goalCurrent').textContent = formatMoney(p.balance);
  document.getElementById('goalTarget').textContent = formatMoney(p.goal);
  const pct = p.goal > 0 ? Math.min(100, Math.round((p.balance / p.goal) * 100)) : 0;
  document.getElementById('goalBar').style.width = pct + '%';
  document.getElementById('goalPercent').textContent = pct + '%';

  const txs = [...(p.transactions||[])].sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('piggyStatement').innerHTML = txs.length ? txs.map(t => {
    const isIn = t.type === 'in';
    return `<div class="row"><div class="row-left"><div class="row-icon" style="background:${isIn?'var(--green-soft)':'var(--pink-soft)'};">${isIn?'+':'-'}</div><div style="min-width:0;"><div class="row-title">${esc(t.note)||(isIn?'Aporte':'Retiro')}</div><div class="row-sub">${formatDateLabel(t.date)}</div></div></div><div class="row-right"><div class="row-amount ${isIn?'green':'red'}">${isIn?'+':'-'}${formatMoney(t.amount)}</div></div></div>`;
  }).join('') : '<div class="empty">Sin movimientos.</div>';
}

function openPiggyAction(type){
  ui.piggyActionType = type;
  document.getElementById('piggyActionTitle').textContent = type === 'in' ? 'Echar dinero' : 'Sacar dinero';
  document.getElementById('piggyActionSymbol').textContent = data.settings.currency;
  document.getElementById('piggyActionAmount').value = '';
  document.getElementById('piggyActionNote').value = '';
  document.getElementById('piggyActionDate').value = isoDate();
  openModal('piggyActionModal');
}
function confirmPiggyAction(){
  const amt = parseFloat(document.getElementById('piggyActionAmount').value);
  if(!amt || amt <= 0) return toast('Monto inválido');
  const p = getActivePiggy();
  if(!p) return;
  if(ui.piggyActionType === 'out' && amt > p.balance) return toast('Saldo insuficiente');
  p.balance += ui.piggyActionType === 'in' ? amt : -amt;
  p.transactions = p.transactions || [];
  p.transactions.push({id:uid(), type: ui.piggyActionType, amount: amt, note: document.getElementById('piggyActionNote').value.trim(), date: document.getElementById('piggyActionDate').value||isoDate()});
  saveData(); renderAlcancia(); closeModal('piggyActionModal'); toast('Registrado correctamente');
}
function openPiggyGoalModal(){
  const p = getActivePiggy();
  document.getElementById('piggyGoalAmount').value = p ? p.goal : '';
  openModal('piggyGoalModal');
}
function savePiggyGoal(){
  const amt = parseFloat(document.getElementById('piggyGoalAmount').value) || 0;
  const p = getActivePiggy();
  if(p) { p.goal = amt; saveData(); renderAlcancia(); }
  closeModal('piggyGoalModal'); toast('Meta actualizada exitosamente');
}
function confirmNewPiggy(){
  const name = document.getElementById('newPiggyName').value.trim();
  if(!name) return toast('Escribe un nombre');
  const bal = parseFloat(document.getElementById('newPiggyBalance').value) || 0;
  const nw = {id:uid(), name, balance:bal, goal:0, goalMonth:currentMonthKey(), transactions:[]};
  if(bal > 0) nw.transactions.push({id:uid(), type:'in', amount:bal, note:'Saldo inicial', date:isoDate()});
  if(!data.piggyBanks) data.piggyBanks = [];
  data.piggyBanks.push(nw);
  ui.activePiggyId = nw.id; saveData(); renderAlcancia(); closeModal('newPiggyModal'); toast('Alcancía creada exitosamente');
}
function deleteCurrentPiggy(){
  if(!data.piggyBanks || data.piggyBanks.length <= 1) return toast('Debes tener al menos una alcancía');
  if(!confirm('¿Seguro que quieres borrar esta alcancía?')) return;
  data.piggyBanks = data.piggyBanks.filter(p=>p.id!==ui.activePiggyId);
  ui.activePiggyId = data.piggyBanks[0].id;
  saveData(); renderAlcancia(); toast('Alcancía borrada exitosamente');
}

/* ===== CUENTA CONJUNTA MULTIPLE (Sincronizada) ===== */
function getActiveShared(){if(!data.sharedAccounts.length)return null;if(!ui.activeSharedId||!data.sharedAccounts.find(s=>s.id===ui.activeSharedId))ui.activeSharedId=data.sharedAccounts[0].id;return data.sharedAccounts.find(s=>s.id===ui.activeSharedId);}
function renderConjunta() {
  const s = getActiveShared();
  document.getElementById('sharedTabs').innerHTML = data.sharedAccounts.map(x=>`<button class="piggy-tab ${x.id===(s?s.id:'')?'active':''}" onclick="ui.activeSharedId='${x.id}';renderAlcancia()">${esc(x.name)}</button>`).join('') + `<button class="piggy-tab piggy-tab-add" onclick="openModal('newSharedModal')">+ Nueva</button>`;
  
  if(!s) {
    document.getElementById('sharedContent').classList.add('hidden');
    document.getElementById('sharedEmpty').classList.remove('hidden');
    return;
  }
  document.getElementById('sharedContent').classList.remove('hidden');
  document.getElementById('sharedEmpty').classList.add('hidden');

  document.getElementById('sharedTitleLabel').textContent = esc(s.name);
  document.getElementById('sharedBalance').textContent = formatMoney(s.balance);
  document.getElementById('sharedAvatarLabel').textContent = (s.partnerName||'O').charAt(0).toUpperCase();
  document.getElementById('sharedPartnerTotalLabel').textContent = esc(s.partnerName) + ' aportó';

  const txs = [...(s.transactions||[])].sort((a,b)=>b.date.localeCompare(a.date));
  let myTotal = 0, partnerTotal = 0;

  document.getElementById('sharedStatement').innerHTML = txs.length ? txs.map(t => {
    const isMe = (t.by === 'me' || t.by === currentUser?.email);
    const isIn = t.type === 'in';
    
    // Calcular totales independientemente de la base de datos usando el correo
    if (isIn) {
        if(isMe) myTotal += Number(t.amount); else partnerTotal += Number(t.amount);
    } else {
        if(isMe) myTotal -= Number(t.amount); else partnerTotal -= Number(t.amount);
    }

    const bg = isMe ? 'var(--green)' : 'var(--accent)';
    return `<div class="row"><div class="row-left"><div class="row-icon" style="background:${bg}; color:#fff; font-size:11px; font-weight:800;">${isMe?'Tú':esc(s.partnerName).substring(0,3)}</div><div style="min-width:0;"><div class="row-title">${esc(t.note)||(isIn?'Aporte':'Retiro')}</div><div class="row-sub">${formatDateLabel(t.date)}</div></div></div><div class="row-right"><div class="row-amount ${isIn?'green':'red'}">${isIn?'+':'-'}${formatMoney(t.amount)}</div></div></div>`;
  }).join('') : '<div class="empty">Sin aportes todavía.</div>';

  document.getElementById('sharedTotalMe').textContent = formatMoney(myTotal);
  document.getElementById('sharedTotalPartner').textContent = formatMoney(partnerTotal);
}
function confirmNewShared() {
  const name = document.getElementById('nsName').value.trim();
  const partner = document.getElementById('nsPartner').value.trim();
  const partnerEmail = document.getElementById('nsPartnerEmail').value.trim().toLowerCase();
  
  if(!name || !partner) return toast('Completa los nombres');
  if(!partnerEmail) return toast('Correo es necesario para sincronizar');
  
  const nw = {
    id: uid(), name, partnerName: partner, partnerEmail,
    ownerId: currentUser?.id, balance: 0, transactions: []
  };
  
  data.sharedAccounts.push(nw);
  ui.activeSharedId = nw.id; saveData(); renderAlcancia(); closeModal('newSharedModal'); toast('Registrado correctamente');
}
function openSharedAction(type) {
  ui.sharedActionType = type;
  const s = getActiveShared();
  if(!s) return;
  document.getElementById('sharedActionTitle').textContent = type==='in' ? `Aportar fondos` : 'Retirar fondos';
  document.getElementById('saAmount').value=''; document.getElementById('saNote').value=''; document.getElementById('saDate').value=isoDate();
  openModal('sharedActionModal');
}
function confirmSharedAction() {
  const amt = parseFloat(document.getElementById('saAmount').value);
  if(!amt || amt <= 0) return toast('Monto inválido');
  const s = getActiveShared();
  if(!s) return;
  if(ui.sharedActionType === 'out' && amt > s.balance) return toast('Saldo insuficiente');
  
  s.balance += ui.sharedActionType === 'in' ? amt : -amt;
  
  // Guardamos el email de la persona para que la nube distinga perfectamente
  const actionByEmail = currentUser?.email || 'me';
  
  s.transactions.push({id:uid(), type: ui.sharedActionType, amount: amt, note: document.getElementById('saNote').value.trim(), date: document.getElementById('saDate').value||isoDate(), by: actionByEmail});
  saveData(); renderAlcancia(); closeModal('sharedActionModal'); toast('Registrado correctamente');
}
function deleteCurrentShared() {
  if(!confirm('¿Seguro que quieres borrar esta cuenta compartida?')) return;
  const s = getActiveShared();
  data.sharedAccounts = data.sharedAccounts.filter(x=>x.id!==ui.activeSharedId);
  ui.activeSharedId = null;
  if(s && s.partnerEmail && typeof sb !== 'undefined' && sb) {
      sb.from('shared_records').delete().eq('id', s.id).then();
  }
  saveData(); renderAlcancia(); toast('Cuenta borrada');
}

/* ===== SAN MULTIPLE (Sincronizado) ===== */
function getActiveSan(){if(!data.sans.length)return null;if(!ui.activeSanId||!data.sans.find(s=>s.id===ui.activeSanId))ui.activeSanId=data.sans[0].id;return data.sans.find(s=>s.id===ui.activeSanId);}
function renderSan() {
  const s = getActiveSan();
  document.getElementById('sanTabs').innerHTML = data.sans.map(x=>`<button class="piggy-tab ${x.id===(s?s.id:'')?'active':''}" onclick="ui.activeSanId='${x.id}';renderSan()">${esc(x.name)}</button>`).join('') + `<button class="piggy-tab piggy-tab-add" onclick="openModal('newSanModal')">+ Nuevo</button>`;
  
  if(!s) {
    document.getElementById('sanContent').classList.add('hidden');
    document.getElementById('sanEmpty').classList.remove('hidden');
    return;
  }
  document.getElementById('sanContent').classList.remove('hidden');
  document.getElementById('sanEmpty').classList.add('hidden');

  const isShared = s.type === 'compartido';
  document.getElementById('sanPartnerAvatars').classList.toggle('hidden', !isShared);
  document.getElementById('sanLegendCompartido').classList.toggle('hidden', !isShared);
  document.getElementById('sanTotalsCompartido').classList.toggle('hidden', !isShared);
  
  if(isShared) {
    document.getElementById('sanPartnerInit').textContent = (s.partnerName||'O').charAt(0).toUpperCase();
    document.getElementById('sanPartnerTotalLabel').textContent = esc(s.partnerName) + ' aportó';
    document.getElementById('sanLabel1').textContent = `Faltan`;
    document.getElementById('sanCount').textContent = s.max - (s.numbers||[]).length;
    document.getElementById('sanHelperText').textContent = "Toca un número para aportar. Los aportes de tu pareja se sincronizan solos.";
  } else {
    document.getElementById('sanLabel1').textContent = `Números`;
    document.getElementById('sanCount').textContent = s.max;
    document.getElementById('sanHelperText').textContent = "Toca un número para marcarlo como completado.";
  }

  let myTotal = 0, partnerTotal = 0;
  const saved = (s.numbers||[]).reduce((acc, n) => {
      const isMe = (n.by === 'me' || n.by === currentUser?.email);
      if (isMe) myTotal += (n.amount||0);
      else partnerTotal += (n.amount||0);
      return acc + (n.amount||0);
  }, 0);

  document.getElementById('sanSaved').textContent = formatMoney(saved);
  document.getElementById('sanTotalMe').textContent = formatMoney(myTotal);
  document.getElementById('sanTotalPartner').textContent = formatMoney(partnerTotal);

  let gridHtml = '';
  for(let i=1; i<=s.max; i++) {
      const numData = (s.numbers||[]).find(x=>x.num===i);
      const isDone = !!numData;
      let cellClass = 'san-cell';
      if(isDone) {
          const isMe = (numData.by === 'me' || numData.by === currentUser?.email);
          cellClass += isMe ? ' done' : ' partner-done';
      }
      gridHtml += `<div class="${cellClass}" onclick="toggleSanNumber(${i})">${i}</div>`;
  }
  document.getElementById('sanGrid').innerHTML = gridHtml;
}

function toggleSanNumber(num) {
  const s = getActiveSan();
  if(!s) return;
  const exIdx = (s.numbers||[]).findIndex(x=>x.num===num);
  
  if(exIdx >= 0) {
      const numData = s.numbers[exIdx];
      const isMe = (numData.by === 'me' || numData.by === currentUser?.email);
      if (s.type === 'compartido' && !isMe) {
          return toast('No puedes alterar esto. El aporte lo realizó tu pareja.');
      }
      if(!confirm(`¿Deseas retirar/eliminar tu aporte del número ${num}?`)) return;
      s.numbers.splice(exIdx, 1);
  } else {
      if(!confirm(`¿Confirmas que aportarás ${formatMoney(num)} para el número ${num}?`)) return;
      const val = num;
      const actionByEmail = currentUser?.email || 'me'; // Siempre se asume que es el propio usuario actual
      s.numbers = s.numbers || [];
      s.numbers.push({num, amount:val, date:isoDate(), by: actionByEmail});
  }
  saveData(); renderSan();
}

function confirmNewSan() {
  const name = document.getElementById('nSanName').value.trim();
  const type = document.getElementById('nSanType').value;
  const partnerName = document.getElementById('nSanPartner').value.trim();
  const partnerEmail = document.getElementById('nSanPartnerEmail').value.trim().toLowerCase();
  const max = parseInt(document.getElementById('nSanMax').value, 10) || 100;

  if(!name) return toast('Completa el nombre');
  if(type === 'compartido' && (!partnerName || !partnerEmail)) {
      return toast('Completa los datos de tu pareja para sincronizar');
  }

  const nw = {
    id: uid(), name, type, max, numbers: [],
    partnerName: type === 'compartido' ? partnerName : '',
    partnerEmail: type === 'compartido' ? partnerEmail : '',
    ownerId: currentUser?.id
  };

  data.sans.push(nw);
  ui.activeSanId = nw.id; 
  saveData(); 
  renderSan(); 
  closeModal('newSanModal'); 
  toast('San creado exitosamente');
}
// Inicializar la aplicación cuando cargue la página
document.addEventListener('DOMContentLoaded', init);

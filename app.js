// ERP System - plain HTML/CSS/JS version. All data is stored in the browser (localStorage).
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>parseFloat(v)||0;
const fmt=v=>num(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fd=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
const today=()=>new Date().toISOString().slice(0,10);
const pad=(n,l)=>String(n).padStart(l,'0');
const img=n=>`<img src="assets/${n}.png" alt="">`;

/* ---------- Data ---------- */
let db=JSON.parse(localStorage.getItem('erp_db')||'null')||{};
db.seq=db.seq||{};
if(!db.units)db.units=[{id:1,name:'Piece',short_name:'Pcs',status:'Active'},{id:2,name:'Kilogram',short_name:'Kg',status:'Active'}];
if(!db.payment_type)db.payment_type=[{id:1,Type:'Cash'},{id:2,Type:'Bank Transfer'}];
if(!db.payment_terms)db.payment_terms=[{id:1,term_name:'Net 30',Days:30}];
const save=()=>localStorage.setItem('erp_db',JSON.stringify(db));
const all=t=>db[t]||(db[t]=[]);
const nextId=t=>Math.max(0,db.seq[t]||0,...all(t).map(r=>r.id||0))+1;
const nid=t=>db.seq[t]=nextId(t);
const find=(t,id)=>all(t).find(x=>x.id==id);
// Remove the old untouched demo account so the "Create Owner account" screen appears.
if(all('users').length==1&&all('users')[0].Email=='admin@erp.com'&&all('users')[0].Password=='admin123')db.users=[];
all('users').forEach((u,i)=>{if(!u.Role)u.Role=i==0?'owner':'user'});

/* ---------- Roles ---------- */
const me=()=>find('users',sessionStorage.getItem('erp_uid'));
const isAdmin=()=>['owner','admin'].includes(me()?.Role);
const isOwner=()=>me()?.Role==='owner';
const hasOwner=()=>all('users').some(u=>u.Role=='owner');
const canManage=u=>!u||isOwner()||u.Role==='user'||u.id==me()?.id;
const canWrite=k=>!!D[k]||isAdmin();

/* ---------- Schemas ----------
   field: [key,label,type,span(of 6)]   type: t n pw ro chk st ta img sel:table.field ref:table.field (+ "tall")
   col:   [label, key|function, flag]   flag: m=money r=right d=date                                          */
const S={
 users:{t:'Users',one:'User',stack:1,
  f:[['Name','Username'],['MobileNo','Mobile No'],['Email','Email'],['Address','Address'],['Password','Password','pw'],['Status','Status','chk']],
  cols:[['Name','Name'],['Mobile No','MobileNo'],['Email','Email'],['Address','Address'],['Status','Status'],['Role','Role']]},
 categories:{t:'Category',one:'Category',stack:1,f:[['name','Category Name'],['status','Status','chk']],cols:[['Category Name','name'],['Status','status']]},
 units:{t:'Unit Of Measure',one:'UOM',stack:1,f:[['name','Unit Of Measure'],['short_name','Short Name'],['status','Status','chk']],
  cols:[['Short Name','short_name'],['UOM Name','name'],['Status','status']]},
 payment_terms:{t:'Payment Term',one:'Term',stack:1,f:[['term_name','Term Name'],['Days','Days','n']],cols:[['Payment Term','term_name'],['Days','Days','r']]},
 payment_type:{t:'Payment Type',one:'Type',stack:1,f:[['Type','Payment Type']],cols:[['Payment Type','Type']]},
 products:{t:'Products',one:'Product',
  def:()=>({item_id:'ITEM-'+pad(nextId('products'),3),sku:'SKU-'+pad(nextId('products'),3)}),
  f:[['item_id','Item ID','ro'],['sku','SKU (Stock Keeping Unit)','ro'],['status','Status','st'],['name','Product Name','t',6],
     ['category_name','Category','sel:categories.name',3],['uom','Unit Of Measure','sel:units.short_name',3],['description','Description','ta',6],
     ['purchase_price','Purchase Price','n',3],['sale_price','Sale Price','n',3],['image_url','Product Image','img',6]],
  cols:[['Image',r=>r.image_url?`<img class="thumb" src="${esc(r.image_url)}" alt="" onclick="imgView(${r.id})">`:'<span class="thumb ph"></span>','h'],['SKU','sku'],['Item Name','name'],['Category','category_name'],['UOM','uom'],['Purchase Price','purchase_price','m'],['Sale Price','sale_price','m'],['Available QTY','available_qty','r'],['Status','status']]},
 customers:{t:'Customers',one:'Customer',
  f:[['name','Name'],['contact_person','Contact Person'],['phone','Phone Number 1'],['credit_limit','Credit Limit','n'],['email','Email'],['address','Address','ta tall'],
     ['ntn_number','NTN Number'],['status','Status','st'],['opening_balance','Opening Balance','n',3],['current_balance','Current Balance','ro',3]],
  cols:[['Customer Name','name'],['Contact No','phone'],['Email','email'],['Address','address'],['NTN No','ntn_number'],['Balance','current_balance','m']]},
 suppliers:{t:'Supplier',one:'Supplier',
  f:[['name','Name'],['contact_person','Contact Person'],['phone','Phone Number 1'],['phone2','Phone Number 2'],['email','Email'],['address','Address','ta tall'],
     ['ntn_number','NTN Number'],['payment_type','Payment Type','sel:payment_type.Type'],['registered','Registered'],['payment_term','Payment Term','sel:payment_terms.term_name'],
     ['status','Status','st'],['opening_balance','Opening Balance','n',3],['current_balance','Current Balance','ro',3]],
  cols:[['Supplier Name','name'],['Contact No','phone'],['Email','email'],['Address','address'],['NTN No','ntn_number'],['Pay Type','payment_type'],['Pay Term','payment_term'],['Balance','current_balance','m']]},
 adjustments:{t:'Adjustment',one:'Adjustment',stack:1,noEdit:1,
  f:[['product_id','Product','ref:products.name'],['change','Quantity Change (+/-)','n'],['reason','Reason']],
  cols:[['Date','date','d'],['Product',r=>find('products',r.product_id)?.name||''],['Change','change','r'],['Reason','reason']],
  after:r=>{r.date=today();const p=find('products',r.product_id);if(p)p.available_qty=num(p.available_qty)+r.change},
  undo:r=>{const p=find('products',r.product_id);if(p)p.available_qty=num(p.available_qty)-r.change}},
 // ----- HR -----
 employees:{t:'Employees',one:'Employee',def:()=>({emp_id:'EMP-'+pad(nextId('employees'),3)}),
  f:[['emp_id','Employee ID','ro'],['name','Full Name'],['status','Status','st'],['designation','Designation'],['department','Department'],['phone','Phone'],
     ['email','Email'],['joining_date','Joining Date','date'],['basic_salary','Basic Salary','n']],
  cols:[['Employee ID','emp_id'],['Name','name'],['Designation','designation'],['Department','department'],['Phone','phone'],['Joining Date','joining_date','d'],['Basic Salary','basic_salary','m'],['Status','status']]},
 attendance:{t:'Attendance',one:'Attendance',stack:1,def:()=>({date:today()}),
  f:[['date','Date','date'],['employee_id','Employee','ref:employees.name'],['att_status','Status','opt:Present|Absent|Leave|Half Day']],
  cols:[['Date','date','d'],['Employee',r=>find('employees',r.employee_id)?.name||''],['Status','att_status']],
  before:(d,id)=>all('attendance').some(a=>a.id!=id&&a.date==d.date&&a.employee_id==d.employee_id)?'Attendance for this employee and date already exists.':''},
 // ----- Payroll -----
 salaries:{t:'Salary Sheet',one:'Salary',
  def:()=>({month:today().slice(0,7)}),
  f:[['month','Month','month'],['employee_id','Employee','ref:employees.name'],['status','Status','opt:Unpaid|Paid'],['allowances','Allowances','n'],['deductions','Other Deductions','n'],['net','Net Salary (auto)','ro']],
  cols:[['Month','month'],['Employee',r=>find('employees',r.employee_id)?.name||''],['Basic Salary','basic','m'],['Allowances','allowances','m'],['Deductions','deductions','m'],['Absent Days','absent_days','r'],['Net Salary','net','m'],['Status','status']],
  before:(d,id)=>{const e=find('employees',d.employee_id);if(!e)return 'Select an employee.';
   if(all('salaries').some(x=>x.id!=id&&x.month==d.month&&x.employee_id==d.employee_id))return 'A salary for this employee and month already exists.';
   const ab=all('attendance').filter(a=>a.employee_id==d.employee_id&&String(a.date).startsWith(d.month)&&a.att_status=='Absent').length;
   d.basic=num(e.basic_salary);d.absent_days=ab;d.net=Math.round((d.basic+d.allowances-d.deductions-d.basic/30*ab)*100)/100;return ''}},
 // ----- Accounts -----
 receipts:{t:'Receipts',one:'Receipt',stack:1,noEdit:1,def:()=>({date:today()}),
  f:[['date','Date','date'],['customer_id','Customer','ref:customers.name'],['amount','Amount','n'],['payment_type','Payment Type','sel:payment_type.Type'],['note','Note']],
  cols:[['Date','date','d'],['Customer',r=>find('customers',r.customer_id)?.name||''],['Payment Type','payment_type'],['Note','note'],['Amount','amount','m']],
  before:d=>d.amount>0?'':'Amount must be greater than zero.',
  after:r=>{const c=find('customers',r.customer_id);if(c)c.current_balance=num(c.current_balance)-r.amount},
  undo:r=>{const c=find('customers',r.customer_id);if(c)c.current_balance=num(c.current_balance)+r.amount}},
 payments:{t:'Payments',one:'Payment',stack:1,noEdit:1,def:()=>({date:today()}),
  f:[['date','Date','date'],['supplier_id','Supplier','ref:suppliers.name'],['amount','Amount','n'],['payment_type','Payment Type','sel:payment_type.Type'],['note','Note']],
  cols:[['Date','date','d'],['Supplier',r=>find('suppliers',r.supplier_id)?.name||''],['Payment Type','payment_type'],['Note','note'],['Amount','amount','m']],
  before:d=>d.amount>0?'':'Amount must be greater than zero.',
  after:r=>{const c=find('suppliers',r.supplier_id);if(c)c.current_balance=num(c.current_balance)-r.amount},
  undo:r=>{const c=find('suppliers',r.supplier_id);if(c)c.current_balance=num(c.current_balance)+r.amount}},
 expenses:{t:'Expenses',one:'Expense',def:()=>({date:today()}),
  f:[['date','Date','date'],['title','Title'],['amount','Amount','n'],['payment_type','Payment Type','sel:payment_type.Type'],['note','Note','ta',6]],
  cols:[['Date','date','d'],['Title','title'],['Payment Type','payment_type'],['Note','note'],['Amount','amount','m']],
  before:d=>d.amount>0?'':'Amount must be greater than zero.'}
};
// stock: effect on product stock, bal: effect on the customer/supplier balance
const D={
 si:{one:'Sale Invoice',p:'customers',pl:'Customer',price:'sale_price',stock:-1,bal:1,pre:'SINV',noL:'Invoice No',noteL:'Note for Customer',btn:'Create new Sale',saveL:'Save Invoice',
  cols:[['Invoice No',r=>r.no],['Date',r=>fd(r.date)],['Customer',r=>r.party_name],['Tax',r=>fmt(r.tax),'r'],['Invoice Total',r=>fmt(r.grand),'r']]},
 sr:{one:'Sale Return',ret:1,refT:'si',p:'customers',pl:'Customer',price:'sale_price',stock:1,bal:-1,pre:'SRTN',noL:'Sale Return No',noteL:'Reason for Return',btn:'Create Sale Return',saveL:'Save Return',
  cols:[['Return No',r=>r.no],['Customer',r=>r.party_name],['Date',r=>fd(r.date)],['Total QTY',r=>r.qty,'r'],['Total',r=>fmt(r.grand),'r']]},
 pi:{one:'Purchase Invoice',p:'suppliers',pl:'Supplier',price:'purchase_price',stock:1,bal:1,pre:'PINV',noL:'Invoice No',noteL:'Note for Supplier',btn:'Create new Purchase',saveL:'Save Invoice',
  cols:[['Invoice No',r=>r.no],['Supplier',r=>r.party_name],['Total QTY',r=>r.qty,'r'],['Tax',r=>fmt(r.tax),'r'],['Invoice Total',r=>fmt(r.grand),'r']]},
 pr:{one:'Purchase Return',ret:1,refT:'pi',p:'suppliers',pl:'Supplier',price:'purchase_price',stock:-1,bal:-1,pre:'PRTN',noL:'Purchase Return No',noteL:'Reason for Return',btn:'Create Purchase Return',saveL:'Save Return',
  cols:[['Return No',r=>r.no],['Supplier',r=>r.party_name],['Date',r=>fd(r.date)],['Invoice Total',r=>fmt(r.grand),'r']]}
};
const MENU=[['dashboard','Dashboard','SquaresFour'],['sales','Sales','CashRegister'],['purchase','Purchase','ShoppingCart'],['inventory','Inventory','Warehouse'],['accounts','Accounts','ChartLine'],['hr','HR','UsersThree'],['payroll','Payroll','HandCoins'],['users','Users','UserCircleCheck']];
const SEC={sales:[['all','All'],['si','Sale Invoice'],['sr','Return Note']],
 purchase:[['all','All'],['pi','Purchase Invoice'],['pr','Return Note']],
 hr:[['employees','Employees'],['attendance','Attendance']],
 payroll:[['salaries','Salary Sheet']],
 accounts:[['overview','Overview'],['receipts','Receipts'],['payments','Payments'],['expenses','Expenses']],
 inventory:[['products','Products'],['adjustments','Adjustment'],['grn','GRN'],['pi','Purchase Invoice'],['pr','Return Note']]};
const TITLES={dashboard:'',sales:'Sales',purchase:'Purchases',inventory:'Inventory',users:'Users',accounts:'Accounts',hr:'HR',payroll:'Payroll',help:'Help'};
const POP=[['Inventory',[['categories','Category'],['units','UOM']]],['Purchase',[['suppliers','Suppliers'],['payment_terms','Payment Terms'],['payment_type','Payment Type']]],['Sales',[['customers','Customers']]]];
const settingsFor=()=>POP.flatMap(g=>g[1].map(x=>x[0])).filter(k=>isAdmin()||['suppliers','customers'].includes(k));
const menuFor=()=>MENU.filter(m=>isAdmin()||['dashboard','sales','purchase','inventory'].includes(m[0]));
const tabsFor=sec=>(SEC[sec]||[]).filter(t=>isAdmin()||t[0]!='adjustments');

let cur={sec:'dashboard',tab:''},refill=()=>{};
const base=()=>cur.sec=='users'?'users':`${cur.sec}/${cur.tab}`;
const go=h=>location.hash=h;
const tabsHtml=()=>{const t=tabsFor(cur.sec);return t.length?`<div class="tabs2">${t.map(x=>`<a href="#${cur.sec}/${x[0]}" class="${cur.tab==x[0]?'on':''}">${x[1]}</a>`).join('')}</div>`:''};
const main=h=>$('#page').innerHTML=(cur.title?`<h1>${esc(cur.title)}</h1>`:'')+tabsHtml()+h;
const modal=h=>{$('#modal').innerHTML=`<div class="box">${h}</div>`;$('#modal').classList.remove('hidden')};
const closeM=()=>$('#modal').classList.add('hidden');

/* ---------- Login ---------- */
let portal='admin',reg=false;
function setPortal(p){portal=p;reg=false;login()}
function login(){
 if(portal=='admin'&&!hasOwner())reg=true;
 const foot=portal=='user'?`<p class="sub"><a href="#" onclick="reg=!reg;login();return false">${reg?'Already have an account? Sign in':'New user? Create account'}</a></p>`
  :hasOwner()?'<p class="sub">Only the Owner can create new Admins (Users &rarr; Make Admin).</p>':'<p class="sub">First-time setup: create your Owner account.</p>';
 const title=reg?(portal=='admin'?'Create Owner account':'Create account'):'Sign in';
 $('#app').innerHTML=`<div class="lg"><form class="lf" onsubmit="return ${reg?'doReg':'doLogin'}(event)"><h2>${title}</h2>
 <p class="s">Unlock exclusive features and start building your dream Business today</p>
 <div class="pt"><a class="${portal=='admin'?'on':''}" onclick="setPortal('admin')">Admin Portal</a><a class="${portal=='user'?'on':''}" onclick="setPortal('user')">User Portal</a></div>
 <label>Username<input name="Name" required></label><label>Email<input name="Email" type="email" required></label>
 <label>Password<input name="Password" type="password" required minlength="4"></label>
 <div class="err" id="err"></div><button>${title}</button>${foot}</form><img class="art" src="assets/login-art.png" alt=""></div>`;
}
function doLogin(e){e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),er=m=>($('#err').textContent=m,false);
 const u=all('users').find(x=>x.Name.toLowerCase()==d.Name.trim().toLowerCase()&&x.Email.toLowerCase()==d.Email.toLowerCase()&&x.Password==d.Password);
 if(!u)return er('Invalid username, email or password.');
 if(u.Status!='Active')return er('This account is inactive.');
 const adm=['owner','admin'].includes(u.Role);
 if(portal=='admin'&&!adm)return er('This account has no admin access. Please use the User Portal.');
 if(portal=='user'&&adm)return er('This is an admin account. Please use the Admin Portal.');
 sessionStorage.setItem('erp_uid',u.id);location.hash='dashboard';route();return false}
function doReg(e){e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),role=portal=='admin'?'owner':'user';
 if(role=='owner'&&hasOwner()){$('#err').textContent='An Owner already exists.';return false}
 if(all('users').some(u=>u.Email.toLowerCase()==d.Email.toLowerCase())){$('#err').textContent='This email is already registered.';return false}
 all('users').push({id:nid('users'),Name:d.Name.trim(),Email:d.Email,Password:d.Password,MobileNo:'',Address:'',Status:'Active',Role:role});save();
 reg=false;login();$('#err').style.color='#2e7d32';$('#err').textContent=(role=='owner'?'Owner account created':'Account created')+'. Please sign in.';return false}
function logout(){sessionStorage.removeItem('erp_uid');$('#app').classList.remove('sb-open');login()}

/* ---------- Shell ---------- */
const isMobile=()=>matchMedia('(max-width:800px)').matches;
// Sidebar: on desktop it collapses (remembered), on phones it is a slide-in drawer.
function toggleSB(show){const a=$('#app');
 if(isMobile())a.classList.toggle('sb-open',show);
 else{const hide=show===undefined?!a.classList.contains('sb-hide'):!show;a.classList.toggle('sb-hide',hide);localStorage.setItem('erp_sb',hide?'0':'1')}}
function shell(u){
 $('#app').innerHTML=`<div class="scrim" onclick="toggleSB(false)"></div><aside onclick="if(event.target.closest('a')&&isMobile())toggleSB(false)"><div class="logo"><i></i><span class="t">ERP System</span><button class="burger in" onclick="toggleSB()" aria-label="Hide menu"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button></div>${menuFor().map(m=>`<a href="#${m[0]}" title="${m[1]}">${img(m[2])}<span class="t">${m[1]}</span></a>`).join('')}<div class="sp"></div>
 <a href="#help" title="Help">${img('Question')}<span class="t">Help</span></a><a href="#" title="Log out" onclick="logout();return false">${img('SignOut')}<span class="t">Log out</span></a></aside>
 <section><header><div class="hl"><button class="burger" onclick="toggleSB()" aria-label="Show or hide menu"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div><div class="hi">Hello, <b>${esc(u)}</b></div><small>Here’s Your overview of your Business.</small></div></div>
 <div class="hr"><span class="gear" onclick="togglePop()">${img('setting')}</span><span class="pill" title="${me().Role}"><i></i>${esc(u)}</span></div></header>
 <div id="pop" class="pop hidden">${POP.map(g=>[g[0],g[1].filter(x=>settingsFor().includes(x[0]))]).filter(g=>g[1].length).map(g=>`<h4>${g[0]}</h4>${g[1].map(x=>`<a href="#settings/${x[0]}">${x[1]}</a>`).join('')}`).join('')}</div>
 <div id="page"></div></section>`;
 $('#app').classList.toggle('sb-hide',localStorage.getItem('erp_sb')==='0');$('#app').classList.remove('sb-open')}
const togglePop=()=>$('#pop').classList.toggle('hidden');
document.addEventListener('click',e=>{if(!e.target.closest('.gear,#pop'))$('#pop')?.classList.add('hidden')});

/* ---------- Simple pages ---------- */
/* ---------- Dashboard (KPI cards + SVG charts, no external libraries) ---------- */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const compact=n=>{const a=Math.abs(n),s=n<0?'-':'';return a>=1e6?s+(a/1e6).toFixed(1)+'M':a>=1e3?s+(a/1e3).toFixed(a>=1e4?0:1)+'k':s+Math.round(a)};
const lastMonths=n=>{const out=[],t=new Date();for(let i=n-1;i>=0;i--){const x=new Date(t.getFullYear(),t.getMonth()-i,1);out.push({key:x.getFullYear()+'-'+pad(x.getMonth()+1,2),label:MON[x.getMonth()]})}return out};
function barChart(ms,a,b){const W=560,H=230,L=46,B=28,T=10,max=Math.max(1,...a,...b),ch=H-B-T,gw=(W-L-10)/ms.length,bw=Math.min(22,gw/3);let g='';
 for(let i=0;i<=4;i++){const y=T+ch-ch*i/4;g+=`<line x1="${L}" x2="${W-10}" y1="${y}" y2="${y}" stroke="#eee"/><text x="${L-8}" y="${y+3}" text-anchor="end" font-size="10" fill="#878787">${compact(max*i/4)}</text>`}
 ms.forEach((m,i)=>{const x=L+gw*i+gw/2;[[a[i],'#173DED',-bw-1],[b[i],'#b7c3ff',1]].forEach(([v,c,o])=>{const h=ch*Math.max(v,0)/max;g+=`<rect x="${x+o}" y="${T+ch-h}" width="${bw}" height="${h}" rx="3" fill="${c}"><title>${m.label}: ${fmt(v)}</title></rect>`});
  g+=`<text x="${x}" y="${H-8}" text-anchor="middle" font-size="10" fill="#878787">${m.label}</text>`});
 return `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg>`}
function donut(items,label='Stock value',none='No stock yet'){const tot=items.reduce((a,i)=>a+i.value,0),R=54,C=2*Math.PI*R,col=['#173DED','#0b0a52','#6f86ff','#9aa9ff','#c9d1ff','#888'];
 if(!tot)return `<p class="empty">${none}</p>`;let off=0;
 const arcs=items.map((i,k)=>{const l=C*i.value/tot,x=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${col[k%6]}" stroke-width="22" stroke-dasharray="${l} ${C-l}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(i.label)}: ${fmt(i.value)}</title></circle>`;off+=l;return x}).join('');
 return `<div class="donut"><svg viewBox="0 0 140 140" width="150">${arcs}<text x="70" y="66" text-anchor="middle" font-size="9" fill="#878787">${esc(label)}</text><text x="70" y="82" text-anchor="middle" font-size="13" font-weight="700">${compact(tot)}</text></svg>
 <ul>${items.map((i,k)=>`<li><i style="background:${col[k%6]}"></i>${esc(i.label)} <b>${compact(i.value)}</b></li>`).join('')}</ul></div>`}
function dash(){
 const ms=lastMonths(6),mt=k=>{const o={};all(k).forEach(r=>{const m=String(r.date).slice(0,7);o[m]=(o[m]||0)+num(r.grand)});return o},
  si=mt('si'),sr=mt('sr'),pi=mt('pi'),pr=mt('pr'),sum=k=>all(k).reduce((a,r)=>a+num(r.grand),0),bal=k=>all(k).reduce((a,r)=>a+num(r.current_balance),0);
 const sales=ms.map(m=>(si[m.key]||0)-(sr[m.key]||0)),purch=ms.map(m=>(pi[m.key]||0)-(pr[m.key]||0));
 const trend=a=>{const c=a[5],p=a[4];if(!p)return `<small>This month: ${compact(c)}</small>`;const ch=(c-p)/Math.abs(p)*100;return `<small class="${ch>=0?'up':'dn'}">${ch>=0?'▲':'▼'} ${Math.abs(ch).toFixed(0)}% vs last month</small>`};
 const prods=all('products'),low=prods.filter(p=>num(p.available_qty)<=5).sort((x,y)=>num(x.available_qty)-num(y.available_qty));
 const cat={};prods.forEach(p=>{const c=p.category_name||'Uncategorized';cat[c]=(cat[c]||0)+num(p.available_qty)*num(p.purchase_price)});
 const cats=Object.entries(cat).map(([label,value])=>({label,value})).filter(c=>c.value>0).sort((x,y)=>y.value-x.value);
 const top5=cats.slice(0,5);if(cats.length>5)top5.push({label:'Others',value:cats.slice(5).reduce((a,c)=>a+c.value,0)});
 const cs={};all('si').forEach(r=>cs[r.party_name]=(cs[r.party_name]||0)+num(r.grand));all('sr').forEach(r=>cs[r.party_name]=(cs[r.party_name]||0)-num(r.grand));
 const topC=Object.entries(cs).sort((x,y)=>y[1]-x[1]).slice(0,5),mx=Math.max(1,...topC.map(c=>c[1]));
 const recent=['si','sr','pi','pr'].flatMap(k=>all(k).map(r=>({...r,k}))).sort((x,y)=>String(y.date).localeCompare(String(x.date))||y.id-x.id).slice(0,6);
 const kpi=(l,v,sub,ic)=>`<div class="kpi"><span class="ico">${img(ic)}</span><div><small>${l}</small><b>${v}</b>${sub}</div></div>`;
 main(`<div class="kpis">${kpi('Net Sales',fmt(sum('si')-sum('sr')),trend(sales),'CashRegister')}${kpi('Net Purchases',fmt(sum('pi')-sum('pr')),trend(purch),'ShoppingCart')}
  ${kpi('Receivable',fmt(bal('customers')),'<small>Customers owe you</small>','HandCoins')}${kpi('Payable',fmt(bal('suppliers')),'<small>You owe suppliers</small>','ChartLine')}</div>
 <div class="dgrid"><div class="panel s8"><h4>Sales vs Purchases <span class="lg2"><i style="background:#173DED"></i>Sales <i style="background:#b7c3ff"></i>Purchases</span></h4>${barChart(ms,sales,purch)}</div>
 <div class="panel s4"><h4>Stock by category</h4>${donut(top5)}</div>
 <div class="panel s4"><h4>Top customers</h4>${topC.length?topC.map(c=>`<div class="hb"><span>${esc(c[0])}</span><div><i style="width:${Math.max(3,c[1]/mx*100)}%"></i></div><b>${compact(c[1])}</b></div>`).join(''):'<p class="empty">No sales yet</p>'}</div>
 <div class="panel s4"><h4>Recent transactions</h4>${recent.length?recent.map(r=>`<div class="rt"><span class="bd ${r.k[1]=='r'?'ret':''}">${r.k[1]=='r'?'Return':'Invoice'}</span><span>${esc(r.no)}<small>${esc(r.party_name)}</small></span><b>${fmt(r.grand)}</b></div>`).join(''):'<p class="empty">No transactions yet</p>'}</div>
 <div class="panel s4"><h4>Low stock <small>(${prods.length} products)</small></h4>${low.length?low.slice(0,6).map(p=>`<div class="rt"><span>${esc(p.name)}<small>${esc(p.sku||'')}</small></span><b class="${num(p.available_qty)<=0?'dn':''}">${num(p.available_qty)} left</b></div>`).join(''):'<p class="empty">All products are well stocked</p>'}</div></div>`)}
const kpiCard=(l,v,sub,ic)=>`<div class="kpi"><span class="ico">${img(ic)}</span><div><small>${l}</small><b>${v}</b>${sub}</div></div>`;
const hbars=rows=>rows.some(r=>r[1]>0)?(m=>rows.map(r=>`<div class="hb"><span>${esc(r[0])}</span><div><i style="width:${Math.max(3,r[1]/m*100)}%"></i></div><b>${compact(r[1])}</b></div>`).join(''))(Math.max(1,...rows.map(r=>r[1]))):'<p class="empty">No data yet</p>';
function overview(){
 const ms=lastMonths(6),sum=(k,f='grand')=>all(k).reduce((a,r)=>a+num(r[f]),0),
  by=(rows,f,dk='date')=>{const o={};rows.forEach(r=>{const m=String(r[dk]).slice(0,7);o[m]=(o[m]||0)+num(r[f])});return o};
 const paidSal=all('salaries').filter(r=>r.status=='Paid'),rc=by(all('receipts'),'amount'),pm=by(all('payments'),'amount'),ex=by(all('expenses'),'amount'),sp=by(paidSal,'net','month');
 const mIn=ms.map(m=>rc[m.key]||0),mOut=ms.map(m=>(pm[m.key]||0)+(ex[m.key]||0)+(sp[m.key]||0));
 const sales=sum('si')-sum('sr'),purch=sum('pi')-sum('pr'),exp=sum('expenses','amount'),sal=paidSal.reduce((a,r)=>a+num(r.net),0),unpaid=all('salaries').filter(r=>r.status!='Paid').reduce((a,r)=>a+num(r.net),0);
 const profit=sales-purch-exp-sal,recd=sum('receipts','amount'),paid=sum('payments','amount')+exp+sal;
 const g={};all('expenses').forEach(r=>g[r.title||'Other']=(g[r.title||'Other']||0)+num(r.amount));
 const eg=Object.entries(g).map(([label,value])=>({label,value})).sort((x,y)=>y.value-x.value),top=eg.slice(0,5);if(eg.length>5)top.push({label:'Others',value:eg.slice(5).reduce((a,c)=>a+c.value,0)});
 const nm=(t,id)=>find(t,id)?.name||'';
 const recent=[...all('receipts').map(r=>({t:'Received',who:nm('customers',r.customer_id),a:r.amount,d:r.date,id:r.id})),...all('payments').map(r=>({t:'Paid',who:nm('suppliers',r.supplier_id),a:r.amount,d:r.date,id:r.id})),
  ...all('expenses').map(r=>({t:'Expense',who:r.title,a:r.amount,d:r.date,id:r.id}))].sort((x,y)=>String(y.d).localeCompare(String(x.d))||y.id-x.id).slice(0,6);
 main(`<div class="kpis">${kpiCard('Estimated Profit',`<span class="${profit>=0?'up':'dn'}">${fmt(profit)}</span>`,'<small>After purchases, expenses and salaries</small>','ChartLine')}
  ${kpiCard('Total Received',fmt(recd),'<small>From customers</small>','HandCoins')}${kpiCard('Total Paid Out',fmt(paid),'<small>Suppliers, expenses, salaries</small>','ShoppingCart')}${kpiCard('Expenses',fmt(exp),'<small>All time</small>','CashRegister')}</div>
 <div class="dgrid"><div class="panel s8"><h4>Money in vs Money out <span class="lg2"><i style="background:#173DED"></i>In <i style="background:#b7c3ff"></i>Out</span></h4>${barChart(ms,mIn,mOut)}</div>
 <div class="panel s4"><h4>Expense breakdown</h4>${donut(top,'Expenses','No expenses yet')}</div>
 <div class="panel s4"><h4>Receivable vs Payable</h4>${hbars([['Receivable',sum('customers','current_balance')],['Payable',sum('suppliers','current_balance')]])}</div>
 <div class="panel s4"><h4>Salaries</h4>${hbars([['Paid',sal],['Unpaid',unpaid]])}</div>
 <div class="panel s4"><h4>Recent money movements</h4>${recent.length?recent.map(r=>`<div class="rt"><span class="bd ${r.t=='Received'?'':'ret'}">${r.t}</span><span>${esc(r.who)}<small>${fd(r.d)}</small></span><b>${fmt(r.a)}</b></div>`).join(''):'<p class="empty">Nothing yet</p>'}</div></div>`)}
const soon=()=>main('<p class="empty">This page is not built yet.</p>');
const help=()=>main(`<p class="hint">Use the left menu for Sales, Purchase and Inventory. Click the gear icon (top right) for Category, UOM, Suppliers, Payment Terms, Payment Type and Customers.<br>Invoices and returns update stock and customer/supplier balances automatically.</p>`);
const srch=ph=>`<div class="srch"><img src="assets/MagnifyingGlass.png" alt=""><input id="q" placeholder="${ph}" oninput="refill()"></div>`;
const q=()=>($('#q')?.value||'').toLowerCase();
const cell=(r,c)=>{let v=typeof c[1]=='function'?c[1](r):r[c[1]];if(c[2]=='m')v=fmt(v);if(c[2]=='d')v=fd(v);return `<td class="${['m','r'].includes(c[2])?'r':''}">${c[2]=='h'?v:esc(v)}`};
const thead=(cols,act)=>`<tr><th>Sno${cols.map(c=>`<th class="${['m','r'].includes(c[2])?'r':''}">${c[0]}`).join('')}${act?'<th>':''}</tr>`;

function allList(sec){const ks=sec=='sales'?['si','sr']:['pi','pr'];
 main(`<div class="bar">${srch('Search Order, Delivery, Invoice...')}</div><table id="tb"></table>`);
 refill=()=>{const rows=ks.flatMap(k=>all(k).map(r=>({...r,type:k[1]=='i'?'Invoice':'Return'}))).filter(r=>JSON.stringify(r).toLowerCase().includes(q())).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  $('#tb').innerHTML=`<tr><th>Item Code<th>Type<th>${sec=='sales'?'Sale':'Supplier'}<th>Date<th class="r">Total Amount</tr>`+(rows.map(r=>`<tr><td>${esc(r.no)}<td>${r.type}<td>${esc(r.party_name)}<td>${fd(r.date)}<td class="r">${fmt(r.grand)}</tr>`).join('')||'<tr><td colspan="5" class="empty">No records</tr>')};refill()}
function grnList(){main(`<div class="bar">${srch('Search GRN...')}</div><table id="tb"></table>`);
 refill=()=>{const rows=all('pi').flatMap(r=>r.items.map(i=>({no:r.no,date:r.date,sup:r.party_name,item:i.name,qty:i.qty}))).filter(r=>JSON.stringify(r).toLowerCase().includes(q()));
  $('#tb').innerHTML='<tr><th>Sno<th>GRN No<th>Date<th>Supplier<th>Item<th class="r">Qty</tr>'+(rows.map((r,i)=>`<tr><td>${i+1}<td>${esc(r.no)}<td>${fd(r.date)}<td>${esc(r.sup)}<td>${esc(r.item)}<td class="r">${r.qty}</tr>`).join('')||'<tr><td colspan="6" class="empty">No records</tr>')};refill()}

/* ---------- Master data: list, form, save, delete ---------- */
function listPage(k){const s=S[k];
 main(`<div class="bar">${srch('Search '+s.t+'...')}${canWrite(k)?`<button class="navy" onclick="go('${base()}/new')">Create new ${s.one}</button>`:''}</div><table id="tb"></table>`);
 refill=()=>{const rows=all(k).filter(r=>JSON.stringify(r).toLowerCase().includes(q()));
  $('#tb').innerHTML=thead(s.cols,canWrite(k))+(rows.map((r,i)=>`<tr><td>${i+1}${s.cols.map(c=>cell(r,c)).join('')}${canWrite(k)?`<td class="act">${acts(k,r)}`:''}</tr>`).join('')||`<tr><td colspan="99" class="empty">No records</tr>`)};refill()}
function acts(k,r){let h=`${S[k].noEdit?'':`<button onclick="go('${base()}/edit/${r.id}')">Edit</button>`}<button class="del" onclick="del('${k}',${r.id})">Delete</button>`;
 if(k=='users'&&isOwner()&&r.Role!='owner'){const a=r.Role=='admin';h=`<button class="gray" onclick="setRole(${r.id},'${a?'user':'admin'}')">${a?'Remove Admin':'Make Admin'}</button>`+h}return h}
function setRole(id,role){const u=find('users',id);if(!isOwner()||!u||u.Role=='owner')return;
 if(!confirm(role=='admin'?`Make ${u.Name} an Admin?`:`Remove Admin access from ${u.Name}?`))return;u.Role=role;save();route()}
function fld(f,v,stack,ed,req){const[k,l,t='t',sp=2]=f,[ty,...fl]=t.split(' ');let x;
 if(ty=='chk')x=`<input type="checkbox" name="${k}" ${(v||'Active')=='Active'?'checked':''}>`;
 else if(ty=='st')x=`<select name="${k}">${['Active','Inactive'].map(o=>`<option ${o==(v||'Active')?'selected':''}>${o}</option>`).join('')}</select>`;
 else if(ty=='ta')x=`<textarea name="${k}">${esc(v)}</textarea>`;
 else if(ty=='img')return `<div class="f s6">${l}<div class="drop" ondragover="event.preventDefault()" ondrop="event.preventDefault();pickImg(event.dataTransfer.files[0])"><div class="imgbox" id="imgprev">${v?`<img src="${esc(v)}" alt="">`:'Image'}</div>
  <div><button type="button" class="navy" onclick="$('#imgf').click()">Upload Image</button> <span id="imgn">No file selected</span><p>Drag &amp; Drop here</p></div></div>
  <input type="hidden" name="${k}" id="imgv" value="${esc(v)}"><input type="file" id="imgf" accept="image/*" hidden onchange="pickImg(this.files[0])"></div>`;
 else if(ty.startsWith('opt:'))x=`<select name="${k}">${ty.slice(4).split('|').map(o=>`<option ${o==(v||ty.slice(4).split('|')[0])?'selected':''}>${o}</option>`).join('')}</select>`;
 else if(ty.startsWith('sel:')||ty.startsWith('ref:')){const[tb,fn]=ty.slice(4).split('.'),id=ty[0]=='r';
  x=`<select name="${k}" ${id?'required':''}><option value="">--</option>${all(tb).map(o=>`<option value="${id?o.id:esc(o[fn])}" ${(id?o.id==v:o[fn]==v)?'selected':''}>${esc(o[fn])}</option>`).join('')}</select>`}
 else x=`<input name="${k}" type="${ty=='n'?'number':ty=='pw'?'password':ty=='date'?'date':ty=='month'?'month':'text'}" ${ty=='n'?'step="any"':''} value="${ty=='pw'?'':esc(v)}" ${ty=='ro'?'readonly':''} ${req&&ty!='pw'?'required':''} ${ty=='pw'?(ed?'placeholder="Leave blank to keep current"':'required minlength="4"'):''}>`;
 return stack?`<div class="srow"><label>${l}</label>${x}</div>`:`<label class="f s${sp}${fl.includes('tall')?' tall':''}">${l}${x}</label>`}
function imgView(id){const p=find('products',id);modal(`<h3>${esc(p.name)}</h3><img src="${esc(p.image_url)}" alt="" style="max-width:100%;border-radius:10px"><div class="row"><button onclick="closeM()">Close</button></div>`)}
function pickImg(f){if(!f||!f.type.startsWith('image/'))return;const r=new FileReader();
 r.onload=()=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas'),k=Math.min(1,240/Math.max(i.width,i.height));c.width=i.width*k;c.height=i.height*k;
  c.getContext('2d').drawImage(i,0,0,c.width,c.height);const u=c.toDataURL('image/jpeg',.8);$('#imgv').value=u;$('#imgprev').innerHTML=`<img src="${u}" alt="">`;$('#imgn').textContent=f.name};i.src=r.result};r.readAsDataURL(f)}
function formPage(k,id){const s=S[k],r=find(k,id)||{};
 if(k=='users'&&id&&!canManage(r)){alert('Only the Owner can edit this account.');return go(base())}
 const def=id?{}:(s.def?s.def():{});
 main(`<h3 class="ft">${id?'Edit':'Create'} ${s.one}</h3><form onsubmit="return saveM(event,'${k}',${id||0})">
 <div class="${s.stack?'stk':'g6'}">${s.f.map((f,i)=>fld(f,r[f[0]]??def[f[0]]??'',s.stack,id,i==0)).join('')}</div>
 <div class="btns${s.stack?'':' r'}"><button>${s.stack?'Save':'Save '+s.one}</button><button type="button" class="gray" onclick="go(base())">${s.stack?'Back':'Cancel'}</button></div></form>`)}
function saveM(e,k,id){e.preventDefault();const s=S[k],el=e.target.elements,d={};
 for(const f of s.f){const key=f[0],ty=(f[2]||'t').split(' ')[0];
  let v=el[key].type=='checkbox'?(el[key].checked?'Active':'Inactive'):el[key].value;
  if(ty=='n'||ty.startsWith('ref:'))v=num(v);else if(ty=='pw'&&id&&!v)continue;
  d[key]=v}
 const er=s.before&&s.before(d,id);if(er){alert(er);return false}
 if(k=='users'){if(all('users').some(u=>u.Email.toLowerCase()==d.Email.toLowerCase()&&u.id!=id)){alert('This email already exists.');return false}if(!id)d.Role='user'}
 if(id)Object.assign(find(k,id),d);
 else{if('opening_balance' in d)d.current_balance=d.opening_balance;if(k=='products')d.available_qty=0;const rec={id:nid(k),...d};all(k).push(rec);s.after&&s.after(rec)}
 save();go(base());return false}
function del(k,id){const r=find(k,id);
 if(k=='users'){if(r.Role=='owner'||r.id==me().id)return alert('The Owner and your own account cannot be deleted.');if(!canManage(r))return alert('Only the Owner can delete an Admin.')}
 if(!confirm('Delete this record?'))return;S[k].undo&&S[k].undo(r);db[k]=all(k).filter(x=>x.id!=id);save();route()}

/* ---------- Invoices and returns ---------- */
let DK='si',L=[],EI=-1;
const prod=id=>find('products',id);
function docList(k){const d=D[k];
 main(`<div class="bar">${srch('Search '+d.one+'...')}<button class="navy" onclick="go('${base()}/new')">${d.btn}</button></div><table id="tb"></table>`);
 refill=()=>{const rows=all(k).filter(r=>JSON.stringify(r).toLowerCase().includes(q()));
  $('#tb').innerHTML=thead(d.cols.map(c=>[c[0],0,c[2]]),1)+(rows.map((r,i)=>`<tr><td>${i+1}${d.cols.map(c=>`<td class="${c[2]=='r'?'r':''}">${esc(c[1](r))}`).join('')}<td class="act"><button onclick="docView('${k}',${r.id})">View</button>${isAdmin()?`<button class="del" onclick="docDel('${k}',${r.id})">Delete</button>`:''}</tr>`).join('')||'<tr><td colspan="99" class="empty">No records</tr>')};refill()}
function docPage(k){const d=D[k];DK=k;L=[];EI=-1;
 const no=d.pre+'-'+pad(nextId(k),5),parties=all(d.p).filter(p=>p.status!='Inactive');
 main(`<h3 class="ft">Create ${d.one}</h3>
 <div class="hdr"><label class="f">${d.noL}<input id="h_no" value="${no}" readonly></label>
 ${d.ret?`<label class="f">Invoice No<select id="h_ref" onchange="refPick()"><option value="">--</option>${all(d.refT).map(r=>`<option value="${r.id}">${esc(r.no)}</option>`).join('')}</select></label>`:''}
 <label class="f">${d.pl} Name<select id="h_party" onchange="partyPick()"><option value="">--</option>${parties.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
 <label class="f">${d.ret?'Return Date':'Invoice Date'}<input type="date" id="h_date" value="${today()}"></label>
 ${k=='si'?'<label class="f">Credit Limit<input id="h_credit" placeholder="Auto Calculated" readonly></label>':''}
 ${k=='pi'?'<label class="f">Due Date<input type="date" id="h_due"></label>':''}
 ${d.ret?'':'<label class="f">Status<select id="h_status"><option>Unpaid</option><option>Paid</option></select></label>'}</div>
 <table class="lt" id="lt"></table>
 <div class="entry"><span id="e_code" class="code">code</span><select id="e_item" onchange="epick()"><option value="">--</option>${all('products').filter(p=>p.status!='Inactive').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
 <input id="e_qty" type="number" min="1" value="1" oninput="eCalc()" title="QTY"><span id="e_uom" class="code">UoM</span>
 <input id="e_price" type="number" step="any" value="0" oninput="eCalc()" title="Unit price"><input id="e_disc" type="number" step="any" value="0" oninput="eCalc()" title="Discount %">
 <b id="e_tot">0.00</b><button type="button" onclick="saveRow()">Save Row</button></div>
 <div class="tots"><div>Total QTY &nbsp; <b id="t_qty">0</b></div><div class="tr"><div>Total &nbsp; <b id="t_tot">0.00</b></div>
 ${d.ret?'':'<div>Tax Amount &nbsp; <input id="h_tax" type="number" step="any" value="0" oninput="totals()"></div><div>Grand Total &nbsp; <b id="t_grand">0.00</b></div>'}</div></div>
 <label class="f note">${d.noteL}<textarea id="h_note"></textarea></label>
 <div class="btns r"><button onclick="docSave()">${d.saveL}</button><button class="gray" onclick="go(base())">Cancel</button></div>`);renderLines()}
function partyPick(){const c=find(D[DK].p,$('#h_party').value);if($('#h_credit'))$('#h_credit').value=c?fmt(num(c.credit_limit)-num(c.current_balance)):''}
function refPick(){const r=find(D[DK].refT,$('#h_ref').value);if(!r)return;$('#h_party').value=r.party_id;L=r.items.map(i=>({...i}));renderLines()}
function epick(){const p=prod($('#e_item').value);$('#e_code').textContent=p?p.item_id||'code':'code';$('#e_uom').textContent=p?p.uom||'':'UoM';$('#e_price').value=p?num(p[D[DK].price]):0;eCalc()}
const eCalc=()=>$('#e_tot').textContent=fmt(num($('#e_qty').value)*num($('#e_price').value)*(1-num($('#e_disc').value)/100));
function saveRow(){const p=prod($('#e_item').value),n=num($('#e_qty').value);if(!p||n<=0)return alert('Select an item and enter a quantity.');
 const price=num($('#e_price').value),disc=num($('#e_disc').value),row={product_id:p.id,code:p.item_id||'',name:p.name,uom:p.uom||'',qty:n,price,disc,sub:n*price*(1-disc/100)};
 EI>=0?L[EI]=row:L.push(row);EI=-1;$('#e_item').value='';$('#e_qty').value=1;$('#e_disc').value=0;epick();renderLines()}
function editRow(i){const r=L[i];EI=i;$('#e_item').value=r.product_id;$('#e_code').textContent=r.code||'code';$('#e_uom').textContent=r.uom||'UoM';$('#e_qty').value=r.qty;$('#e_price').value=r.price;$('#e_disc').value=r.disc;eCalc()}
const delRow=i=>{L.splice(i,1);EI=-1;renderLines()};
function renderLines(){$('#lt').innerHTML='<tr><th>Item Code<th>Item Name<th>Quantity<th>UoM<th>Unit Price<th>Discount<th>Line Total<th>Edit<th>Delete</tr>'+
 L.map((r,i)=>`<tr><td>${esc(r.code)}<td>${esc(r.name)}<td>${r.qty}<td>${esc(r.uom)}<td>${fmt(r.price)}<td>${r.disc}%<td>${fmt(r.sub)}<td><a class="ic" onclick="editRow(${i})">${img('edit')}</a><td><a class="ic" onclick="delRow(${i})">${img('Trash')}</a></tr>`).join('');totals()}
function totals(){const t=L.reduce((a,r)=>a+r.sub,0),n=L.reduce((a,r)=>a+r.qty,0),tx=num($('#h_tax')?.value);
 $('#t_qty').textContent=n;$('#t_tot').textContent=fmt(t);if($('#t_grand'))$('#t_grand').textContent=fmt(t+tx);return[t,n,tx]}
function docSave(){const k=DK,d=D[k],party=find(d.p,$('#h_party').value);
 if(!party)return alert('Please select a '+d.pl.toLowerCase()+'.');if(!$('#h_date').value)return alert('Please choose a date.');if(!L.length)return alert('Add at least one item.');
 if(d.stock<0){const need={};L.forEach(i=>need[i.product_id]=(need[i.product_id]||0)+i.qty);
  for(const id in need){const p=prod(id);if(p&&need[id]>num(p.available_qty))return alert(`Not enough stock: ${p.name} (available ${num(p.available_qty)})`)}}
 const[t,n,tx]=totals(),ref=d.ret?find(d.refT,$('#h_ref').value):null;
 L.forEach(i=>{const p=prod(i.product_id);if(p)p.available_qty=num(p.available_qty)+d.stock*i.qty});
 party.current_balance=num(party.current_balance)+d.bal*(t+tx);
 const id=nid(k);all(k).push({id,no:d.pre+'-'+pad(id,5),party_id:party.id,party_name:party.name,date:$('#h_date').value,due:$('#h_due')?.value||'',status:$('#h_status')?.value||'',
  note:$('#h_note').value,ref:ref?.id||'',ref_no:ref?.no||'',items:L.map(i=>({...i})),qty:n,total:t,tax:tx,grand:t+tx});
 save();go(base())}
function docView(k,id){const r=find(k,id);
 modal(`<h3>${esc(r.no)} – ${esc(r.party_name)}</h3><p>Date: ${fd(r.date)} ${r.status?'| '+esc(r.status):''} ${r.note?'| '+esc(r.note):''}</p><table><tr><th>Item<th>Qty<th>Price<th>Disc %<th class="r">Line Total</tr>
 ${r.items.map(i=>`<tr><td>${esc(i.name)}<td>${i.qty}<td>${fmt(i.price)}<td>${i.disc}<td class="r">${fmt(i.sub)}</tr>`).join('')}</table>
 <p class="tot">Total: ${fmt(r.total)} | Tax: ${fmt(r.tax)} | <b>Grand total: ${fmt(r.grand)}</b></p>
 <div class="row"><button class="gray" onclick="window.print()">Print</button><button onclick="closeM()">Close</button></div>`)}
function docDel(k,id){if(!confirm('Delete this record? Stock and balance will be reversed.'))return;const d=D[k],r=find(k,id);
 r.items.forEach(i=>{const p=prod(i.product_id);if(p)p.available_qty=num(p.available_qty)-d.stock*i.qty});
 const party=find(d.p,r.party_id);if(party)party.current_balance=num(party.current_balance)-d.bal*r.grand;
 db[k]=all(k).filter(x=>x.id!=id);save();route()}

/* ---------- Router ---------- */
function route(){const u=me();if(!u||u.Status!='Active')return login();
 if(!$('#page'))shell(u.Name);
 if(isMobile())$('#app').classList.remove('sb-open');
 const p=(location.hash.slice(1)||'dashboard').split('/');if(p[0]=='users')p.splice(1,0,'users');
 let[sec,tab,act,id]=p;
 if(sec=='settings'){if(!settingsFor().includes(tab)){sec='dashboard';tab=''}}
 else if(sec!='help'&&!menuFor().some(m=>m[0]==sec)){sec='dashboard';tab=''}
 if(SEC[sec]){const tt=tabsFor(sec);if(!tt.some(t=>t[0]==tab))tab=tt[0][0]}
 cur={sec,tab:tab||'',title:sec=='settings'?S[tab].t:TITLES[sec]};
 document.querySelectorAll('aside a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')=='#'+sec));
 $('#pop').classList.add('hidden');
 const k=sec=='users'?'users':(sec=='settings'||(S[tab]&&SEC[sec]))?tab:null;
 if(sec=='dashboard')return dash();
 if(sec=='help')return help();
 if(k){const w=canWrite(k)&&!(act=='edit'&&S[k].noEdit);return (act=='new'||act=='edit')?(w?formPage(k,id):go(base())):listPage(k)}
 if(SEC[sec]){if(tab=='overview')return overview();if(tab=='grn')return grnList();if(tab=='all')return allList(sec);return act=='new'?docPage(tab):docList(tab)}
 soon()}
addEventListener('hashchange',route);
route();

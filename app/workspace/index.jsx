"use client";
import {SignOutButton} from '../email-sign-in';
import React,{useEffect,useRef,useState} from 'react';import{ArrowUpRight,ArrowDownLeft,Plus,Search,ChevronRight,ChevronDown,LayoutDashboard,FileText,Users,Phone,Settings,Check,Clock,Download,X,Trash2,ArrowLeft,Copy,CheckCircle2,AlertCircle,Menu,LogOut,Wallet,MoreHorizontal,RefreshCw,Play,Mail,ShieldCheck,Sparkles}from'lucide-react';import{api,backend}from'./api';import BusinessSettings from '../business-settings';import Assistant from './assistant';import{money,total,status,localDate,paymentDay,aging,matchesFilters,emptyFilters,workspaceMatches}from'./domain';import'./style.css';
const paymentLabels={CHECK:'Check',ACH:'ACH',BANK_TRANSFER:'Bank transfer',CARD:'Card',CASH:'Cash',OTHER:'Other',DEMO:'Demo payment'};
const Icon=({icon:I,...p})=>
<I size={18} strokeWidth={1.7} {...p}/>;const Badge=({invoice})=>
<span className={'badge '+status(invoice).toLowerCase()}>
<i/>{({OPEN:'Pending',OVERDUE:'Overdue',PAID:'Paid',VOID:'Void'})[status(invoice)]}</span>;
function App({account,business,businesses,switchBusiness}){const[invoices,setInvoices]=useState([]),[editingClient,setEditingClient]=useState(null),[clientSearch,setClientSearch]=useState(''),[trash,setTrash]=useState([]),[filters,setFilters]=useState(emptyFilters),[showFilters,setShowFilters]=useState(false),[clients,setClients]=useState([]),[invoiceClient,setInvoiceClient]=useState(null),[editField,setEditField]=useState('number'),[voiceSetup,setVoiceSetup]=useState({}),[view,setView]=useState('Overview'),[search,setSearch]=useState(''),[filter,setFilter]=useState('All invoices'),[selected,setSelected]=useState(null),[modal,setModal]=useState(null),[error,setError]=useState(''),[toast,setToast]=useState(''),[busy,setBusy]=useState(false),[live,setLive]=useState(false),[mobile,setMobile]=useState(false);const toastTimer=useRef();async function load(){try{setInvoices(await api.list());setTrash(await api.trash());setClients(await api.clients());const session=await api.session();setLive(session.live);setVoiceSetup(session.voiceSetup||{});setError('')}catch(e){setError(e.message)}}useEffect(()=>{load();return()=>clearTimeout(toastTimer.current)},[]);useEffect(()=>{if(!live)return;const timer=setInterval(load,15000);return()=>clearInterval(timer)},[live]);useEffect(()=>{function shortcut(e){if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!modal)setModal('search')}}document.addEventListener('keydown',shortcut);return()=>document.removeEventListener('keydown',shortcut)},[modal]);function notify(m){setToast(m);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4500)}async function action(i,a,outcome){setBusy(true);try{await api.action(i.id,a,outcome);await load();setModal(null);notify(a==='void'?'Invoice voided':a==='call'?'Voice call requested':'Demo result recorded. No money moved.')}catch(e){setModal(null);setError(e.message)}finally{setBusy(false)}}const chosen=invoices.find(i=>i.id===selected);const active=invoices.filter(i=>i.status==='OPEN');const paid=invoices.filter(i=>i.status==='PAID');const outstanding=active.reduce((s,i)=>s+i.total,0),collected=paid.reduce((s,i)=>s+i.total,0);const filtered=invoices.filter(i=>(i.client+' '+i.number+' '+i.email).toLowerCase().includes(search.toLowerCase())&&(filter==='All invoices'||(filter==='Pending'?status(i)==='OPEN':filter==='Overdue'?status(i)==='OVERDUE':filter==='Paid'?i.status==='PAID':i.status==='VOID'))&&matchesFilters(i,filters));function nav(v){setView(v);setSelected(null);setSearch('');setFilter('All invoices');setFilters(emptyFilters());setClientSearch('');setMobile(false)}function editInvoice(i,field='number'){setSelected(i.id);setEditField(field);setModal('edit');setError('')}function openNew(c=null){setInvoiceClient(c?.email?c:null);setModal('new');setError('')}function exportCSV(){const cell=v=>'"'+String(/^[=+@\-]/.test(String(v))?'\t'+v:v).replaceAll('"','""')+'"';const lines=[['Invoice','Client','Email','Due date','Payment date','Aging days past due','Payment method','Check number','Amount USD','Status'],...filtered.map(i=>[i.number,i.client,i.email,i.dueDate,paymentDay(i)||'',aging(i).days??'',paymentLabels[i.paymentMethod]||'',i.checkNumber||'',i.total.toFixed(2),status(i)])];const blob=new Blob([lines.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='autopay-invoices.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Invoice export downloaded')}
return <div className="shell">
<aside className={mobile?'sidebar open':'sidebar'}>
<a href="#" className="logo" onClick={e=>{e.preventDefault();nav('Overview')}}>
<span className="logomark">a</span>autopay<span className="logodot">.</span>
</a>
<div className="workspace">
<span className="avatar small">{account.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</span>
<div><select aria-label="Select business workspace" className="business-select" value={business.id} onChange={e=>switchBusiness(e.target.value)}>{businesses.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select><small>{business.role==='OWNER'?'Business owner':'Team member'}</small></div>
<ChevronDown size={14}/>
</div>
<div className="navlabel">WORKSPACE</div>
<nav>{[['Overview',LayoutDashboard],['Invoices',FileText],['Clients',Users],['Assistant',Sparkles],['Voice activity',Phone],['Trash',Trash2]].map(([v,I])=>
<button className={view===v?'active':''} key={v} onClick={()=>nav(v)}>
<Icon icon={I}/>{v}{v==='Invoices'&&<span className="navcount">{invoices.length}</span>}</button>)}</nav>
<div className="sidebarbottom">
<div className="demo-card">
<div className="demoicon">
<ShieldCheck size={19}/>
</div>
<b>{live?'Live payments':'Your shared workspace'}</b>
<p>{live?'Connected to your Java backend. Calls can charge real money.':'Your team shares business records. Payment simulations never move money.'}</p>
<button onClick={()=>nav('Settings')}>{backend?'Connection settings':'About this demo'} <ArrowUpRight size={13}/>
</button>
</div>
<nav>
<button onClick={()=>nav('Settings')} className={view==='Settings'?'active':''}>
<Icon icon={Settings}/>Settings</button>
</nav>
<div className="profile">
<span className="avatar">{account.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</span>
<div>{account.name}<small>{account.email}</small>
</div>
<span className="online-dot"/>
</div>
</div>
</aside>
<div className="mainarea">
<header className="topbar">
<div className="breadcrumb">
<button className="mobilemenu" aria-label="Toggle navigation" onClick={()=>setMobile(!mobile)}>
<Menu size={20}/>
</button>
<span>Workspace</span>
<ChevronRight size={13}/>
<b>{view}</b>
</div>
<button aria-label="Search workspace" className="workspace-search" onClick={()=>setModal('search')}><Search size={15}/><span>Search clients or invoices</span><kbd>⌘ K</kbd></button><span className="mode">
<i/>{backend?(live?'Live backend':'Backend demo'):'Interactive demo'}</span>
</header>
<main>{error&&<div role="alert" className="error">
<AlertCircle size={17}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss error">
<X size={15}/>
</button>
</div>}{chosen?<>
<button className="back" onClick={()=>setSelected(null)}>
<ArrowLeft size={15}/> Back to invoices</button>
<div className="pageheading">
<div>
<div className="eyebrow">INVOICE DETAILS</div>
<h1>{chosen.number}</h1>
<p>Created {new Date(chosen.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
</div>
<div className="actions"><button className="secondary" onClick={()=>editInvoice(chosen)}>Edit invoice</button><button className="secondary delete-invoice" onClick={()=>setModal('delete')}><Trash2 size={14}/>Delete</button>
<button className="secondary" onClick={()=>window.print()}>
<Icon icon={Download}/> Print / PDF</button>{chosen.status==='OPEN'&&<button className="primary" onClick={()=>setModal('voice')}>
<Icon icon={Phone}/>{live?'Call client to collect payment':'Voice payment options'}</button>}</div>
</div>
<div className="detail-grid">
<div className="invoice-paper">
<div className="paperhead">
<span className="logo">
<span className="logomark">a</span>autopay.</span>
<Badge invoice={chosen}/>
</div>
<div className="paper-info">
<div>
<span className="label">BILL TO</span>
<h3>{chosen.client}</h3>
<p>{chosen.email}<br/>{chosen.phone||'No phone provided'}</p>
</div>
<div>
<span className="label">INVOICE</span>
<p>{chosen.number}<br/>Due {chosen.dueDate}</p>
</div>
</div>
<table>
<thead>
<tr>
<th>Description</th>
<th>Qty</th>
<th>Rate</th>
<th>Amount</th>
</tr>
</thead>
<tbody>{chosen.items.map((l,n)=>
<tr key={n}>
<td>{l.description}</td>
<td>{l.quantity}</td>
<td>{money(l.unitPrice)}</td>
<td>{money(l.quantity*l.unitPrice)}</td>
</tr>)}</tbody>
</table>
<div className="paper-total">
<span>{chosen.status==='PAID'?'Amount paid':'Invoice total'} <small>USD</small>
</span>
<strong>{money(chosen.total)}</strong>
</div>
<div className="invoice-notes"><div><span className="label">INVOICE NOTES</span><button className="secondary" onClick={()=>setModal('notes')}>{chosen.notes?'Edit notes':'Add notes'}</button></div><p className="paper-notes">{chosen.notes||'No notes yet. Add payment instructions or a message for this invoice.'}</p></div>
{chosen.status==='PAID'&&<div className="payment-summary"><div><span className="label">PAYMENT DATE</span><p>{paymentDay(chosen)||'Not recorded'}</p></div><div><span className="label">PAYMENT METHOD</span><p>{paymentLabels[chosen.paymentMethod]||'Not specified'}{chosen.paymentMethod==='CHECK'&&chosen.checkNumber?' · #'+chosen.checkNumber:''}</p></div><button className="secondary" onClick={()=>setModal('payment')}>Edit payment details</button></div>}<div className="paperfooter">{live?'Payment managed through AutoPay.':'DEMO INVOICE · No real payment is requested.'}</div>
</div>
<div>
<Attachments invoice={chosen} onUpdate={load}/><div className="panel activitypanel">
<h3>Invoice timeline</h3>{[...chosen.activity].reverse().map((event,n)=>{const [time,message]=event.split(' | ');return <div className="timeline" key={n}>
<span className="timeline-dot"/>
<div>
<b>{message}</b>
<small>{new Date(time).toLocaleString()}</small>
</div>
</div>})}</div>{chosen.status==='OPEN'&&<button className="voidbutton" onClick={()=>setModal('void')}>
<Trash2 size={14}/>Void invoice</button>}</div>
</div>
</>:<>
<div className="pageheading">
<div>
<div className="eyebrow">YOUR FINANCES, IN FOCUS</div>
<h1>{view==='Assistant'?'Your workspace has answers.':view==='Overview'?'A little less chasing.':view==='Invoices'?'Every invoice, in one place.':view==='Clients'?'The people you work with.':view==='Voice activity'?'Let your invoices speak.':view==='Trash'?'Deleted, with a way back.':'Your workspace, connected.'}</h1>
<p>{view==='Assistant'?'Ask a question. Understand your invoices and clients.':view==='Overview'?'A clearer view of your cash flow. A better way to get paid.':view==='Invoices'?'Create, track, and manage your invoices from start to finish.':view==='Clients'?'Create clients, keep their contact details, and start invoices in a click.':view==='Voice activity'?'A transparent history of voice collection and payment events.':view==='Trash'?'Deleted invoices and their attachments stay here until you restore them.':'Explore locally, or connect the full-stack version.'}</p>
</div>{view==='Clients'&&<button className="primary" onClick={()=>{setEditingClient(null);setModal('client')}}><Plus size={17}/>New client</button>}{['Overview','Invoices'].includes(view)&&<button className="primary" onClick={openNew}>
<Plus size={17}/>Create invoice</button>}</div>{view==='Assistant'&&<Assistant business={business}/>} {view==='Overview'&&<>
<div className="stats">
<Stat label="Total collected" amount={collected} sub={`${paid.length} paid invoices`} icon={ArrowDownLeft} tone="green"/>
<Stat label="Outstanding" amount={outstanding} sub={`${active.length} awaiting payment`} icon={Wallet}/>
<Stat label="Overdue" amount={active.filter(i=>status(i)==='OVERDUE').reduce((s,i)=>s+i.total,0)} sub={`${active.filter(i=>status(i)==='OVERDUE').length} need a follow-up`} icon={Clock} tone="orange"/>
<Stat label="Total invoiced" amount={invoices.filter(i=>i.status!=='VOID').reduce((s,i)=>s+i.total,0)} sub={`${invoices.filter(i=>i.status!=='VOID').length} active & paid invoices`} icon={FileText}/>
</div>
<div className="overview-grid">
<div className="panel cashflow">
<div className="panelhead">
<div>
<h3>Collection overview</h3>
<p>A snapshot of your invoice portfolio</p>
</div>
<span className="mini-pill">All time</span>
</div>
<div className="chart-total">{money(collected)}<span>collected to date</span>
</div>
<div className="bars" aria-label="Amounts by invoice">{invoices.filter(i=>i.status!=='VOID').slice(0,8).reverse().map(i=>
<div className="barcolumn" key={i.id}>
<button aria-label={`${i.client}: ${money(i.total)}, ${status(i)}`} onClick={()=>setSelected(i.id)} style={{height:Math.max(10,130*i.total/Math.max(1,...invoices.map(i=>i.total)))}} className={i.status==='PAID'?'bar paidbar':'bar'}/>
<small>{i.client.split(' ')[0]}</small>
</div>)}</div>
<div className="chartlegend">
<span>
<i className="legend paidlegend"/>Collected</span>
<span>
<i className="legend"/>Outstanding</span>
<small>Click a bar to view its invoice</small>
</div>
</div>
<div className="voice-banner">
<div className="voicegraphic">
<span className="phonecircle">
<Phone size={24}/>
</span>
<span className="wave">▂ ▅ ▃ ▇ ▅ ▂ ▆ ▃</span>
</div>
<span className="mini-pill">VOICE-POWERED PAYMENTS</span>
<h2>A friendly call.<br/>A simpler payment.</h2>
<p>Connect invoice collection with a guided voice experience.</p>
<button onClick={()=>{const i=active[0];if(i){setSelected(i.id);setModal('voice')}else notify('Create an open invoice to try voice payments.')}}>Explore voice payments <ArrowUpRight size={15}/>
</button>
<small>{live?'Twilio integration enabled':'Simulation mode · no calls or charges'}</small>
</div>
</div>
</>}{['Overview','Invoices'].includes(view)&&<div className="panel invoice-list">
<div className="panelhead">
<div>
<h3>{view==='Overview'?'Your invoices':'Invoice workspace'} <span className="count">{invoices.length}</span>
</h3>
<p>Keep track of what’s paid and what’s next.</p>
</div>
<button className="secondary" onClick={exportCSV}>
<Download size={14}/>Export CSV</button>
</div>
<div className="tabletools"><button className="secondary filter-toggle" onClick={()=>setShowFilters(!showFilters)}>{showFilters?'Hide filters':'Filter invoices'}{Object.values(filters).some(Boolean)&&<span className="filter-dot"/>}<ChevronDown size={13}/></button>
<div className="tabs">{['All invoices','Pending','Paid','Overdue','Void'].map(f=>
<button className={filter===f?'selected':''} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div>
<label className="search">
<Search size={15}/>
<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoices…" aria-label="Search invoices"/>
</label>
</div>
{showFilters&&<InvoiceFilters values={filters} onChange={setFilters} statusFilter={filter} setStatus={setFilter} clear={()=>{setFilters(emptyFilters());setFilter('All invoices');setSearch('')}}/>}<div className="table-scroll">
<table>
<thead>
<tr>
<th>Invoice / Client</th>
<th>Due date</th>
<th>Payment date</th><th>Aging</th><th>Payment method</th><th>Amount</th>
<th>Status</th>
<th>
</th>
</tr>
</thead>
<tbody>{filtered.map(i=>
<tr key={i.id}>
<td>
<button className="invoice-name" onClick={()=>editInvoice(i,'client')}>
<span className={'client-avatar color'+i.client.length%4}>{i.client.split(' ').map(s=>s[0]).join('').slice(0,2)}</span>
<span>
<b>{i.client}</b>
<small>{i.number}</small>
</span>
</button>
</td>
<td><button className="cell-edit" aria-label={'Edit due date for '+i.number} onClick={()=>editInvoice(i,'dueDate')}>{new Date(i.dueDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</button></td>
<td><button className="cell-edit" aria-label={'Edit payment date for '+i.number} onClick={()=>editInvoice(i,'paymentDate')}>{i.status==='PAID'?(paymentDay(i)||'Not recorded'):'—'}</button></td><td><button className={status(i)==='OVERDUE'?'cell-edit aging overdue':'cell-edit aging'} aria-label={'Edit aging for '+i.number} onClick={()=>editInvoice(i,'aging')}>{aging(i).text}</button></td><td>{i.status==='PAID'?<button className="payment-cell" onClick={()=>{setSelected(i.id);setModal('payment')}}><span>{paymentLabels[i.paymentMethod]||'Add payment type'}</span>{i.paymentMethod==='CHECK'&&i.checkNumber&&<small>#{i.checkNumber}</small>}<ChevronDown size={12}/></button>:<button className="cell-edit" aria-label={'Edit payment method for '+i.number} onClick={()=>editInvoice(i,'paymentMethod')}>—</button>}</td><td className="amount"><button className="cell-edit" aria-label={'Edit amount for '+i.number} onClick={()=>editInvoice(i,'unitPrice')}>{money(i.total)}</button></td>
<td><button className="cell-edit" aria-label={'Edit status for '+i.number} onClick={()=>editInvoice(i,'status')}><Badge invoice={i}/></button></td>
<td>
<button className="rowbutton" aria-label={`View ${i.number}`} onClick={()=>setSelected(i.id)}>
<ArrowUpRight size={16}/>
</button>
</td>
</tr>)}</tbody>
</table>{!filtered.length&&<div className="empty">
<FileText size={28}/>
<h3>No invoices here yet</h3>
<p>{invoices.length?'No invoices match your search and filters.':'Create your first invoice to get started.'}</p>{!invoices.length&&<button className="primary" onClick={openNew}>Create invoice</button>}</div>}</div>
<div className="tablefooter">Showing {filtered.length} of {invoices.length} invoices <span>
<ShieldCheck size={13}/> Shared with your team</span>
</div>
</div>}{view==='Clients'&&<><label className="client-directory-search"><Search size={16}/><input aria-label="Search client directory" value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="Find a client by name, email, phone, or notes…"/>{clientSearch&&<button aria-label="Clear client search" onClick={()=>setClientSearch('')}><X size={14}/></button>}</label><div className="clientgrid">{!clients.length&&<div className="panel empty"><Users size={25}/><h3>Your client directory starts here</h3><button className="primary" onClick={()=>{setEditingClient(null);setModal('client')}}>New client</button></div>}{workspaceMatches(clientSearch||' ',[],clients).clients.length===0&&clientSearch&&<div className="panel empty"><h3>No matching clients</h3><button className="secondary" onClick={()=>setClientSearch('')}>Clear search</button></div>}{(clientSearch?workspaceMatches(clientSearch,[],clients).clients:clients).map(c=>
<div className="panel clientcard" key={c.email}>
<span className="client-avatar color1">{c.name.slice(0,2).toUpperCase()}</span>
<h3><button className="client-title" onClick={()=>{setEditingClient(c);setModal('clientdetails')}} aria-label={'View client '+c.name}>{c.name}<ArrowUpRight size={14}/></button></h3>
<p>{c.email}<br/>{c.phone||'No phone provided'}{c.contactName&&<><br/>Contact: {c.contactName}</>}{c.website&&<><br/>{c.website}</>}</p><div className="client-edit-actions"><button className="secondary" onClick={()=>{setEditingClient(c);setModal('client')}}>Edit client</button></div><section className="client-info-section"><h4>Business address</h4><p>{c.address||'No business address added.'}</p></section><section className="client-info-section"><h4>Bank information</h4><p>{c.bankLast4?'Account ending in '+c.bankLast4:'No bank information saved.'}</p>{c.canManageBank?<button className="secondary" onClick={()=>{setEditingClient(c);setModal('bank')}}>{c.bankLast4?'Edit bank information':'Add bank information'}</button>:<small>Full bank details are managed by the business owner.</small>}</section>{c.notes&&<p className="client-note">{c.notes}</p>}
<div>
<span>{invoices.filter(i=>i.email===c.email).length} invoices</span>
<b>{money(invoices.filter(i=>i.email===c.email&&i.status==='OPEN').reduce((s,i)=>s+i.total,0))} outstanding</b>
</div>
<button className="primary" onClick={()=>openNew(c)}><Plus size={14}/>Create invoice</button><button className="secondary" onClick={()=>{setView('Invoices');setSearch(c.email)}}>View invoices <ArrowUpRight size={14}/>
</button>
</div>)}</div></>}{view==='Voice activity'&&<div className="panel activitypanel">
<h3>Call & payment history</h3>
<p className="muted">{live?'Provider events from signed callbacks.':'Demo events are simulated. No real calls or payments occur.'}</p>{invoices.flatMap(i=>i.activity.filter(e=>/voice|payment/i.test(e)).map((e,n)=>({i,e,key:i.id+n}))).sort((a,b)=>b.e.localeCompare(a.e)).map(({i,e,key})=>
<button className="activityrow" key={key} onClick={()=>setSelected(i.id)}>
<span className="activityicon">
<Phone size={16}/>
</span>
<span>
<b>{e.split(' | ')[1]}</b>
<small>{i.client} · {i.number} · {new Date(e.split(' | ')[0]).toLocaleString()}</small>
</span>
<ChevronRight size={15}/>
</button>)}{!invoices.some(i=>i.activity.some(e=>/voice|payment/i.test(e)))&&<div className="empty">No voice activity yet. Try a payment simulation on an open invoice.</div>}</div>}{view==='Trash'&&<div className="panel activitypanel"><h3>Deleted invoices <span className="count">{trash.length}</span></h3>{!trash.length&&<div className="empty">Trash is empty.</div>}{trash.map(i=><div className="trash-row" key={i.id}><div><b>{i.number} · {i.client}</b><small>{money(i.total)} · Due {i.dueDate}</small></div><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await api.restore(i.id);await load();notify('Invoice restored')}catch(e){setError(e.message)}finally{setBusy(false)}}}><RefreshCw size={14}/>Restore</button></div>)}</div>}{view==='Settings'&&<><BusinessSettings business={business} account={account}/><VoiceSetup setup={voiceSetup} live={live} refresh={load}/><div className="settings-grid">
<div className="panel activitypanel">
<h3>Connection</h3>
<div className="settingrow">
<span>Workspace mode</span>
<b>Cloud business API</b>
</div>
<div className="settingrow">
<span>Storage</span>
<b>Shared cloud database</b>
</div>
<div className="settingrow">
<span>Voice payments</span>
<b>{live?'Live — configured':'Simulated'}</b>
</div>
<p className="muted">Business records and files are stored in the cloud and shared only with members of this business.</p>
<button className="secondary" onClick={load}>
<RefreshCw size={14}/>Refresh connection</button>
</div>
<div className="panel activitypanel">
<h3>Your account</h3>
<p className="muted">Signed in as {account.email}. Each teammate uses an individual login and sees this business’s shared records.</p>{!backend&&<button className="secondary" onClick={()=>setModal('reset')}>
<RefreshCw size={14}/>Reset sample workspace</button>}<SignOutButton className="secondary"><LogOut size={14}/>Log out</SignOutButton><p className="privacy-note">AutoPay does not ask for or store card numbers. Live voice payments use Twilio Pay and a configured payment connector.</p>
</div>
</div></>}</>}<footer>AutoPay <span>AutoPay business workspace</span>
<span>{business.name}</span>
</footer>
</main>
</div>{toast&&<div className="toast" role="status">
<CheckCircle2 size={17}/>{toast}</div>}{modal&&<Modal title={modal==='client'?(editingClient?'Edit client':'Create a client'):({search:'Search your workspace',new:'Create an invoice',edit:'Edit invoice',delete:'Delete this invoice?',bank:'Client bank information',clientdetails:'Client profile',notes:'Invoice notes',payment:'Payment details',voice:'Voice payment',void:'Void this invoice?',reset:'Reset demo workspace?'})[modal]||'Workspace' } onClose={()=>{if(!busy)setModal(null)}}>{modal==='clientdetails'&&editingClient?<ClientDetails client={editingClient} edit={()=>setModal('client')} bank={()=>setModal('bank')} invoice={()=>openNew(editingClient)}/>:modal==='bank'&&editingClient?<BankForm client={editingClient} onUpdated={load}/>:modal==='search'?<WorkspaceSearch invoices={invoices} clients={clients} onInvoice={i=>{setModal(null);nav('Invoices');setSelected(i.id)}} onClient={c=>{setModal(null);nav('Clients');setClientSearch(c.email)}}/>:modal==='delete'&&chosen?<><p className="muted">{chosen.number} will move to Trash with its notes and attachments. It can be restored later. Deletion does not cancel a call, charge, or refund.</p><button className="danger" disabled={busy} onClick={async()=>{setBusy(true);try{await api.delete(chosen.id);setSelected(null);setModal(null);await load();notify('Invoice moved to Trash')}catch(e){setModal(null);setError(e.message)}finally{setBusy(false)}}}>{busy?'Deleting…':'Move to Trash'}</button></>:modal==='edit'&&chosen?<InvoiceForm clients={clients} initialInvoice={chosen} focusField={editField} busy={busy} onSave={async d=>{setBusy(true);try{await api.update(chosen.id,d);await load();setModal(null);notify('Invoice changes saved')}finally{setBusy(false)}}}/>:modal==='payment'&&chosen?<PaymentForm invoice={chosen} busy={busy} onSave={async(method,check)=>{setBusy(true);try{await api.paymentDetails(chosen.id,method,check);await load();setModal(null);notify('Payment details saved')}finally{setBusy(false)}}}/>:modal==='client'?<ClientForm initialClient={editingClient} busy={busy} onSave={async d=>{setBusy(true);try{if(editingClient)await api.updateClient(editingClient.id,d);else await api.createClient(d);await load();setModal(null);notify(editingClient?'Client updated':'Client created')}finally{setBusy(false)}}}/>:modal==='notes'&&chosen?<NotesForm invoice={chosen} busy={busy} onSave={async notes=>{setBusy(true);try{await api.notes(chosen.id,notes);await load();setModal(null);notify('Invoice notes saved')}finally{setBusy(false)}}}/>:modal==='new'?<InvoiceForm clients={clients} initialClient={invoiceClient} onSave={async d=>{setBusy(true);try{const i=await api.create(d);await load();setModal(null);setSelected(i.id);notify('Invoice created')}catch(e){throw e}finally{setBusy(false)}}} busy={busy}/>:modal==='voice'&&chosen?<VoiceDialog invoice={chosen} live={live} onSetup={()=>{setModal(null);nav('Settings')}} busy={busy} onRun={outcome=>action(chosen,live?'call':'simulate',outcome)}/>:modal==='void'?<>
<p className="muted">This invoice will remain in your records, but it can no longer be paid. This cannot be undone in the workspace.</p>
<button className="danger" disabled={busy} onClick={()=>action(chosen,'void')}>{busy?'Saving…':'Void invoice'}</button>
</>:<>
<p className="muted">This removes all browser demo data and restores the sample workspace.</p>
<button className="danger" onClick={async()=>{try{await api.reset();await load();setModal(null);notify('Sample workspace restored')}catch(e){setError(e.message)}}}>Reset workspace</button>
</>}</Modal>}</div>}
function Stat({label,amount,sub,icon:I,tone=''}){return <div className="stat">
<div className="stathead">
<span>{label}</span>
<span className={'stat-icon '+tone}>
<I size={17}/>
</span>
</div>
<strong>{money(amount)}</strong>
<small>{sub}</small>
</div>}
function Modal({title,onClose,children}){const ref=useRef();useEffect(()=>{const el=ref.current;el.showModal();return()=>el.close()},[]);return <dialog ref={ref} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}}>
<div className="modalhead">
<h2>{title}</h2>
<button aria-label="Close dialog" onClick={onClose}>
<X size={20}/>
</button>
</div>{children}</dialog>}
function InvoiceForm({onSave,busy,clients=[],initialClient,initialInvoice,focusField}){const formRef=useRef();const[d,setD]=useState(initialInvoice?{client:initialInvoice.client,email:initialInvoice.email,phone:initialInvoice.phone||'',dueDate:initialInvoice.dueDate,notes:initialInvoice.notes||'',items:initialInvoice.items.map(i=>({...i})),number:initialInvoice.number,status:initialInvoice.status,paymentDate:paymentDay(initialInvoice)||'',paymentMethod:initialInvoice.paymentMethod||'',checkNumber:initialInvoice.checkNumber||''}:{client:initialClient?.name||'',email:initialClient?.email||'',phone:initialClient?.phone||'',dueDate:localDate(14),notes:'Thank you for your business.',items:[{description:'',quantity:1,unitPrice:''}]}),[error,setError]=useState('');useEffect(()=>{if(initialInvoice&&focusField)formRef.current?.querySelector('[name="'+focusField+'"]')?.focus()},[]);function change(k,v){setD({...d,[k]:v})}function item(n,k,v){change('items',d.items.map((l,i)=>i===n?{...l,[k]:v}:l))}let sum;try{sum=total(d.items)}catch{sum=0}async function submit(e){e.preventDefault();try{total(d.items);await onSave({...d,items:d.items.map(i=>({...i,quantity:Number(i.quantity),unitPrice:Number(i.unitPrice)}))})}catch(e){setError(e.message)}}return <form ref={formRef} onSubmit={submit}>
{initialInvoice&&<><p className="edit-notice">These changes edit invoice records. Changing status to Paid records an external/manual payment; it does not charge a client. Reopening or voiding a paid invoice does not refund a payment.</p><div className="form-grid edit-controls"><label>Invoice number<input name="number" required maxLength={80} value={d.number} onChange={e=>change('number',e.target.value)}/></label><label>Status<select name="status" value={d.status} onChange={e=>setD({...d,status:e.target.value,paymentDate:e.target.value==='PAID'?(d.paymentDate||localDate()):d.paymentDate})}><option value="OPEN">Open (pending / overdue)</option><option value="PAID">Paid</option><option value="VOID">Void</option></select></label><label>Payment date<input name="paymentDate" type="date" disabled={d.status!=='PAID'} required={d.status==='PAID'&&initialInvoice.status!=='PAID'} value={d.paymentDate} onChange={e=>change('paymentDate',e.target.value)}/><small>{d.status==='PAID'?'Date the payment was recorded; blank means unknown.':'Set status to Paid to record a payment date.'}</small></label><label>Payment method<select name="paymentMethod" disabled={d.status!=='PAID'} required={d.status==='PAID'&&initialInvoice.status!=='PAID'} value={d.paymentMethod} onChange={e=>change('paymentMethod',e.target.value)}><option value="">Not specified</option>{Object.entries(paymentLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>{d.status==='PAID'&&d.paymentMethod==='CHECK'&&<label>Check number<input name="checkNumber" required maxLength={80} value={d.checkNumber} onChange={e=>change('checkNumber',e.target.value)}/></label>}<label>Aging days (negative = due in)<input name="aging" type="number" step="1" min="-36500" max="36500" disabled={d.status==='VOID'||(d.status==='PAID'&&!d.paymentDate)} value={d.status==='VOID'||(d.status==='PAID'&&!d.paymentDate)?'':Math.round((Date.parse((d.status==='PAID'?d.paymentDate:localDate())+'T00:00:00Z')-Date.parse(d.dueDate+'T00:00:00Z'))/86400000)} onChange={e=>{if(e.target.value===''||!Number.isInteger(Number(e.target.value)))return;const date=new Date((d.status==='PAID'?d.paymentDate:localDate())+'T12:00:00');date.setDate(date.getDate()-Number(e.target.value));change('dueDate',`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`)}}/><small>Changing aging adjusts the due date. Paid aging uses the payment date.</small></label></div></>}<p className="muted">Choose a saved client or enter client details manually, then add your line items.</p><label className="savedclient">Saved client<select defaultValue={initialClient?.email||''} onChange={e=>{const c=clients.find(c=>c.email===e.target.value);setD({...d,client:c?.name||'',email:c?.email||'',phone:c?.phone||''})}}><option value="">Enter client details manually</option>{clients.map(c=><option key={c.email} value={c.email}>{c.name} — {c.email}</option>)}</select></label>
<div className="form-grid">
<label>Client / business name<input name="client" required maxLength={150} value={d.client} onChange={e=>change('client',e.target.value)} placeholder="e.g. Northstar Studio"/>
</label>
<label>Email address<input required type="email" maxLength={200} value={d.email} onChange={e=>change('email',e.target.value)} placeholder="billing@company.com"/>
</label>
<label>Phone number <small>optional · E.164 format</small>
<input type="tel" pattern="\+[1-9][0-9]{7,14}" value={d.phone} onChange={e=>change('phone',e.target.value)} placeholder="+19155550100"/>
</label>
<label>Due date<input name="dueDate" required type="date" value={d.dueDate} onChange={e=>change('dueDate',e.target.value)}/>
</label>
</div>
<div className="lineheading">
<b>Line items</b>
<span>USD</span>
</div>{d.items.map((l,n)=>
<div className="lineitem" key={n}>
<label>Description<input aria-label={`Item ${n+1} description`} required maxLength={250} value={l.description} onChange={e=>item(n,'description',e.target.value)} placeholder="Service or product"/>
</label>
<label>Qty<input aria-label={`Item ${n+1} quantity`} type="number" min="1" max="10000" step="1" required value={l.quantity} onChange={e=>item(n,'quantity',e.target.value)}/>
</label>
<label>Unit price<input name="unitPrice" aria-label={`Item ${n+1} price`} type="number" min="0.01" max="1000000" step="0.01" required value={l.unitPrice} onChange={e=>item(n,'unitPrice',e.target.value)} placeholder="0.00"/>
</label>
<button type="button" aria-label={`Remove item ${n+1}`} disabled={d.items.length===1} onClick={()=>change('items',d.items.filter((_,i)=>i!==n))}>
<Trash2 size={16}/>
</button>
</div>)}<button className="addline" type="button" disabled={d.items.length>=50} onClick={()=>change('items',[...d.items,{description:'',quantity:1,unitPrice:''}])}>
<Plus size={14}/>Add line item</button>
<label className="noteslabel">Notes<textarea maxLength={2000} value={d.notes} onChange={e=>change('notes',e.target.value)}/>
</label>
<div className="formtotal">
<span>Total</span>
<strong>{money(sum)}</strong>
</div>{error&&<p className="error" role="alert">{error}</p>}<button className="primary submit" disabled={busy}>{busy?'Saving…':initialInvoice?'Save invoice changes':'Create invoice'}<ArrowUpRight size={16}/>
</button>
</form>}
function VoiceDialog({invoice,live,busy,onRun,onSetup}){const[outcome,setOutcome]=useState('success'),[consent,setConsent]=useState(false);return <>
<>{!live&&<div className="call-setup-notice"><b>Live calls are not connected</b><p>Complete Twilio and backend setup to call clients and collect real payments.</p><button className="secondary" onClick={onSetup}>Set up live calls <ArrowUpRight size={14}/></button></div>}</><div className="call-summary">
<span className="phonecircle">
<Phone size={22}/>
</span>
<div>
<b>{invoice.client}</b>
<p>{invoice.number} · {money(invoice.total)}</p>
</div>
</div>
<div className="voice-script">
<span className="eyebrow">{live?'CALL PREVIEW':'SIMULATED CALL SCRIPT'}</span>
<p>“This is AutoPay. You can pay invoice {invoice.number} for {money(invoice.total)}. Follow the secure payment prompts to continue.”</p>
<small>{live?'Twilio Pay collects payment details through your configured connector.':'Demo only. No phone call is placed and no card details are collected.'}</small>
</div>{live?<label className="consent">
<input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I have permission to call {invoice.phone||'this client'} and understand that a completed payment can charge {money(invoice.total)}.</label>:<label className="outcomelabel">Choose a demo outcome<select value={outcome} onChange={e=>setOutcome(e.target.value)}>
<option value="success">Payment succeeds</option>
<option value="failed">Payment fails / client doesn’t pay</option>
</select>
</label>}<button className="primary submit" disabled={busy||(live&&(!consent||!invoice.phone))} onClick={()=>onRun(outcome)}>
<Play size={15}/>{busy?'Processing…':live?'Place live payment call':'Run simulation'}</button>
</>}
export default App;
function ClientForm({onSave,busy,initialClient}){const[d,setD]=useState({name:initialClient?.name||'',email:initialClient?.email||'',phone:initialClient?.phone||'',notes:initialClient?.notes||'',address:initialClient?.address||'',contactName:initialClient?.contactName||'',website:initialClient?.website||''}),[error,setError]=useState('');return <form onSubmit={async e=>{e.preventDefault();try{await onSave(d)}catch(e){setError(e.message)}}}><p className="muted">Save a client before creating any invoices. Use an international phone number for payment calls.</p><div className="form-grid"><label>Client name<input required maxLength={150} value={d.name} onChange={e=>setD({...d,name:e.target.value})} placeholder="Business or contact name"/></label><label>Client email<input required type="email" maxLength={200} value={d.email} onChange={e=>setD({...d,email:e.target.value})} placeholder="billing@company.com"/></label><label>Client phone <small>optional · international format</small><input type="tel" pattern="\+[1-9][0-9]{7,14}" value={d.phone} onChange={e=>setD({...d,phone:e.target.value})} placeholder="+19155550100"/></label></div><div className="form-grid" style={{marginTop:18}}><label>Contact person<input maxLength={150} value={d.contactName} onChange={e=>setD({...d,contactName:e.target.value})}/></label><label>Client website<input type="url" maxLength={250} placeholder="https://example.com" value={d.website} onChange={e=>setD({...d,website:e.target.value})}/></label></div><label className="noteslabel">Client business address<textarea maxLength={500} value={d.address} onChange={e=>setD({...d,address:e.target.value})}/></label><label className="noteslabel">Client notes<textarea maxLength={2000} value={d.notes} onChange={e=>setD({...d,notes:e.target.value})} placeholder="Contact preferences or business details"/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary submit" disabled={busy}>{busy?'Saving…':initialClient?'Save client changes':'Save client'}<Plus size={15}/></button></form>}
function NotesForm({invoice,onSave,busy}){const[notes,setNotes]=useState(invoice.notes||''),[error,setError]=useState('');return <form onSubmit={async e=>{e.preventDefault();try{await onSave(notes)}catch(e){setError(e.message)}}}><p className="muted">Notes belong to {invoice.number} and appear on its printable invoice. Saving also adds an entry to the timeline.</p><label>Invoice notes<textarea autoFocus maxLength={2000} rows={7} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Payment instructions, a project reference, or a message for this invoice"/></label><div className="notescount">{notes.length} / 2,000 characters</div>{error&&<p className="error" role="alert">{error}</p>}<button className="primary submit" disabled={busy}>{busy?'Saving…':'Save notes'}<Check size={16}/></button></form>}
function VoiceSetup({setup,live,refresh}){const[step,setStep]=useState(0);const steps=[{title:'Host the Java backend',key:'backend',text:'The private preview runs in your browser. Deploy the included Docker app and MySQL database to a host that runs Java containers. Serve the app and API together over HTTPS.',link:'https://docs.docker.com/compose/gettingstarted/',label:'Docker setup guide'},{title:'Create your Twilio account',key:'accountSid',text:'Create an account, then save TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your server’s secret environment settings. Do not put them in this browser or source files.',link:'https://www.twilio.com/console',label:'Open Twilio Console'},{title:'Choose your calling number',key:'fromNumber',text:'Get a voice-capable Twilio number and set TWILIO_FROM_NUMBER in international format. Start by calling a number you control before contacting customers.',link:'https://www.twilio.com/docs/voice/quickstart',label:'Voice quickstart'},{title:'Connect payment processing',key:'payConnector',text:'Configure a Twilio Pay connector with a supported payment processor and complete Twilio’s required payment setup. Set TWILIO_PAY_CONNECTOR to the connector’s unique name. Use the provider’s test mode first.',link:'https://www.twilio.com/docs/voice/twiml/pay',label:'Twilio Pay setup'},{title:'Configure and test callbacks',key:'publicUrl',text:'Set PUBLIC_BASE_URL to your public HTTPS backend origin. Twilio must reach /webhooks/voice/* without workspace login; signatures are checked by the backend. The exact public URL must match your configuration.',link:'https://www.twilio.com/docs/usage/webhooks/webhooks-security',label:'Webhook security guide'},{title:'Enable live calls',key:'enabled',text:'After testing your provider configuration, set AUTOPAY_LIVE=true on the server and restart it. Refresh the connection below. Open an unpaid invoice, review its phone number and amount, and confirm permission before placing a payment call.',link:null}];const current=steps[step];const checks=[['backend','Java backend connected'],['accountSid','Account SID configured'],['authToken','Auth token configured'],['fromNumber','Calling number configured'],['payConnector','Pay connector configured'],['publicUrl','Public HTTPS URL configured'],['enabled','Live mode enabled']];return <section className="panel voice-setup"><div className="setup-heading"><div><span className="eyebrow">VOICE PAYMENT SETUP</span><h2>Turn invoices into conversations.</h2><p>{live?'Your server configuration is present. Verify the provider’s test flow before charging customers.':'Connect Twilio and a payment processor to place real collection calls.'}</p></div><span className={live?'setup-status ready':'setup-status'}>{live?'Configured · verify with provider':'Not connected'}</span></div><div className="setup-layout"><div className="setup-steps">{steps.map((s,n)=><button key={s.title} onClick={()=>setStep(n)} className={step===n?'selected':''}><span className={setup[s.key]?'step-number complete':'step-number'}>{setup[s.key]?<Check size={13}/>:n+1}</span>{s.title}<ChevronRight size={14}/></button>)}</div><div className="setup-content"><span className="eyebrow">STEP {step+1} OF {steps.length}</span><h3>{current.title}</h3><p>{current.text}</p>{current.link&&<a className="secondary" href={current.link} target="_blank" rel="noopener">{current.label}<ArrowUpRight size={14}/></a>}<div className="setup-nav"><button className="secondary" disabled={step===0} onClick={()=>setStep(step-1)}>Back</button><button className="primary" disabled={step===steps.length-1} onClick={()=>setStep(step+1)}>Next step<ChevronRight size={14}/></button></div></div></div><div className="setup-checks">{checks.map(([key,label])=><span key={key} aria-label={label+': '+(setup[key]?'ready':'missing')} className={setup[key]?'complete':''}>{setup[key]?<CheckCircle2 size={14}/>:<Clock size={14}/>} {label}</span>)}</div><div className="setup-bottom"><p>Readiness checks inspect server configuration only; they do not verify Twilio credentials or place a call. Calls may charge your Twilio account and successful payments may charge the client.</p><button className="secondary" onClick={refresh}><RefreshCw size={14}/>Refresh readiness</button><a className="secondary" href="/voice-setup.txt" download><Download size={14}/>Download setup guide</a></div></section>}

function PaymentForm({invoice,onSave,busy}){const[method,setMethod]=useState(['CHECK','ACH','BANK_TRANSFER','CARD','CASH','OTHER'].includes(invoice.paymentMethod)?invoice.paymentMethod:''),[check,setCheck]=useState(invoice.checkNumber||''),[error,setError]=useState('');return <form onSubmit={async e=>{e.preventDefault();try{await onSave(method,check)}catch(e){setError(e.message)}}}><p className="muted">Record how {invoice.number} was paid. This edits payment records only and does not move money or change the payment date.</p><label>Payment method<select required value={method} onChange={e=>setMethod(e.target.value)}><option value="">Choose a payment type</option>{Object.entries(paymentLabels).filter(([k])=>k!=='DEMO').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{method==='CHECK'&&<label className="noteslabel">Check number<input required maxLength={80} value={check} onChange={e=>setCheck(e.target.value)} placeholder="e.g. 10482"/></label>}{error&&<p className="error" role="alert">{error}</p>}<button className="primary submit" disabled={busy}>{busy?'Saving…':'Save payment details'}</button></form>}
function Attachments({invoice,onUpdate}){const[files,setFiles]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[remove,setRemove]=useState(null);const input=useRef();async function load(){try{setFiles(await api.attachments(invoice.id));setError('')}catch(e){setError(e.message)}}useEffect(()=>{load();setRemove(null)},[invoice.id]);async function add(event){const file=event.target.files[0];if(!file)return;setBusy(true);setError('');try{await api.attach(invoice.id,file);await load();await onUpdate()}catch(e){setError(e.message)}finally{setBusy(false);event.target.value=''}}async function download(f){setBusy(true);try{const blob=await api.download(invoice.id,f);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(e.message)}finally{setBusy(false)}}return <section className="panel attachments"><div className="attachment-heading"><h3>Attachments <span className="count">{files.length}</span></h3><input ref={input} type="file" hidden aria-label="Choose invoice attachment" onChange={add}/><button className="secondary" disabled={busy||files.length>=10} onClick={()=>input.current.click()}><Plus size={14}/>{busy?'Working…':'Attach file'}</button></div><p className="attachment-note">Up to 5 MB per file · 10 files / 25 MB per invoice. Stored securely for your business.</p>{error&&<p className="error" role="alert">{error}</p>}{!files.length&&<p className="muted">Add a purchase order, receipt, or supporting document.</p>}{files.map(f=><div className="attachment-row" key={f.id}><FileText size={17}/><div><button disabled={busy} onClick={()=>download(f)} className="attachment-name">{f.name}</button><small>{f.size<1024?f.size+' B':(f.size/1024).toFixed(1)+' KB'} · {new Date(f.createdAt).toLocaleDateString()}</small></div><button className="rowbutton" disabled={busy} aria-label={'Download '+f.name} onClick={()=>download(f)}><Download size={15}/></button><button className="rowbutton" disabled={busy} aria-label={'Remove '+f.name} onClick={()=>setRemove(f)}><Trash2 size={14}/></button></div>)}{remove&&<div className="attachment-confirm"><p>Remove {remove.name}? This removes the attachment from this invoice.</p><button className="danger" disabled={busy} onClick={async()=>{setBusy(true);try{await api.removeAttachment(invoice.id,remove.id);setRemove(null);await load();await onUpdate()}catch(e){setError(e.message)}finally{setBusy(false)}}}>Remove attachment</button><button className="secondary" disabled={busy} onClick={()=>setRemove(null)}>Keep file</button></div>}</section>}
function InvoiceFilters({values,onChange,statusFilter,setStatus,clear}){const update=(key,value)=>onChange({...values,[key]:value});const invalid=(values.dueFrom&&values.dueTo&&values.dueFrom>values.dueTo)||(values.paidFrom&&values.paidTo&&values.paidFrom>values.paidTo)||(values.amountMin!==''&&values.amountMax!==''&&Number(values.amountMin)>Number(values.amountMax))||(values.ageMin!==''&&values.ageMax!==''&&Number(values.ageMin)>Number(values.ageMax));return <div className="invoice-filters"><div className="filter-heading"><b>Filter invoices</b><button className="textbutton" onClick={clear}>Clear all filters</button></div><div className="filter-grid"><fieldset><legend>Due date</legend><label>From<input type="date" value={values.dueFrom} onChange={e=>update('dueFrom',e.target.value)}/></label><label>To<input type="date" value={values.dueTo} onChange={e=>update('dueTo',e.target.value)}/></label></fieldset><fieldset><legend>Payment date</legend><label>From<input type="date" value={values.paidFrom} onChange={e=>update('paidFrom',e.target.value)}/></label><label>To<input type="date" value={values.paidTo} onChange={e=>update('paidTo',e.target.value)}/></label></fieldset><fieldset><legend>Aging · days past due</legend><label>Minimum<input type="number" min="0" step="1" placeholder="0" value={values.ageMin} onChange={e=>update('ageMin',e.target.value)}/></label><label>Maximum<input type="number" min="0" step="1" placeholder="Any" value={values.ageMax} onChange={e=>update('ageMax',e.target.value)}/></label></fieldset><fieldset><legend>Payment / invoice amount · USD</legend><label>Minimum<input type="number" min="0" step="0.01" placeholder="0.00" value={values.amountMin} onChange={e=>update('amountMin',e.target.value)}/></label><label>Maximum<input type="number" min="0" step="0.01" placeholder="Any" value={values.amountMax} onChange={e=>update('amountMax',e.target.value)}/></label></fieldset><fieldset><legend>Status</legend><label>Invoice status<select value={statusFilter} onChange={e=>setStatus(e.target.value)}>{['All invoices','Pending','Paid','Overdue','Void'].map(s=><option key={s} value={s}>{s}</option>)}</select></label></fieldset></div><p>Filters combine with your search. Payment dates apply to recorded payment dates. Aging is 0 before the due date and stays fixed for paid invoices.</p>{invalid&&<p className="filter-error" role="alert">A minimum or start date is greater than its maximum or end date. Adjust the range to see matches.</p>}</div>}
function TrashInvoices({invoices,busy,restore}){return <div className="panel activitypanel"><h3>Deleted invoices <span className="count">{invoices.length}</span></h3>{!invoices.length&&<div className="empty">Trash is empty.</div>}{invoices.map(i=><div className="trash-row" key={i.id}><div><b>{i.number} · {i.client}</b><small>{money(i.total)} · Due {i.dueDate}</small></div><button className="secondary" disabled={busy} onClick={()=>restore(i.id)}><RefreshCw size={14}/>Restore</button></div>)}</div>}
function WorkspaceSearch({invoices,clients,onInvoice,onClient}){const[query,setQuery]=useState('');const results=workspaceMatches(query,invoices,clients),count=results.invoices.length+results.clients.length;return <div className="global-search"><label className="global-search-input"><Search size={19}/><input autoFocus aria-label="Search clients and invoices" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Client name, invoice number, email, phone…" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(results.invoices[0])onInvoice(results.invoices[0]);else if(results.clients[0])onClient(results.clients[0])}}}/></label><p className="search-hint">Search names, invoice numbers, emails, phone numbers, notes, and check references.</p><div role="status" className="search-count">{query.trim()?count+' matches in this workspace':'Start typing to find a client or invoice.'}</div>{query.trim()&&count===0&&<div className="empty"><Search size={24}/><h3>No results for “{query}”</h3><p>Try a name, email address, or invoice number.</p></div>}{results.invoices.length>0&&<section className="search-results"><h3>Invoices <span>{results.invoices.length}</span></h3>{results.invoices.slice(0,10).map(i=><button key={i.id} onClick={()=>onInvoice(i)}><span className="search-result-icon"><FileText size={17}/></span><span><b>{i.number} · {i.client}</b><small>{i.email} · Due {i.dueDate}</small></span><span className="search-result-amount">{money(i.total)}</span><Badge invoice={i}/><ChevronRight size={14}/></button>)}</section>}{results.clients.length>0&&<section className="search-results"><h3>Clients <span>{results.clients.length}</span></h3>{results.clients.slice(0,10).map(c=><button key={c.email} onClick={()=>onClient(c)}><span className="search-result-icon"><Users size={17}/></span><span><b>{c.name}</b><small>{c.email}{c.phone?' · '+c.phone:''}</small></span><ChevronRight size={14}/></button>)}</section>}{count>0&&<p className="search-hint">Showing up to 10 results in each group. Press Enter to open the first result, or Tab to choose one.</p>}</div>}
function BankForm({client,onUpdated}){const[details,setDetails]=useState(null),[bank,setBank]=useState({bankName:'',accountHolder:'',accountType:'CHECKING',routingNumber:'',accountNumber:''}),[reveal,setReveal]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');useEffect(()=>{api.bank(client.id).then(d=>{setDetails(d);if(d.details)setBank(d.details)}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[client.id]);async function save(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{await api.saveBank(client.id,bank);await onUpdated();setMessage('Bank details saved securely.');setReveal(false)}catch(e){setError(e.message)}finally{setBusy(false)}}if(loading)return <p className="muted">Loading protected bank details…</p>;return <form onSubmit={save}><p className="muted">Bank details for {client.name}. Only the business owner can reveal or edit these fields. This stores payment instructions; it does not initiate bank transfers.</p>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="settings-success" role="status">{message}</p>}<div className="bank-notice"><ShieldCheck size={17}/><span>Encrypted before storage. Account and routing numbers remain masked until you reveal them.</span></div><div className="form-grid"><label>Bank name<input required maxLength={150} value={bank.bankName} onChange={e=>setBank({...bank,bankName:e.target.value})} autoComplete="off"/></label><label>Account holder<input required maxLength={150} value={bank.accountHolder} onChange={e=>setBank({...bank,accountHolder:e.target.value})} autoComplete="off"/></label><label>Account type<select value={bank.accountType} onChange={e=>setBank({...bank,accountType:e.target.value})}><option value="CHECKING">Checking</option><option value="SAVINGS">Savings</option></select></label><label>US routing number<input required type={reveal?'text':'password'} inputMode="numeric" pattern="[0-9]{9}" maxLength={9} value={bank.routingNumber} onChange={e=>setBank({...bank,routingNumber:e.target.value.replace(/\D/g,'')})} autoComplete="off"/></label><label>Account number<input required type={reveal?'text':'password'} inputMode="numeric" pattern="[0-9]{4,17}" maxLength={17} value={bank.accountNumber} onChange={e=>setBank({...bank,accountNumber:e.target.value.replace(/\D/g,'')})} autoComplete="off"/></label></div><button type="button" className="secondary" style={{marginTop:18}} onClick={()=>setReveal(!reveal)}>{reveal?'Hide numbers':'Reveal numbers'}</button><button className="primary submit" disabled={busy||!details?.configured}>{busy?'Saving…':'Save bank details'}</button>{!details?.configured&&<p className="muted" style={{marginTop:12}}>Encrypted bank storage is not configured in this environment.</p>}</form>}
function ClientDetails({client,edit,bank,invoice}){return <div className="client-detail"><div className="client-detail-heading"><span className="client-avatar color1">{client.name.slice(0,2).toUpperCase()}</span><div><h3>{client.name}</h3><p>{client.email}</p></div></div><div className="client-detail-section"><h4>Contact information</h4><dl><dt>Contact person</dt><dd>{client.contactName||'Not added'}</dd><dt>Email</dt><dd>{client.email}</dd><dt>Phone</dt><dd>{client.phone||'Not added'}</dd><dt>Website</dt><dd>{client.website||'Not added'}</dd></dl><button className="secondary" onClick={edit}>Edit contact details</button></div><div className="client-detail-section"><h4>Business address</h4><p>{client.address||'No business address added.'}</p><button className="secondary" onClick={edit}>Edit address</button></div><div className="client-detail-section"><h4>Bank information</h4><p>{client.bankLast4?'Account ending in '+client.bankLast4:'No bank information saved.'}</p>{client.canManageBank?<button className="secondary" onClick={bank}>{client.bankLast4?'View or edit bank information':'Add bank information'}</button>:<small>Only the business owner can reveal or edit full bank details.</small>}</div><div className="client-detail-section"><h4>Client notes</h4><p>{client.notes||'No notes added.'}</p><button className="secondary" onClick={edit}>Edit notes</button></div><button className="primary submit" onClick={invoice}><Plus size={14}/>Create invoice for this client</button></div>}

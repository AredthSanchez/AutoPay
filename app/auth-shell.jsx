'use client';
import React,{useEffect,useState} from 'react';
import App from './workspace';
import {EmailSignIn, SignOutButton} from './email-sign-in';
import {setBusiness} from './workspace/api';
import {ArrowUpRight,CheckCircle2,ShieldCheck,Users,FileText,LoaderCircle} from 'lucide-react';
import './workspace/style.css';
import './auth.css';
export default function AuthShell({mode='login'}){const[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[name,setName]=useState(''),[businessName,setBusinessName]=useState(''),[ownerName,setOwnerName]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[invite,setInvite]=useState('');useEffect(()=>{setInvite(new URLSearchParams(location.search).get('invite')||'');fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'}).then(async r=>{if(r.status===401)return null;if(!r.ok)throw Error('Account service is unavailable. Please retry.');return r.json()}).then(d=>{setData(d);setName(d?.account?.name||d?.identity?.displayName||'');const saved=localStorage.getItem('autopay-business');const id=d?.businesses?.find(b=>b.id===saved)?.id||d?.businesses?.[0]?.id||'';setBusiness(id);setSelected(id)}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);const path=typeof window==='undefined'?'/':window.location.pathname;const business=data?.businesses?.find(b=>b.id===selected);const isHome=path==='/'||path==='/workspace';if(loading)return <div className="auth-loading">
<LoaderCircle size={25}/>
<span>Opening your workspace…</span>
</div>;if(data?.account&&business&&isHome&&!invite)return <App account={data.account} business={business} businesses={data.businesses} switchBusiness={id=>{setBusiness(id);localStorage.setItem('autopay-business',id);setSelected(id)}} key={selected}/>;const signed=!!data?.identity;const signup=mode==='signup'||(signed&&(!data.account||!data.businesses?.length));const returnTo=invite?'/signup?invite='+encodeURIComponent(invite):signup?'/signup':'/';async function submit(e){e.preventDefault();setBusy(true);setError('');try{const r=await fetch(invite?'/api/auth/join':'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json','X-AutoPay-Request':'1'},body:JSON.stringify(invite?{name,token:invite}:{name,businessName,ownerName:ownerName||name})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not create your workspace.');localStorage.setItem('autopay-business',d.businessId);location.assign('/')}catch(e){setError(e.message)}finally{setBusy(false)}}return <main className="auth-layout">
<section className="auth-story">
<a className="logo" href="/">
<span className="logomark">a</span>autopay.</a>
<span className="auth-eyebrow">BUILT FOR YOUR BUSINESS</span>
<h1>Your team.<br/>Your invoices.<br/>One clear picture.</h1>
<p>Give every teammate their own login, with one shared place to manage clients, invoices, payments, and files.</p>
<div className="auth-benefits">
<span>
<Users size={17}/>Individual logins. A shared business.</span>
<span>
<FileText size={17}/>Invoices and files, together.</span>
<span>
<ShieldCheck size={17}/>Business membership checked on every request.</span>
</div>
<small>A workspace that keeps the whole team in sync.</small>
</section>
<section className="auth-form-area">
<div className="auth-form">
<span className="eyebrow">{invite?'TEAM INVITATION':signup?'CREATE YOUR WORKSPACE':'WELCOME BACK'}</span>
<h2>{invite?'Join your business.':signup?'Start your next chapter.':'A little less chasing.'}</h2>
<p>{invite?'Sign in using the email address your team invited.':signup?'Create a business workspace, then invite your team.':'Sign in to your business workspace and pick up where you left off.'}</p>{error&&<p className="error" role="alert">{error}</p>}{!signed?<EmailSignIn returnTo={returnTo}/>:invite||signup?<form onSubmit={submit}>
<div className="auth-identity">
<CheckCircle2 size={16}/>{data.identity.email}</div>
<label>Your name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/>
</label>{!invite&&<><label>Business owner name<input required maxLength={120} value={ownerName||name} onChange={e=>setOwnerName(e.target.value)} autoComplete="name"/></label><label>Business name<input required maxLength={150} value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="e.g. Northstar Studio" autoComplete="organization"/>
</label></>}<button className="primary auth-continue" disabled={busy}>{busy?'Saving…':invite?'Join business':'Create business workspace'}<ArrowUpRight size={16}/>
</button>
</form>:<>
<div className="auth-identity">
<CheckCircle2 size={16}/>{data.account?.name||data.identity.email}</div>
<a href="/" className="primary auth-continue">Open your workspace<ArrowUpRight size={16}/>
</a>
</>}{signed&&<SignOutButton className="secondary auth-switch">Use a different account / Log out</SignOutButton>}<div className="auth-divider"/>
<p className="auth-alternate">{signup?'Already part of a business?':'New to AutoPay?'} <a href={signup?'/login':'/signup'}>{signup?'Log in':'Create an account'} ↗</a>
</p>{signup&&!invite&&<p className="auth-fine">Joining an existing team? Ask the business owner for an invitation link instead of creating a second business.</p>}</div>
<small className="auth-footer">AutoPay · Invoices, without the busywork.</small>
</section>
</main>}

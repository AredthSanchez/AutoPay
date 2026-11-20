'use client';
import React,{useEffect,useState} from 'react';
import {request} from './workspace/api';
import {Users,Mail,Plus,Copy,RefreshCw,CheckCircle2,Clock,AlertCircle} from 'lucide-react';
export default function BusinessSettings({business,account}){const[team,setTeam]=useState(null),[settings,setSettings]=useState(null),[notices,setNotices]=useState([]),[target,setTarget]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');async function load(){try{const[t,s,n]=await Promise.all([request('/team'),request('/notification-settings'),request('/notifications')]);setTeam(t);setSettings(s);setNotices(n)}catch(e){setError(e.message)}}useEffect(()=>{load()},[business.id]);async function run(fn,success){setBusy(true);setError('');setMessage('');try{await fn();setMessage(success);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}return <section className="business-settings"><BusinessProfile business={business} account={account}/>
<div className="panel activitypanel">
<span className="eyebrow">BUSINESS WORKSPACE</span>
<h3 style={{marginTop:12}}>{business.name}</h3>
<p className="muted">Every team member has an individual login. Everyone in this business shares the same invoices, clients, and attachments.</p>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="settings-success" role="status">
<CheckCircle2 size={15}/>{message}</p>}<h4 className="settings-label">
<Users size={15}/>Team members</h4>{team?.members.map(m=>
<div className="member-row" key={m.id}>
<div>
<b>{m.name}</b>
<small>{m.email}</small>
</div>
<span className="mini-pill">{m.role==='OWNER'?'Owner':'Member'}</span>
</div>)}{business.role==='OWNER'&&<form className="invite-form" onSubmit={e=>{e.preventDefault();run(async()=>{const d=await request('/team/invite',{email:target});setLink(d.url)},'Invitation created. Share the link with the invited teammate.')}}>
<label>Invite a teammate by email<input required type="email" maxLength={200} value={target} onChange={e=>setTarget(e.target.value)} placeholder="teammate@business.com"/>
</label>
<button className="primary" disabled={busy}>
<Plus size={14}/>Create invitation link</button>{link&&<div className="invite-link">
<p>This invitation expires in 7 days and only works for {target}.</p>
<input readOnly aria-label="Team invitation link" value={link}/>
<button type="button" className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(link);setMessage('Invitation link copied.')}catch{setMessage('Select the link and copy it to share.')}}}>
<Copy size={14}/>Copy link</button>
</div>}</form>}{business.role!=='OWNER'&&<p className="muted" style={{marginTop:20}}>Ask your business owner to invite additional teammates.</p>}<a className="secondary" href="/signup">Create another business</a>
</div>
<div className="panel activitypanel">
<span className="eyebrow">INVOICE EMAIL ALERTS</span>
<h3 style={{marginTop:12}}>A new invoice. A heads-up.</h3>
<p className="muted">Notify the selected inbox whenever any team member creates an invoice. The recipient is shared across this business.</p>{settings&&<form onSubmit={e=>{e.preventDefault();run(()=>request('/notification-settings',{email:settings.email,enabled:settings.enabled}),'Notification preferences saved.')}}>
<label>Notification email<input type="email" required={settings.enabled} maxLength={200} disabled={!settings.canManage} value={settings.email} onChange={e=>setSettings({...settings,email:e.target.value})} placeholder="accounts@business.com"/>
</label>
<label className="notification-toggle">
<input type="checkbox" disabled={!settings.canManage} checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/>Email this inbox for every new invoice</label>
<div className={settings.senderConfigured?'mail-ready':'mail-pending'}>{settings.senderConfigured?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>}<div>
<b>{settings.senderConfigured?'Email sender configured':'Email sender setup required'}</b>
<p>{settings.senderConfigured?'New invoice alerts are sent through the configured mail provider.':'Set RESEND_API_KEY and MAIL_FROM_EMAIL in the hosted runtime environment, using a verified sender. Alerts are saved as Pending setup until a sender is configured.'}</p>
</div>
</div>{settings.canManage?<button className="primary" disabled={busy}>Save notification settings</button>:<p className="muted">Only the business owner can change the recipient or delivery preference.</p>}</form>}{settings?.testRecipient&&<p className="muted">Current test sender can notify only {settings.testRecipient}. Verify a sending domain to use other inboxes.</p>}<h4 className="settings-label">
<Mail size={15}/>Recent invoice alerts</h4>{!notices.length&&<p className="muted">No alerts yet. Enable notifications, then create an invoice.</p>}{notices.slice(0,10).map(n=>
<div className="notice-row" key={n.id}>
<div>
<b>{n.recipient}</b>
<small>{new Date(n.created_at).toLocaleString()} · {n.status==='SENT'?'Sent':n.status==='PENDING_SETUP'?'Pending setup':n.status==='SENDING'?'Sending':n.status==='FAILED'?'Failed':'Pending'}</small>{n.error&&<small>{n.error}</small>}</div>{business.role==='OWNER'&&['FAILED','PENDING_SETUP','PENDING'].includes(n.status)&&<button className="secondary" disabled={busy||!settings?.senderConfigured} onClick={()=>run(()=>request('/notifications/'+n.id+'/retry',{}),'Delivery attempt completed. Check the status below.')}>
<RefreshCw size={13}/>Retry</button>}</div>)}</div>
</section>}
function BusinessProfile({business,account}){const[profile,setProfile]=useState(null),[myName,setMyName]=useState(account.name),[busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>{request('/business-profile').then(setProfile).catch(e=>setError(e.message))},[business.id]);async function save(e){e.preventDefault();setBusy(true);setError('');try{await request('/auth/profile',{name:myName});if(profile?.canManage)await request('/business-profile',profile);location.reload()}catch(e){setError(e.message);setBusy(false)}}return <div className="panel activitypanel" style={{gridColumn:'1 / -1'}}><span className="eyebrow">BUSINESS & ACCOUNT DETAILS</span><h3 style={{marginTop:12}}>Keep your information up to date.</h3>{error&&<p className="error" role="alert">{error}</p>}{profile&&<form className="business-profile-form" onSubmit={save}><div className="form-grid"><label>Your display name<input required maxLength={120} value={myName} onChange={e=>setMyName(e.target.value)} autoComplete="name"/></label><label>Login email<input value={account.email} readOnly/><small>Verified by your sign-in provider.</small></label><label>Business name<input required disabled={!profile.canManage} maxLength={150} value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>Business owner name<input required disabled={!profile.canManage} maxLength={120} value={profile.ownerName} onChange={e=>setProfile({...profile,ownerName:e.target.value})}/></label><label>Business phone<input type="tel" pattern="\+[1-9][0-9]{7,14}" disabled={!profile.canManage} value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})} placeholder="+19155550100"/></label><label>Business website<input type="url" maxLength={250} disabled={!profile.canManage} value={profile.website} onChange={e=>setProfile({...profile,website:e.target.value})} placeholder="https://example.com"/></label></div><label>Business address<textarea maxLength={500} disabled={!profile.canManage} value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/></label><button className="primary" disabled={busy}>{busy?'Saving…':'Save information'}</button></form>}</div>}

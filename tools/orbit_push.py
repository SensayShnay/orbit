# Orbit weekly sync, run on the Mac. Reads message COUNTS and DATES only (never message text),
# sends them to your Supabase, then prints a small digest for the weekly note.
# usage: ORBIT_TOKEN=orb_... python3 orbit_push.py <chat.db copy> <ChatStorage.sqlite copy>
import sys,os,json,re,sqlite3,datetime,time,collections,urllib.request
from zoneinfo import ZoneInfo
URL='https://mpjqxzsdjwmsfmselztl.supabase.co/functions/v1/orbit-sync';TOK=os.environ['ORBIT_TOKEN']
def call(kind,payload=None):
    r=urllib.request.Request(URL,data=json.dumps({'kind':kind,'payload':payload or {}}).encode(),headers={'x-orbit-token':TOK,'content-type':'application/json'})
    return json.load(urllib.request.urlopen(r,timeout=120))
TZ=ZoneInfo('America/New_York');now=time.time();T=datetime.date.today();today=T.isoformat();Y=T.year
cdb,wdb=sys.argv[1:3]
def norm(h):
    h=str(h).strip().lower()
    if '@' in h and not h.endswith('@lid') and not h.endswith('@s.whatsapp.net'): return h
    d=re.sub(r'\D','',h.split('@')[0])
    if len(d)==10: d='1'+d
    return '+'+d if d else None
H=call('handles');own={}
for cid,hs in H.items():
    for h in hs:
        n=norm(h)
        if n: own.setdefault(n,cid)
E=collections.defaultdict(list);err=[]
try:
    c=sqlite3.connect(cdb)
    for hid,ts,me in c.execute("""select h.id,m.date/1000000000.0+978307200,m.is_from_me from message m
      join chat_message_join cmj on cmj.message_id=m.ROWID join chat_handle_join chj on chj.chat_id=cmj.chat_id join handle h on h.ROWID=chj.handle_id
      where cmj.chat_id in (select chat_id from chat_handle_join group by chat_id having count(*)=1)"""):
        cid=own.get(norm(hid))
        if cid: E[cid].append((ts,me,'i'))
except Exception as e: err.append('iMessage: '+str(e))
try:
    w=sqlite3.connect(wdb)
    for jid,ts,me in w.execute("""select s.ZCONTACTJID,m.ZMESSAGEDATE+978307200,m.ZISFROMME from ZWAMESSAGE m join ZWACHATSESSION s on s.Z_PK=m.ZCHATSESSION
      where s.ZSESSIONTYPE=0 and coalesce(m.ZMESSAGETYPE,0) not in (6,10)"""):
        if jid and (jid.endswith('@s.whatsapp.net') or jid.endswith('@lid')):
            cid=own.get(norm(jid))
            if cid: E[cid].append((ts,me,'w'))
except Exception as e: err.append('WhatsApp: '+str(e))
dt=lambda ts:datetime.datetime.fromtimestamp(ts,TZ)
stats={}
for cid,ev in E.items():
    ev.sort();r={}
    for src,key in (('i','textStats'),('w','whatsappStats')):
        x=[e for e in ev if e[2]==src]
        if not x: continue
        by=collections.Counter(str(dt(e[0]).year) for e in x);mon={}
        for e in x:
            if e[0]>now-365*86400:
                d=dt(e[0]).date().isoformat();m=d[:7];cn,l=mon.get(m,(0,''));mon[m]=(cn+1,max(l,d))
        r[key]={'count':len(x),'sent':int(sum(e[1] for e in x)),'first':dt(x[0][0]).date().isoformat(),'last':dt(x[-1][0]).date().isoformat(),
                'byYear':dict(by),'syncedAt':today,'_months':{k:list(v) for k,v in mon.items()}}
    stats[cid]=r
updated=0;ids=sorted(stats)
for i in range(0,len(ids),40): updated+=call('stats',{k:stats[k] for k in ids[i:i+40]}).get('updated',0)
# Wrapped, current year only
first={c:dt(ev[0][0]).date() for c,ev in E.items() if ev}
months=[0]*12;hours=[0]*24;tot=sent=0;ppl=collections.Counter();days=collections.Counter();pd=collections.defaultdict(set);ft=None
for cid,ev in E.items():
    for ts,me,src in ev:
        d=dt(ts)
        if d.year!=Y: continue
        months[d.month-1]+=1;hours[d.hour]+=1;tot+=1;sent+=me;ppl[cid]+=1;days[d.date()]+=1;pd[cid].add(d.date())
        if me and (ft is None or ts<ft[1]): ft=(cid,ts)
best=(None,0)
for cid,ds in pd.items():
    s=sorted(ds);run=1
    if best[1]<1: best=(cid,1)
    for a,b in zip(s,s[1:]):
        run=run+1 if (b-a).days==1 else 1
        if run>best[1]: best=(cid,run)
td=max(days.items(),key=lambda x:x[1]) if days else (None,0)
prev={cid for cid,ev in E.items() if any(dt(e[0]).year==Y-1 for e in ev)}
if E:
    call('wrapped',{'year':str(Y),'data':{'months':months,'hours':hours,'total':tot,'sent':int(sent),'people':dict(ppl.most_common(15)),'peopleCount':len(ppl),
      'topDay':{'date':td[0].isoformat() if td[0] else None,'count':td[1]},'streak':{'id':best[0],'days':best[1]},
      'firstText':{'id':ft[0],'date':dt(ft[1]).date().isoformat()} if ft else None,
      'newPeople':[x for x in ppl if first[x].year==Y],'rekindled':[x for x in ppl if x not in prev and first[x].year<Y-1],'activeDays':len(days)}})
# Digest for the weekly note
S=call('summary');st=S.get('settings') or {};rm=st.get('remind') or {};pr=st.get('profile') or {}
D=int(rm.get('driftDays') or 182);R=int(rm.get('reachDays') or 90);pause=rm.get('pauseUntil') or ''
C=S.get('contacts') or [];sy=max([y for c in C for y in (c.get('years') or [])] or [Y])
skip={'Long Orbit','In memory','Outer Orbit'}
def ago(d):
    try: return (T-datetime.date.fromisoformat(d[:10])).days
    except Exception: return None
def hook(c): return '; '.join(x for x in [c.get('whereMet') and 'met '+c['whereMet'],c.get('job'),c.get('city'),c.get('interests')] if x)[:90]
act=[c for c in C if (sy in (c.get('years') or []) or c.get('circle')=='Family') and c.get('circle') not in skip and not ((c.get('driftSnooze') or '')>=today)]
drift=[];reach=[]
for c in act:
    a=ago(c['last']) if c.get('last') else None
    if a is not None and a>=D: drift.append({'name':c['name'],'days':a,'new':a<D+7,'hook':hook(c)})
    if a is None or a>R: reach.append({'name':c['name'],'days':a,'hook':hook(c)})
drift.sort(key=lambda x:x['days']);reach.sort(key=lambda x:-(x['days'] if x['days'] is not None else 99999))
def nb(b):
    try:
        m,d=map(int,b.split('-')[1:3]);n=datetime.date(Y,m,d)
        if n<T: n=datetime.date(Y+1,m,d)
        return (n-T).days,n.isoformat()
    except Exception: return None
bd=[]
for c in C:
    if c.get('circle') in ('In memory',): continue
    for who,b in [(c['name'],c.get('birthday'))]+[(k['name']+' ('+c['name']+"'s kid)",k.get('birthday')) for k in (c.get('kids') or [])]:
        x=nb(b) if b else None
        if x and x[0]<=14: bd.append({'name':who,'inDays':x[0],'date':x[1]})
bd.sort(key=lambda x:x['inDays'])
print(json.dumps({'refreshed':updated,'contactsWithMessages':len(stats),'errors':err,'callMe':pr.get('callMe') or 'Shnay',
  'weeklyNote':rm.get('weeklyNote',True),'pausedUntil':pause if pause>=today else '','driftDays':D,
  'newlyDrifting':[x for x in drift if x['new']],'driftingTotal':len(drift),'reachOut':[x for x in reach if not any(d['name']==x['name'] and d['new'] for d in drift)][:6],
  'birthdays14d':bd},ensure_ascii=False))

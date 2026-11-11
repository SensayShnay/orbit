#!/bin/bash
# Orbit Message sync (runs on your Mac, twice a day).
# It reads only WHO you messaged and WHEN, from 1-on-1 chats in Messages (and WhatsApp, if installed).
# It never reads, stores or sends what any message says.
# It only sends numbers for people who are already in your Orbit; everyone else is ignored on this Mac.
VERSION="1.0"
DIR="${ORBIT_DIR:-$HOME/Library/Application Support/Orbit Message Sync}"
URL="${ORBIT_URL:-https://mpjqxzsdjwmsfmselztl.supabase.co/functions/v1/orbit-sync}"
SQL="${ORBIT_SQLITE:-/usr/bin/sqlite3}"
CURL="${ORBIT_CURL:-/usr/bin/curl}"
MSG="${ORBIT_MESSAGES:-$HOME/Library/Messages/chat.db}"
WA="${ORBIT_WHATSAPP:-$HOME/Library/Group Containers/group.net.whatsapp.WhatsApp.shared/ChatStorage.sqlite}"
TOKEN="$(cat "$DIR/token" 2>/dev/null)"
[ -z "$TOKEN" ] && { echo "$(date) No token. Set up Message sync again from Orbit > Settings."; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
say() { echo "$(date "+%H:%M:%S") $*"; }
say "Starting Message sync $VERSION"

post() { "$CURL" -fsS -m 120 -H "x-orbit-token: $TOKEN" -H 'content-type: application/json' --data-binary @"$1" "$URL"; }
status() { printf '{"kind":"status","payload":{"ok":%s,"message":"%s","people":%s,"version":"%s"}}' "$1" "$2" "${3:-0}" "$VERSION" > "$TMP/status.json"; post "$TMP/status.json" >/dev/null 2>&1; }

say "Copying your Messages database (a copy, the original is never touched)"
# 1. Copy the Messages database (needs Full Disk Access). Reading a copy never touches the real one.
if ! cp "$MSG" "$TMP/chat.db" 2>/dev/null; then
  status false no_access; echo "$(date) No access to Messages. Turn on Full Disk Access for Orbit Message Sync."; exit 2; fi
cp "$MSG-wal" "$TMP/chat.db-wal" 2>/dev/null; cp "$MSG-shm" "$TMP/chat.db-shm" 2>/dev/null
HAVE_WA=0
if cp "$WA" "$TMP/wa.db" 2>/dev/null; then HAVE_WA=1; cp "$WA-wal" "$TMP/wa.db-wal" 2>/dev/null; cp "$WA-shm" "$TMP/wa.db-shm" 2>/dev/null; say "WhatsApp found, including it"; else say "No WhatsApp on this Mac (that's fine)"; fi

say "Asking Orbit which people are in your sphere"
# 2. Ask Orbit which phone numbers and emails belong to people in your sphere.
printf '{"kind":"hnorm","payload":{}}' > "$TMP/h.req"
if ! post "$TMP/h.req" > "$TMP/handles.json"; then echo "$(date) Couldn't reach Orbit (check the internet connection or set up again)."; exit 3; fi

say "Counting messages per person (this can take a minute on a big Messages history)"
# 3. Count messages per person. Only the handle, the date and who sent it are read. Never the text.
WA_PART=""
if [ "$HAVE_WA" = 1 ]; then WA_PART="
  union all
  select h.cid, 'whatsappStats' k, ev.ts, ev.me from (
    select case when length(d)=10 then '+1'||d else '+'||d end hn, m.ZMESSAGEDATE+978307200 ts, coalesce(m.ZISFROMME,0) me
    from (select Z_PK, substr(ZCONTACTJID,1,instr(ZCONTACTJID,'@')-1) d from wa.ZWACHATSESSION where ZSESSIONTYPE=0 and ZCONTACTJID like '%@s.whatsapp.net') s
    join wa.ZWAMESSAGE m on m.ZCHATSESSION=s.Z_PK where coalesce(m.ZMESSAGETYPE,0) not in (6,10)) ev join h on h.hn=ev.hn"; fi
ATTACH=""; [ "$HAVE_WA" = 1 ] && ATTACH="attach database '$TMP/wa.db' as wa;"
cd "$TMP" || exit 4
"$SQL" -bail -batch -noheader chat.db "$ATTACH
pragma temp_store=memory;
create temp table h as select json_extract(value,'\$.h') hn, json_extract(value,'\$.c') cid from json_each(readfile('handles.json'));
create index temp.h_hn on h(hn);
create temp table hd as select ROWID rid, case when instr(id,'@')>0 then lower(trim(id))
         else (case when length(d)=10 then '+1'||d else '+'||d end) end hn
       from (select ROWID, id, replace(replace(replace(replace(replace(replace(id,' ',''),'-',''),'(',''),')',''),'+',''),'.','') d from handle);
create temp table solo as select chat_id from chat_handle_join group by chat_id having count(*)=1;
create index temp.solo_c on solo(chat_id);
-- one pass over the message history: only handle, date and who sent it
create temp table e as
  select h.cid, 'textStats' k, (case when m.date>100000000000 then m.date/1000000000.0 else m.date end)+978307200 ts, coalesce(m.is_from_me,0) me
  from message m join chat_message_join cmj on cmj.message_id=m.ROWID join solo on solo.chat_id=cmj.chat_id
  join chat_handle_join chj on chj.chat_id=cmj.chat_id join hd on hd.rid=chj.handle_id join h on h.hn=hd.hn
  $WA_PART;
alter table e add column d text; update e set d=date(ts,'unixepoch','localtime');
create index temp.e_i on e(cid,k);
select 'diag: handles from Orbit '||(select count(*) from h)||', Messages handle rows '||(select count(*) from hd)||', of which match your sphere '||(select count(distinct hd.rid) from hd join h on h.hn=hd.hn)||' ('||(select count(distinct h.cid) from hd join h on h.hn=hd.hn)||' people), 1-on-1 chats '||(select count(*) from solo)||', message rows counted '||(select count(*) from e)||' for '||(select count(distinct cid) from e)||' people';
select 'diag: old-style match '||(with h2 as (select json_extract(value,'\$.h') hn, json_extract(value,'\$.c') cid from json_each(readfile('handles.json'))), hd2 as (select ROWID rid, case when instr(id,'@')>0 then lower(trim(id)) else (case when length(d)=10 then '+1'||d else '+'||d end) end hn from (select ROWID, id, replace(replace(replace(replace(replace(replace(id,' ',''),'-',''),'(',''),')',''),'+',''),'.','') d from handle)) select count(distinct h2.cid) from hd2 join h2 on h2.hn=hd2.hn)||' people; types in sphere list '||(select group_concat(t||'='||n) from (select typeof(hn) t,count(*) n from h group by 1))||'; types in Messages '||(select group_concat(t||'='||n) from (select typeof(hn) t,count(*) n from hd group by 1))||'; sqlite '||sqlite_version();
select 'diag: matched ids '||(select group_concat(cid,' ') from (select distinct cid from e order by cid));
select 'diag: sample unmatched sphere handles: '||(select group_concat(substr(hn,1,4)||'…'||substr(hn,-3), ' ') from (select hn from h where hn not in (select hn from hd) limit 8));
with yr as (select cid, k, json_group_object(y,n) j from (select cid, k, substr(d,1,4) y, count(*) n from e group by 1,2,3) group by 1,2),
mo as (select cid, k, json_group_object(m, json_array(n,l)) j from (select cid, k, substr(d,1,7) m, count(*) n, max(d) l from e where ts > cast(strftime('%s','now') as integer)-365*86400 group by 1,2,3) group by 1,2),
tot as (select cid, k, count(*) n, sum(me) s, min(d) f, max(d) l from e group by 1,2),
per as (select tot.cid, json_group_object(tot.k, json_object('count',tot.n,'sent',tot.s,'first',tot.f,'last',tot.l,'byYear',json(yr.j),
          'syncedAt',date('now','localtime'),'_months',json(coalesce(mo.j,'{}')))) j
        from tot join yr on yr.cid=tot.cid and yr.k=tot.k left join mo on mo.cid=tot.cid and mo.k=tot.k group by tot.cid)
select json_object('kind','stats','payload',coalesce((select json_group_object(cid,json(j)) from per),json('{}')));
" > "$TMP/out.txt" 2> "$TMP/err.txt"
grep "^diag:" "$TMP/out.txt" | sed "s/^diag: //" | while read -r l; do say "$l"; done
grep -v "^diag:" "$TMP/out.txt" > "$TMP/stats.json"
if [ ! -s "$TMP/stats.json" ]; then status false read_error; echo "$(date) Couldn't read Messages: $(head -c 300 "$TMP/err.txt")"; exit 5; fi
PEOPLE="$("$SQL" -batch -noheader :memory: "select count(*) from json_each(json_extract(readfile('$TMP/stats.json'),'\$.payload'));" 2>/dev/null)"
NI="$("$SQL" -batch -noheader :memory: "select count(*) from json_each(json_extract(readfile('$TMP/stats.json'),'\$.payload')) where json_extract(value,'\$.textStats') is not null;" 2>/dev/null)"
NW="$("$SQL" -batch -noheader :memory: "select count(*) from json_each(json_extract(readfile('$TMP/stats.json'),'\$.payload')) where json_extract(value,'\$.whatsappStats') is not null;" 2>/dev/null)"
say "Matched ${NI:-0} people on iMessage and ${NW:-0} on WhatsApp"

say "Sending the counts to Orbit"
# 4. Send the counts to your Orbit.
if post "$TMP/stats.json" > "$TMP/out.json"; then status true "synced i${NI:-0} w${NW:-0}" "${PEOPLE:-0}"; [ "${PEOPLE:-0}" = 1 ] && W=person || W=people; echo "$(date) Synced ${PEOPLE:-0} $W."
else status false send_error; echo "$(date) Couldn't send to Orbit."; exit 6; fi

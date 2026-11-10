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

post() { "$CURL" -fsS -m 120 -H "x-orbit-token: $TOKEN" -H 'content-type: application/json' --data-binary @"$1" "$URL"; }
status() { printf '{"kind":"status","payload":{"ok":%s,"message":"%s","people":%s,"version":"%s"}}' "$1" "$2" "${3:-0}" "$VERSION" > "$TMP/status.json"; post "$TMP/status.json" >/dev/null 2>&1; }

# 1. Copy the Messages database (needs Full Disk Access). Reading a copy never touches the real one.
if ! cp "$MSG" "$TMP/chat.db" 2>/dev/null; then
  status false no_access; echo "$(date) No access to Messages. Turn on Full Disk Access for Orbit Message Sync."; exit 2; fi
cp "$MSG-wal" "$TMP/chat.db-wal" 2>/dev/null; cp "$MSG-shm" "$TMP/chat.db-shm" 2>/dev/null
HAVE_WA=0
if cp "$WA" "$TMP/wa.db" 2>/dev/null; then HAVE_WA=1; cp "$WA-wal" "$TMP/wa.db-wal" 2>/dev/null; cp "$WA-shm" "$TMP/wa.db-shm" 2>/dev/null; fi

# 2. Ask Orbit which phone numbers and emails belong to people in your sphere.
printf '{"kind":"hnorm","payload":{}}' > "$TMP/h.req"
if ! post "$TMP/h.req" > "$TMP/handles.json"; then echo "$(date) Couldn't reach Orbit (check the internet connection or set up again)."; exit 3; fi

# 3. Count messages per person. Only the handle, the date and who sent it are read. Never the text.
WA_PART=""
if [ "$HAVE_WA" = 1 ]; then WA_PART="
  union all
  select h.cid, ev.ts, ev.me, 'whatsappStats' k from (
    select case when length(d)=10 then '+1'||d else '+'||d end hn, m.ZMESSAGEDATE+978307200 ts, coalesce(m.ZISFROMME,0) me
    from (select Z_PK, substr(ZCONTACTJID,1,instr(ZCONTACTJID,'@')-1) d from wa.ZWACHATSESSION where ZSESSIONTYPE=0 and ZCONTACTJID like '%@s.whatsapp.net') s
    join wa.ZWAMESSAGE m on m.ZCHATSESSION=s.Z_PK where coalesce(m.ZMESSAGETYPE,0) not in (6,10)) ev join h on h.hn=ev.hn"; fi
ATTACH=""; [ "$HAVE_WA" = 1 ] && ATTACH="attach database '$TMP/wa.db' as wa;"
cd "$TMP" || exit 4
"$SQL" -bail -batch -noheader chat.db "$ATTACH
with h as (select json_extract(value,'\$.h') hn, json_extract(value,'\$.c') cid from json_each(readfile('handles.json'))),
hd as (select ROWID rid, case when instr(id,'@')>0 then lower(trim(id))
         else (case when length(d)=10 then '+1'||d else '+'||d end) end hn
       from (select ROWID, id, replace(replace(replace(replace(replace(replace(id,' ',''),'-',''),'(',''),')',''),'+',''),'.','') d from handle)),
solo as (select chat_id from chat_handle_join group by chat_id having count(*)=1),
ev as (select h.cid, (case when m.date>100000000000 then m.date/1000000000.0 else m.date end)+978307200 ts, coalesce(m.is_from_me,0) me, 'textStats' k
  from message m join chat_message_join cmj on cmj.message_id=m.ROWID join solo on solo.chat_id=cmj.chat_id
  join chat_handle_join chj on chj.chat_id=cmj.chat_id join hd on hd.rid=chj.handle_id join h on h.hn=hd.hn
  $WA_PART),
e as (select cid, k, ts, me, date(ts,'unixepoch','localtime') d from ev),
yr as (select cid, k, json_group_object(y,n) j from (select cid, k, strftime('%Y',d) y, count(*) n from e group by 1,2,3) group by 1,2),
mo as (select cid, k, json_group_object(m, json_array(n,l)) j from (select cid, k, substr(d,1,7) m, count(*) n, max(d) l from e where ts > cast(strftime('%s','now') as integer)-365*86400 group by 1,2,3) group by 1,2),
tot as (select cid, k, count(*) n, sum(me) s, min(d) f, max(d) l from e group by 1,2),
per as (select tot.cid, json_group_object(tot.k, json_object('count',tot.n,'sent',tot.s,'first',tot.f,'last',tot.l,'byYear',json(yr.j),
          'syncedAt',date('now','localtime'),'_months',json(coalesce(mo.j,'{}')))) j
        from tot join yr on yr.cid=tot.cid and yr.k=tot.k left join mo on mo.cid=tot.cid and mo.k=tot.k group by tot.cid)
select json_object('kind','stats','payload',coalesce((select json_group_object(cid,json(j)) from per),json('{}')));
" > "$TMP/stats.json" 2> "$TMP/err.txt"
if [ ! -s "$TMP/stats.json" ]; then status false read_error; echo "$(date) Couldn't read Messages: $(head -c 300 "$TMP/err.txt")"; exit 5; fi
PEOPLE="$("$SQL" -batch -noheader :memory: "select count(*) from json_each(json_extract(readfile('$TMP/stats.json'),'\$.payload'));" 2>/dev/null)"

# 4. Send the counts to your Orbit.
if post "$TMP/stats.json" > "$TMP/out.json"; then status true synced "${PEOPLE:-0}"; [ "${PEOPLE:-0}" = 1 ] && W=person || W=people; echo "$(date) Synced ${PEOPLE:-0} $W."
else status false send_error; echo "$(date) Couldn't send to Orbit."; exit 6; fi

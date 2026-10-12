(function(){
var mint='7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump';
var slugs=['true-north-transparency-true-north-transparency','2025-2026-development-toronto-palapa-tours','hacking-the-tower-indolestic','united-mma-sponsorship-bk-whiskey','welcome-to-toronto-academy-of-emc-toronto-emc','angry-mortgage-podcast-indolestic-marv','who-runs-the-world-runner-s-club','photoshoot-young-teelo-2','songwriting-camp-documentary-global-masterminds','privilege-jevy','sefra-cozal','saint-flair-west-ooak'];
var track=document.querySelector('.story-work-track');
if(track) fetch('/home-projects.json').then(function(r){if(!r.ok)throw Error();return r.json();}).then(function(entries){
 var set=document.createElement('div');set.className='story-work-set';
 slugs.forEach(function(slug){var p=entries.find(function(p){return p.href==='/project/'+slug;});if(!p)return;var a=document.createElement('a');a.href=p.href;var img=document.createElement('img');img.src=p.image;img.alt=p.title+' — '+p.artist;img.loading='lazy';var span=document.createElement('span');span.textContent=p.title;var small=document.createElement('small');small.textContent=p.tag+' · '+p.artist;span.appendChild(small);a.append(img,span);set.appendChild(a);});
 track.replaceChildren(set);var clone=set.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.querySelectorAll('a').forEach(function(a){a.tabIndex=-1;});track.appendChild(clone);
}).catch(function(){track.remove();});
var activity=document.querySelector('.story-market'),loaded=false;
if(activity)activity.addEventListener('toggle',async function(){
 if(!activity.open||loaded)return;loaded=true;
 activity.querySelector('iframe').src='https://birdeye.so/tv-widget/'+mint+'?chain=solana&viewMode=pair&chartInterval=15&chartType=CANDLE&theme=dark';
 var status=activity.querySelector('[role=status]'),body=activity.querySelector('tbody');
 try{
 var key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkbHB2Y3N4eXhpcnl3amtoc3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTAwMzQsImV4cCI6MjA5Mjk4NjAzNH0.mfI7RcFIMUEH3QzxhtYI7Z2gkm-V2VdKAcGaF6p523w';
 var r=await fetch('https://hdlpvcsxyxirywjkhsui.supabase.co/functions/v1/rhoze-trades?limit=100&bucket=3600',{headers:{apikey:key,Authorization:'Bearer '+key}});if(!r.ok)throw Error();var data=await r.json();
 var trades=(data.trades||[]).filter(function(t){return t.sig&&Number.isFinite(Number(t.tokens))&&Number.isFinite(Number(t.valueUsd));}).sort(function(a,b){return b.ts-a.ts;});
 trades.forEach(function(t){var row=document.createElement('tr');[new Date(t.ts*1000).toLocaleDateString(),t.type==='buy'?'Buy':t.type==='sell'?'Sell':'Trade',Number(t.tokens).toLocaleString(undefined,{maximumFractionDigits:0}),Number(t.valueUsd).toLocaleString(undefined,{style:'currency',currency:'USD'})].forEach(function(text){var td=document.createElement('td');td.textContent=text;row.appendChild(td);});var td=document.createElement('td'),a=document.createElement('a');a.href='https://solscan.io/tx/'+encodeURIComponent(t.sig);a.target='_blank';a.rel='noopener noreferrer';a.textContent='↗';a.setAttribute('aria-label','Verify transaction on Solscan');td.appendChild(a);row.appendChild(td);body.appendChild(row);});
 status.textContent=trades.length?'Recent indexed trades · USD':'No indexed trades available. Check full activity on Solscan.';
 }catch(e){status.textContent='Transaction activity is unavailable right now. Check full activity on Solscan.';}
});
})();

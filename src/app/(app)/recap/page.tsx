"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/backlog-store";
import { supabase } from "@/lib/supabase";
import { buildMonthlyRecap, type RecapItem } from "@/lib/monthly-recap";
import { loadMonthlyRecap } from "@/lib/monthly-recap-data";
import { currentRecapMonth, recapLabel, validRecapMonth } from "@/lib/recap-month";
import { RecapShareCard } from "@/components/RecapShareCard";
import { CoverImage } from "@/components/CoverImage";

const labels = {game:"Games",movie:"Films",series:"Series",anime:"Anime"};
function MonthContent({userId,month}:{userId:string;month:string}) {
  const [state,setState]=useState<{items:RecapItem[];loading:boolean;error:boolean}>({items:[],loading:true,error:false});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let alive=true;
    loadMonthlyRecap(supabase,userId,month).then(items=>{if(alive)setState({items,loading:false,error:false});}).catch(()=>{if(alive)setState({items:[],loading:false,error:true});});
    return()=>{alive=false;};
  },[userId,month,attempt]);
  if(state.loading)return <p role="status" className="py-10 text-muted">Loading your month…</p>;
  if(state.error)return <div role="status" className="rounded-2xl bg-surface p-6"><p>Your recap couldn’t load. Check your connection and try again.</p><button type="button" onClick={()=>{setState({items:[],loading:true,error:false});setAttempt(n=>n+1);}} className="mt-4 min-h-11 rounded-full bg-accent px-5 text-white">Retry</button></div>;
  const recap=buildMonthlyRecap(state.items,month), safe=buildMonthlyRecap(state.items,month,true);
  const card={month:recapLabel(month),count:safe.completed.length,countLabel:safe.completed.length===1?"title finished":"titles finished",detail:Object.entries(safe.byType).filter(([,count])=>count).map(([type,count])=>`${count} ${count===1&&type!=="series"?labels[type as keyof typeof labels].toLowerCase().replace(/s$/,""):labels[type as keyof typeof labels].toLowerCase()}`).join(" · ")||"No non-private completions recorded",highlights:safe.highlights.map(item=>({title:item.title,detail:`${labels[item.media_type]}${item.rating!=null?` · ${item.rating}/5`:""}${item.is_favorite?" · Favourite":""}`}))};
  return <div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">
    <div className="space-y-7">
      <section className="rounded-2xl bg-surface p-5 sm:p-6"><h2 className="font-display text-2xl font-bold text-ink">{recap.completed.length?`${recap.completed.length} ${recap.completed.length===1?"title":"titles"}, finished.`:"A quieter month."}</h2><p className="mt-2 text-sm text-muted">{recap.average!==null?`Average rating ${recap.average.toFixed(1)}/5 across scored completions.`:"No scored completions in this month."}</p><dl className="mt-5 grid grid-cols-4 gap-2">{Object.entries(recap.byType).map(([type,count])=><div key={type}><dt className="text-xs text-muted">{labels[type as keyof typeof labels]}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{count}</dd></div>)}</dl></section>
      <section><h2 className="mb-3 font-display text-xl font-bold text-ink">The highlights</h2>{recap.highlights.length?<div className="grid grid-cols-3 gap-3">{recap.highlights.map(item=><div key={item.id}><div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-ivory"><CoverImage src={item.cover_url} title={item.title} sizes="(max-width: 640px) 30vw, 200px"/></div><h3 className="mt-2 text-sm font-semibold text-ink">{item.title}</h3><p className="mt-1 text-xs text-muted">{item.rating!==null?`${item.rating}/5`:"Not rated"}{item.is_favorite?" · Favourite":""}{item.is_private?" · Private":""}</p></div>)}</div>:<p className="text-sm text-muted">Finish a title to start a recap, or choose another month.</p>}</section>
      {recap.completed.length>0&&<section><h2 className="mb-3 font-display text-xl font-bold text-ink">Everything you finished</h2><ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface">{recap.completed.map(item=><li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3"><span className="min-w-0"><span className="block text-sm font-medium text-ink">{item.title}</span><span className="text-xs text-muted">{labels[item.media_type]}{item.is_private?" · Private":""}</span></span><time className="shrink-0 text-xs text-muted" dateTime={item.completed_at!}>{new Date(item.completed_at!).toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}</time></li>)}</ul></section>}
      <p className="text-xs leading-relaxed text-muted">Based on currently completed titles and recorded completion dates, grouped in UTC. Titles without a completion date aren’t counted. Scores and favourites reflect your current library, so recaps may change as you edit it.</p>
    </div><RecapShareCard variant="backlog" data={card}/>
  </div>;
}
export default function MonthlyRecapPage(){
  const {session}=useAuth();
  const [month,setMonth]=useState(()=>currentRecapMonth());
  return <div className="space-y-7 pb-8 pt-10 sm:pt-12"><header className="flex flex-wrap items-end justify-between gap-4"><div><Link href="/" className="text-sm text-accent">← Up Next</Link><h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">Your month, in review</h1><p className="mt-1 text-sm text-muted">The stories you finished. The ones that stayed with you.</p></div><label className="text-xs text-muted">Recap month<input type="month" aria-label="Recap month" min="2000-01" max={currentRecapMonth()} value={month} onChange={e=>setMonth(validRecapMonth(e.target.value))} className="mt-1 block min-h-11 rounded-xl bg-ivory px-3 text-sm text-ink"/></label></header><p className="text-sm font-semibold text-accent">{recapLabel(month)}{month===currentRecapMonth()?" · So far":""}</p>{session&&<MonthContent key={session.user.id+month} userId={session.user.id} month={month}/>}</div>;
}

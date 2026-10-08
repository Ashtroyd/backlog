import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecapItem } from "./monthly-recap";
import { recapBounds } from "./recap-month";

export async function loadMonthlyRecap(client: SupabaseClient, userId: string, month: string): Promise<RecapItem[]> {
  const {start,end} = recapBounds(month);
  const rows: RecapItem[] = [];
  for(let offset=0; ;offset+=1000) {
    const {data,error} = await client.from("items")
      .select("id,title,cover_url,media_type,status,completed_at,rating,is_favorite,is_private")
      .eq("user_id",userId).eq("status","completed").gte("completed_at",start).lt("completed_at",end)
      .order("completed_at",{ascending:false}).order("id").range(offset,offset+999).abortSignal(AbortSignal.timeout(8000));
    if(error) throw error;
    rows.push(...(data ?? []) as RecapItem[]);
    if(!data || data.length<1000) return rows;
  }
}

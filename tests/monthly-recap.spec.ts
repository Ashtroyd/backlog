import {expect,test,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
test.use({trace:"off"});
// Isolated auth and data: never creates accounts or reaches the real database.
const user={id:"11111111-1111-4111-8111-111111111111",email:"recap@example.test",aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"};
const base={user_id:user.id,cover_url:null,release_year:2025,genres:[],meta:{},status:"completed",rating:4,review:null,is_private:false,is_favorite:false,started_at:null,progress:null,hours_played:null,notes:null,pinned_at:null,live_service:false,current_thoughts:null,created_at:"2026-01-01T00:00:00Z",updated_at:"2026-09-15T00:00:00Z",completed_at:"2026-09-15T00:00:00Z"};
const rows=[{...base,id:"a",external_id:"1",title:"Arrival",media_type:"movie"},{...base,id:"b",external_id:"2",title:"Secret favourite",media_type:"game",is_private:true,is_favorite:true,rating:5},{...base,id:"c",external_id:"3",title:"Unknown finish date",media_type:"anime",completed_at:null}];
async function openRecap(page:Page,fail=false){
 await page.addInitScript(()=>localStorage.setItem("backlog:tourSeen","1"));
 await page.route("https://*.supabase.co/**",async route=>{
   const url=new URL(route.request().url());let body:unknown=[];
   if(url.pathname.includes("/auth/v1/token")){
     const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
     body={access_token:`${enc({alg:"HS256",typ:"JWT"})}.${enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})}.fixture`,refresh_token:"fixture",expires_in:3600,token_type:"bearer",user};
   }else if(url.pathname.endsWith("/user"))body=user;
   else if(url.pathname.endsWith("/profiles")){
     const profile={id:user.id,username:"recap",display_name:"Recap",avatar_url:null,banner_url:null,bio:null,home_layout:null};
     body=route.request().headers().accept?.includes("object")?profile:[profile];
   }else if(url.pathname.endsWith("/items")){
     const isRecap=url.searchParams.has("completed_at");
     if(fail&&isRecap)return route.fulfill({status:400,contentType:"application/json",body:JSON.stringify({message:"fixture failed"})});
     if(isRecap)expect(url.searchParams.get("user_id")).toBe(`eq.${user.id}`);
     body=rows.filter(row=>[...url.searchParams].every(([key,value])=>{
       const v=row[key as keyof typeof row];
       if(value.startsWith("eq."))return String(v)===value.slice(3);
       if(value.startsWith("gte."))return v!==null&&String(v)>=value.slice(4);
       if(value.startsWith("lt."))return v!==null&&String(v)<value.slice(3);
       return true;
     }));if(url.searchParams.has("or"))body=[];
   }
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
 });
 await page.route("**/api/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({results:[],ok:true})}));
 await page.goto("/");await page.getByLabel("Email",{exact:true}).fill(user.email);await page.getByLabel("Password",{exact:true}).fill("fixture-only");await page.getByRole("button",{name:"Log in",exact:true}).click();
 await page.getByRole("link",{name:"Monthly recap →",exact:true}).click();await page.getByLabel("Recap month",{exact:true}).fill("2026-09");
 return ()=>{fail=false;};
}
for(const width of [390,1440])test(`recap is private-safe and downloads a PNG at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await openRecap(page);await expect(page.getByRole("heading",{name:"2 titles, finished."})).toBeVisible();
 await expect(page.getByText("Unknown finish date",{exact:true})).toHaveCount(0);
 const canvas=page.locator("canvas");await expect(canvas).toHaveAttribute("aria-label",/1 title finished/);await expect(canvas).not.toHaveAttribute("aria-label",/Secret favourite/);
 const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Download card"}).click();const download=await downloadPromise;const bytes=await readFile((await download.path())!);
 expect(bytes.subarray(1,4).toString()).toBe("PNG");expect(bytes.readUInt32BE(16)).toBe(1080);expect(bytes.readUInt32BE(20)).toBe(1350);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath(`recap-${width}.png`),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel("Recap month",{exact:true}).fill("2026-08");await expect(page.getByRole("heading",{name:"A quieter month."})).toBeVisible();
 expect(errors).toEqual([]);
});
test("recap load failure has a working retry and card failures stay visible",async({page})=>{
 const recover=await openRecap(page,true);await expect(page.getByText(/Your recap couldn’t load/)).toBeVisible();recover();await page.getByRole("button",{name:"Retry",exact:true}).click();await expect(page.getByRole("heading",{name:"2 titles, finished."})).toBeVisible();
 await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};});await page.getByRole("button",{name:"Download card"}).click();await expect(page.getByText("The card couldn’t download. Try again.")).toBeVisible();
});

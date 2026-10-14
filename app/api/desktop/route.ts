// Additive media authorization gateway; existing login/session routes are unchanged.
import { csrfAllowed } from '@/lib/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:Request) {
  try {
    const input=await req.json();
    if(input.action!=='grant'&&input.action!=='revoke')return Response.json({error:'Denied'},{status:403});
    const origin=req.headers.get('origin');
    if(!origin||!csrfAllowed(req))return Response.json({error:'Denied'},{status:403});
    const base=(process.env.NODE_ENV==='development'?process.env.GTV_DESKTOP_TEST_BACKEND_URL:undefined)||process.env.RAILWAY_BACKEND_URL;
    if(!base)return Response.json({error:'Unavailable'},{status:503});
    const upstream=await fetch(`${base}/api/desktop`,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin,'Cookie':req.headers.get('cookie')||''},body:JSON.stringify(input),cache:'no-store',signal:AbortSignal.timeout(4500)});
    return new Response(upstream.body,{status:upstream.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Unavailable'},{status:503});}
}

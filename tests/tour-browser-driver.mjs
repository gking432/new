import { execFileSync } from 'node:child_process';
export const session = process.env.QA_SESSION || 'tour-qa';
export function ab(...args) { return execFileSync('npx',['--yes','agent-browser','--session',session,...args],{encoding:'utf8',timeout:25000}); }
export function evaluate(js) { return ab('eval',js).trim(); }
export const sleep = ms => new Promise(r=>setTimeout(r,ms));
export function state() { return JSON.parse(evaluate('({step:document.querySelector("[data-tour-step]")?.getAttribute("data-tour-step"),url:location.pathname+location.search,text:document.body.innerText.slice(-2200)})')); }
export async function waitStep(id) { for(let i=0;i<35;i++){const s=state();if(s.step===id){console.log('STEP',id,s.url);return s;}await sleep(200);} throw Error('Expected '+id+' got '+JSON.stringify(state())); }
export async function clickText(text,selector='button') {
 evaluate(`(() => { const matches=Array.from(document.querySelectorAll(${JSON.stringify(selector)})).filter(e=>e.textContent.trim()===${JSON.stringify(text)} && e.getClientRects().length); const el=matches[0]; if(!el) throw Error('Missing control: '+${JSON.stringify(text)}); if(el.disabled) throw Error('Disabled control');  el.click(); })()`); await sleep(200);
}
export async function clickSelector(selector) { evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(!el) throw Error('Missing '+${JSON.stringify(selector)});el.click();})()`); await sleep(200); }
export async function next(from,to) { await waitStep(from); await clickText('Next'); await waitStep(to); }
export async function nav(from,route,to) {await waitStep(from); await clickSelector('nav a[href="'+route+'"]');await waitStep(to);}

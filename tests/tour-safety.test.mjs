import test from 'node:test';
import assert from 'node:assert/strict';
import { readCheckpoint, restoreStep } from '../lib/tutorial/checkpoint.ts';
import { reserveVoiceMint, voiceQuotaConfigured, liveVoiceConfigured, createLocalMintLimiter } from '../lib/realtime/quota.ts';

const id='00000000-0000-4000-8000-000000000001';
const saved=(stepId,route)=>({stepId,route,storylineLeadId:id,gregLeadId:id});

test('resume preserves route, query and stable step identity after step insertion',()=>{
 const s=saved('approve-1',`/app/inbox?tab=approvals&lead=${id}`);
 assert.deepEqual(restoreStep([{id:'welcome'},{id:'inserted'},{id:'approve-1'}],s,false),{index:2,route:s.route,recovered:false});
});
test('invalid stored state and external resume URLs cannot redirect or crash',()=>{
 for(const raw of ['oops','null','{}',JSON.stringify(saved('x','//example.com')),JSON.stringify(saved('x','/app\\evil'))]) assert.equal(readCheckpoint(raw),null);
 assert.equal(restoreStep([{id:'welcome'}],saved('removed','/app/quotes'),false).index,0);
});
test('refresh reopens the email composer for the same customer',()=>{
 const result=restoreStep([{id:'welcome'},{id:'reply-email'}],saved('send-email-reply','/app/inbox'),true);
 assert.equal(result.index,1);assert.equal(result.route,`/app/inbox?tab=conversations&lead=${id}`);assert.equal(result.recovered,true);
});
test('refresh after quote output preserves the saved quote and selected lead',()=>{
 const route=`/app/quote-tool?lead=${id}`;
 assert.equal(restoreStep([{id:'quote-review-result'}],saved('quote-review-result',route),true).route,route);
});
test('live voice does not require Redis and absent quotas do not block minting',async()=>{
 assert.equal(voiceQuotaConfigured({}),false);
 assert.equal(liveVoiceConfigured({OPENAI_API_KEY:'test-key'}),true);
 assert.equal(liveVoiceConfigured({OPENAI_API_KEY:'test-key',ENABLE_REALTIME_CALLS:'false'}),false);
 assert.equal(liveVoiceConfigured({}),false);
 assert.equal(await reserveVoiceMint({},()=>{throw Error('Redis must not be contacted');}),true);
});
test('local burst limit rejects excess mints and recovers after a minute',()=>{
 let time=1000;
 const reserve=createLocalMintLimiter(()=>time);
 for(let i=0;i<10;i++) assert.equal(reserve(10),true);
 assert.equal(reserve(10),false);
 time+=60000;
 assert.equal(reserve(10),true);
});
const env={UPSTASH_REDIS_REST_URL:'https://quota.example.test',UPSTASH_REDIS_REST_TOKEN:'test-token'};
test('quota denial, malformed responses, HTTP errors and outages fail closed',async()=>{
 for(const response of [new Response('{"result":0}'),new Response('{"result":"1"}'),new Response('{"error":"bad"}'),new Response('{}',{status:500}),new Response('not json')]) {
  assert.equal(await reserveVoiceMint(env,async()=>response),false);
 }
 assert.equal(await reserveVoiceMint(env,async()=>{throw Error('offline');}),false);
});
test('all instances reserve through one atomic server operation with bounded configuration',async()=>{
 let command;
 const fetchMock=async(url,options)=>{
   assert.equal(url,env.UPSTASH_REDIS_REST_URL);
   assert.equal(options.cache,'no-store');
   command=JSON.parse(options.body);
   return new Response('{"result":1}');
 };
 assert.equal(await reserveVoiceMint({...env,REALTIME_MINTS_PER_MINUTE:'Infinity',REALTIME_MINTS_PER_DAY:'1000000'},fetchMock),true);
 assert.equal(command[0],'EVAL');
 assert.deepEqual(command.slice(2),['2','northstar:voice:minute','northstar:voice:day','5','30']);
});

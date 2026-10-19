import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {checkManifest} from './check-manifest.mjs';
const fixtureParent=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../_validation');
const fixtureParentExisted=fs.existsSync(fixtureParent);fs.mkdirSync(fixtureParent,{recursive:true});
const root=fs.mkdtempSync(path.join(fixtureParent,'manifest-test-'));
const bytes=Buffer.from('Synthetic owned evidence, not a runtime capture.');
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
const at='2026-10-19T01:00:00.000Z',later='2026-10-19T01:00:01.000Z';
fs.writeFileSync(path.join(root,'owned.txt'),bytes);
const valid=()=>({schemaVersion:1,profile:{id:'synthetic',name:'Synthetic',sourceCategory:'web',git:{commit:null}},scope:{goal:'Inspect a representative interaction',mode:'style-and-core-flows',acceptanceCriteria:[{id:'ui',description:'Representative flow'}],acceptedBoundaries:[]},delivery:{status:'complete',criteria:[{id:'ui',status:'met',evidence:['source-rule']}]},readiness:{status:'ready',readyRules:['navigation.return']},targets:[{id:'source',role:'source',runtime:'web-browser',identity:'Synthetic test target only'}],runs:[{id:'run1',targetId:'source',controller:'test',startedAt:at,origin:'current',dataMode:'fixture'}],artifacts:[{id:'screen',path:'owned.txt',sha256:sha,bytes:bytes.length,classification:'A',sharing:'approved'}],captures:[{id:'capture',runId:'run1',targetId:'source',classification:'A',startedAt:at,completedAt:later,atomic:false,method:'Synthetic metadata test only',parts:[{kind:'screenshot',artifactId:'screen',startedAt:at,completedAt:at}],review:{status:'accepted',reviewedAt:later}}],coverage:[{id:'source-rule',subject:'source',kind:'runtime',researchStatus:'verified',evidence:['capture']}],distribution:{default:'deny',files:[{artifactId:'screen',sha256:sha,bytes:bytes.length,reviewedAt:later}]}});
const evaluate=(mutate=()=>{},distributed=false)=>{const manifest=valid();mutate(manifest);return {manifest,result:checkManifest(manifest,{root,distributed})};};

test('declared owned local evidence validates without changing state',()=>{
 const {manifest,result}=evaluate();assert.equal(result.status,'passed-integrity-only');assert.equal(result.filesChecked,1);assert.equal(manifest.coverage[0].researchStatus,'verified');assert.equal(result.statesModified,false);
});
test('source runtime verification cannot borrow D evidence',()=>{
 const {result}=evaluate(m=>{m.targets[0].role='reference';m.captures[0].classification='D';m.artifacts[0].classification='D';});assert(result.errors.some(e=>e.includes('reviewed A capture')));
});
test('a REA catalog entry needs declared traceable source research',()=>{
 assert(evaluate(m=>m.scope.mode='catalog').result.errors.some(e=>e.includes('source-research identity')));
 assert.equal(evaluate(m=>{m.scope.mode='catalog';m.profile.researchIdentity={status:'documented',evidenceRefs:['capture']};}).result.status,'passed-integrity-only');
});
test('a captured file still needs actual review and timing',()=>{
 assert(evaluate(m=>m.captures[0].review.status='pending').result.errors.some(e=>e.includes('reviewed A capture')));
 assert(evaluate(m=>m.captures[0].parts[0].completedAt='2026-10-19T02:00:00.000Z').result.errors.some(e=>e.includes('timestamps')));
 assert(evaluate(m=>m.captures[0].atomic=true).result.errors.some(e=>e.includes('atomic guarantee')));
});
test('accepted scope boundary leaves untested research unverified',()=>{
 const {manifest,result}=evaluate(m=>{m.coverage.push({id:'device-sync',subject:'source',kind:'runtime',researchStatus:'unverified',evidence:[]});m.scope.acceptanceCriteria.push({id:'sync',description:'Real second device'});m.scope.acceptedBoundaries.push({id:'later',description:'User defers real-device sync',userInstructionRef:'Synthetic explicit user instruction',acceptedAt:later});m.delivery.criteria.push({id:'sync',status:'accepted_with_boundary',boundaryId:'later'});});
 assert.equal(result.status,'passed-integrity-only');assert.equal(manifest.coverage[1].researchStatus,'unverified');assert.equal(result.declaredAgreedDeliveryStatus,'complete');
});
test('full validation cannot silently drop an unresolved criterion',()=>{
 const {result}=evaluate(m=>{m.scope.mode='full-functional-validation';m.scope.acceptanceCriteria.push({id:'sync',description:'Full sync validation'});});assert(result.errors.some(e=>e.includes('unresolved criterion: sync')));
 assert(evaluate(m=>{m.scope.acceptedBoundaries.push({id:'assumed',description:'Assumed acceptance',acceptedAt:later});}).result.errors.some(e=>e.includes('explicit user instruction')));
});
test('distributed mode omits declared withheld bytes without pretending they shipped',()=>{
 const mutate=m=>m.artifacts.push({id:'private',path:'absent-private.txt',sha256:sha,bytes:bytes.length,classification:'A',sharing:'withheld'});
 assert(evaluate(mutate).result.errors.some(e=>e.includes('Required artifact missing')));
 const {result}=evaluate(mutate,true);assert.equal(result.status,'passed-integrity-only');assert.equal(result.omittedArtifacts,1);assert.equal(result.filesChecked,1);
});
test('distribution exact review does not follow changed metadata or private approval',()=>{
 assert(evaluate(m=>m.artifacts[0].sharing='withheld',true).result.errors.some(e=>e.includes('Exact distribution review')));
 assert(evaluate(m=>m.artifacts[0].sha256='b'.repeat(64),true).result.errors.some(e=>e.includes('Exact distribution review')));
});
test('bytes, duplicate IDs and traversal fail explicitly',()=>{
 assert(evaluate(m=>m.artifacts[0].bytes++).result.errors.some(e=>e.includes('bytes changed')));
 assert(evaluate(m=>m.artifacts.push({...m.artifacts[0]})).result.errors.some(e=>e.includes('duplicate id')));
 assert(evaluate(m=>m.artifacts[0].path='../outside.txt').result.errors.some(e=>e.includes('Invalid portable artifact path')));
 assert(evaluate(m=>m.targets.push(null)).result.errors.some(e=>e.includes('non-object')));
});
test.after(()=>{
 const resolved=path.resolve(root),allowed=path.resolve(fixtureParent)+path.sep;
 assert(resolved.startsWith(allowed)&&path.basename(resolved).startsWith('manifest-test-'));
 fs.rmSync(resolved,{recursive:true});
 if(!fixtureParentExisted&&fs.readdirSync(fixtureParent).length===0)fs.rmdirSync(fixtureParent);
});

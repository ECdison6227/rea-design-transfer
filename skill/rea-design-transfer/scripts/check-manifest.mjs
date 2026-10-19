/** Portable, read-only declared-evidence checks. Does not capture, approve, publish or alter status. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export function checkManifest(manifest,{root,distributed=false}){
 manifest=manifest&&typeof manifest==='object'?manifest:{};
 const errors=[],warnings=[];
 const check=(ok,message)=>{if(!ok)errors.push(message);};
 const text=v=>typeof v==='string'&&v.trim().length>0;
 const date=v=>text(v)&&Number.isFinite(Date.parse(v));
 const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 const list=(value,name)=>{check(Array.isArray(value),name+' must be an array');return Array.isArray(value)?value:[];};
 const index=(values,name)=>{const map=new Map();for(const value of values){if(!value||typeof value!=='object'||Array.isArray(value)){check(false,name+' has a non-object record');continue;}check(text(value.id),name+' has an invalid id');check(!map.has(value.id),name+' duplicate id: '+value.id);map.set(value.id,value);}return map;};
 const inside=(parent,child)=>{const rel=path.relative(parent,child);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
 root=fs.realpathSync(root);
 const artifactPath=relative=>{
  const valid=text(relative)&&!relative.includes('\\')&&!relative.includes(':')&&!path.isAbsolute(relative)&&!relative.split('/').some(s=>s==='..'||s===''||s==='.');
  check(valid,'Invalid portable artifact path: '+relative);
  if(!valid)return null;
  const resolved=path.resolve(root,relative);check(inside(root,resolved),'Artifact escapes root: '+relative);
  return inside(root,resolved)?resolved:null;
 };
 check(manifest?.schemaVersion===1,'Unsupported schemaVersion');
 check(text(manifest?.profile?.id)&&text(manifest?.profile?.name),'Missing profile identity');
 check(['web','desktop','mobile','unknown'].includes(manifest?.profile?.sourceCategory),'Invalid original source category');
 const sourceCommit=manifest?.profile?.git?.commit;
 if(sourceCommit!==null&&sourceCommit!==undefined)check(/^[a-f0-9]{40,64}$/.test(sourceCommit),'Invalid declared Git commit');
 const targets=index(list(manifest.targets,'targets'),'targets');
 const runs=index(list(manifest.runs,'runs'),'runs');
 const artifacts=index(list(manifest.artifacts,'artifacts'),'artifacts');
 const captures=index(list(manifest.captures,'captures'),'captures');
 const coverage=index(list(manifest.coverage,'coverage'),'coverage');
 for(const target of targets.values()){
  check(['source','reference','transfer'].includes(target.role),'Invalid target role: '+target.id);
  check(text(target.runtime)&&text(target.identity),'Missing runtime/identity for '+target.id);
 }
 for(const run of runs.values()){
  check(targets.has(run.targetId),'Unknown run target: '+run.id);
  check(text(run.controller)&&date(run.startedAt),'Run needs controller/start time: '+run.id);
  check(['current','historical'].includes(run.origin),'Run needs actual historical/current origin: '+run.id);
  check(['authentic','fixture','unknown'].includes(run.dataMode),'Run needs explicit dataMode: '+run.id);
  if(run.completedAt!==null&&run.completedAt!==undefined)check(date(run.completedAt)&&Date.parse(run.completedAt)>=Date.parse(run.startedAt),'Run timestamps differ: '+run.id);
 }
 const paths=new Set();
 for(const artifact of artifacts.values()){
  check(!paths.has(artifact.path),'Duplicate artifact path: '+artifact.path);paths.add(artifact.path);
  artifactPath(artifact.path);
  check(digest(artifact.sha256)&&Number.isSafeInteger(artifact.bytes)&&artifact.bytes>=0,'Artifact needs actual SHA-256/bytes: '+artifact.id);
  check(['A','B','C','D'].includes(artifact.classification),'Invalid artifact classification: '+artifact.id);
  check(['approved','withheld','pending'].includes(artifact.sharing),'Invalid artifact sharing boundary: '+artifact.id);
 }
 for(const capture of captures.values()){
  const run=runs.get(capture.runId),target=targets.get(run?.targetId);
  check(!!run&&capture.targetId===run.targetId,'Capture run/target differs: '+capture.id);
  check(capture.classification===(target?.role==='source'?'A':'D'),'Capture confuses source/reference identity: '+capture.id);
  check(date(capture.startedAt)&&date(capture.completedAt)&&Date.parse(capture.completedAt)>=Date.parse(capture.startedAt),'Capture timestamps differ: '+capture.id);
  if(run)check(Date.parse(capture.startedAt)>=Date.parse(run.startedAt)&&(!run.completedAt||Date.parse(capture.completedAt)<=Date.parse(run.completedAt)),'Capture lies outside its recorded run: '+capture.id);
  check(typeof capture.atomic==='boolean'&&(capture.atomic===false||text(capture.atomicityEvidence)),'Capture needs actual non-atomic boundary or atomic guarantee: '+capture.id);
  check(text(capture.method),'Capture method missing: '+capture.id);
  const parts=list(capture.parts,'capture.parts '+capture.id);check(parts.length>0,'Capture has no actual parts: '+capture.id);
  for(const part of parts){
   if(!part||typeof part!=='object'){check(false,'Invalid capture part: '+capture.id);continue;}
   const artifact=artifacts.get(part.artifactId);
   check(!!artifact&&artifact.classification===capture.classification,'Capture artifact identity differs: '+capture.id);
   check(text(part.kind)&&date(part.startedAt)&&date(part.completedAt)&&Date.parse(part.startedAt)>=Date.parse(capture.startedAt)&&Date.parse(part.completedAt)>=Date.parse(part.startedAt)&&Date.parse(part.completedAt)<=Date.parse(capture.completedAt),'Capture part timestamps differ: '+capture.id);
  }
  check(['pending','accepted','rejected'].includes(capture.review?.status),'Capture review status missing: '+capture.id);
  if(capture.review?.status==='accepted')check(date(capture.review.reviewedAt),'Accepted capture needs review time: '+capture.id);
 }
 const knownEvidence=id=>artifacts.has(id)||captures.has(id);
 for(const item of coverage.values()){
  check(['source','reference','transfer'].includes(item.subject),'Coverage subject missing: '+item.id);
  check(['runtime','static'].includes(item.kind),'Coverage kind missing: '+item.id);
  check(['verified','partial','unverified','not_applicable'].includes(item.researchStatus),'Invalid research status: '+item.id);
  const evidence=list(item.evidence,'coverage.evidence '+item.id);for(const id of evidence)check(knownEvidence(id),'Unknown evidence '+id+' for '+item.id);
  if(item.researchStatus==='not_applicable')check(text(item.reason),'Not-applicable needs reason: '+item.id);
  if(item.researchStatus==='verified'){
   check(evidence.length>0,'Verified coverage lacks evidence: '+item.id);
   if(item.subject==='source'&&item.kind==='runtime')check(evidence.some(id=>captures.get(id)?.classification==='A'&&captures.get(id)?.review?.status==='accepted'),'Verified source runtime coverage needs reviewed A capture: '+item.id);
   if(item.subject==='source'&&item.kind==='static')check(text(item.anchor)&&evidence.some(id=>artifacts.get(id)?.classification==='B'),'Verified source static coverage needs B bytes and exact anchor: '+item.id);
  }
 }
 const scope=manifest.scope,delivery=manifest.delivery;
 check(text(scope?.goal)&&['style-and-core-flows','full-functional-validation','documents-only','transfer','catalog'].includes(scope?.mode),'Scope goal/mode missing');
 if(scope?.mode==='catalog'){
  const qualification=manifest.profile?.researchIdentity;
  check(qualification?.status==='documented'&&Array.isArray(qualification.evidenceRefs)&&qualification.evidenceRefs.some(id=>captures.get(id)?.classification==='A'||['A','B'].includes(artifacts.get(id)?.classification)),'REA catalog entry needs explicitly documented source-research identity; ordinary UI implementation alone does not qualify');
 }
 const criteria=index(list(scope?.acceptanceCriteria,'scope.acceptanceCriteria'),'acceptanceCriteria');
 const results=index(list(delivery?.criteria,'delivery.criteria'),'delivery.criteria');
 const boundaries=index(list(scope?.acceptedBoundaries,'scope.acceptedBoundaries'),'acceptedBoundaries');
 for(const boundary of boundaries.values())check(text(boundary.description)&&text(boundary.userInstructionRef)&&date(boundary.acceptedAt),'Accepted boundary needs explicit user instruction/time: '+boundary.id);
 check(['in_progress','partial','complete'].includes(delivery?.status),'Invalid agreed delivery status');
 for(const result of results.values()){
  check(criteria.has(result.id),'Delivery criterion not in agreed scope: '+result.id);
  check(['pending','met','accepted_with_boundary'].includes(result.status),'Invalid delivery criterion status: '+result.id);
  if(result.status==='accepted_with_boundary')check(boundaries.has(result.boundaryId),'Delivery boundary missing: '+result.id);
  if(result.status==='met'){
   const evidence=list(result.evidence,'delivery.evidence '+result.id);check(evidence.length>0,'Met criterion lacks evidence: '+result.id);
   for(const id of evidence)check(knownEvidence(id)||coverage.has(id),'Unknown delivery evidence: '+id);
  }
 }
 if(delivery?.status==='complete'){
  check(criteria.size>0,'Complete delivery needs agreed criteria');
  for(const id of criteria.keys())check(['met','accepted_with_boundary'].includes(results.get(id)?.status),'Complete delivery has an unresolved criterion: '+id);
 }
 check(['not_assessed','ready','conditional','not_ready'].includes(manifest.readiness?.status),'Invalid migration readiness');
 if(manifest.readiness?.status==='ready')check(Array.isArray(manifest.readiness.readyRules)&&manifest.readiness.readyRules.length>0,'Ready migration needs identified usable rules');
 check(manifest.distribution?.default==='deny','Distribution must default to deny');
 const selections=list(manifest.distribution?.files,'distribution.files'),selected=new Set();
 for(const selection of selections){
  if(!selection||typeof selection!=='object'){check(false,'Invalid distribution selection');continue;}
  const artifact=artifacts.get(selection.artifactId);check(!selected.has(selection.artifactId),'Duplicate distributed selection: '+selection.artifactId);selected.add(selection.artifactId);
  check(artifact?.sharing==='approved'&&artifact.sha256===selection.sha256&&artifact.bytes===selection.bytes&&date(selection.reviewedAt),'Exact distribution review differs or is absent: '+selection.artifactId);
 }
 let filesChecked=0,bytesChecked=0;
 for(const artifact of artifacts.values()){
  if(distributed&&!selected.has(artifact.id))continue;
  const resolved=artifactPath(artifact.path);if(!resolved)continue;
  if(!fs.existsSync(resolved)){check(false,'Required artifact missing: '+artifact.path);continue;}
  if(!inside(root,fs.realpathSync(resolved))){check(false,'Artifact symlink escapes root: '+artifact.path);continue;}
  if(!fs.statSync(resolved).isFile()){check(false,'Artifact is not a regular file: '+artifact.path);continue;}
  const bytes=fs.readFileSync(resolved);filesChecked++;bytesChecked+=bytes.length;
  check(bytes.length===artifact.bytes&&crypto.createHash('sha256').update(bytes).digest('hex')===artifact.sha256,'Artifact bytes changed: '+artifact.path);
 }
 if(!captures.size)warnings.push('No runtime captures declared; this check has exercised no runtime evidence.');
 const researchCoverage=Object.fromEntries(['verified','partial','unverified','not_applicable'].map(status=>[status,[...coverage.values()].filter(item=>item.researchStatus===status).length]));
 return {status:errors.length?'failed':'passed-integrity-only',mode:distributed?'distributed-exact-declared-set':'local-all-declared-artifacts',profileId:manifest.profile?.id,filesChecked,bytesChecked,declaredArtifacts:artifacts.size,omittedArtifacts:distributed?artifacts.size-selected.size:0,researchCoverage,declaredMigrationReadiness:manifest.readiness?.status,declaredAgreedDeliveryStatus:delivery?.status,statesModified:false,limitations:['Checks only declared structure, references and actual file bytes. Does not prove completeness of the artifact inventory, target identity, pixels, behavior, authorization or user acceptance.','No GUI, Git, network or archive inspection. Metadata about omitted artifacts does not make them public evidence.'],warnings,errors};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,flag,...rest]=process.argv.slice(2);
 if(!input||(flag&&flag!=='--distributed')||rest.length)throw Error('Usage: node check-manifest.mjs MANIFEST.json [--distributed]');
 const file=path.resolve(input),manifest=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
 const result=checkManifest(manifest,{root:path.dirname(file),distributed:flag==='--distributed'});
 console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
}

/** Design Package v1: offline initialization, contract/integrity checks and catalog profile export. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const FORMAT='rea-design-package';
export const MODULES={tokens:'tokens/tokens.json',components:'components/catalog.json',layouts:'patterns/layouts.json',interactions:'patterns/interactions.json',motion:'motion/catalog.json',assets:'assets/manifest.json',evidence:'evidence/index.json'};
export const ENTRIES={readme:'README.md',spec:'DESIGN_SPEC.md',...MODULES,reference:'reference/README.md',comparison:'comparison/README.md',adaptation:'ADAPTATION_GUIDE.md'};
const COVERAGE=['verified','partial','unverified','not_applicable'];
const CLASSES=['A','B','C','D'];
const text=v=>typeof v==='string'&&v.trim().length>0;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const hashFile=file=>{const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),chunk=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,chunk,0,chunk.length,null))>0)h.update(chunk.subarray(0,n));return h.digest('hex');}finally{fs.closeSync(fd);}};
const load=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const date=v=>text(v)&&Number.isFinite(Date.parse(v));
export function packagePath(root,relative){
 if(!text(relative)||relative.includes('\\')||relative.includes(':')||path.isAbsolute(relative)||relative.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.')))throw Error('Invalid portable package path: '+relative);
 const base=path.resolve(root),full=path.resolve(base,relative);
 if(!full.startsWith(base+path.sep))throw Error('Package path escapes root');
 // Check the nearest existing ancestor too, so init cannot write through an escaping link.
 let ancestor=full;while(!fs.existsSync(ancestor)&&ancestor!==base)ancestor=path.dirname(ancestor);
 if(fs.existsSync(base)){const realBase=fs.realpathSync(base),real=fs.realpathSync(ancestor);if(real!==realBase&&!real.startsWith(realBase+path.sep))throw Error('Package symlink escapes root: '+relative);}
 return full;
}

export function validateDesignPackage(file,{forCatalog=false}={}){
 const errors=[],warnings=[],root=path.dirname(path.resolve(file)),check=(ok,msg)=>{if(!ok)errors.push(msg);};
 let p;try{p=load(file);}catch(e){return{status:'failed',errors:['Cannot read design package: '+e.message],warnings,statesModified:false};}
 if(!object(p))return{status:'failed',errors:['Package must be an object'],warnings,statesModified:false};
 check(p.format===FORMAT&&p.formatVersion===1,'Unsupported design package format/version');
 check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id||'')&&text(p.name),'Package needs slug id and name');
 check(object(p.source)&&['web','desktop','mobile'].includes(p.source.platform),'Original source platform must be web/desktop/mobile');
 check(text(p.source?.runtime)&&text(p.source?.version)&&text(p.source?.identity),'Source runtime/version/identity must be explicit (unknown is allowed in draft)');
 check(p.source?.capturedAt===null||date(p.source?.capturedAt),'Source capturedAt must be actual ISO time or null');
 check(['visual-design-and-core-interactions','custom'].includes(p.scope?.mode)&&text(p.scope?.goal),'Missing design-focused goal/scope');
 check(Array.isArray(p.scope?.excludedBusiness),'scope.excludedBusiness must be explicit');
 check(['draft','partial','ready'].includes(p.readiness?.status),'Invalid migration readiness');
 check(Array.isArray(p.readiness?.coreGaps)&&Array.isArray(p.readiness?.optionalGaps)&&Array.isArray(p.readiness?.supportedUses),'Readiness needs coreGaps, optionalGaps and supportedUses');
 check(['private','reviewed-public'].includes(p.distribution?.mode)&&Array.isArray(p.distribution?.omissions),'Distribution mode/omissions must be explicit');
 const modules={},allIds=new Map(),entryPaths=new Set();
 for(const key of Object.keys(ENTRIES)){
  const ref=p.entries?.[key];
  try{const f=packagePath(root,ref);check(!entryPaths.has(ref),'Duplicate logical entry path: '+ref);entryPaths.add(ref);check(fs.existsSync(f)&&fs.statSync(f).isFile(),'Missing entry '+key+': '+ref);
   if(MODULES[key]&&fs.existsSync(f)){const m=load(f);check(m.formatVersion===1&&m.kind===key&&Array.isArray(m.items),'Invalid '+key+' module envelope');modules[key]=m;for(const item of Array.isArray(m.items)?m.items:[]){check(object(item)&&text(item.id),'Invalid '+key+' item');if(!object(item))continue;check(!allIds.has(item.id),'Duplicate global record id: '+item.id);allIds.set(item.id,{kind:key,item});}}
  }catch(e){errors.push(key+': '+e.message);}
 }
 const records=kind=>Array.isArray(modules[kind]?.items)?modules[kind].items.filter(object):[];
 const evidence=new Map(records('evidence').map(e=>[e.id,e]));
 const refList=(ids,label,{nonempty=false}={})=>{check(Array.isArray(ids),label+' must be an array');if(!Array.isArray(ids))return[];if(nonempty)check(ids.length>0,label+' needs evidence');for(const id of ids)check(evidence.has(id),label+' refers to unknown evidence '+id);return ids.map(id=>evidence.get(id)).filter(Boolean);};
 let filesChecked=0;const checkedFiles=[];
 const verifyFile=(ref,digest,label)=>{try{const full=packagePath(root,ref);check(fs.existsSync(full)&&fs.statSync(full).isFile(),'Missing '+label+': '+ref);if(!fs.existsSync(full)||!fs.statSync(full).isFile())return;check(/^[a-f0-9]{64}$/.test(digest||''),'Missing actual SHA-256 for '+label);const actual=hashFile(full);check(actual===digest,'Bytes changed for '+label+': '+ref);filesChecked++;checkedFiles.push(ref);}catch(e){errors.push(label+': '+e.message);}};
 for(const e of evidence.values()){
  check(CLASSES.includes(e.classification)&&['current','historical'].includes(e.origin),'Evidence classification/origin: '+e.id);
  check(['source','reference','transfer'].includes(e.subject),'Evidence source/reference/transfer subject: '+e.id);
  check(['runtime','static','inference','independent'].includes(e.kind),'Evidence kind: '+e.id);
  check(e.capturedAt===null||date(e.capturedAt),'Actual evidence time or null required: '+e.id);
  check(text(e.sourceIdentity),'Evidence source identity: '+e.id);
  if(e.subject==='source')check(e.sourceIdentity===p.source?.identity||(e.classification==='B'&&e.sourceBinding?.status==='unverified'&&text(e.sourceBinding?.reason)),'Evidence belongs to a different source identity without an explicit unverified B binding: '+e.id);
  const interval=e.captureInterval,hasInterval=object(interval)&&date(interval.startedAt)&&date(interval.completedAt)&&Date.parse(interval.completedAt)>=Date.parse(interval.startedAt);
  if(interval!==undefined&&interval!==null)check(hasInterval,'Invalid capture interval: '+e.id);
  if(hasInterval&&date(e.capturedAt))check(Date.parse(e.capturedAt)>=Date.parse(interval.startedAt)&&Date.parse(e.capturedAt)<=Date.parse(interval.completedAt),'Capture time outside interval: '+e.id);
  check(['included','withheld'].includes(e.sharing),'Evidence sharing: '+e.id);
  if(e.classification==='A')check(e.subject==='source'&&e.kind==='runtime'&&(date(e.capturedAt)||hasInterval)&&e.review?.status==='reviewed'&&date(e.review?.reviewedAt),'A must be reviewed original runtime evidence: '+e.id);
  if(e.classification==='B')check(e.subject==='source'&&e.kind==='static','B must identify source static declaration: '+e.id);
  if(e.subject!=='source')check(e.classification==='D','Reference/transfer evidence remains D: '+e.id);
  if(e.sharing==='included')verifyFile(e.path,e.sha256,'evidence '+e.id);else check(text(e.reason)&&/^[a-f0-9]{64}$/.test(e.sha256||''),'Withheld evidence needs identity hash and reason: '+e.id);
 }
 for(const kind of ['tokens','components','layouts','interactions','motion'])for(const r of records(kind)){
  check(CLASSES.includes(r.classification)&&COVERAGE.includes(r.coverage),'Record classification/coverage: '+r.id);
  check(['core','optional'].includes(r.priority)&&Array.isArray(r.unknowns),'Record priority/unknowns: '+r.id);
  check(object(r.implementation)&&['specified','adaptation-required','blocked'].includes(r.implementation.status),'Record implementation status missing/invalid: '+r.id);
  const refs=refList(r.evidenceRefs,r.id+'.evidenceRefs',{nonempty:r.coverage==='verified'});
  if(r.coverage==='verified')check(['A','B'].includes(r.classification)&&refs.some(e=>e.subject==='source'&&['A','B'].includes(e.classification)&&e.sourceIdentity===p.source?.identity&&e.sourceBinding?.status!=='unverified'),'Source verified cannot borrow inferred/independent/unbound evidence: '+r.id);
  if(kind==='tokens'){check('value'in r&&text(r.unit)&&text(r.role)&&text(r.scope),'Token needs value/unit/role/scope: '+r.id);if(r.coverage==='verified')check(r.value!==null,'Verified token cannot have unknown value: '+r.id);}
  if(kind==='components'){
   check(text(r.name)&&Array.isArray(r.slots)&&Array.isArray(r.states)&&Array.isArray(r.tokenRefs),'Component structure/states/tokens: '+r.id);
   if(r.coverage==='verified')check(r.states?.length>0,'Verified component has no state observations: '+r.id);
   for(const id of Array.isArray(r.tokenRefs)?r.tokenRefs:[])check(allIds.get(id)?.kind==='tokens','Component token ref '+r.id+' -> '+id);
   for(const s of Array.isArray(r.states)?r.states:[]){if(!object(s)){check(false,'Invalid component state: '+r.id);continue;}check(text(s.id)&&text(s.appearance),'State id/appearance: '+r.id);refList(s.evidenceRefs,r.id+'.state.'+s.id,{nonempty:r.coverage==='verified'});}
  }
  if(kind==='layouts'){check(text(r.name)&&Array.isArray(r.componentRefs)&&Array.isArray(r.rules),'Layout needs composition and rules: '+r.id);for(const id of Array.isArray(r.componentRefs)?r.componentRefs:[])check(allIds.get(id)?.kind==='components','Layout component ref '+r.id+' -> '+id);}
  if(kind==='interactions'){
   check(Array.isArray(r.componentRefs)&&Array.isArray(r.transitions),'Interaction components/transitions: '+r.id);
   for(const id of Array.isArray(r.componentRefs)?r.componentRefs:[])check(allIds.get(id)?.kind==='components','Interaction component ref '+r.id+' -> '+id);
   if(r.coverage==='verified')check(r.transitions?.length>0,'Verified interaction has no transitions: '+r.id);
   for(const t of Array.isArray(r.transitions)?r.transitions:[]){if(!object(t)){check(false,'Invalid transition: '+r.id);continue;}check(text(t.from)&&text(t.event)&&text(t.to)&&text(t.result),'Transition needs from/event/to/result: '+r.id);refList(t.evidenceRefs,r.id+'.transition',{nonempty:r.coverage==='verified'});}
  }
  if(kind==='motion'){
   check(text(r.trigger)&&Array.isArray(r.properties)&&object(r.duration)&&object(r.easing)&&Array.isArray(r.interruption),'Motion needs trigger/properties/duration/easing/interruption: '+r.id);
   check(object(r.duration)&&'value'in r.duration&&text(r.duration.unit)&&['observed','declared','chosen','unknown'].includes(r.duration.basis),'Motion duration needs value/unit/basis: '+r.id);
   check(object(r.easing)&&'value'in r.easing&&['observed','declared','chosen','unknown'].includes(r.easing.basis),'Motion easing needs explicit value/basis: '+r.id);
   if(r.duration?.basis==='unknown')check(r.duration.value===null,'Unknown duration must not invent a value: '+r.id);
   if(r.easing?.basis==='unknown')check(r.easing.value===null,'Unknown easing must not invent a value: '+r.id);
   if(r.classification==='A'&&r.duration?.basis==='observed')check(refs.some(e=>e.classification==='A'&&e.kind==='runtime'),'Measured motion needs runtime A: '+r.id);
   if(r.duration?.basis==='declared')check(refs.some(e=>e.classification==='B'),'Declared motion needs source B: '+r.id);
  }
 }
 for(const a of records('assets')){check(text(a.type)&&Array.isArray(a.usage)&&Array.isArray(a.componentRefs),'Asset type/usage/component refs: '+a.id);for(const id of Array.isArray(a.componentRefs)?a.componentRefs:[])check(allIds.get(id)?.kind==='components','Asset component ref '+a.id+' -> '+id);check(['included','withheld','unavailable'].includes(a.sharing),'Asset sharing status: '+a.id);if(a.sharing==='included')verifyFile(a.path,a.sha256,'asset '+a.id);else check(text(a.reason),'Omitted asset needs reason: '+a.id);}
 for(const key of ['reference','crossDomain']){const v=p.validation?.[key];check(object(v)&&COVERAGE.includes(v.status),'Validation status missing: '+key);const refs=refList(v?.evidenceRefs,'validation.'+key,{nonempty:v?.status==='verified'});if(v?.status==='verified'){if(key==='reference')check(refs.some(e=>e.subject==='source'&&e.classification==='A')&&refs.some(e=>e.subject==='reference'&&e.classification==='D'),'Reference comparison needs original A and reference D evidence');else check(refs.some(e=>e.subject==='transfer'&&e.classification==='D'),'Cross-domain validation needs transfer D evidence');}}
 if(p.readiness?.status==='ready'){
  check(p.readiness.coreGaps?.length===0,'Ready package retains core design gaps');
  for(const kind of ['tokens','components','layouts'])check(records(kind).some(r=>r.priority==='core'),'Ready package has no core '+kind);
  check(p.readiness.supportedUses?.length>0,'Ready package needs specific supported uses');
  for(const {item,kind}of allIds.values())if(['tokens','components','layouts','interactions','motion'].includes(kind)&&item.priority==='core'){
   check(['specified','adaptation-required'].includes(item.implementation?.status),'Ready package has unspecified/blocked core '+item.id);
   if(item.coverage!=='verified'||item.implementation?.status==='adaptation-required')check(item.implementation?.classification==='D'&&text(item.implementation?.decision),'Core uncertainty needs explicit D implementation/adaptation decision: '+item.id);
  }
  for(const key of ['reference','crossDomain'])check(p.validation?.[key]?.status==='verified','Ready package lacks verified '+key+' comparison');
  check(!['unknown','not-recorded'].includes(p.source?.identity)&&!['unknown','not-recorded'].includes(p.source?.version),'Ready source identity/version unresolved');
 }
 const researchRefs=refList(p.source?.researchEvidenceRefs,'source.researchEvidenceRefs');
 if(forCatalog){check(researchRefs.length>0&&researchRefs.some(e=>e.subject==='source'&&['A','B'].includes(e.classification)&&e.provider==='REA'&&e.sharing==='included'&&e.sourceIdentity===p.source?.identity&&e.sourceBinding?.status!=='unverified'),'Catalog package needs included traceable REA source research');check(text(p.source?.researchMethod)&&p.source.researchMethod!=='not-recorded','Catalog package needs actual research method');}
 if(!records('components').length)warnings.push('No component observations; initialized/partial format is not ready design research.');
 if(p.readiness?.status!=='ready')warnings.push('Package readiness is '+p.readiness?.status+'; integrity success does not complete the research.');
 return{status:errors.length?'failed':'passed-integrity-only',formatVersion:1,id:p.id,platform:p.source?.platform,readiness:p.readiness?.status,filesChecked,counts:Object.fromEntries(Object.keys(MODULES).map(k=>[k,records(k).length])),forCatalog,statesModified:false,originalAppExecuted:false,errors,warnings,limitations:['Checks declared contract, paths, references, source/D separation and actual file hashes. Does not authenticate author claims, perform pixel review or prove runtime fidelity/authorization.'],checkedFiles};
}

export function initDesignPackage(output,{id,name=id,platform,runtime='unknown',version='unknown',identity='unknown'}={}){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id||'')||!['web','desktop','mobile'].includes(platform))throw Error('init needs --id slug and --platform web|desktop|mobile');
 const root=path.resolve(output);if(fs.existsSync(root)&&!fs.statSync(root).isDirectory())throw Error('Output is not a directory');
 for(const ref of ['design-package.json',...Object.values(ENTRIES)])if(fs.existsSync(packagePath(root,ref)))throw Error('Refusing to overwrite existing entry '+ref);
 fs.mkdirSync(root,{recursive:true});
 const p={format:FORMAT,formatVersion:1,id,name,source:{platform,runtime,version,identity,capturedAt:null,researchMethod:'not-recorded',researchEvidenceRefs:[]},scope:{mode:'visual-design-and-core-interactions',goal:'Extract reusable visual elements, components/layouts, key motion and core UI patterns for another business.',excludedBusiness:['Original backend/algorithms and full business-function cloning unless separately requested']},readiness:{status:'draft',supportedUses:[],coreGaps:['Core visual/interaction types not yet researched'],optionalGaps:[]},entries:{...ENTRIES},validation:{reference:{status:'unverified',evidenceRefs:[]},crossDomain:{status:'unverified',evidenceRefs:[]}},distribution:{mode:'private',omissions:[]}};
 fs.writeFileSync(path.join(root,'design-package.json'),JSON.stringify(p,null,2)+'\n');
 for(const[k,ref]of Object.entries(ENTRIES)){const full=packagePath(root,ref);fs.mkdirSync(path.dirname(full),{recursive:true});if(MODULES[k])fs.writeFileSync(full,JSON.stringify({formatVersion:1,kind:k,items:[]},null,2)+'\n');else{let text;
  if(k==='spec')text=`# ${name} — DESIGN SPEC\n\n当前为draft；下列章节尚无研究结论。空集合与创建时间不代表实测。\n\n`+['来源与范围','设计原则','视觉系统与排版','组件地图与状态','布局组合与响应式','通用交互与引导','关键动效','资产及使用映射','参考与原版对照','迁移适配','覆盖与核心缺口'].map(h=>'## '+h+'\n\n未研究；从design-package.json和对应模块记录证据后更新。\n').join('\n');
  else if(k==='readme')text=`# ${name} 设计包\n\n入口：[design-package.json](design-package.json) → [DESIGN_SPEC.md](DESIGN_SPEC.md) → [ADAPTATION_GUIDE.md](ADAPTATION_GUIDE.md)。\n\n当前draft；来源运行、参考和跨业务验证均未执行。使用前读取readiness与核心缺口。原平台：${platform}，运行栈：${runtime}。\n`;
  else if(k==='adaptation')text='# 迁移指南\n\n读取设计入口和覆盖，再审查目标功能、已有UI、品牌与技术栈。建立来源规则/资产到目标组件的映射。当前draft尚无可用规则；来源未证实的行为由目标作明确D选择。\n';
  else text='# '+(k==='reference'?'组件参考':'原版对照')+'\n\n尚未制作或验证。记录实际技术栈、运行命令、状态/版本和证据后更新；不能把此入口存在当运行通过。\n';
  fs.writeFileSync(full,text);}}
 return path.join(root,'design-package.json');
}

export function catalogProfile(file,{root:studyRoot}={}){
 const result=validateDesignPackage(file,{forCatalog:true});if(result.errors.length)throw Error(result.errors.join('\n'));
 const p=load(file);if(studyRoot!=='platforms/'+p.source.platform+'/'+p.id)throw Error('Catalog root must match platforms/<source.platform>/<id>');
 const module=k=>load(packagePath(path.dirname(path.resolve(file)),p.entries[k])).items;
 const colors=module('tokens').filter(t=>/^#[a-fA-F0-9]{6}$/.test(t.value||'')).slice(0,3).map(t=>t.value);
 return{id:p.id,name:p.name,subtitle:'可迁移视觉设计与核心交互',platform:p.source.platform,kind:'research',root:studyRoot,visibility:'public',sourceVersion:p.source.version,provenance:{kind:'rea-study',target:p.source.identity,method:p.source.researchMethod,researchEntry:p.entries.readme},summary:p.scope.goal,tags:['Design Package v1'],stack:[p.source.runtime],readiness:p.readiness.status,coverage:'See design-package.json and per-record source coverage; catalog import creates no new runtime evidence.',features:p.readiness.supportedUses,limits:[...p.readiness.coreGaps,...p.readiness.optionalGaps,'Original-platform/version boundaries remain; integrity check is not functional acceptance.'],palette:colors.length?colors:['#e5e7eb','#111827'],cover:'generic',paletteClassification:'D: catalog presentation; implementation uses scoped source tokens',designPackage:path.basename(file),artifacts:[{label:'研究入口',path:p.entries.readme,role:'readme'},{label:'设计规范',path:p.entries.spec,role:'spec'},{label:'Design Package v1',path:path.basename(file),role:'design-package'},{label:'迁移指南',path:p.entries.adaptation,role:'adoption'}],run:{cwd:studyRoot,command:'Read '+p.entries.spec+'; reference commands are documented in '+p.entries.reference,requires:'See source-specific readiness and platform requirements',verifiedHere:false}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const[command,input,...rest]=process.argv.slice(2),args=new Map();for(let i=0;i<rest.length;i+=2){if(!rest[i]?.startsWith('--')||!rest[i+1])throw Error('Expected --key value');if(args.has(rest[i]))throw Error('Duplicate option');args.set(rest[i],rest[i+1]);}
 if(command==='init'){if(!input)throw Error('init OUTPUT --id slug --platform web|desktop|mobile');const file=initDesignPackage(input,{id:args.get('--id'),name:args.get('--name'),platform:args.get('--platform'),runtime:args.get('--runtime'),version:args.get('--version'),identity:args.get('--identity')});console.log(JSON.stringify({created:file,readiness:'draft',originalAppExecuted:false}));}
 else if(command==='validate'){if(!input)throw Error('validate PACKAGE.json');const r=validateDesignPackage(path.resolve(input));console.log(JSON.stringify(r,null,2));if(r.errors.length)process.exitCode=1;}
 else if(command==='profile'){const p=catalogProfile(path.resolve(input),{root:args.get('--root')}),output=args.get('--output');if(output){const f=path.resolve(output);if(fs.existsSync(f))throw Error('Refusing to overwrite profile output');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n');console.log(JSON.stringify({created:f}));}else console.log(JSON.stringify(p,null,2));}
 else throw Error('Use init, validate or profile. No command contacts network/Git/devices or changes research status.');
}

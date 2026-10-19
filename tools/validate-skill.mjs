import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const kit=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.resolve(process.argv[2]??path.join(kit,'skill/rea-design-transfer'));
const localRequire=createRequire(import.meta.url);
const candidates=[()=>localRequire('yaml'),()=>createRequire(path.join(process.env.APPDATA??path.join(os.homedir(),'AppData/Roaming'),'npm/node_modules/rea-agents/package.json'))('yaml')];
let YAML;for(const candidate of candidates){try{YAML=candidate();break}catch{}}
if(!YAML)throw Error('YAML parser unavailable. Use skill-creator quick_validate.py with Python+PyYAML, or provide local yaml dependency. No dependencies were installed.');
const errors=[];const raw=fs.readFileSync(path.join(target,'SKILL.md'),'utf8');const match=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
const parse=text=>{const doc=YAML.parseDocument(text,{uniqueKeys:true});if(doc.errors.length)throw Error(doc.errors.map(x=>x.message).join('; '));return doc.toJSON()};
if(!match)errors.push('Missing YAML frontmatter');
let meta={};try{meta=match?parse(match[1]):{}}catch(e){errors.push(e.message)}
const allowed=new Set(['name','description','license','allowed-tools','metadata']);
for(const key of Object.keys(meta))if(!allowed.has(key))errors.push('Unsupported frontmatter key: '+key);
if(typeof meta.name!=='string'||meta.name.length>64||!(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(meta.name))errors.push('Invalid skill name');
if(meta.name!==path.basename(target))errors.push('Folder/name mismatch');
if(typeof meta.description!=='string'||!meta.description.trim()||meta.description.length>1024||/[<>]/.test(meta.description))errors.push('Invalid description');
if(/\[TODO:|\bTODO\b|\bFIXME\b/.test(raw))errors.push('Unfinished scaffold marker');
const files=['SKILL.md','agents/openai.yaml','references/research.md','references/deliverables.md','references/transfer.md','references/workflow.md','references/design-package.md','scripts/design-package.mjs'];
for(const f of files)if(!fs.existsSync(path.join(target,f)))errors.push('Missing '+f);
function markdown(dir){const found=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('_')||e.name.startsWith('.')||e.name==='node_modules')continue;const f=path.join(dir,e.name);if(e.isDirectory())found.push(...markdown(f));else if(e.name.endsWith('.md'))found.push(f);}return found;}
for(const abs of markdown(target)){const text=fs.readFileSync(abs,'utf8');for(const [,href]of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){if(/^(https?:|#)/.test(href))continue;if(!fs.existsSync(path.resolve(path.dirname(abs),href.split('#')[0])))errors.push('Broken reference '+path.relative(target,abs)+' -> '+href)}}
let ui;try{ui=parse(fs.readFileSync(path.join(target,'agents/openai.yaml'),'utf8'));const short=ui.interface?.short_description;if(typeof short!=='string'||short.length<25||short.length>64)errors.push('UI short description must be 25..64 characters');if(!ui.interface?.default_prompt?.includes('$'+meta.name))errors.push('Default prompt missing explicit skill invocation');if(ui.policy?.allow_implicit_invocation===false)errors.push('Implicit invocation unexpectedly disabled')}catch(e){errors.push(e.message)}
const result={at:new Date().toISOString(),target,status:errors.length?'failed':'passed',method:'Node.js + YAML parser; structural checks for this skill, local references and UI metadata',officialPythonValidator:'Not invoked by this Node.js validator. See docs/validation.md for the original local validation scope.',limitations:['Format and reference validity do not prove runtime research quality. See docs/validation.md for the bounded behavior evaluation.'],errors};
fs.mkdirSync(path.join(kit,'_validation'),{recursive:true});fs.writeFileSync(path.join(kit,'_validation',target===path.join(kit,'skill/rea-design-transfer')?'format-source.json':'format-installed.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;

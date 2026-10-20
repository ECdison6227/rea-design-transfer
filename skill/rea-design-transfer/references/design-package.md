# Design Package v1

这是统一交付协议，覆盖原版web、desktop、mobile；具体运行栈与目标实现栈分开。消费者从一个固定文件进入，再读取需要的模块。它不要求所有产品使用同一种框架，也不把格式检查当原版还原验收。

## 初始化与读取

```sh
node /path/to/rea-design-transfer/scripts/design-package.mjs init ./my-product --id my-product --name "My Product" --platform mobile --runtime android --version "实际版本" --identity "实际包名/制品哈希或URL身份"
node /path/to/rea-design-transfer/scripts/design-package.mjs validate ./my-product/design-package.json
```

init只写入指定目录，遇到任何已有入口文件即拒绝覆盖；不访问网络、不控制原App。创建的draft没有采集时间、证据或运行通过，空集合始终不等于研究完成。相对路径使用正斜线，不能越出包根、使用绝对路径或指向逃逸的符号链接。

固定入口和默认位置如下；entry值可映射到其他位置，但模块应符合本协议。旧资料以适配/新增模块接入，原始记录保持不变。

| entries键 | 默认位置 | 内容 |
| --- | --- | --- |
| readme | README.md | 身份、阅读顺序、条件、运行与继续入口 |
| spec | DESIGN_SPEC.md | 人类可读的完整设计规范 |
| tokens | tokens/tokens.json | 视觉/排版/几何角色与有来源的值 |
| components | components/catalog.json | 组件结构、状态、token映射和适配 |
| layouts | patterns/layouts.json | 通用页面/局部布局组合 |
| interactions | patterns/interactions.json | 返回、编辑、反馈等可见状态转移 |
| motion | motion/catalog.json | 触发、属性、时序、曲线和中断 |
| assets | assets/manifest.json | 原件/派生件的用途、变体、SHA及复用入口 |
| evidence | evidence/index.json | A/B/C/D、原身份/时间、相对原件、SHA和分享边界 |
| reference | reference/README.md | 组件参考的实际栈、启动和状态；未制作时明确说明 |
| comparison | comparison/README.md | 原版/参考配对条件与具体差异 |
| adaptation | ADAPTATION_GUIDE.md | 保留/替换/适配映射及跨领域用法 |

## 根文件

根对象的format固定为`rea-design-package`，formatVersion为1，id为小写连字符slug，name为产品名。

- `source`：platform为web/desktop/mobile，runtime、version、identity明确记录；capturedAt是实际采集ISO时间或null；researchMethod是实际REA方法说明，researchEvidenceRefs引用证据ID。未知可写unknown/not-recorded但不能冒充已完成。
  认证影响核心设计时，在source附authentication说明是否需要登录、当前状态、验证时间/证据和覆盖条件，不存账号、凭据或cookie。用户登录完成后补相应运行证据；该字段本身不证明登录后设计已研究。
- `scope`：mode默认visual-design-and-core-interactions，goal为本次目标，excludedBusiness列明不属于设计研究的原业务范围。
- `readiness`：status为draft/partial/ready；supportedUses说明能如何使用，coreGaps是影响核心设计的缺口，optionalGaps保存业务未知/深入归因等可选边界。
- `entries`：上表各逻辑入口的包根相对路径。
- `validation.reference`、`validation.crossDomain`：各有status和evidenceRefs。status使用verified/partial/unverified/not_applicable；reference的verified须有原版A及参考D配对，crossDomain的verified须有transfer D证据。
- `distribution`：mode为private或reviewed-public，默认private；omissions列出未交付的私有/受限原件及原因。此字段不能代替实际Git提交/归档审查。

readiness与原版coverage分开。ready不能有未解决coreGaps，需要具体supportedUses、核心tokens/组件/布局以及已经核对的参考配对和跨业务切片。核心记录的实施状态须为specified或adaptation-required；原版仍未知时必须写明D替代决策和影响，不能因此把coverage改成verified。关键缺口仍无法实施时保持partial。

## 模块通用约定

每个JSON模块为`{formatVersion:1, kind:"模块键", items:[]}`。所有记录ID在同一个包内唯一，引用使用ID，不依赖原软件混淆名称。

tokens、components、layouts、interactions、motion的每项都有：

| 字段 | 含义 |
| --- | --- |
| id | 稳定记录ID |
| classification | A/B/C/D；整理后的接口/别名另标D |
| coverage | verified/partial/unverified/not_applicable，描述原版证据覆盖 |
| priority | core或optional，按迁移影响判断 |
| evidenceRefs | evidence模块中的ID数组 |
| unknowns | 未证实的参数/状态/条件，不用猜测补齐 |
| implementation | status为specified/adaptation-required/blocked；有原版不确定性时用classification:D与decision说明实施选择 |

verified需要源A/B，不可借C/D实现证明原版。某状态已观察不表示整组件所有状态已测；覆盖说明和unknowns保留范围。

各模块至少额外给出：

- **tokens**：role、value、unit、scope。value未知为null，verified值不能为null。原单位不静默换成目标单位；语义别名和换算/替代方案另列D。
- **components**：name、slots数组、tokenRefs、states；每个state有id、appearance和evidenceRefs。继续给几何、插槽输入、事件、适用平台/缩放、长文本与使用指导；接口由迁移层定义，不叫原App API。
- **layouts**：name、componentRefs、rules；记录层级、对齐、内容宽度、密度、插槽和响应式。
- **interactions**：componentRefs、transitions；每条有from/event/to/result/evidenceRefs，补条件、副作用、关闭/返回和保留/重置。未观察到的请求取消/后端语义保留未知。
- **motion**：trigger、properties、duration、easing、interruption；duration有value/unit/basis，easing有value/basis，basis为observed/declared/chosen/unknown。unknown值为null；运行A、素材B和目标D分别说明，继续记录delay、exit、重入、reduced motion及条件。

这些是最低互操作字段，不是研究内容上限。DESIGN_SPEC.md与模块可补充形状、字体行高、触控、焦点等对该来源确有用的信息。

## 资产与证据

assets项有id、type、usage数组、componentRefs、sharing。included原件或派生件给path和实际sha256；withheld/unavailable写reason，能提供时保留原哈希、来源路径、变体、许可/加工信息和替代方案。文件名本身不证明运行使用。

evidence项有id、classification、origin(current/historical)、subject(source/reference/transfer)、kind(runtime/static/inference/independent)、sourceIdentity、capturedAt、sharing。source身份与根source.identity一致；A必须是原版runtime且有真实时间和review.status=reviewed/reviewedAt；B是原版static；reference/transfer保持D。

只有采集区间时可令capturedAt=null，给captureInterval.startedAt/completedAt及实际方法，不伪造精确快门时刻。有单点时间和区间时，单点须在区间内。静态文件可capturedAt=null；缺少与原制品绑定的B片段可用独立sourceIdentity，并给sourceBinding:{status:unverified,reason:实际原因}和artifactIdentity。它可以保留并指导候选分析，但不能借此证明当前版本的verified覆盖或REA入库资格。

included证据给path/sha256并校验真实字节；withheld保留sha256/reason，不伪造本地文件或自动开放原件。静态B可补selector/函数/行号，原始REA输出保留provider:REA及真实Evidence ID（如果工具提供）。检查器不认证作者声明和像素复核，无法替代实际研究。

## 接入rea-ui-library

把包放进总库的`platforms/<source.platform>/<id>/`，读取总库AGENTS/README，再导出待登记profile：

```sh
node /path/to/skill/scripts/design-package.mjs profile platforms/mobile/my-product/design-package.json --root platforms/mobile/my-product --output .runtime/my-product.profile.json
npm run study:add -- --profile .runtime/my-product.profile.json
npm test
npm run build
npm run verify
```

profile导出要求有包含实际文件与SHA的REA源研究证据、真实researchMethod，防止把空模板当研究加入。工具检查声明的可追溯性，不证明该REA调用真实发生。现有研究没有design-package.json时继续按旧profile读取，不自动伪造新格式或更高readiness。

新增/更新研究与研究文件锁必须经过显式审查；普通build/verify不重新接受字节变化。只有已获授权才提交/推送GitHub，保持既有私有性。库中“复制迁移任务”应携带来源仓库、ref/commit、目录、设计入口和原有边界。

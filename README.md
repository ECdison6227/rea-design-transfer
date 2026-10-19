# REA 设计提取与迁移

技能名：**`rea-design-transfer`**。从喜欢的手机、桌面或网页产品提取视觉设计与通用交互，交付标准设计包；在自己的产品完成功能和普通UI后，选择其中一份规范，对齐其设计语言并保留自己的业务。

本仓库是技能与格式工具包，地址为兼容已有链接保留`ECdison6227/rea-style-library`。研究资料总库独立存放在[rea-ui-library](https://github.com/ECdison6227/rea-ui-library)，沿用该库的平台分类、权限和入库约定。技能包不包含任何产品已研究成功的保证。

## 两阶段使用

**先研究并入库**：提取排版、尺寸/间距、配色/表面、形状/图标、组件及状态、布局组合、关键动效、反馈与引导。原业务作为样本；独特会员卡片也应提取，实际扣费/同步协议/播放内核等不成为默认验收。按设计类型补齐核心缺口，同类样本充分就停止扩展。

**后应用到自己的项目**：用户先做功能与普通UI，再提供项目源码、目标平台和选定规范。Agent读取设计入口、保留业务/数据/品牌，沿用目标技术栈映射tokens与组件，再运行并对照代表页面/状态。无需为已有充分证据重跑全包分析。

## 安装与调用

把这段交给支持技能安装的Agent：

```text
请从 https://github.com/ECdison6227/rea-style-library 安装 skill/rea-design-transfer。
这是旧rea-style-library技能的新名称；若本机存在旧版，先比较并备份到技能发现目录外，再替换，避免两份同时自动触发。
研究真实制品时检查reverse-engineer-anything技能和实际REA工具；已有环境不要重装。
```

使用新调用名：

```text
$rea-design-transfer
提取设计模式。
来源：[APK/客户端/网站/历史资料]
输出：[独立目录或总库platforms/<platform>/<id>]
我要保存整套视觉设计与通用交互，以后用于完全不同业务。
请交付Design Package v1，围绕核心设计类型研究，不默认穷举原软件业务功能。
```

```text
$rea-design-transfer
应用规范模式。
规范库：[GitHub仓库/ref/来源目录]
我的项目：[已有功能与普通UI的源码路径]
请读取design-package.json与DESIGN_SPEC.md，保留我的业务、数据、品牌和技术栈，
把视觉元素、组件组合和核心交互对齐所选规范，运行并报告实际差异。
```

仅选型、整理和入库不自动启动原产品或制作新参考。自动技能选择保持启用；跨平台能力以实际工具和可运行目标为准。

## 标准交付

固定消费者入口是`design-package.json`和`DESIGN_SPEC.md`，后续读取tokens、components、layouts、interactions、motion、assets与evidence模块，以及reference/comparison/adaptation入口。逻辑槽位和模块结构固定，具体路径可以映射。

[格式协议](skill/rea-design-transfer/references/design-package.md) · [交付验收](skill/rea-design-transfer/references/deliverables.md) · [迁移流程](skill/rea-design-transfer/references/transfer.md)

```sh
node skill/rea-design-transfer/scripts/design-package.mjs init ./study --id my-product --name "My Product" --platform web --runtime browser --version "实际版本" --identity "实际URL或制品身份"
node skill/rea-design-transfer/scripts/design-package.mjs validate ./study/design-package.json
```

初始化生成draft，空模板不被当成研究或ready。检查器核对格式、相对路径、引用、A/B/C/D边界与真实SHA，不控制设备、不修改研究状态，也不证明像素/动效已经正确恢复。

核心原版参数尚未知时保留coverage，目标替代明确为D；有可实施且经过对照的替代可说明迁移就绪范围。无法解决的核心设计缺口仍为partial。原版全部功能通过率不作为设计库的验收标准；用户另要求的功能清单独立处理。

现有研究继续使用旧入口；新增适配包逐步映射，不重写原图和历史。总库可以用通用工具导出profile，再按其`study:add`与文件锁流程登记。普通UI工程、空模板和迁移样例不自动成为新的REA来源。

## 可直接复制的任务

[通用研究Prompt](通用研究Prompt.md) · [已有产品改造Prompt](改造软件Prompt.md)

研究真实制品时委托已安装的[reverse-engineer-anything / REA](https://github.com/morluto/rea)，使用真实可用工具并保存输出；技能不会自动连接/安装引擎。只应用已有规范通常不需要新REA分析。

原件保留与公开分发分别决定。保持研究仓库既有私有性，发布前检查实际Git差异/归档成员，不自动上传原包、账号profile、私人画面或受限资产。用户已经明确授权推送时，完成检查后执行，不重复索要相同许可。

## 开发检查

```sh
npm ci --ignore-scripts
npm run validate
npm test
```

运行脚本本身无第三方运行依赖；开发格式校验使用锁定的YAML解析器。[验证说明](docs/validation.md)区分结构检查、合成契约测试和独立情境试用，均不冒充所有平台原版运行成功。

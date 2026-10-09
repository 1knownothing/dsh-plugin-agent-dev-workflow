# dsh-agent-dev-workflow

> 通用 Agent 开发流程（8 阶段流水线 + 门禁 + 独立验证）作为一个**可开关的 DSH 插件**。
> 启用后**对所有会话、所有项目生效**——不是只对某一个对话生效。

零依赖、零 `@deepseek-ai/*` 导入，因此**不绑定 DSH 版本**，DSH 升级不会把它弄坏。

---

## 它做什么

把 `SKILL.md` 里的开发流程通过 DSH 的 skill registry 注册进去，于是任何一个对话窗口都能用它：

- **S1 需求澄清** → 先把需求翻译成**可判真假**的验收标准
- **S2 现状勘查** → 结论必须带 `文件:行号`，不许猜
- **S3 设计决策** → 至少两个方案 + 明确取舍
- **S4 任务切片** → 写入范围互斥，避免并行冲突
- **S5 实现** → 最小改动 + 真实证据
- **S6 独立验证** → **写的人不许自己验**（唯一有强实证支撑的机制）
- **S7 审查验收** → 三态裁决 `verified` / `partial` / `failed`
- **S8 固化教训** → 人类否决变成**可重放校验**

---

## 作用域：全局还是单对话？

**全局。** 插件的开关改的是 **profile** 的配置（`dsh.profile.bundles` + `cordis.patch.yml`），而 profile 是这个 DSH 安装的共享配置：

| | 作用范围 |
|---|---|
| 在插件页**打开**这个组合包 | 该 profile 下的**所有会话、所有项目**都能用 |
| 在插件页**关闭**它 | 该 profile 下全部消失 |
| 换一个 profile / 另一台机器 | **不共享**，要重新安装 |

所以"打开即全局"是对的，但"全局"的范围是**这台机器上的这个 profile**，不是跨设备。

---

## 安装

### 路径一：插件页（推荐，带回滚）

1. 打开侧边栏 **插件** 页
2. **添加插件** → 粘贴本目录的绝对路径，例如：
   ```
   D:\1Anewproject\dev\dsh-plugin-agent-dev-workflow
   ```
3. 安装完成后点 **立即启用**
4. 列表里会出现 **Agent Dev Workflow**，带开关

插件管理器会先 `inspect`（读 `package.json`、确认它声明了 `dsh.bundle.patch`）再执行 pnpm，安装失败会自动恢复 `package.json` 与 `pnpm-lock.yaml`。

### 路径二：命令行

```powershell
dsh plugin add "D:\1Anewproject\dev\dsh-plugin-agent-dev-workflow" --profile desktop
```

### 关掉它

插件页里关掉开关即可（保留依赖）；要彻底清除用卸载。

---

## 目录结构

```text
dsh-plugin-agent-dev-workflow/
├─ package.json          # name + dsh.bundle.patch —— 声明"我是组合包"的关键
├─ cordis.patch.yml      # insert: 一行插件条目，name 必须等于本包 package.json 的 name
├─ lib/index.js          # 宿主半侧：注册 skill provider（零 @deepseek-ai 导入）
├─ assets/               # ← 就是 skill 目录本身（同 @deepseek-ai/dsh-skill-office 的约定）
│  ├─ SKILL.md           #    主协议
│  ├─ references/        #    5 份展开手册
│  ├─ assets/            #    产物模板 + 示例
│  └─ scripts/           #    install.ps1
├─ verify.mjs            # 离线自测：用假 ctx 跑 apply()，不需要装 DSH
├─ icon.svg
└─ LICENSE
```

**关键机制**：`lib/index.js` 用 `ctx.skills.registerProvider()` 注册一个只返回 1 个 skill 的
provider。rank 用 `BUNDLED_SKILL_RANK = 600`（内联常量，见 `@deepseek-ai/dsh-skill`），
所以同名 skill 里 **project / user 级的仍然优先**——不会硬压掉你的自定义版本。

---

## 自测

不需要安装、不需要 DSH、不需要联网：

```powershell
cd D:\1Anewproject\dev\dsh-plugin-agent-dev-workflow
node verify.mjs             # 功能自测：34 项
node check-manifest.mjs     # 清单检查：兼容性门槛 + 仓库占位符是否还在
```

`verify.mjs` 覆盖：模块契约、provider 注册、summary 字段、rank、description 的 500 字符上限、
`get()` 返回的正文（不含 frontmatter）、所有被引用资源存在、以及**资产缺失时必须抛错**。

---

## 发布到 npm + DSH Plugin Hub

发布到社区 Hub（`dshpluginhub.ai`）需要四步，**其中两步只能由你执行**（需要你的 npm 账号和 GitHub 仓库）。

### 第 0 步：把仓库地址换成你自己的

`package.json` 里的 `repository` / `homepage` / `dsh.hub.homepage` 现在还是占位符
（`REPLACE-WITH-YOUR-GITHUB-USERNAME`）。Hub 的校验会**拒绝没有公开 GitHub 仓库的包**。

**注意**：包名 `dsh-agent-dev-workflow` 在 npm 上可能已被占用，发布前用
`npm view dsh-agent-dev-workflow version` 确认；被占用就改 `package.json` 的 `name`
（同时改 `cordis.patch.yml` 里 `insert[].name` 保持一致）。

### 第 1 步：你来做 —— 登录 npm

```powershell
npm adduser          # 或 npm login
npm whoami           # 应打印你的用户名
```

### 第 2 步：本地校验（已通过，可复跑）

```powershell
npx --yes @dsh-plugin-hub/cli validate .
```

期望输出：`Valid plugin: dsh-agent-dev-workflow@1.0.0`（会有一个"建议加截图"的警告，不影响发布）。

### 第 3 步：你来做 —— 发布

```powershell
npm pack --dry-run   # 先看会打包什么（应为 17 个文件、约 36 kB）
npm publish --access public
```

### 第 4 步：收录到 Hub

发布后 **Hub 每小时自动同步收录**。想更快可在 Hub 的插件页手动提交包名。
之后 claim（绑定 GitHub App）就能在 Dashboard 里编辑展示信息、截图、分类。

---

## 与 skill 版本的关系

同一套流程还有一份**纯 skill** 形态（`..\dsh-skills\`），装在 `~/.dsh/skills/`。两者的区别：

| | 插件（本目录） | 纯 skill |
|---|---|---|
| 可见性 | 插件页有开关，可随时停用 | 常驻，靠 `SKILL.md` frontmatter 触发 |
| 版本耦合 | 零（无 `@deepseek-ai/*` 导入） | 零（纯 markdown） |
| 分发 | 包名 / 路径 / git 仓库 | 拷目录 |
| 适合 | 想"有个开关"、想按包管理 | 想彻底零配置 |

两者**可以共存**：插件启用时用插件里的副本，停用后 `~/.dsh/skills/` 那份仍然生效。

改了 `assets/` 后说一句"重装"，我用 `dsh plugin` 或插件页重装即可。

---

## 已知限制

- 插件安装后**不支持自动更新**：升级要先卸载再装新版。
- 替换已有包后需要**重启进程**才会加载新的 JavaScript 模块版本。
- `lib/index.js` 的 `apply()` 会在加载时**同步读取** `assets/SKILL.md`：资产缺失或
  frontmatter 不合法就**直接抛错**，这是故意的——避免"装上了但静默消失"。

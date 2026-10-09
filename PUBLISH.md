# PUBLISH.md — 把这个插件发到 npm 和 DSH Plugin Hub

> 状态：**包已经做到"一条命令就能发"**。官方 Hub 校验已通过：
> `Valid plugin: dsh-agent-dev-workflow@1.0.0`
>
> 剩下的两步需要**你的账号**，我无法代做：GitHub 仓库、npm 登录。

---

## 为什么必须你来

| 需要的东西 | 现在状态 | 谁能做 |
|---|---|---|
| 公开的 GitHub 仓库 | ❌ 没有 | 你（Hub 校验强制要求） |
| npm 登录 | ❌ `ENEEDAUTH` | 你（`npm adduser`） |
| 把包推上去 | ❌ 无凭据 | 你（`npm publish`） |

**没有绕过办法**：Hub 的官方校验第一条就是 `Plugin package.json requires a public GitHub repository URL`，
而 npm 发布必然要账号。我试过——`gh` 也没装，所以我连替你建仓库都做不到。

---

## 好消息：先从插件页装本地版，不用发布

**你现在就能用上这个插件，不需要发布。** 插件页的「添加插件」支持**本地绝对路径**：

1. 侧边栏 → **插件**
2. **添加插件** → 粘贴：
   ```
   D:\1Anewproject\dev\dsh-plugin-agent-dev-workflow
   ```
3. 装完点 **立即启用**
4. 列表里出现 **Agent Dev Workflow**，带开关

这样你立刻得到一个**可开关的条目**。发布到 Hub 的意义只是"让别人也能装"。

---

## 发布四步（逐条复制）

### 第 0 步：替换仓库占位符

`package.json` 里有三处 `REPLACE-WITH-YOUR-GITHUB-USERNAME`，换成你的 GitHub 用户名：

```
repository.url                              (约第 15 行)
homepage                                    (约第 19 行)
dsh.hub.homepage                            (dsh.hub 块内)
```

改完自检（会告诉你占位符还在不在）：

```powershell
cd D:\1Anewproject\dev\dsh-plugin-agent-dev-workflow
node check-manifest.mjs
```

### 第 1 步：你来做 —— 建公开仓库

在 GitHub 上建一个**公开**仓库 `dsh-agent-dev-workflow`，然后：

```powershell
cd D:\1Anewproject\dev\dsh-plugin-agent-dev-workflow
git remote add origin https://github.com/<你的用户名>/dsh-agent-dev-workflow.git
git push -u origin main
```

### 第 2 步：你来做 —— 登录 npm

```powershell
npm adduser          # 或 npm login
npm whoami           # 应打印你的用户名
```

> 先确认包名没被占：`npm view dsh-agent-dev-workflow version`
> 如果被占，改 `package.json` 的 `name`，**同时**改 `cordis.patch.yml` 里 `insert[].name` 保持一致。

### 第 3 步：本地校验（已通过，可复跑）

```powershell
npx --yes @dsh-plugin-hub/cli validate .
```

期望：`Valid plugin: dsh-agent-dev-workflow@1.0.0`（"Add a screenshot before launch" 只是建议）。

### 第 4 步：你来做 —— 发布

```powershell
npm pack --dry-run   # 先看会打包什么：应为 19 个文件、约 42 kB
npm publish --access public
```

### 第 5 步：收录到 Hub

发布后 **Hub 每小时自动同步收录**。想更快可在 Hub 的插件页手动提交包名：

```
dsh-agent-dev-workflow
```

之后 claim（在 Hub 登录并给仓库装 GitHub App）就能在 Dashboard 编辑展示信息、截图、分类。

---

## 发布前我已经验证过什么

| 验证项 | 结果 |
|---|---|
| Hub 官方校验 | `Valid plugin: dsh-agent-dev-workflow@1.0.0` |
| 功能自测 `verify.mjs` | **34/34 通过**（并且已随包发布，别人可自验） |
| 反向对照（删 `references/pipeline.md`） | `pass=33 fail=1`，exit 1 —— 测试确实会失败 |
| **从 npm 装出来的包能否跑** | ✅ 实测：`inject=["skills"]`、`rank 600`、`resourceBase` 指向包内 `assets`、正文加载 9248 字符 |
| `npm pack` 内容 | 19 个文件、约 42 kB，`assets/` 齐全 |
| `cordis.patch.yml` 的 name == 包名 | ✅ `dsh-agent-dev-workflow`（Loader 解析的关键） |
| DSH 版本兼容门槛 | ✅ `peerDependencies` 不存在 → `evaluatePluginCompatibility` 第一道门槛直接判兼容 |

---

## 常见失败与对策

| 现象 | 原因 | 对策 |
|---|---|---|
| `Plugin package.json requires a public GitHub repository URL` | `repository` 缺失或还是占位符 | 回第 0 步 |
| 插件页报 `not-a-bundle` | 包没声明 `dsh.bundle.patch` | 本包已声明，确认没被改坏 |
| 装上了但插件页没条目 | 组合包没被选中 | 在插件页点「立即启用」 |
| `incompatible-version` | 包里声明了 peerDependencies | 本包没有；别给 `package.json` 加 `peerDependencies` |
| 装了但 skill 不出现 | 当前 preset 是 `minimal` | 换 `standard` preset |
| Hub 上搜不到 | 还没到同步周期 | 等一小时，或手动提交包名 |

---

## 也别忘了：纯 skill 那份不需要发布

同一套流程还有一份**纯 skill** 形态（`..\dsh-skills\`），装在 `~/.dsh/skills/`，
**常驻、可开关（`toggle.ps1`）、零发布成本**。插件的额外价值只有两条：
**插件页里的开关** 和 **按包分发给别人**。自己用的话，纯 skill 就够。

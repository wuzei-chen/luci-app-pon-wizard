# 设计文档与踩坑记录

## 1. 组成

| 文件 | 作用 |
|---|---|
| `files/www/luci-static/quickstart/pon-card.js` | 注入脚本：克隆官方卡片、SPA 自愈补插、四步向导面板、整页接管 |
| `files/usr/lib/lua/luci/controller/pon_card.lua` | rpcd 后端：`pon_card_status`（ponctl --json + uci 读）、`pon_card_apply`（uci 三段写入 + 可选重启，CSRF 校验） |
| `files/www/luci-static/resources/view/pon/wizard.js` + `menu.d/luci-app-pon-guide.json` | 独立页（网络 → PON → 向导配置），与卡片面板数据同源，作为备用入口 |
| `install.sh` / `uninstall.sh` | 设备端安装/卸载（main.htm 幂等补丁 + 版本参数缓存击穿） |

## 2. 关键机制

### 卡片风格零偏差
quickstart 卡片样式是 Vue scoped CSS（`data-v-xxxx` 属性选择器）。注入卡通过 `cloneNode` 现有卡并保留其 data-v 属性，官方渐变色按 `nth-child(9n+N)` 自动分配；第 4 位官方无色定义，内联补主题青渐变（唯一内联样式）。

### 整页接管
点击卡片时对 `.page` 容器：隐藏全部子元素（各自记忆原 display）+ 挂 `pon-open` 类（清零容器顶距、flex 顶对齐）+ 面板插入为末子元素。返回时精确复原。
**为什么必须 `align-items:flex-start`**：`.page` 是 flex 容器且默认居中，面板会被垂直居中产生 91~121px 悬浮偏移，滚动时绿头与内容视觉脱节。

### SPA 自愈
官方内页往返时 Vue 重建卡片行并销毁注入卡。MutationObserver 常驻 + `mount()` 幂等（卡在即跳过），每次 DOM 变更自动补插；CSS 注入以 `style.pon-card-css` 标记幂等。

### 数据链
- 读：`ponctl --device pon0 status --json`（实时）+ `/etc/config/pon`（当前配置）
- 写：`uci` 三段（line0 模式/SN/注册码；line0_omci 与 line0_oam 的 LOID/厂商字段双写，GPON 与 EPON 通吃）
- POST 需 `window.token`（main.htm 已全局暴露的 CSRF 令牌）

## 3. 踩坑记录（改码前必读）

1. **Lua/JS 模板 CRLF**：Windows 源头的 `.htm/.lua/sh` 文件必须 `tr -d '\r'`，否则 `unfinished string` 500 或 shebang 失效（"not found"）
2. **LuCI View 基类**：JS 视图必须 `view.extend`（`baseclass.extend` 不会触发渲染管线 load→render→替换 #view）
3. **render 内禁止同步发起 `L.Request`**：会静默炸掉渲染管线；请求放 `load()`，按钮事件里除外
4. **menu.d 父节点 `depends.acl`**：会话不满足时整个子树不可达（含官方页面），luci-app-pon 原菜单有此依赖，重装后需删除
5. **全局 `h2` 样式**：向导页全局 h2 带白卡样式，注入页标题须用 `div`
6. **构建缓存**：main.htm 的 script 标签必须带版本参数；更新 js 后同步递增 `VERSION`

# luci-app-pon-wizard

为 iStoreOS / PonWrt 的网络向导（quickstart）增加 **PON 分步配置能力** 的 LuCI 扩展。

在向导页新增与官方卡片风格完全一致的「PON 配置」卡片，点击后整页接管，以四步分步流程完成光纤线路的完整配置——无需 SSH，无需命令行。

![screenshots](docs/)

## 功能

| 步骤 | 内容 |
|---|---|
| ① 线路模式 | 驱动默认 / GPON / XG-PON / EPON 单选卡（附速率与运营商提示），底部实时光状态条（收光功率 / ONU 状态 / 业务通道就绪度，5 秒轮询） |
| ② 注册身份 | 序列号 SN（前端格式校验）、Registration-ID、LOID / LOID 密码（电信认证方式） |
| ③ 高级选项 | 厂商 ID / 设备型号 / 硬件 / 软件版本（伪装原厂 ONU 用，默认可跳过） |
| ④ 确认应用 | 9 项汇总表 + 「保存后立即重启 PON」勾选 |

交互特性：

- 点击卡片**整页接管**（卡片行让位、向导标题隐藏），与官方内页行为一致
- 每一步均有红色「返回」按钮；任意时刻返回，卡片行完整复原
- 官方三张卡片往返切换，PON 卡片稳定存活（SPA 重建自动补插）
- 数据落盘 `/etc/config/pon`（line0 / line0_omci / line0_oam 三段），与官方 `luci-app-pon` 页面数据同源

## 架构

```
向导页（quickstart Vue）
  └─ pon-card.js 注入
       ├─ 克隆现有卡片 DOM（继承 scoped CSS，风格零偏差）
       ├─ 点击 → .page 整页让位 → 渲染四步面板
       │    ├─ GET  admin/network_guide/pon_card_status   (ponctl --json + uci)
       │    └─ POST admin/network_guide/pon_card_apply    (uci 写入 + 可选重启)
       └─ MutationObserver 常驻补插（SPA 重建自愈）
```

## 兼容性

实测环境（编写基准）：

| 组件 | 版本 |
|---|---|
| PonWrt | SNAPSHOT r0-03c1345 |
| 内核 | 6.18.55（airoha/an7581） |
| 设备 | Nokia XG-040G-MD |
| quickstart | binary 0.13.0 |
| luci-app-pon | 0.1.0（官方 PON 页面，可选共存） |

其他 AN7581/AN7583 + quickstart 系统理论上可用，scoped CSS 的 `data-v-*` 值会**运行时自动从现有卡片读取**，主题/版本差异一般无需改码。

## 安装

```sh
# 1. 上传文件树到设备
scp -r files root@192.168.1.1:/tmp/luci-app-pon-wizard

# 2. 设备端执行安装（自动备份 main.htm、打补丁、重启服务）
ssh root@192.168.1.1 "sh /tmp/luci-app-pon-wizard/install.sh"
```

安装内容：

- `pon_card.lua` → rpcd 后端（状态查询 + 配置写入，CSRF 校验）
- `pon-card.js` → 向导页注入脚本（main.htm 补丁自动带版本参数，后续更新改 `VERSION` 即可击穿缓存）
- `luci-pon-guide.json` + `wizard.js` → 「网络 → PON → 向导配置」独立页（备用入口，与卡片面板数据同源）

## 卸载

```sh
ssh root@192.168.1.1 "sh /tmp/luci-app-pon-wizard/uninstall.sh"
```

恢复 main.erb 原文件（安装时备份为 `.orig`）、移除全部文件并重启服务。`/etc/config/pon` 用户配置保留。

## 已知注意事项

1. **quickstart 升级**会替换 `main.htm` → 需重跑 `install.sh`（补丁幂等）
2. Vue 结构大改（如 `.network-containers` 类名变化）→ 需适配 `pon-card.js` 选择器
3. 官方 `luci-app-pon` 若重装，其菜单 JSON 会恢复 `depends.acl` → 根节点 ACL 依赖会导致 PON 子树整组不可达，需删除该依赖（见 docs/DESIGN.md 踩坑记录）
4. 面板展开依赖隐藏 `.page` 兄弟元素实现整页让位，quickstart 前端若改版布局需同步调整

## License

Apache-2.0（与依赖的 [openwrt-pon-userspace](https://github.com/pbs05/openwrt-pon-userspace) 一致）

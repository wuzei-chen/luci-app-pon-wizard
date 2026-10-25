#!/bin/sh
# luci-app-pon-wizard 卸载脚本（设备端执行）
set -e
MAIN=/usr/lib/lua/luci/view/quickstart/main.htm

echo "== luci-app-pon-wizard uninstall =="

# 1) 恢复 main.htm
[ -f "$MAIN.orig" ] && cp "$MAIN.orig" "$MAIN" && echo "main.htm 已还原"

# 2) 移除文件
rm -f /usr/lib/lua/luci/controller/pon_card.lua
rm -f /www/luci-static/quickstart/pon-card.js
rm -f /www/luci-static/resources/view/pon/wizard.js
rm -f /usr/share/luci/menu.d/luci-app-pon-guide.json
rm -f /usr/share/rpcd/acl.d/luci-app-pon-guide.json

# 3) 清缓存重启（保留 /etc/config/pon 用户配置）
rm -f /tmp/luci-indexcache*
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart

echo "== 已卸载。/etc/config/pon 配置保留 =="

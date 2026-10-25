#!/bin/sh
# luci-app-pon-wizard 安装脚本（设备端执行）
# 前提：本文件与 files/ 树已位于同一目录（如 /tmp/luci-app-pon-wizard/）
set -e

BASE="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(cat "$BASE/VERSION" 2>/dev/null || echo 17)"

echo "== luci-app-pon-wizard install (v$VERSION) =="

# 0) 依赖检查
for pkg in airoha-ponctl airoha-pond; do
	apk info 2>/dev/null | grep -qx "$pkg" || {
		echo "缺少依赖: $pkg（apk add $pkg）"; exit 1; }
done

# 1) 复制文件
cp -f "$BASE/files/usr/lib/lua/luci/controller/pon_card.lua" /usr/lib/lua/luci/controller/
mkdir -p /usr/share/luci/menu.d /usr/share/rpcd/acl.d
cp -f "$BASE/files/usr/share/luci/menu.d/"*.json /usr/share/luci/menu.d/
[ -f "$BASE/files/usr/share/rpcd/acl.d/luci-app-pon-guide.json" ] && \
	cp -f "$BASE/files/usr/share/rpcd/acl.d/"*.json /usr/share/rpcd/acl.d/
mkdir -p /www/luci-static/quickstart /www/luci-static/resources/view/pon
cp -f "$BASE/files/www/luci-static/quickstart/pon-card.js" /www/luci-static/quickstart/
cp -f "$BASE/files/www/luci-static/resources/view/pon/"*.js /www/luci-static/resources/view/pon/
chmod 644 /usr/lib/lua/luci/controller/pon_card.lua /www/luci-static/quickstart/pon-card.js

# 2) main.htm 补丁（幂等：备份一次，脚本行缺则插入，版本参数每次更新）
MAIN=/usr/lib/lua/luci/view/quickstart/main.htm
[ -f "$MAIN.orig" ] || cp "$MAIN" "$MAIN.orig"
if ! grep -q 'pon-card.js' "$MAIN"; then
	sed -i 's|<%+footer%>|<script src="/luci-static/quickstart/pon-card.js?v='"$VERSION"'"></script>\n<%+footer%>|' "$MAIN"
	echo "main.htm 已打补丁"
else
	sed -i 's|pon-card.js?v=[0-9]*|pon-card.js?v='"$VERSION"'|' "$MAIN"
	echo "main.htm 补丁已存在，版本参数更新为 v$VERSION"
fi

# 3) 清缓存重启
rm -f /tmp/luci-indexcache*
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart

echo "== 完成。浏览器强刷（Ctrl+F5）后进入网络向导验证 =="

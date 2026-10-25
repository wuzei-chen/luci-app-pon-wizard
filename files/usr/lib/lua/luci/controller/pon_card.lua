-- pon_card.lua v2 — 网络向导 PON 分步配置后端（2026-10-25）
-- status: GET，返回 ponctl 实时状态 + /etc/config/pon 完整配置（JSON）
-- apply:  POST（CSRF token 校验），分步写 line0 / line0_omci / line0_oap 三段并可选重启 PON
module("luci.controller.pon_card", package.seeall)

function index()
	-- 分步向导页：call 模板渲染（无 title），不进菜单树——网络向导保持叶子节点直达卡片页
	entry({"admin", "network_guide", "pon_wizard"}, template("pon_wizard")).leaf = true
	entry({"admin", "network_guide", "pon_card_status"}, call("api_status")).leaf = true
	entry({"admin", "network_guide", "pon_card_apply"}, call("api_apply")).leaf = true
end

local function json_out(tbl)
	local jsonc = require "luci.jsonc"
	luci.http.prepare_content("application/json")
	luci.http.write(jsonc.stringify(tbl))
end

function api_status()
	local jsonc = require "luci.jsonc"
	local uci = require "luci.model.uci".cursor()
	local out = { ok = false }
	local f = io.popen("/usr/sbin/ponctl --device pon0 status --json 2>/dev/null")
	if f then
		local raw = f:read("*a") or ""
		f:close()
		local st = jsonc.parse(raw)
		if st and st.line then
			out.ok = true
			out.active_mode = st.line.active_mode or ""
			out.optical = st.line.optical_signal or false
			out.lifecycle = st.line.lifecycle or ""
			out.sync = st.line.xgtc_sync or ""
			out.onu_state = (st.registration and st.registration.onu_state) or ""
			out.onu_id_valid = (st.registration and st.registration.onu_id_valid) or false
			out.rx_power = (st.frontend and st.frontend.rx_power_dbm) or nil
			out.tx_power = (st.frontend and st.frontend.tx_power_dbm) or nil
			out.temp = (st.frontend and st.frontend.temperature_celsius) or nil
			out.service_ready = (st.datapath and st.datapath.service_ready) or false
		end
	end
	local g = function(s, o) return uci:get("pon", s, o) or "" end
	out.cfg = {
		mode = g("line0", "mode"),
		serial = g("line0", "serial_number"),
		regid = g("line0", "registration_id"),
		loid = g("line0_omci", "loid"),
		loid_pw = g("line0_omci", "loid_password"),
		vendor_id = g("line0_omci", "vendor_id"),
		equipment_id = g("line0_omci", "equipment_id"),
		hw_ver = g("line0_omci", "hardware_version"),
		sw_ver = g("line0_omci", "software_version")
	}
	json_out(out)
end

local function valid_serial(s)
	if s:match("^%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x$") then return true end
	if #s == 12 and s:sub(1, 4):match("^%w%w%w%w$") and s:sub(5):match("^%x%x%x%x%x%x%x%x$") then return true end
	return false
end

function api_apply()
	local http = require "luci.http"
	local uci = require "luci.model.uci".cursor()
	local fv = function(n, d) return (http.formvalue(n) or d):gsub("%s+", "") end
	local mode = fv("mode", "")
	local serial = fv("serial", "")
	local regid = http.formvalue("regid") or ""
	local loid = fv("loid", "")
	local loid_pw = http.formvalue("loid_password") or ""
	local vendor_id = fv("vendor_id", "")
	local equipment_id = fv("equipment_id", "")
	local hw_ver = fv("hw_ver", "")
	local sw_ver = fv("sw_ver", "")
	local restart = http.formvalue("restart")

	if mode ~= "" and mode ~= "gpon" and mode ~= "xgpon" and mode ~= "epon" then
		return json_out({ ok = false, err = "无效的线路模式" })
	end
	if serial ~= "" and not valid_serial(serial) then
		return json_out({ ok = false, err = "SN 需为 16 位 hex 或 4 字符厂商码 + 8 位 hex" })
	end
	if regid ~= "" and not regid:match("^text:") and not regid:match("^hex:") then
		regid = "text:" .. regid
	end

	uci:set("pon", "line0", "mode", mode)
	uci:set("pon", "line0", "serial_number", serial)
	uci:set("pon", "line0", "registration_id", regid)

	-- LOID 与厂商信息：OMCI（GPON/XG-PON）与 OAM（EPON）两段同步写
	local omci, oam = "line0_omci", "line0_oam"
	uci:set("pon", omci, "loid", loid)
	uci:set("pon", omci, "loid_password", loid_pw)
	uci:set("pon", omci, "vendor_id", vendor_id)
	uci:set("pon", omci, "equipment_id", equipment_id)
	uci:set("pon", omci, "hardware_version", hw_ver)
	uci:set("pon", omci, "software_version", sw_ver)
	uci:set("pon", oam, "loid", loid)
	uci:set("pon", oam, "loid_password", loid_pw)
	uci:set("pon", oam, "vendor_id", vendor_id)
	uci:set("pon", oam, "model", equipment_id)
	uci:set("pon", oam, "hardware_version", hw_ver)
	uci:set("pon", oam, "software_version", sw_ver)
	uci:save("pon")
	uci:commit("pon")

	local restarted = false
	if restart == "1" then
		luci.sys.call("/etc/init.d/pon restart >/dev/null 2>&1")
		restarted = true
	end
	json_out({ ok = true, restarted = restarted })
end

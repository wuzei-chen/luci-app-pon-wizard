/* pon wizard page script (v25) — 由 Lua 模板页加载（/admin/network_guide/pon_wizard）
 * 内容：4 步分步向导（线路模式 → 注册身份 → 高级选项 → 确认应用）。
 * 数据走 luci.controller.pon_card（pon_card_status / pon_card_apply）。
 */
(function () {
	'use strict';
	var root = document.getElementById('pon-wizard-root');
	if (!root || root.__ponWiz) return;
	root.__ponWiz = true;

	function E(tag, attr, kids) {
		var e = document.createElement(tag);
		if (attr) for (var k in attr) e.setAttribute(k, attr[k]);
		if (kids == null) { /* none */ }
		else if (Array.isArray(kids)) kids.forEach(function (c) { if (c) e.appendChild(c); });
		else if (typeof kids === 'object') e.appendChild(kids);
		else e.textContent = kids;
		return e;
	}
	function st(e, cssText) { e.style.cssText = cssText; return e; }
	function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }

	/* 隐藏 LuCI 全局悬浮按钮条（本页自带保存） */
	var style = document.createElement('style');
	style.textContent = '.cbi-page-actions,.cbi-map-actions{display:none !important;}'
		+ '#pon-wizard-root .pon-guide{max-width:568px;margin:0 auto;padding:56px 16px 40px;font-size:14px;color:#333;}'
		+ '#pon-wizard-root .pon-guide h2{font-size:42px;line-height:1.2;font-weight:700;color:#282828;margin:0 0 10px;'
		+ 'background:transparent;border-radius:0;box-shadow:none;padding:0;}'
		+ '#pon-wizard-root .sub{color:#999;font-size:14px;font-weight:600;margin:0 0 32px;}'
		+ '#pon-wizard-root .pon-msg{min-height:18px;font-size:12px;color:#888;margin-top:12px;text-align:center;}';
	document.head.appendChild(style);

	function scrollTop() {
		var sc = document.querySelector('.main-right');
		if (sc) sc.scrollTop = 0;
		window.scrollTo(0, 0);
	}

	var guide = E('div', { 'class': 'pon-guide' });
	root.appendChild(guide);
	guide.appendChild(E('h2', null, 'PON 配置'));
	guide.appendChild(E('p', { 'class': 'sub' }, '按步骤完成光纤线路配置（共 4 步，高级项可跳过）'));

	/* ---- 步骤条 ---- */
	var STEPS = ['线路模式', '注册身份', '高级选项', '确认应用'];
	var bar = st(el('div'), 'display:flex;align-items:center;margin:0 0 30px;');
	var dots = [];
	STEPS.forEach(function (t, i) {
		var wrap = st(el('div'), 'display:flex;align-items:center;');
		var dot = st(el('div', String(i + 1)),
			'width:30px;height:30px;border-radius:50%;flex:none;display:flex;align-items:center;'
			+ 'justify-content:center;font-size:13px;background:rgb(229,229,229);color:#fff;transition:all .2s;');
		var lbl = st(el('div', t), 'margin-left:8px;font-size:13px;color:rgb(102,102,102);white-space:nowrap;');
		wrap.appendChild(dot); wrap.appendChild(lbl);
		bar.appendChild(wrap);
		dots.push({ dot: dot, lbl: lbl });
		if (i < STEPS.length - 1)
			bar.appendChild(st(el('div'), 'flex:1;height:2px;background:rgb(229,229,229);margin:0 10px;'));
	});
	guide.appendChild(bar);

	var content = st(el('div'), 'min-height:280px;');
	guide.appendChild(content);

	/* ---- 导航按钮（全宽堆叠，官方按钮语言） ---- */
	function btn(text, bg, disp) {
		return st(el('button', text), 'display:' + disp + ';width:100%;height:40px;margin:0 0 12px;'
			+ 'border:0;border-radius:6px;background:' + bg + ';color:#fff;font-size:14px;cursor:pointer;');
	}
	var prev = btn('上一步', 'rgb(136,152,170)', 'none');
	var next = btn('下一步', 'rgb(11,143,168)', 'none');
	var save = btn('保存配置', 'rgb(11,143,168)', 'none');
	var quit = btn('返回', 'rgb(217,74,92)', 'block');
	guide.appendChild(prev); guide.appendChild(next); guide.appendChild(save); guide.appendChild(quit);

	var msg = st(el('div'), 'min-height:18px;font-size:12px;color:#888;margin-top:12px;text-align:center;');
	guide.appendChild(msg);

	/* ---- 向导状态：9 个配置字段 ---- */
	var wiz = { step: 1, loaded: false, data: {
		mode: '', serial: '', regid: '', loid: '', loid_pw: '',
		vendor_id: '', equipment_id: '', hw_ver: '', sw_ver: '', restart: false
	} };
	var liveBox = null;

	function fieldRow(labelText, ctrl, hint) {
		var f = st(el('div'), 'margin:0 0 18px;');
		f.appendChild(st(el('div', labelText), 'color:rgb(50,50,93);font-size:14px;margin:0 0 6px;'));
		st(ctrl, 'width:100%;height:42px;border:0.8px solid rgb(229,229,229);'
			+ 'border-radius:6px;padding:0 12px;font-size:14px;box-sizing:border-box;'
			+ 'background:#fff;outline:none;color:#333;');
		ctrl.addEventListener('focus', function () { ctrl.style.borderColor = '#0b8fa8'; });
		ctrl.addEventListener('blur', function () { ctrl.style.borderColor = 'rgb(229,229,229)'; });
		f.appendChild(ctrl);
		if (hint) f.appendChild(st(el('div', hint), 'font-size:12px;color:rgb(153,153,153);margin-top:4px;'));
		return f;
	}

	function collect() {
		content.querySelectorAll('[data-f]').forEach(function (i) {
			var k = i.getAttribute('data-f');
			wiz.data[k] = (i.type === 'checkbox') ? i.checked : i.value;
		});
	}

	function paintBar() {
		dots.forEach(function (dr, i) {
			var n = i + 1;
			if (n < wiz.step) {
				dr.dot.textContent = '\u2713'; dr.dot.style.background = 'rgb(11,143,168)';
				dr.lbl.style.color = 'rgb(11,143,168)'; dr.lbl.style.fontWeight = '';
			} else if (n === wiz.step) {
				dr.dot.textContent = String(n); dr.dot.style.background = 'rgb(11,143,168)';
				dr.lbl.style.color = 'rgb(30,30,30)'; dr.lbl.style.fontWeight = '600';
			} else {
				dr.dot.textContent = String(n); dr.dot.style.background = 'rgb(229,229,229)';
				dr.lbl.style.color = 'rgb(102,102,102)'; dr.lbl.style.fontWeight = '';
			}
		});
	}

	function modeBlock(m, title, desc) {
		var b = st(el('div'), 'display:flex;align-items:center;border:1.5px solid rgb(229,229,229);'
			+ 'border-radius:8px;padding:14px 16px;margin-bottom:12px;cursor:pointer;'
			+ 'background:#fff;transition:border-color .15s;');
		var radio = st(el('div'), 'width:18px;height:18px;border-radius:50%;border:2px solid rgb(229,229,229);'
			+ 'flex:none;margin-right:14px;');
		var tx = el('div');
		tx.appendChild(st(el('div', title), 'font-weight:600;font-size:15px;'));
		tx.appendChild(st(el('div', desc), 'font-size:12px;color:rgb(153,153,153);margin-top:2px;'));
		b.appendChild(radio); b.appendChild(tx);
		b.addEventListener('click', function () {
			wiz.data.mode = m;
			content.querySelectorAll('.pon-mode-blk').forEach(function (x) {
				x.style.borderColor = 'rgb(229,229,229)';
				x.firstChild.style.borderColor = 'rgb(229,229,229)';
				x.firstChild.style.background = 'transparent';
			});
			b.style.borderColor = 'rgb(11,143,168)';
			radio.style.borderColor = 'rgb(11,143,168)';
			radio.style.background = 'rgb(11,143,168)';
		});
		b.classList.add('pon-mode-blk');
		if (wiz.data.mode === m) setTimeout(function () { b.click(); }, 0);
		return b;
	}

	function stepHeader(text) {
		return st(el('div', text), 'font-size:15px;font-weight:600;margin:0 0 16px;color:rgb(30,30,30);');
	}

	function renderStep() {
		paintBar();
		content.innerHTML = '';
		msg.textContent = '';
		if (wiz.step === 1) {
			content.appendChild(stepHeader('第一步：选择光纤线路模式（不确定时保持驱动默认，由网络协商）'));
			content.appendChild(modeBlock('', '驱动默认', '自动协商，兼容性优先'));
			content.appendChild(modeBlock('gpon', 'GPON', '2.5G 下行 / 1.25G 上行（移动、联通常见）'));
			content.appendChild(modeBlock('xgpon', 'XG-PON', '10G 下行 / 2.5G 上行（千兆宽带常见）'));
			content.appendChild(modeBlock('epon', 'EPON', '以太网无源光网络（电信常见）'));
			liveBox = st(el('div'), 'background:#fff;border-radius:8px;padding:10px 14px;'
				+ 'margin-top:8px;color:rgb(102,102,102);font-size:13px;line-height:1.9;');
			content.appendChild(liveBox);
			poll();
		} else if (wiz.step === 2) {
			content.appendChild(stepHeader('第二步：注册身份（由运营商提供，SN 与 LOID 按需填写）'));
			var sn = document.createElement('input'); sn.type = 'text'; sn.value = wiz.data.serial; sn.setAttribute('data-f', 'serial');
			content.appendChild(fieldRow('序列号（SN）', sn, '16 位 hex 或 4 字符厂商码 + 8 位 hex；留空使用板载 SN'));
			var rg = document.createElement('input'); rg.type = 'text'; rg.value = wiz.data.regid; rg.setAttribute('data-f', 'regid');
			content.appendChild(fieldRow('Registration-ID', rg, '移动宽带常要求；留空按零上报'));
			var ld = document.createElement('input'); ld.type = 'text'; ld.value = wiz.data.loid; ld.setAttribute('data-f', 'loid');
			content.appendChild(fieldRow('LOID（逻辑标识）', ld, '电信宽带常见认证方式；不用请留空'));
			var lp = document.createElement('input'); lp.type = 'password'; lp.value = wiz.data.loid_pw; lp.setAttribute('data-f', 'loid_pw');
			content.appendChild(fieldRow('LOID 密码', lp));
		} else if (wiz.step === 3) {
			content.appendChild(stepHeader('第三步：高级选项（伪装原厂 ONU 时使用，默认无需修改）'));
			[['vendor_id', '厂商 ID（Vendor ID）'], ['equipment_id', '设备型号（Equipment ID）'],
			 ['hw_ver', '硬件版本'], ['sw_ver', '软件版本']].forEach(function (p) {
				var i = document.createElement('input'); i.type = 'text'; i.value = wiz.data[p[0]]; i.setAttribute('data-f', p[0]);
				content.appendChild(fieldRow(p[1], i));
			});
		} else {
			content.appendChild(stepHeader('第四步：确认配置并应用'));
			var rows = [['线路模式', { '': '驱动默认', gpon: 'GPON', xgpon: 'XG-PON', epon: 'EPON' }[wiz.data.mode] || '驱动默认'],
				['序列号（SN）', wiz.data.serial || '未设置（使用板载）'],
				['Registration-ID', wiz.data.regid || '未设置'],
				['LOID', wiz.data.loid || '未设置'],
				['LOID 密码', wiz.data.loid_pw ? '已设置' : '未设置'],
				['厂商 ID', wiz.data.vendor_id || '默认'],
				['设备型号', wiz.data.equipment_id || '默认'],
				['硬件版本', wiz.data.hw_ver || '默认'],
				['软件版本', wiz.data.sw_ver || '默认']];
			var tbl = st(el('div'), 'background:#fff;border-radius:8px;padding:6px 16px;margin-bottom:18px;');
			rows.forEach(function (r, idx) {
				var line = st(el('div'), 'display:flex;padding:9px 0;'
					+ (idx < rows.length - 1 ? 'border-bottom:0.8px solid rgb(240,240,240);' : ''));
				line.appendChild(st(el('div', r[0]), 'width:170px;color:rgb(102,102,102);font-size:13px;flex:none;'));
				line.appendChild(st(el('div', r[1]), 'font-size:13px;color:rgb(30,30,30);word-break:break-all;'));
				tbl.appendChild(line);
			});
			content.appendChild(tbl);
			var ck = document.createElement('input'); ck.type = 'checkbox'; ck.checked = wiz.data.restart; ck.setAttribute('data-f', 'restart');
			st(ck, 'width:auto;height:auto;margin-right:8px;');
			ck.id = 'pon-restart-ck';
			var ckl = el('label', '保存后立即重启 PON 线路（新身份生效）');
			ckl.setAttribute('for', 'pon-restart-ck');
			st(ckl, 'font-size:13px;color:rgb(50,50,93);display:flex;align-items:center;cursor:pointer;');
			ckl.insertBefore(ck, ckl.firstChild);
			content.appendChild(ckl);
		}
		prev.style.display = (wiz.step > 1) ? 'block' : 'none';
		next.style.display = (wiz.step < 4) ? 'block' : 'none';
		save.style.display = (wiz.step === 4) ? 'block' : 'none';
		quit.style.display = 'block';
	}

	prev.addEventListener('click', function () { collect(); if (wiz.step > 1) { wiz.step--; renderStep(); scrollTop(); } });
	next.addEventListener('click', function () {
		collect();
		if (wiz.step === 2) {
			var s = (wiz.data.serial || '').trim();
			if (s && !(/^[0-9a-fA-F]{16}$/.test(s) || (/^[0-9a-zA-Z]{4}[0-9a-fA-F]{8}$/.test(s)))) {
				msg.style.color = 'rgb(217,74,92)';
				msg.textContent = 'SN 格式不正确：需 16 位 hex 或 4 字符厂商码 + 8 位 hex';
				return;
			}
		}
		msg.textContent = '';
		if (wiz.step < 4) { wiz.step++; renderStep(); scrollTop(); }
	});

	save.addEventListener('click', function () {
		collect();
		save.disabled = true;
		msg.style.color = 'rgb(102,102,102)';
		msg.textContent = '保存中…';
		var url = L.url('admin', 'network_guide', 'pon_card_apply');
		if (L.env.token) url += '?token=' + L.env.token;
		var body = new URLSearchParams({
			mode: wiz.data.mode || '', serial: (wiz.data.serial || '').trim(),
			regid: (wiz.data.regid || '').trim().replace(/^text:/, ''),
			loid: wiz.data.loid || '', loid_password: wiz.data.loid_pw || '',
			vendor_id: wiz.data.vendor_id || '', equipment_id: wiz.data.equipment_id || '',
			hw_ver: wiz.data.hw_ver || '', sw_ver: wiz.data.sw_ver || '',
			restart: wiz.data.restart ? '1' : '0'
		});
		fetch(url, { method: 'POST', body: body }).then(function (r) {
			return r.json();
		}).then(function (r) {
			if (r.ok) {
				msg.style.color = 'rgb(11,143,168)';
				msg.textContent = '已保存' + (r.restarted ? '，PON 线路重启中…' : '。到 网络 → PON → 状态 查看注册进程');
			} else {
				msg.style.color = 'rgb(217,74,92)';
				msg.textContent = '失败：' + (r.err || '未知错误');
			}
		}).catch(function () {
			msg.style.color = 'rgb(217,74,92)';
			msg.textContent = '网络错误，请重试';
		}).finally(function () { save.disabled = false; });
	});

	quit.addEventListener('click', function () {
		location.href = L.url('admin', 'network_guide', 'pages', 'network');
	});

	/* ---- 实时状态（第一步展示，10s 轮询） ---- */
	function paintLive(dd) {
		if (!liveBox || !liveBox.isConnected) return;
		var rx = (dd.rx_power != null) ? Number(dd.rx_power).toFixed(1) + ' dBm' : '-';
		liveBox.textContent = '';
		[['活动模式', dd.active_mode || '-'], ['ONU 状态', dd.onu_state || '-'],
		 ['光信号', dd.optical ? '有' : '无'], ['接收光功率', rx],
		 ['生命周期', dd.lifecycle || '-'], ['业务通道', dd.service_ready ? '就绪' : '未就绪']]
		.forEach(function (kv) {
			var s = st(el('span', kv[0] + '：' + kv[1]), 'margin-right:18px;white-space:nowrap;display:inline-block;');
			liveBox.appendChild(s);
		});
	}
	function poll() {
		fetch(L.url('admin', 'network_guide', 'pon_card_status')).then(function (r) {
			return r.json();
		}).then(function (dd) {
			if (dd && dd.ok) paintLive(dd);
		}).catch(function () {});
	}
	setInterval(poll, 10000);

	/* ---- 初始数据 ---- */
	fetch(L.url('admin', 'network_guide', 'pon_card_status')).then(function (r) {
		return r.json();
	}).then(function (dd) {
		if (dd && dd.ok && dd.cfg) {
			var c = dd.cfg;
			wiz.data.mode = c.mode || '';
			wiz.data.serial = c.serial || '';
			wiz.data.regid = (c.regid || '').replace(/^text:/, '');
			wiz.data.loid = c.loid || '';
			wiz.data.loid_pw = c.loid_pw || '';
			wiz.data.vendor_id = c.vendor_id || '';
			wiz.data.equipment_id = c.equipment_id || '';
			wiz.data.hw_ver = c.hw_ver || '';
			wiz.data.sw_ver = c.sw_ver || '';
			wiz.loaded = true;
			if (wiz.step === 1) renderStep();
		}
	}).catch(function () {});

	renderStep();
})();

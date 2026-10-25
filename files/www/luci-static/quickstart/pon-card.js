/* pon-card.js — 网络向导 PON 配置卡片 v7（2026-10-25）
 * 卡片：纯克隆现有卡（scoped CSS/nth 渐变天然一致），插末位，桌面 4 列。
 * 交互：点击卡片在卡片行下方原地展开/收起 quickstart 内页风格配置面板，
 * 不再跳转。数据走 luci.controller.pon_card（status/apply）。
 */
(function () {
	'use strict';
	if (window.__ponCardInjected) return;
	window.__ponCardInjected = true;

	var API = '/cgi-bin/luci/admin/network_guide/';
	var MODES = [['', '驱动默认'], ['gpon', 'GPON'], ['xgpon', 'XG-PON'], ['epon', 'EPON']];
	var SVG = '<svg width="136px" height="136px" viewBox="0 0 136 136" xmlns="http://www.w3.org/2000/svg">'
		+ '<g transform="translate(32,32)">'
		+ '<rect width="72" height="72" rx="10" fill="#FFFFFF"/>'
		+ '<g transform="translate(14,14)" fill="none" stroke="#0B8FA8" stroke-width="4" stroke-linecap="round">'
		+ '<path d="M6 44 C 6 24, 26 24, 26 6"/>'
		+ '<path d="M22 44 C 22 30, 34 30, 34 6"/>'
		+ '<circle cx="6" cy="46" r="4" fill="#0B8FA8" stroke="none"/>'
		+ '<circle cx="22" cy="46" r="4" fill="#0B8FA8" stroke="none"/>'
		+ '<path d="M38 10 l6 -6 m0 0 l-1 6 m1 -6 l-6 1" stroke-width="3"/>'
		+ '</g></g></svg>';

	var card, panel, refs = {};

	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function buildCard(ref) {
		card = ref.cloneNode(true);
		card.classList.add('pon-card-item');

		var a = card.querySelector('a');
		a.href = 'javascript:;';
		a.addEventListener('click', function (e) { e.preventDefault(); toggle(); });

		var thumb = card.querySelector('.thumbnail');
		thumb.style.backgroundImage = 'linear-gradient(145deg, rgb(11, 191, 200) 0%, rgb(11, 143, 168) 100%)';

		var oldSvg = thumb.querySelector('svg');
		if (oldSvg) {
			var wrap = document.createElement('div');
			wrap.innerHTML = SVG;
			var n = wrap.firstChild;
			Array.from(oldSvg.attributes).forEach(function (at) {
				if (at.name.indexOf('data-v-') === 0) n.setAttribute(at.name, '');
			});
			if (oldSvg.getAttribute('style')) n.setAttribute('style', oldSvg.getAttribute('style'));
			oldSvg.parentNode.replaceChild(n, oldSvg);
		}
		var span = thumb.querySelector('span');
		if (span) span.textContent = 'PON 配置';
		return card;
	}

			function buildPanel() {
		/* 四步分步向导（官方风格）：模式 → 注册身份 → 高级 → 确认应用 */
		panel = el('div', 'pon-card-panel');
		panel.style.cssText = 'display:none;width:100%;padding:36px 0 12px;'
			+ 'box-sizing:border-box;font-size:14px;color:#333;';

		var body = el('div', 'pon-panel-body');
		body.style.cssText = 'width:568px;max-width:92%;margin:0 auto;';

		/* 官方标题是 div——用 h2 会吃到全局 h2 白卡样式（背景/圆角/阴影） */
		var h2 = el('div', null, 'PON 配置');
		h2.style.cssText = 'font-size:42px;font-weight:700;margin:0 0 8px;'
			+ 'color:rgb(30,30,30);line-height:1.25;'
			+ 'background:transparent;padding:0;border-radius:0;box-shadow:none;';
		body.appendChild(h2);
		var sub = el('p', null, '按步骤完成光纤线路配置（共 4 步，高级项可跳过）');
		sub.style.cssText = 'color:rgb(102,102,102);font-size:14px;margin:0 0 26px;';
		body.appendChild(sub);

		var bar = el('div', 'pon-steps');
		bar.style.cssText = 'display:flex;align-items:center;margin:0 0 30px;';
		var STEPS = ['线路模式', '注册身份', '高级选项', '确认应用'];
		var dots = [];
		STEPS.forEach(function (t, i) {
			var wrap = el('div');
			wrap.style.cssText = 'display:flex;align-items:center;';
			var dot = el('div', null, String(i + 1));
			dot.style.cssText = 'width:30px;height:30px;border-radius:50%;flex:none;'
				+ 'display:flex;align-items:center;justify-content:center;font-size:13px;'
				+ 'background:rgb(229,229,229);color:#fff;transition:all .2s;';
			var lbl = el('div', null, t);
			lbl.style.cssText = 'margin-left:8px;font-size:13px;color:rgb(102,102,102);white-space:nowrap;';
			wrap.appendChild(dot); wrap.appendChild(lbl);
			bar.appendChild(wrap);
			dots.push({ dot: dot, lbl: lbl });
			if (i < STEPS.length - 1) {
				var line = el('div');
				line.style.cssText = 'flex:1;height:2px;background:rgb(229,229,229);margin:0 10px;';
				bar.appendChild(line);
			}
		});
		body.appendChild(bar);

		var content = el('div', 'pon-step-content');
		content.style.cssText = 'min-height:280px;';
		body.appendChild(content);

		var nav = el('div');
		nav.style.cssText = 'margin-top:10px;';
		/* 官方内页按钮语言：全部全宽 568x40 垂直堆叠；次级灰 #8892aa */
		var prev = el('button', null, '上一步');
		prev.style.cssText = 'display:none;width:100%;height:40px;margin:0 0 12px;'
			+ 'border:0;border-radius:6px;background:rgb(136,152,170);'
			+ 'color:#fff;font-size:14px;cursor:pointer;';
		var next = el('button', null, '下一步');
		next.style.cssText = 'display:none;width:100%;height:40px;margin:0 0 12px;'
			+ 'border:0;border-radius:6px;background:rgb(11,143,168);'
			+ 'color:#fff;font-size:14px;cursor:pointer;';
		var back = el('button', null, '保存配置');
		back.style.cssText = 'display:none;width:100%;height:40px;margin:0 0 12px;'
			+ 'border:0;border-radius:6px;background:rgb(11,143,168);'
			+ 'color:#fff;font-size:14px;cursor:pointer;';
		var quit = el('button', null, '返回');
		quit.style.cssText = 'display:none;width:100%;height:40px;border:0;'
			+ 'border-radius:6px;background:rgb(217,74,92);'
			+ 'color:#fff;font-size:14px;cursor:pointer;';
		nav.appendChild(prev); nav.appendChild(next); nav.appendChild(back); nav.appendChild(quit);
		body.appendChild(nav);

		var msg = el('div');
		msg.style.cssText = 'margin-top:10px;min-height:16px;font-size:12px;'
			+ 'color:rgb(102,102,102);text-align:center;';
		body.appendChild(msg);

		panel.appendChild(body);

		var wiz = { step: 1, data: { mode: '', serial: '', regid: '', loid: '', loid_pw: '',
			vendor_id: '', equipment_id: '', hw_ver: '', sw_ver: '', restart: false }, loaded: false };
		var liveBox = null;

		function fieldRow(labelText, ctrl, hint) {
			var f = el('div');
			f.style.cssText = 'margin:0 0 18px;';
			var lab = el('div', null, labelText);
			lab.style.cssText = 'color:rgb(50,50,93);font-size:14px;margin:0 0 6px;';
			f.appendChild(lab);
			ctrl.style.cssText = 'width:100%;height:42px;border:0.8px solid rgb(229,229,229);'
				+ 'border-radius:6px;padding:0 12px;font-size:14px;box-sizing:border-box;'
				+ 'background:#fff;outline:none;color:#333;';
			ctrl.addEventListener('focus', function () { ctrl.style.borderColor = '#0b8fa8'; });
			ctrl.addEventListener('blur', function () { ctrl.style.borderColor = 'rgb(229,229,229)'; });
			f.appendChild(ctrl);
			if (hint) { var h = el('div', null, hint); h.style.cssText = 'font-size:12px;color:rgb(153,153,153);margin-top:4px;'; f.appendChild(h); }
			return f;
		}

		function scrollTop() {
		var sc = document.querySelector('.main-right') || document.scrollingElement;
		if (sc) sc.scrollTop = 0;
		window.scrollTo(0, 0);
	}

	function collect() {
			content.querySelectorAll('[data-f]').forEach(function (i) {
				var k = i.getAttribute('data-f');
				wiz.data[k] = (i.type === 'checkbox') ? i.checked : i.value;
			});
		}

		function paintBar() {
			dots.forEach(function (d, i) {
				var n = i + 1;
				if (n < wiz.step) {
					d.dot.textContent = '\u2713'; d.dot.style.background = 'rgb(11,143,168)';
					d.lbl.style.color = 'rgb(11,143,168)';
				} else if (n === wiz.step) {
					d.dot.textContent = String(n); d.dot.style.background = 'rgb(11,143,168)';
					d.lbl.style.color = 'rgb(30,30,30)'; d.lbl.style.fontWeight = '600';
				} else {
					d.dot.textContent = String(n); d.dot.style.background = 'rgb(229,229,229)';
					d.lbl.style.color = 'rgb(102,102,102)'; d.lbl.style.fontWeight = '';
				}
			});
		}

		function modeBlock(m, title, desc) {
			var b = el('div');
			b.style.cssText = 'display:flex;align-items:center;border:1.5px solid rgb(229,229,229);'
				+ 'border-radius:8px;padding:14px 16px;margin-bottom:12px;cursor:pointer;'
				+ 'background:#fff;transition:border-color .15s;';
			var radio = el('div');
			radio.style.cssText = 'width:18px;height:18px;border-radius:50%;border:2px solid rgb(229,229,229);'
				+ 'flex:none;margin-right:14px;';
			var tx = el('div');
			var t1 = el('div', null, title);
			t1.style.cssText = 'font-weight:600;font-size:15px;';
			var t2 = el('div', null, desc);
			t2.style.cssText = 'font-size:12px;color:rgb(153,153,153);margin-top:2px;';
			tx.appendChild(t1); tx.appendChild(t2);
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

		function renderStep() {
			paintBar();
			content.innerHTML = '';
			msg.textContent = '';
			if (wiz.step === 1) {
				var sh = el('div', null, '第一步：选择光纤线路模式（不确定时保持驱动默认，由网络协商）');
				sh.style.cssText = 'font-size:15px;font-weight:600;margin:0 0 16px;color:rgb(30,30,30);';
				content.appendChild(sh);
				content.appendChild(modeBlock('', '驱动默认', '自动协商，兼容性优先'));
				content.appendChild(modeBlock('gpon', 'GPON', '2.5G 下行 / 1.25G 上行（移动、联通常见）'));
				content.appendChild(modeBlock('xgpon', 'XG-PON', '10G 下行 / 2.5G 上行（千兆宽带常见）'));
				content.appendChild(modeBlock('epon', 'EPON', '以太网无源光网络（电信常见）'));
				liveBox = el('div');
				liveBox.style.cssText = 'background:#fff;border-radius:8px;padding:10px 14px;'
					+ 'margin-top:8px;color:rgb(102,102,102);font-size:13px;line-height:1.9;';
				content.appendChild(liveBox);
			} else if (wiz.step === 2) {
				var sh2 = el('div', null, '第二步：注册身份（由运营商提供，SN 与 LOID 按需填写）');
				sh2.style.cssText = 'font-size:15px;font-weight:600;margin:0 0 16px;color:rgb(30,30,30);';
				content.appendChild(sh2);
				var sn = el('input'); sn.type = 'text'; sn.value = wiz.data.serial; sn.setAttribute('data-f', 'serial');
				content.appendChild(fieldRow('序列号（SN）', sn, '16 位 hex 或 4 字符厂商码 + 8 位 hex；留空使用板载 SN'));
				var rg = el('input'); rg.type = 'text'; rg.value = wiz.data.regid; rg.setAttribute('data-f', 'regid');
				content.appendChild(fieldRow('Registration-ID', rg, '移动宽带常要求；留空按零上报'));
				var ld = el('input'); ld.type = 'text'; ld.value = wiz.data.loid; ld.setAttribute('data-f', 'loid');
				content.appendChild(fieldRow('LOID（逻辑标识）', ld, '电信宽带常见认证方式；不用请留空'));
				var lp = el('input'); lp.type = 'password'; lp.value = wiz.data.loid_pw; lp.setAttribute('data-f', 'loid_pw');
				content.appendChild(fieldRow('LOID 密码', lp));
			} else if (wiz.step === 3) {
				var sh3 = el('div', null, '第三步：高级选项（伪装原厂 ONU 时使用，默认无需修改）');
				sh3.style.cssText = 'font-size:15px;font-weight:600;margin:0 0 16px;color:rgb(30,30,30);';
				content.appendChild(sh3);
				[['vendor_id', '厂商 ID（Vendor ID）'], ['equipment_id', '设备型号（Equipment ID）'],
				 ['hw_ver', '硬件版本'], ['sw_ver', '软件版本']].forEach(function (p) {
					var i = el('input'); i.type = 'text'; i.value = wiz.data[p[0]]; i.setAttribute('data-f', p[0]);
					content.appendChild(fieldRow(p[1], i));
				});
			} else {
				var sh4 = el('div', null, '第四步：确认配置并应用');
				sh4.style.cssText = 'font-size:15px;font-weight:600;margin:0 0 16px;color:rgb(30,30,30);';
				content.appendChild(sh4);
				var rows = [['线路模式', { '': '驱动默认', gpon: 'GPON', xgpon: 'XG-PON', epon: 'EPON' }[wiz.data.mode] || '驱动默认'],
					['序列号（SN）', wiz.data.serial || '未设置（使用板载）'],
					['Registration-ID', wiz.data.regid || '未设置'],
					['LOID', wiz.data.loid || '未设置'],
					['LOID 密码', wiz.data.loid_pw ? '已设置' : '未设置'],
					['厂商 ID', wiz.data.vendor_id || '默认'],
					['设备型号', wiz.data.equipment_id || '默认'],
					['硬件版本', wiz.data.hw_ver || '默认'],
					['软件版本', wiz.data.sw_ver || '默认']];
				var tbl = el('div');
				tbl.style.cssText = 'background:#fff;border-radius:8px;padding:6px 16px;margin-bottom:18px;';
				rows.forEach(function (r, idx) {
					var line = el('div');
					line.style.cssText = 'display:flex;padding:9px 0;' + (idx < rows.length - 1 ? 'border-bottom:0.8px solid rgb(240,240,240);' : '');
					var k = el('div', null, r[0]);
					k.style.cssText = 'width:170px;color:rgb(102,102,102);font-size:13px;flex:none;';
					var v = el('div', null, r[1]);
					v.style.cssText = 'font-size:13px;color:rgb(30,30,30);word-break:break-all;';
					line.appendChild(k); line.appendChild(v);
					tbl.appendChild(line);
				});
				content.appendChild(tbl);
				var ck = el('input'); ck.type = 'checkbox'; ck.checked = wiz.data.restart; ck.setAttribute('data-f', 'restart');
				ck.style.cssText = 'width:auto;height:auto;margin-right:8px;';
				ck.id = 'pon-restart-ck';
				var ckl = el('label', null, '保存后立即重启 PON 线路（新身份生效）');
				ckl.setAttribute('for', 'pon-restart-ck');
				ckl.style.cssText = 'font-size:13px;color:rgb(50,50,93);display:flex;align-items:center;cursor:pointer;';
				ckl.insertBefore(ck, ckl.firstChild);
				content.appendChild(ckl);
			}
			prev.style.display = (wiz.step > 1) ? 'block' : 'none';
			next.style.display = (wiz.step < 4) ? 'block' : 'none';
			back.style.display = (wiz.step === 4) ? 'block' : 'none';
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
			if (wiz.step < 4) { wiz.step++; renderStep(); scrollTop(); }
		});

		back.addEventListener('click', function () {
			collect();
			msg.style.color = 'rgb(102,102,102)';
			msg.textContent = '保存中…';
			var body2 = new URLSearchParams({
				token: window.token || '',
				mode: wiz.data.mode || '', serial: (wiz.data.serial || '').trim(),
				regid: (wiz.data.regid || '').trim().replace(/^text:/, ''),
				loid: wiz.data.loid || '', loid_password: wiz.data.loid_pw || '',
				vendor_id: wiz.data.vendor_id || '', equipment_id: wiz.data.equipment_id || '',
				hw_ver: wiz.data.hw_ver || '', sw_ver: wiz.data.sw_ver || '',
				restart: wiz.data.restart ? '1' : '0'
			});
			fetch(API + 'pon_card_apply', { method: 'POST', body: body2 })
				.then(function (r) { return r.json(); })
				.then(function (d) {
					if (d.ok) {
						msg.style.color = 'rgb(11,143,168)';
						msg.textContent = '已保存' + (d.restarted ? '，PON 线路重启中…' : '。到 网络 → PON → 状态 查看注册进程');
					} else {
						msg.style.color = 'rgb(217,74,92)';
						msg.textContent = '失败：' + (d.err || '未知错误');
					}
				})
				.catch(function () { msg.textContent = '网络错误，请重试'; });
		});

		quit.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });

		function poll() {
			fetch(API + 'pon_card_status').then(function (r) { return r.json(); }).then(function (d) {
				if (!d.ok) return;
				if (!wiz.loaded && d.cfg) {
					wiz.data.mode = d.cfg.mode || '';
					wiz.data.serial = d.cfg.serial || '';
					wiz.data.regid = (d.cfg.regid || '').replace(/^text:/, '');
					wiz.data.loid = d.cfg.loid || '';
					wiz.data.loid_pw = d.cfg.loid_pw || '';
					wiz.data.vendor_id = d.cfg.vendor_id || '';
					wiz.data.equipment_id = d.cfg.equipment_id || '';
					wiz.data.hw_ver = d.cfg.hw_ver || '';
					wiz.data.sw_ver = d.cfg.sw_ver || '';
					wiz.loaded = true;
					if (wiz.step === 1) renderStep();
				}
				if (liveBox && liveBox.isConnected) {
					var rx = (d.rx_power != null) ? Number(d.rx_power).toFixed(1) + ' dBm' : '-';
					liveBox.textContent = '';
					[['活动模式', d.active_mode || '-'], ['ONU 状态', d.onu_state || '-'],
					['光信号', d.optical ? '有' : '无'], ['接收光功率', rx],
					['生命周期', d.lifecycle || '-'], ['业务通道', d.service_ready ? '就绪' : '未就绪']]
					.forEach(function (kv) {
						var s = el('span', null, kv[0] + '：' + kv[1]);
						s.style.cssText = 'margin-right:18px;white-space:nowrap;display:inline-block;';
						liveBox.appendChild(s);
					});
				}
			}).catch(function () {});
		}

		renderStep();
		poll();
		return panel;
	}

	function setPageChrome(page, open) {
		/* 内容高于任一祖先 flex 容器时，center 对称溢出会把标题顶进横条
		   （分辨率相关）。展开时沿途祖先全部顶部对齐，收起时还原。 */
		var e = page.parentElement;
		while (e && e !== document.body) {
			if (open) {
				if (e.dataset.ponPrevAlign === undefined) {
					e.dataset.ponPrevAlign = e.style.alignItems || '';
					e.dataset.ponPrevJust = e.style.justifyContent || '';
					e.style.alignItems = 'flex-start';
					e.style.justifyContent = 'flex-start';
				}
			} else if (e.dataset.ponPrevAlign !== undefined) {
				e.style.alignItems = e.dataset.ponPrevAlign;
				e.style.justifyContent = e.dataset.ponPrevJust;
				delete e.dataset.ponPrevAlign;
				delete e.dataset.ponPrevJust;
			}
			e = e.parentElement;
		}
	}

	function toggle() {
		/* 官方内页行为：整个 .page 内容区让位（标题/描述/卡片行/底部提示全部隐藏） */
		var row = card ? card.parentElement : document.querySelector('.network-containers');
		if (!row) return;
		var page = row.parentElement;
		if (page.querySelector('.pon-card-panel') === null) {
			page.appendChild(buildPanel());
		} else if (!panel.isConnected) {
			page.appendChild(panel);
		}
		var opening = (panel.style.display !== 'block');
		panel.style.display = opening ? 'block' : 'none';
		if (opening) { page.classList.add('pon-open'); } else { page.classList.remove('pon-open'); }
		setPageChrome(page, opening);
		Array.prototype.forEach.call(page.children, function (c) {
			if (c === panel) return;
			if (opening) { c.dataset.ponPrevDisplay = c.style.display; c.style.display = 'none'; }
			else { c.style.display = c.dataset.ponPrevDisplay || ''; }
		});
		if (opening) { scrollTop(); poll(); }
	}

	function poll() {
		if (!panel) return;
		fetch(API + 'pon_card_status').then(function (r) { return r.json(); }).then(function (d) {
			if (!d.ok) { refs.status.textContent = '状态读取失败'; return; }
			var rx = (d.rx_power != null) ? Number(d.rx_power).toFixed(1) + ' dBm' : '-';
			refs.status.textContent = '';
			[['活动模式', d.active_mode || '-'], ['ONU 状态', d.onu_state || '-'],
			['光信号', d.optical ? '有' : '无'], ['接收光功率', rx], ['生命周期', d.lifecycle || '-']]
			.forEach(function (kv) {
				var s = el('span', null, kv[0] + '：' + kv[1]);
				s.style.cssText = 'margin-right:20px;white-space:nowrap;display:inline-block;';
				refs.status.appendChild(s);
			});
			if (document.activeElement !== refs.modeSel) refs.modeSel.value = d.cfg_mode || '';
			if (document.activeElement !== refs.snIn) refs.snIn.value = d.cfg_serial || '';
			if (document.activeElement !== refs.regIn) refs.regIn.value = (d.cfg_regid || '').replace(/^text:/, '');
		}).catch(function () { refs.status.textContent = '状态读取失败'; });
	}

	function injectCss() {
		if (document.head.querySelector('style.pon-card-css')) return;
		var st = document.createElement('style');
		st.className = 'pon-card-css';
		st.textContent = '@media (min-width:768px){.network-containers .network-container_item{'
			+ 'flex:0 0 calc(25% - 9px) !important;max-width:calc(25% - 9px) !important;}}'
			+ '.pon-open{padding-top:0 !important;margin-top:0 !important;align-items:flex-start !important;}'
			+ '.pon-open .pon-card-panel{padding-top:10px !important;}';
		document.head.appendChild(st);
	}

	function mount() {
		var row = document.querySelector('.network-containers');
		if (!row || row.querySelector('.pon-card-item')) return false;
		var items = Array.from(row.querySelectorAll(':scope > .network-container_item'));
		var ref = items[items.length - 1];
		if (!ref) return false;
		injectCss();
		if (panel && panel.isConnected) { panel.style.display = 'none'; }
		row.appendChild(buildCard(ref));
		return true;
	}

	function boot() {
		/* SPA 常驻观察：官方内页返回时 Vue 会重建卡片行并销毁已插入的 PON 卡，
		   mount 幂等（卡在即跳过），每次 DOM 变更都补插 */
		var mo = new MutationObserver(function () { mount(); });
		mo.observe(document.body, { childList: true, subtree: true });
		setInterval(function () {
			if (panel && panel.style.display === 'block') poll();
		}, 5000);
		mount();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})();

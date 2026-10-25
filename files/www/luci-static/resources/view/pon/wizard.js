/* pon/guide.js — 网络向导内页风格的 PON 配置页（2026-10-25）
 * 视觉复刻 quickstart 向导内页：浅灰底、label 上置、必填红星、底部按钮条。
 * 数据走 luci.controller.pon_card（status/apply）。
 */
'use strict';
'require view';

return view.extend({
	title: _('PON 配置'),

	load: function () {
		return L.resolveDefault(
			L.Request.get(L.url('admin', 'network_guide', 'pon_card_status'))
				.then(function (r) { return r.json(); }), {});
	},

	render: function (data) {
		var d = (data && data.ok) ? data : {};

		var css = ''
			+ '.pon-guide{max-width:760px;margin:0 auto;padding:24px 16px;font-size:14px;color:#333;}'
			+ '.pon-guide h2{font-size:20px;font-weight:600;margin:0 0 6px;}'
			+ '.pon-guide .sub{color:#999;font-size:13px;margin:0 0 24px;}'
			+ '.pon-field{margin-bottom:20px;}'
			+ '.pon-field label{display:block;margin-bottom:6px;color:#4a4a4a;font-size:13px;}'
			+ '.pon-field label .req{color:#e02020;margin-right:2px;}'
			+ '.pon-field input,.pon-field select{width:100%;height:44px;border:1px solid #d9dee2;'
			+ 'border-radius:6px;padding:0 12px;font-size:14px;box-sizing:border-box;background:#fff;outline:none;}'
			+ '.pon-field input:focus,.pon-field select:focus{border-color:#0b8fa8;}'
			+ '.pon-status{background:#f4f8f9;border-radius:8px;padding:12px 16px;margin:0 0 24px;'
			+ 'color:#666;font-size:13px;line-height:1.9;}'
			+ '.pon-status b{color:#0b8fa8;font-weight:600;}'
			+ '.pon-btns{display:flex;gap:12px;margin-top:28px;}'
			+ '.pon-btn-back{height:42px;padding:0 26px;border:1px solid #d9dee2;border-radius:8px;'
			+ 'background:#fff;color:#666;font-size:14px;cursor:pointer;}'
			+ '.pon-btn-save{height:42px;padding:0 30px;border:0;border-radius:8px;'
			+ 'background:#0b8fa8;color:#fff;font-size:14px;cursor:pointer;}'
			+ '.pon-msg{min-height:18px;font-size:12px;color:#888;margin-top:10px;}';

		var style = E('style', {}, css);

		var rx = (d.rx_power != null) ? Number(d.rx_power).toFixed(1) + ' dBm' : '-';
		var status = E('div', { 'class': 'pon-status' }, [
			E('div', {}, ['活动模式：', E('b', {}, d.active_mode || '-'), '　ONU 状态：', E('b', {}, d.onu_state || '-')]),
			E('div', {}, ['光信号：', E('b', {}, d.optical ? '有' : '无'), '　接收光功率：', E('b', {}, rx), '　生命周期：', E('b', {}, d.lifecycle || '-')])
		]);

		function field(labelText, required, ctrl) {
			var lab = E('label', {}, []);
			if (required) lab.appendChild(E('span', { 'class': 'req' }, '*'));
			lab.appendChild(document.createTextNode(labelText));
			return E('div', { 'class': 'pon-field' }, [lab, ctrl]);
		}

		var modeSel = E('select', { 'class': 'pon-mode' });
		[['', '驱动默认'], ['gpon', 'GPON'], ['xgpon', 'XG-PON'], ['epon', 'EPON']].forEach(function (m) {
			var o = E('option', { value: m[0] }, m[1]);
			modeSel.appendChild(o);
		});
		modeSel.value = d.cfg_mode || '';

		var snIn = E('input', { 'class': 'pon-sn', 'type': 'text', 'placeholder': '16 位 hex 或 4 位厂商码 + 8 位 hex（留空使用板载 SN）' });
		snIn.value = d.cfg_serial || '';

		var regIn = E('input', { 'class': 'pon-reg', 'type': 'text', 'placeholder': '可选，留空按零上报' });
		regIn.value = (d.cfg_regid || '').replace(/^text:/, '');

		var msg = E('div', { 'class': 'pon-msg' }, []);

		var save = E('button', { 'class': 'pon-btn-save', 'type': 'button' }, '保存并应用');
		var back = E('button', { 'class': 'pon-btn-back', 'type': 'button' }, '返回');

		save.addEventListener('click', function () {
			save.disabled = true;
			msg.textContent = '保存中…';
			/* 与 quickstart 面板相同的保存机制：raw fetch + URLSearchParams */
			var url = L.url('admin', 'network_guide', 'pon_card_apply');
			if (L.env.token) url += '?token=' + L.env.token;
			var body = new URLSearchParams({
				mode: modeSel.value,
				serial: snIn.value.trim(),
				regid: regIn.value.trim(),
				restart: '0'
			});
			fetch(url, { method: 'POST', body: body }).then(function (r) {
				return r.json();
			}).then(function (r) {
				msg.textContent = r.ok ? '已保存。重启 PON 线路后新身份生效（网络 → PON → 状态 可查看注册进程）。'
					: '失败：' + (r.err || '未知错误');
			}).catch(function () {
				msg.textContent = '网络错误，请重试';
			}).finally(function () { save.disabled = false; });
		});
		back.addEventListener('click', function () { history.back(); });

		var page = E('div', { 'class': 'pon-guide' }, [
			E('h2', {}, 'PON 配置'),
			E('p', { 'class': 'sub' }, '配置光纤线路模式与 ONU 注册身份（SN / Registration-ID）'),
			status,
			field('线路模式', false, modeSel),
			field('序列号（SN）', false, snIn),
			field('Registration-ID', false, regIn),
			E('div', { 'class': 'pon-btns' }, [back, save]),
			msg
		]);

		return E('div', {}, [style, page]);
	}
});

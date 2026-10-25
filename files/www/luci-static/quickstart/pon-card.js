/* pon-card.js — 网络向导 PON 配置卡片 v22（2026-10-25）
 * 克隆官方卡片（scoped CSS 继承，风格零偏差），插卡片行末位，桌面 4 列。
 * 点击卡片跳转独立向导页 admin/network/pon/wizard（LuCI 原生路由，
 * 向导风格配置界面，无 quickstart 动态布局冲突）。
 * 注入式面板方案已退役（quickstart 动态布局导致跨分辨率位置漂移）。
 */
(function () {
	'use strict';
	if (window.__ponCardInjected) return;
	window.__ponCardInjected = true;

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

	function buildCard(ref) {
		var card = ref.cloneNode(true);
		card.classList.add('pon-card-item');

		var a = card.querySelector('a');
		a.href = '/cgi-bin/luci/admin/network/pon/wizard';

		var thumb = card.querySelector('.thumbnail');
		/* 官方 nth-child(9n+4) 无渐变定义（原页面仅 3 卡），补主题青渐变 */
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

	function injectCss() {
		if (document.head.querySelector('style.pon-card-css')) return;
		var st = document.createElement('style');
		st.className = 'pon-card-css';
		st.textContent = '@media (min-width:768px){.network-containers .network-container_item{'
			+ 'flex:0 0 calc(25% - 9px) !important;max-width:calc(25% - 9px) !important;}}';
		document.head.appendChild(st);
	}

	function mount() {
		var row = document.querySelector('.network-containers');
		if (!row || row.querySelector('.pon-card-item')) return false;
		var items = Array.from(row.querySelectorAll(':scope > .network-container_item'));
		var ref = items[items.length - 1];
		if (!ref) return false;
		injectCss();
		row.appendChild(buildCard(ref));
		return true;
	}

	function boot() {
		/* SPA 常驻观察：官方内页返回时 Vue 重建卡片行并销毁注入卡，
		   mount 幂等（卡在即跳过），每次 DOM 变更自动补插 */
		var mo = new MutationObserver(function () { mount(); });
		mo.observe(document.body, { childList: true, subtree: true });
		mount();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})();

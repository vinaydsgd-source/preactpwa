import { h } from 'preact';
import { useState } from 'preact/hooks';
import style from './style.css';
import useInstallPrompt from '../../hooks/useInstallPrompt';

const FEATURES = [
	{
		icon: 'fast',
		title: 'Lightning Fast',
		desc: 'Powered by Preact (3 KB) for near-instant loads, even on flaky mobile networks.',
	},
	{
		icon: 'offline',
		title: 'Works Offline',
		desc: 'A built-in service worker caches the app shell so it keeps running without a connection.',
	},
	{
		icon: 'install',
		title: 'Installable Anywhere',
		desc: 'Add it to your home screen on Android, iOS, Windows, macOS or Chrome OS in one tap.',
	},
];

const FeatureIcon = ({ name }) => {
	const common = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
	if (name === 'fast') {
		return (
			<svg {...common}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg>
		);
	}
	if (name === 'offline') {
		return (
			<svg {...common}><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
		);
	}
	return (
		<svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
	);
};

const InstallButtons = ({ size = 'lg' }) => {
	const { canInstall, isIos, isSamsungInternet, isInstalled, promptInstall } = useInstallPrompt();
	const [showHelp, setShowHelp] = useState(false);

	if (isInstalled) {
		return (
			<div class={style.installedBadge} role="status" aria-live="polite">
				App installed - launch it from your home screen
			</div>
		);
	}

	const usesManualGuide = isIos || isSamsungInternet;

	const handleInstallClick = async () => {
		if (usesManualGuide) {
			setShowHelp(true);
			return;
		}
		if (canInstall) {
			await promptInstall();
			return;
		}
		setShowHelp(true);
	};

	const label = usesManualGuide ? 'Add to Home Screen' : 'Install App';
	const btnClass = size === 'sm' ? `${style.btn} ${style.btnPrimary} ${style.btnSm}` : `${style.btn} ${style.btnPrimary}`;

	return (
		<div class={style.installWrap}>
			<button type="button" class={btnClass} onClick={handleInstallClick}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
					<polyline points="7 10 12 15 17 10"></polyline>
					<line x1="12" y1="15" x2="12" y2="3"></line>
				</svg>
				<span>{label}</span>
			</button>

			{showHelp && (
				<div class={style.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="installHelpTitle" onClick={() => setShowHelp(false)}>
					<div class={style.modalCard} onClick={(e) => e.stopPropagation()}>
						<h3 id="installHelpTitle">Install on this device</h3>
						{isIos && (
							<ol>
								<li>Tap the <strong>Share</strong> button in the Safari toolbar.</li>
								<li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
								<li>Tap <strong>Add</strong> in the top-right corner.</li>
							</ol>
						)}
						{!isIos && isSamsungInternet && (
							<ol>
								<li>Tap the <strong>menu</strong> button (<strong>≡</strong>) at the bottom-right.</li>
								<li>Choose <strong>Add page to</strong>.</li>
								<li>Tap <strong>Home screen</strong>, then <strong>Add</strong>.</li>
							</ol>
						)}
						{!isIos && !isSamsungInternet && (
							<div>
								<p>Use your browser menu to add this app to your home screen:</p>
								<ul>
									<li><strong>Chrome / Edge:</strong> menu (<strong>⋮</strong>) -> <strong>Install app</strong> or <strong>Add to home screen</strong>.</li>
									<li><strong>Firefox (Android):</strong> menu (<strong>⋮</strong>) -> <strong>Install</strong>.</li>
								</ul>
							</div>
						)}
						<button type="button" class={`${style.btn} ${style.btnGhost}`} onClick={() => setShowHelp(false)}>
							Got it
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

const Home = () => {
	const year = new Date().getFullYear();

	return (
		<div class={style.home}>
			<header class={style.nav}>
				<a class={style.brand} href="#top">
					<span class={style.logoMark} aria-hidden="true">P</span>
					<span>Preact PWA</span>
				</a>
				<nav class={style.navLinks} aria-label="Primary">
					<a href="#features">Features</a>
					<a href="#install">Install</a>
				</nav>
			</header>

			<section id="top" class={style.hero}>
				<div class={style.heroInner}>
					<span class={style.eyebrow}>Progressive Web App</span>
					<h1 class={style.heroTitle}>
						A blazing-fast app you can <span class={style.gradient}>install in one tap</span>.
					</h1>
					<p class={style.heroSubtitle}>
						Built with Preact, vanilla JavaScript, HTML and CSS. Works on Chrome,
						Samsung Internet, Firefox and iOS Safari - online or off.
					</p>
					<div class={style.ctaRow}>
						<InstallButtons />
						<a href="#features" class={`${style.btn} ${style.btnGhost}`}>Learn More</a>
					</div>
					<ul class={style.platformChips} aria-label="Supported platforms">
						<li>Chrome</li>
						<li>Samsung Internet</li>
						<li>Firefox (Android)</li>
						<li>iOS Safari</li>
					</ul>
				</div>
			</section>

			<section id="features" class={style.features}>
				<div class={style.sectionHead}>
					<h2>Why this app?</h2>
					<p>Three things every modern web app should get right.</p>
				</div>
				<div class={style.featureGrid}>
					{FEATURES.map((f) => (
						<article class={style.featureCard} key={f.title}>
							<div class={style.featureIcon}><FeatureIcon name={f.icon} /></div>
							<h3>{f.title}</h3>
							<p>{f.desc}</p>
						</article>
					))}
				</div>
			</section>

			<section id="install" class={style.installSection}>
				<div class={style.installCard}>
					<h2>Ready to install?</h2>
					<p>
						Tap the button below. On Chrome, Edge and Samsung Internet you'll get a native install prompt.
						On iOS Safari you'll see a quick guide for the Share menu.
					</p>
					<InstallButtons />
				</div>
			</section>

			<footer class={style.footer}>
				<p>&copy; {year} Preact PWA. Built with Preact + Preact CLI.</p>
				<p class={style.footerNote}>
					Note: Firefox on the desktop does not currently support installing PWAs - that's a browser limitation.
				</p>
			</footer>
		</div>
	);
};

export default Home;
